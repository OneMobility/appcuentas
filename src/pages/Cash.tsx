"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, ChevronLeft, ChevronRight, Trash2, Edit, Search, Filter, FileDown, FileText, Scale } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { exportToCsv, exportToPdf } from "@/utils/export";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import CashReconciliationDialog from "@/components/CashReconciliationDialog";

const Cash = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();
  
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "ingreso" | "egreso">("all");
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReconcileDialogOpen, setIsReconcileDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  const [transactionForm, setTransactionForm] = useState({
    type: "ingreso" as "ingreso" | "egreso",
    amount: "",
    description: "",
    selectedCategoryId: "",
  });

  const fetchTransactions = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('cash_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) showError('Error al cargar transacciones');
    else {
      setTransactions(data || []);
      setBalance((data || []).reduce((sum, tx) => tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount, 0));
    }
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchTransactions();
  }, [user, isLoadingCategories]);

  const filteredTransactions = useMemo(() => {
    const start = startOfMonth(currentViewDate);
    const end = endOfMonth(currentViewDate);
    return transactions.filter(tx => {
      const txDate = parseISO(tx.date);
      const matchesDate = isWithinInterval(txDate, { start, end });
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || tx.type === filterType;
      return matchesDate && matchesSearch && matchesType;
    });
  }, [transactions, currentViewDate, searchTerm, filterType]);

  const handleOpenAdd = () => {
    setTransactionForm({ type: "ingreso", amount: "", description: "", selectedCategoryId: "" });
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (tx: any) => {
    setEditingTransaction(tx);
    setTransactionForm({
      type: tx.type,
      amount: tx.amount.toString(),
      description: tx.description,
      selectedCategoryId: tx.income_category_id || tx.expense_category_id || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = evaluateExpression(transactionForm.amount) || 0;
    if (amount <= 0) { showError("Monto inválido"); return; }

    const data = {
      user_id: user.id,
      type: transactionForm.type,
      amount,
      description: transactionForm.description,
      date: editingTransaction ? editingTransaction.date : getLocalDateString(new Date()),
      income_category_id: transactionForm.type === "ingreso" ? transactionForm.selectedCategoryId : null,
      expense_category_id: transactionForm.type === "egreso" ? transactionForm.selectedCategoryId : null,
    };

    let error;
    if (editingTransaction) {
      const { error: updateError } = await supabase.from('cash_transactions').update(data).eq('id', editingTransaction.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('cash_transactions').insert(data);
      error = insertError;
    }

    if (error) showError("Error al guardar");
    else {
      showSuccess(editingTransaction ? "Transacción actualizada" : "Transacción registrada");
      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      fetchTransactions();
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase.from('cash_transactions').delete().eq('id', id);
    if (error) showError("Error al eliminar");
    else {
      showSuccess("Movimiento eliminado");
      fetchTransactions();
    }
  };

  const handleExport = (formatType: 'csv' | 'pdf') => {
    const data = filteredTransactions.map(tx => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Descripción: tx.description,
      Categoría: getCategoryById(tx.income_category_id || tx.expense_category_id)?.name || "N/A",
      Tipo: tx.type === "ingreso" ? "Ingreso" : "Egreso",
      Monto: tx.amount.toFixed(2)
    }));

    const filename = `efectivo_${format(currentViewDate, "yyyyMM")}`;
    if (formatType === 'csv') exportToCsv(`${filename}.csv`, data);
    else exportToPdf(`${filename}.pdf`, `Reporte Efectivo - ${format(currentViewDate, "MMMM yyyy", { locale: es })}`, ["Fecha", "Descripción", "Categoría", "Tipo", "Monto"], data.map(d => Object.values(d)));
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Lo que tienes (Efectivo)</h1>

      <Card className="border-l-4 border-primary bg-primary/10">
        <CardHeader><CardTitle>Saldo Actual</CardTitle></CardHeader>
        <CardContent><div className="text-4xl font-bold">${balance.toFixed(2)}</div></CardContent>
      </Card>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full md:max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar descripción..." className="pl-8 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-full sm:w-[140px] h-9">
              <Filter className="mr-2 h-3 w-3" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ingreso">Ingresos</SelectItem>
              <SelectItem value="egreso">Egresos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setIsReconcileDialogOpen(true)} title="Cuadrar Saldo"><Scale className="h-4 w-4" /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" title="Exportar"><FileDown className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}><FileText className="mr-2 h-4 w-4" /> CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}><FileText className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-9 gap-1" onClick={handleOpenAdd}><PlusCircle className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Movimientos</CardTitle>
          <div className="flex items-center bg-muted rounded-lg p-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-3 text-sm font-medium min-w-[120px] text-center capitalize">{format(currentViewDate, "MMMM yyyy", { locale: es })}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay movimientos.</TableCell></TableRow>
              ) : (
                filteredTransactions.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell>{format(parseISO(tx.date), "dd/MM")}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{tx.description}</span>
                        <span className="text-xs text-muted-foreground">{getCategoryById(tx.income_category_id || tx.expense_category_id)?.name || "Sin categoría"}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right font-bold", tx.type === "egreso" ? "text-red-600" : "text-green-600")}>
                      {tx.type === "egreso" ? "-" : "+"}${tx.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(tx)}><Edit className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                            <AlertDialogDescription>Se ajustará el saldo automáticamente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTransaction(tx.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CashReconciliationDialog
        isOpen={isReconcileDialogOpen}
        onClose={() => setIsReconcileDialogOpen(false)}
        appBalance={balance}
        transactionCount={transactions.length}
        onReconciliationSuccess={fetchTransactions}
        onNoAdjustmentSuccess={() => showSuccess("El saldo ya está cuadrado.")}
      />

      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => { if(!open) { setIsAddDialogOpen(false); setIsEditDialogOpen(false); setEditingTransaction(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTransaction ? "Editar Transacción" : "Registrar Transacción"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={transactionForm.type} onValueChange={(v: any) => setTransactionForm({...transactionForm, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Monto</Label>
              <Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select value={transactionForm.selectedCategoryId} onValueChange={(v) => setTransactionForm({...transactionForm, selectedCategoryId: v})}>
                <SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                <SelectContent>
                  {(transactionForm.type === "ingreso" ? incomeCategories : expenseCategories).map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cash;
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, ChevronLeft, ChevronRight, Trash2, Edit, Search, Filter, FileDown, ArrowRightLeft, Image as ImageIcon, Coins } from "lucide-react";
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
import CashReconciliationDialog from "@/components/CashReconciliationDialog";
import CardTransferDialog from "@/components/CardTransferDialog";
import ImageUpload from "@/components/ImageUpload";
import { fetchUsdToMxnRate } from "@/utils/currency-helper";

const Cash = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();
  
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "ingreso" | "egreso">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReconcileDialogOpen, setIsReconcileDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  // Monedas y conversión
  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");
  const [usdToMxnRate, setUsdToMxnRate] = useState<number>(20.00);

  const [transactionForm, setTransactionForm] = useState({
    type: "ingreso" as "ingreso" | "egreso",
    amount: "",
    description: "",
    selectedCategoryId: "",
    imageUrl: "",
  });

  // Cargar tasa de cambio al abrir
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const rate = await fetchUsdToMxnRate();
        setUsdToMxnRate(rate);
      } catch (e) {
        console.error("No se pudo obtener la tasa en efectivo:", e);
      }
    };
    fetchRate();
  }, [isAddDialogOpen, isEditDialogOpen]);

  const fetchData = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('cash_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      showError('Error al cargar transacciones: ' + error.message);
    } else {
      let current = 0;
      const computed = (data || []).map(tx => {
        current = tx.type === "ingreso" ? current + tx.amount : current - tx.amount;
        return { ...tx, runningBalance: current };
      });
      setTransactions([...computed].reverse());
      setBalance(current);
    }

    const { data: cardsData } = await supabase.from('cards').select('*').eq('user_id', user.id);
    setCards(cardsData || []);
  };

  useEffect(() => {
    if (user && !isLoadingCategories) fetchData();
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
    setCurrency("MXN");
    setTransactionForm({
      type: "egreso",
      amount: "",
      description: "",
      selectedCategoryId: "",
      imageUrl: "",
    });
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (tx: any) => {
    setCurrency("MXN");
    setEditingTransaction(tx);
    setTransactionForm({
      type: tx.type,
      amount: tx.amount.toString(),
      description: tx.description,
      selectedCategoryId: tx.income_category_id || tx.expense_category_id || "",
      imageUrl: tx.image_url || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let baseAmount: number;
    if (transactionForm.amount.startsWith('=')) {
      baseAmount = evaluateExpression(transactionForm.amount.substring(1)) || 0;
    } else {
      baseAmount = parseFloat(transactionForm.amount);
    }

    if (isNaN(baseAmount) || baseAmount <= 0) {
      showError("Monto inválido");
      return;
    }

    // Convertir de USD a MXN si es necesario
    let finalAmount = baseAmount;
    let finalDescription = transactionForm.description;
    if (currency === "USD") {
      finalAmount = baseAmount * usdToMxnRate;
      finalDescription += ` (Reg: $${baseAmount.toFixed(2)} USD a tasa $${usdToMxnRate.toFixed(2)} MXN)`;
    }

    setIsSubmitting(true);
    const txData = {
      user_id: user.id,
      type: transactionForm.type,
      amount: finalAmount,
      description: finalDescription,
      date: editingTransaction ? editingTransaction.date : getLocalDateString(new Date()),
      income_category_id: transactionForm.type === "ingreso" ? transactionForm.selectedCategoryId : null,
      expense_category_id: transactionForm.type === "egreso" ? transactionForm.selectedCategoryId : null,
      image_url: transactionForm.imageUrl,
    };

    try {
      let error;
      if (editingTransaction) {
        const { error: updateError } = await supabase
          .from('cash_transactions')
          .update(txData)
          .eq('id', editingTransaction.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('cash_transactions')
          .insert(txData);
        error = insertError;
      }

      if (error) throw error;

      showSuccess(editingTransaction ? "Movimiento actualizado" : "Movimiento registrado");
      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      fetchData();
    } catch (err: any) {
      showError("Error al guardar: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (tx: any) => {
    try {
      const { error } = await supabase.from('cash_transactions').delete().eq('id', tx.id);
      if (error) throw error;
      showSuccess("Movimiento eliminado");
      fetchData();
    } catch (err: any) {
      showError("Error al eliminar: " + err.message);
    }
  };

  const handleExport = (formatType: 'csv' | 'pdf') => {
    const data = filteredTransactions.map(tx => ({
      Fecha: format(parseISO(tx.date), "dd/MM/yyyy"),
      Descripción: tx.description,
      Categoría: getCategoryById(tx.income_category_id || tx.expense_category_id)?.name || "N/A",
      Tipo: tx.type === "ingreso" ? "Ingreso" : "Egreso",
      Monto: tx.amount.toFixed(2),
      Saldo: tx.runningBalance.toFixed(2)
    }));

    const filename = `efectivo_${format(currentViewDate, "yyyyMM")}`;
    if (formatType === 'csv') {
      exportToCsv(`${filename}.csv`, data);
      showSuccess("Exportado a CSV");
    } else {
      exportToPdf(`${filename}.pdf`, `Reporte Efectivo - ${format(currentViewDate, "MMMM yyyy", { locale: es })}`, ["Fecha", "Descripción", "Categoría", "Tipo", "Monto", "Saldo"], data.map(d => Object.values(d)));
      showSuccess("Exportado a PDF");
    }
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6 p-1 md:p-4">
      <h1 className="text-2xl md:text-3xl font-bold">Lo que tienes (Efectivo)</h1>

      <Card className="border-l-4 border-primary bg-primary/10 shadow-sm">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-medium opacity-70">Saldo Actual</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0"><div className="text-3xl md:text-4xl font-bold">${balance.toFixed(2)}</div></CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-8 h-10 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-full sm:w-[140px] h-10 rounded-xl">
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="ingreso">Ingresos</SelectItem><SelectItem value="egreso">Egresos</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setIsTransferDialogOpen(true)} title="Transferir"><ArrowRightLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setIsReconcileDialogOpen(true)} title="Cuadrar"><Scale className="h-4 w-4" /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-10 w-10 rounded-xl"><FileDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem><DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-10 gap-1.5 rounded-xl flex-1 font-bold" onClick={handleOpenAdd}><PlusCircle className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="flex items-center justify-between p-4 bg-muted/20">
          <CardTitle className="text-sm font-bold">Movimientos</CardTitle>
          <div className="flex items-center bg-background rounded-lg p-0.5 border">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-2 text-[10px] font-bold min-w-[80px] text-center capitalize">{format(currentViewDate, "MMM yyyy", { locale: es })}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-hide">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 text-[10px]">Fecha</TableHead>
                  <TableHead className="text-[10px]">Descripción</TableHead>
                  <TableHead className="text-right text-[10px]">Monto</TableHead>
                  <TableHead className="text-right pr-4 text-[10px]">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">Sin movimientos este mes.</TableCell></TableRow>
                ) : (
                  filteredTransactions.map(tx => {
                    const category = getCategoryById(tx.income_category_id || tx.expense_category_id);
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="pl-4 text-[10px] font-medium">{format(parseISO(tx.date), "dd/MM")}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs truncate max-w-[100px]">{tx.description}</span>
                            <span className="text-[9px] text-muted-foreground">{category?.name || "Sin cat."}</span>
                          </div>
                        </TableCell>
                        <TableCell className={cn("text-right font-bold text-xs", tx.type === "egreso" ? "text-red-600" : "text-green-600")}>
                          {tx.type === "egreso" ? "-" : "+"}${tx.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right pr-4 flex gap-1 justify-end">
                          {tx.image_url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(tx.image_url, '_blank')} title="Ver ticket">
                              <ImageIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(tx)}><Edit className="h-3.5 w-3.5" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="w-[90vw] rounded-2xl">
                              <AlertDialogHeader><AlertDialogTitle>¿Eliminar?</AlertDialogTitle><AlertDialogDescription>Se ajustará el saldo.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel className="rounded-xl">No</AlertDialogCancel><AlertDialogAction className="rounded-xl" onClick={() => handleDeleteTransaction(tx)}>Sí</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogos de Transacción */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => { if(!open) { setIsAddDialogOpen(false); setIsEditDialogOpen(false); setEditingTransaction(null); } }}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-3xl p-6">
          <DialogHeader><DialogTitle>{editingTransaction ? "Editar Movimiento" : "Nuevo Movimiento"}</DialogTitle></DialogHeader>
          <form onSubmit={handleTransactionSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={transactionForm.type} onValueChange={(v: any) => setTransactionForm({...transactionForm, type: v})}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ingreso">Ingreso</SelectItem><SelectItem value="egreso">Egreso</SelectItem></SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label>Monto</Label>
                <div className="flex bg-muted p-0.5 rounded-lg text-xs gap-1">
                  <button type="button" onClick={() => setCurrency("MXN")} className={cn("px-2 py-1 rounded-md font-bold transition-all", currency === "MXN" ? "bg-white text-indigo-900 shadow-sm" : "text-muted-foreground")}>MXN</button>
                  <button type="button" onClick={() => setCurrency("USD")} className={cn("px-2 py-1 rounded-md font-bold transition-all", currency === "USD" ? "bg-white text-indigo-900 shadow-sm" : "text-muted-foreground")}>USD</button>
                </div>
              </div>
              <div className="relative">
                <Input value={transactionForm.amount} onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} className="rounded-xl h-10 pr-12" placeholder="0.00" required />
                <span className="absolute right-3.5 top-2.5 text-xs text-muted-foreground font-black">{currency}</span>
              </div>
              {currency === "USD" && transactionForm.amount && (
                <p className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                  <Coins className="h-3 w-3 animate-pulse" /> Equivale a ~ ${(parseFloat(transactionForm.amount) * usdToMxnRate || 0).toFixed(2)} MXN (tasa: ${usdToMxnRate.toFixed(2)})
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input value={transactionForm.description} onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} className="rounded-xl h-10" placeholder="Detalle..." required />
            </div>
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select value={transactionForm.selectedCategoryId} onValueChange={(v) => setTransactionForm({...transactionForm, selectedCategoryId: v})}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {(transactionForm.type === "egreso" ? expenseCategories : incomeCategories).map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2"><DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-4 w-4" /> {cat.name}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Ticket / Imagen (Opcional)</Label>
              <ImageUpload 
                onUploadSuccess={(url) => setTransactionForm({...transactionForm, imageUrl: url})} 
                initialUrl={transactionForm.imageUrl}
                onRemove={() => setTransactionForm({...transactionForm, imageUrl: ""})}
                folder="cash_tickets"
              />
            </div>
            <DialogFooter><Button type="submit" className="w-full rounded-xl font-bold h-11" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CardTransferDialog isOpen={isTransferDialogOpen} onClose={() => setIsTransferDialogOpen(false)} cards={cards} cashBalance={balance} onTransferSuccess={fetchData} />
      <CashReconciliationDialog isOpen={isReconcileDialogOpen} onClose={() => setIsReconcileDialogOpen(false)} appBalance={balance} transactionCount={transactions.length} onReconciliationSuccess={fetchData} onNoAdjustmentSuccess={() => showSuccess("Saldo cuadrado.")} />
    </div>
  );
};

export default Cash;
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
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

const Cash = () => {
  const { user } = useSession();
  const { incomeCategories, expenseCategories, getCategoryById, isLoadingCategories } = useCategoryContext();
  
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
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
    return transactions.filter(tx => isWithinInterval(parseISO(tx.date), { start, end }));
  }, [transactions, currentViewDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = evaluateExpression(newTransaction.amount) || 0;
    if (amount <= 0) { showError("Monto inválido"); return; }

    const { error } = await supabase.from('cash_transactions').insert({
      user_id: user.id,
      type: newTransaction.type,
      amount,
      description: newTransaction.description,
      date: getLocalDateString(new Date()),
      income_category_id: newTransaction.type === "ingreso" ? newTransaction.selectedCategoryId : null,
      expense_category_id: newTransaction.type === "egreso" ? newTransaction.selectedCategoryId : null,
    });

    if (error) showError("Error al registrar");
    else {
      showSuccess("Transacción registrada");
      setIsAddDialogOpen(false);
      fetchTransactions();
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase.from('cash_transactions').delete().eq('id', id);
    if (error) {
      showError("Error al eliminar el movimiento");
    } else {
      showSuccess("Movimiento eliminado correctamente");
      fetchTransactions();
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Lo que tienes (Efectivo)</h1>

      <Card className="border-l-4 border-primary bg-primary/10">
        <CardHeader><CardTitle>Saldo Actual</CardTitle></CardHeader>
        <CardContent><div className="text-4xl font-bold">${balance.toFixed(2)}</div></CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle>Movimientos</CardTitle>
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button variant="ghost" size="icon" onClick={() => setCurrentViewDate(subMonths(currentViewDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="px-3 text-sm font-medium min-w-[120px] text-center capitalize">{format(currentViewDate, "MMMM yyyy", { locale: es })}</span>
              <Button variant="ghost" size="icon" onClick={() => setCurrentViewDate(addMonths(currentViewDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="h-4 w-4 mr-1" /> Nueva Transacción</Button>
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
              {filteredTransactions.map(tx => (
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
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. El saldo de tu efectivo se ajustará automáticamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTransaction(tx.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Transacción</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={newTransaction.type} onValueChange={(v: any) => setNewTransaction({...newTransaction, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Monto" value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} required />
            <Input placeholder="Descripción" value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} required />
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select value={newTransaction.selectedCategoryId} onValueChange={(v) => setNewTransaction({...newTransaction, selectedCategoryId: v})}>
                <SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                <SelectContent>
                  {(newTransaction.type === "ingreso" ? incomeCategories : expenseCategories).map(cat => (
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
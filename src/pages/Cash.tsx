"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, CalendarIcon, Edit, Trash2, ArrowRightLeft, Scale, ChevronLeft, ChevronRight } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { useCategoryContext } from "@/context/CategoryContext";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";

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
    date: new Date(),
    selectedCategoryId: "",
  });

  const fetchTransactions = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('cash_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) showError('Error al cargar transacciones');
    else {
      setTransactions(data || []);
      const currentBalance = (data || []).reduce((sum, tx) => tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount, 0);
      setBalance(currentBalance);
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
      return isWithinInterval(txDate, { start, end });
    });
  }, [transactions, currentViewDate]);

  const handlePrevMonth = () => setCurrentViewDate(subMonths(currentViewDate, 1));
  const handleNextMonth = () => setCurrentViewDate(addMonths(currentViewDate, 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let amount = newTransaction.amount.startsWith('=') 
      ? evaluateExpression(newTransaction.amount.substring(1)) 
      : parseFloat(newTransaction.amount);

    if (!amount || amount <= 0) { showError("Monto inválido"); return; }

    const { error } = await supabase.from('cash_transactions').insert({
      user_id: user.id,
      type: newTransaction.type,
      amount,
      description: newTransaction.description,
      date: getLocalDateString(newTransaction.date),
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
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="px-3 text-sm font-medium min-w-[120px] text-center capitalize">
                {format(currentViewDate, "MMMM yyyy", { locale: es })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-1" /> Nueva Transacción
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell>{format(parseISO(tx.date), "dd/MM")}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{tx.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {getCategoryById(tx.income_category_id || tx.expense_category_id)?.name || "Sin categoría"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className={cn("text-right font-bold", tx.type === "egreso" ? "text-red-600" : "text-green-600")}>
                    {tx.type === "egreso" ? "-" : "+"}${tx.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredTransactions.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No hay movimientos en este mes.</TableCell></TableRow>
              )}
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
            <div className="grid gap-2">
              <Label>Monto</Label>
              <Input value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} placeholder="0.00" required />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} required />
            </div>
            <DialogFooter><Button type="submit">Guardar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cash;
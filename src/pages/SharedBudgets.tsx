"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Users, CheckCircle, Trash2, Banknote, CheckCircle2, Clock, DollarSign, Edit, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCategoryContext } from "@/context/CategoryContext";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { evaluateExpression } from "@/utils/math-helpers";
import { format, parseISO, isBefore, isSameDay, addDays } from "date-fns";
import { es } from "date-fns/locale";

interface Debtor {
  id: string;
  name: string;
  current_balance: number;
}

interface Creditor {
  id: string;
  name: string;
  current_balance: number;
}

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  last_four_digits: string;
  type: "credit" | "debit";
  current_balance: number;
}

interface Participant {
  id: string;
  debtor_id: string;
  debtors: Debtor;
  share_amount: number;
  paid_amount: number;
  is_paid: boolean;
}

interface SharedBudget {
  id: string;
  name: string;
  total_amount: number;
  split_type: string;
  description: string;
  budget_participants: Participant[];
  creditor_id?: string | null;
  due_date?: string | null;
}

const SharedBudgets = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const { incomeCategories } = useCategoryContext();
  const [budgets, setBudgets] = useState<SharedBudget[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [skipLinkedTransaction, setSkipLinkedTransaction] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<{
    participantId: string;
    budgetId: string;
    debtorId: string;
    debtorName: string;
    remaining: number;
    budgetName: string;
  } | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    destinationId: "cash",
    categoryId: "",
  });

  const fetchAllData = async () => {
    if (!user) return;

    const [debtorsRes, creditorsRes, cardsRes, cashRes] = await Promise.all([
      supabase.from('debtors').select('id, name, current_balance').eq('user_id', user.id),
      supabase.from('creditors').select('id, name, current_balance').eq('user_id', user.id),
      supabase.from('cards').select('id, name, bank_name, last_four_digits, type, current_balance').eq('user_id', user.id),
      supabase.from('cash_transactions').select('type, amount').eq('user_id', user.id)
    ]);

    setDebtors(debtorsRes.data || []);
    setCreditors(creditorsRes.data || []);
    setCards(cardsRes.data || []);
    
    const currentCash = (cashRes.data || []).reduce((sum, tx) => 
      tx.type === "ingreso" ? sum + tx.amount : sum - tx.amount, 0
    );
    setCashBalance(currentCash);

    const { data: budgetsData, error: budgetsError } = await supabase
      .from('shared_budgets')
      .select('*, budget_participants(id, debtor_id, share_amount, paid_amount, is_paid, debtors(id, name, current_balance))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (budgetsError) {
      showError('Error al cargar presupuestos: ' + budgetsError.message);
    } else {
      setBudgets(budgetsData || []);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [user]);

  const handleOpenPaymentDialog = (p: Participant, budget: SharedBudget) => {
    const remaining = p.share_amount - (p.paid_amount || 0);
    setSelectedParticipant({
      participantId: p.id,
      budgetId: budget.id,
      debtorId: p.debtor_id,
      debtorName: p.debtors?.name || "Deudor",
      remaining,
      budgetName: budget.name
    });
    setPaymentForm({
      amount: remaining.toString(),
      destinationId: "cash",
      categoryId: incomeCategories[0]?.id || "",
    });
    setSkipLinkedTransaction(false);
    setIsPaymentDialogOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedParticipant || isProcessing) return;

    let amount: number;
    if (paymentForm.amount.startsWith('=')) {
      amount = evaluateExpression(paymentForm.amount.substring(1)) || 0;
    } else {
      amount = parseFloat(paymentForm.amount);
    }

    if (isNaN(amount) || amount <= 0) {
      showError("Monto inválido.");
      return;
    }

    setIsProcessing(true);
    const transactionDate = new Date().toISOString().split('T')[0];

    try {
      const budget = budgets.find(b => b.id === selectedParticipant.budgetId);
      const participant = budget?.budget_participants.find(p => p.id === selectedParticipant.participantId);
      const newPaidAmount = (participant?.paid_amount || 0) + amount;
      const isFullyPaid = newPaidAmount >= (participant?.share_amount || 0) - 0.01;

      await supabase.from('budget_participants').update({ paid_amount: newPaidAmount, is_paid: isFullyPaid }).eq('id', selectedParticipant.participantId);

      const debtor = debtors.find(d => d.id === selectedParticipant.debtorId);
      if (debtor) {
        await supabase.from('debtors').update({ current_balance: debtor.current_balance - amount }).eq('id', debtor.id);
        await supabase.from('debtor_transactions').insert({
          user_id: user.id, debtor_id: debtor.id, type: "payment", amount,
          description: `Abono: ${selectedParticipant.budgetName}`, date: transactionDate,
        });
      }

      if (!skipLinkedTransaction) {
        if (paymentForm.destinationId === "cash") {
          await supabase.from('cash_transactions').insert({ user_id: user.id, type: "ingreso", amount, description: `Abono ${selectedParticipant.debtorName} (${selectedParticipant.budgetName})`, date: transactionDate, income_category_id: paymentForm.categoryId || null });
        } else {
          const card = cards.find(c => c.id === paymentForm.destinationId);
          if (card) {
            const newCardBalance = card.type === "credit" ? card.current_balance - amount : card.current_balance + amount;
            await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', card.id);
            await supabase.from('card_transactions').insert({ user_id: user.id, card_id: card.id, type: "payment", amount, description: `Abono ${selectedParticipant.debtorName}`, date: transactionDate, income_category_id: paymentForm.categoryId || null });
          }
        }
      }

      showSuccess("Abono registrado.");
      setIsPaymentDialogOpen(false);
      fetchAllData();
    } catch (error: any) {
      showError('Error: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkAllPaid = async (budget: SharedBudget) => {
    if (!user || isProcessing) return;
    setIsProcessing(true);
    try {
      for (const p of budget.budget_participants.filter(p => !p.is_paid)) {
        const remaining = p.share_amount - (p.paid_amount || 0);
        await supabase.from('budget_participants').update({ paid_amount: p.share_amount, is_paid: true }).eq('id', p.id);
        const debtor = debtors.find(d => d.id === p.debtor_id);
        if (debtor) {
          await supabase.from('debtors').update({ current_balance: debtor.current_balance - remaining }).eq('id', debtor.id);
          await supabase.from('debtor_transactions').insert({ user_id: user.id, debtor_id: debtor.id, type: "payment", amount: remaining, description: `Liquidación: ${budget.name}`, date: getLocalDateString(new Date()) });
        }
      }
      showSuccess("Presupuesto liquidado.");
      fetchAllData();
    } catch (error: any) {
      showError('Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      const b = budgets.find(x => x.id === budgetId);
      if (!b) return;
      for (const p of b.budget_participants) {
        if (!p.is_paid) {
          const rem = p.share_amount - (p.paid_amount || 0);
          const d = debtors.find(x => x.id === p.debtor_id);
          if (d) await supabase.from('debtors').update({ current_balance: d.current_balance - rem }).eq('id', d.id);
        }
      }
      if (b.creditor_id) {
        const c = creditors.find(x => x.id === b.creditor_id);
        if (c) await supabase.from('creditors').update({ current_balance: c.current_balance - b.total_amount }).eq('id', c.id);
      }
      await supabase.from('shared_budgets').delete().eq('id', budgetId);
      showSuccess("Presupuesto eliminado.");
      fetchAllData();
    } catch (e) {}
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Presupuestos Compartidos</h1>

      <Card className="border-l-4 border-indigo-500 bg-indigo-50 text-indigo-800">
        <CardHeader><CardTitle>Total Compartido</CardTitle></CardHeader>
        <CardContent><div className="text-4xl font-bold">${budgets.reduce((s, b) => s + b.total_amount, 0).toFixed(2)}</div></CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mis Presupuestos</CardTitle>
          <Button size="sm" onClick={() => navigate('/shared-budgets/create')}><PlusCircle className="h-4 w-4 mr-1" /> Nuevo</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Acreedor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((budget) => {
                  const isFullyPaid = budget.budget_participants.every(p => p.is_paid);
                  const creditor = creditors.find(c => c.id === budget.creditor_id);
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  const isOverdue = !isFullyPaid && budget.due_date && isBefore(parseISO(budget.due_date), today);
                  const isDueSoon = !isFullyPaid && budget.due_date && (isSameDay(parseISO(budget.due_date), today) || isSameDay(parseISO(budget.due_date), addDays(today, 2)));

                  return (
                    <TableRow key={budget.id} className={cn(isFullyPaid && "bg-green-50/30")}>
                      <TableCell className="font-medium">{budget.name}</TableCell>
                      <TableCell>
                        {budget.due_date ? (
                          <div className={cn("flex items-center gap-1 text-xs", isOverdue ? "text-red-600 font-bold" : isDueSoon ? "text-orange-600" : "")}>
                            <CalendarIcon className="h-3 w-3" />
                            {format(parseISO(budget.due_date), "dd/MM/yy")}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(isFullyPaid ? "bg-green-100 text-green-800" : isOverdue ? "bg-red-100 text-red-800 animate-pulse" : "bg-yellow-100 text-yellow-800")}>
                          {isFullyPaid ? "Pagado" : isOverdue ? "Vencido" : "Pendiente"}
                        </Badge>
                      </TableCell>
                      <TableCell>${budget.total_amount.toFixed(2)}</TableCell>
                      <TableCell>{creditor ? creditor.name : (budget.creditor_id ? 'Eliminado' : 'Yo')}</TableCell>
                      <TableCell className="text-right flex gap-2 justify-end">
                        <Dialog>
                          <DialogTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-1"><Users className="h-3.5 w-3.5" /> Pagos</Button></DialogTrigger>
                          <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                              <DialogTitle className="flex justify-between items-center">
                                Pagos: {budget.name}
                                {!isFullyPaid && <Button variant="outline" size="sm" onClick={() => handleMarkAllPaid(budget)}>Liquidar Todo</Button>}
                              </DialogTitle>
                            </DialogHeader>
                            <Table>
                              <TableHeader><TableRow><TableHead>Deudor</TableHead><TableHead>Saldo</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                              <TableBody>
                                {budget.budget_participants.map(p => (
                                  <TableRow key={p.id}>
                                    <TableCell>{p.debtors?.name || 'Eliminado'}</TableCell>
                                    <TableCell>${(p.share_amount - (p.paid_amount || 0)).toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                      {p.is_paid ? <Badge className="bg-green-100 text-green-800">OK</Badge> : <Button size="sm" onClick={() => handleOpenPaymentDialog(p, budget)}>Abonar</Button>}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </DialogContent>
                        </Dialog>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/shared-budgets/edit/${budget.id}`)}><Edit className="h-3.5 w-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" className="h-8 w-8 p-0"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar?</AlertDialogTitle><AlertDialogDescription>Se revertirán deudas y cargos.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>No</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBudget(budget.id)}>Sí</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abono: {selectedParticipant?.debtorName}</DialogTitle></DialogHeader>
          <form onSubmit={handleRecordPayment} className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Monto</Label><Input value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required /></div>
            <div className="flex items-center space-x-2 bg-blue-50 p-2 rounded border border-blue-100">
              <Checkbox id="skip" checked={skipLinkedTransaction} onCheckedChange={(v) => setSkipLinkedTransaction(!!v)} />
              <Label htmlFor="skip" className="text-xs">Ya registrado manualmente</Label>
            </div>
            {!skipLinkedTransaction && (
              <div className="grid gap-4">
                <div className="grid gap-2"><Label>Destino</Label><Select value={paymentForm.destinationId} onValueChange={(v) => setPaymentForm({...paymentForm, destinationId: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Efectivo</SelectItem>{cards.filter(c => c.type === "debit").map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2"><Label>Categoría</Label><Select value={paymentForm.categoryId} onValueChange={(v) => setPaymentForm({...paymentForm, categoryId: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{incomeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
            )}
            <DialogFooter><Button type="submit">Confirmar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SharedBudgets;
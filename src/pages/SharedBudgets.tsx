"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Users, CheckCircle, Trash2, Banknote, CheckCircle2, Clock, DollarSign } from "lucide-react";
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
import { useCategoryContext } from "@/context/CategoryContext";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { evaluateExpression } from "@/utils/math-helpers";

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
  paid_amount: number; // Nueva columna
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

  // Estado para el diálogo de abono
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
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

    // Fetch Debtors, Creditors, Cards, Cash
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

    // Fetch Budgets
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

    if (amount > selectedParticipant.remaining + 0.01) {
      showError("El abono no puede ser mayor a la deuda pendiente del presupuesto.");
      return;
    }

    setIsProcessing(true);
    const transactionDate = new Date().toISOString().split('T')[0];

    try {
      // 1. Actualizar participante (paid_amount e is_paid)
      const newPaidAmount = (budgets.find(b => b.id === selectedParticipant.budgetId)
        ?.budget_participants.find(p => p.id === selectedParticipant.participantId)
        ?.paid_amount || 0) + amount;
      
      const isFullyPaid = newPaidAmount >= selectedParticipant.remaining + (newPaidAmount - amount) - 0.01;

      const { error: partError } = await supabase
        .from('budget_participants')
        .update({ 
          paid_amount: newPaidAmount,
          is_paid: isFullyPaid 
        })
        .eq('id', selectedParticipant.participantId);
      if (partError) throw partError;

      // 2. Actualizar saldo del deudor
      const debtor = debtors.find(d => d.id === selectedParticipant.debtorId);
      if (debtor) {
        const { error: debtorError } = await supabase
          .from('debtors')
          .update({ current_balance: debtor.current_balance - amount })
          .eq('id', debtor.id);
        if (debtorError) throw debtorError;

        await supabase.from('debtor_transactions').insert({
          user_id: user.id,
          debtor_id: debtor.id,
          type: "payment",
          amount,
          description: `Abono por Presupuesto: ${selectedParticipant.budgetName}`,
          date: transactionDate,
        });
      }

      // 3. Registrar ingreso en Efectivo o Tarjeta
      if (paymentForm.destinationId === "cash") {
        await supabase.from('cash_transactions').insert({
          user_id: user.id,
          type: "ingreso",
          amount,
          description: `Abono de ${selectedParticipant.debtorName} (${selectedParticipant.budgetName})`,
          date: transactionDate,
          income_category_id: paymentForm.categoryId || null,
        });
      } else {
        const card = cards.find(c => c.id === paymentForm.destinationId);
        if (card) {
          const newCardBalance = card.type === "credit" 
            ? card.current_balance - amount 
            : card.current_balance + amount;

          await supabase.from('cards').update({ current_balance: newCardBalance }).eq('id', card.id);
          await supabase.from('card_transactions').insert({
            user_id: user.id,
            card_id: card.id,
            type: "payment",
            amount,
            description: `Abono de ${selectedParticipant.debtorName} (${selectedParticipant.budgetName})`,
            date: transactionDate,
            income_category_id: paymentForm.categoryId || null,
          });
        }
      }

      showSuccess("Abono registrado correctamente.");
      setIsPaymentDialogOpen(false);
      fetchAllData();
    } catch (error: any) {
      showError('Error al registrar abono: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkAllPaid = async (budget: SharedBudget) => {
    if (!user || isProcessing) return;
    
    const pendingParticipants = budget.budget_participants.filter(p => !p.is_paid);
    if (pendingParticipants.length === 0) return;

    // Para el cierre masivo, usaremos efectivo por defecto y la primera categoría de ingresos
    setIsProcessing(true);
    try {
      for (const p of pendingParticipants) {
        const remaining = p.share_amount - (p.paid_amount || 0);
        // Reutilizamos la lógica pero de forma simplificada para el bucle
        await supabase.from('budget_participants').update({ paid_amount: p.share_amount, is_paid: true }).eq('id', p.id);
        
        const debtor = debtors.find(d => d.id === p.debtor_id);
        if (debtor) {
          await supabase.from('debtors').update({ current_balance: debtor.current_balance - remaining }).eq('id', debtor.id);
          await supabase.from('debtor_transactions').insert({
            user_id: user.id, debtor_id: debtor.id, type: "payment", amount: remaining,
            description: `Pago total: ${budget.name}`, date: new Date().toISOString().split('T')[0]
          });
        }

        await supabase.from('cash_transactions').insert({
          user_id: user.id, type: "ingreso", amount: remaining,
          description: `Pago total de ${p.debtors?.name} (${budget.name})`,
          date: new Date().toISOString().split('T')[0],
          income_category_id: incomeCategories[0]?.id || null
        });
      }
      showSuccess(`Presupuesto "${budget.name}" liquidado por completo.`);
      fetchAllData();
    } catch (error: any) {
      showError('Error al procesar pagos: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBudget = async (budgetId: string, budgetName: string) => {
    if (!user) return;

    try {
      const budgetToDelete = budgets.find(b => b.id === budgetId);
      if (!budgetToDelete) return;

      // Revertir deudas pendientes
      for (const participant of budgetToDelete.budget_participants) {
        if (!participant.is_paid) {
          const remaining = participant.share_amount - (participant.paid_amount || 0);
          const debtor = debtors.find(d => d.id === participant.debtor_id);
          if (debtor) {
            await supabase.from('debtors').update({ current_balance: debtor.current_balance - remaining }).eq('id', debtor.id);
          }
        }
      }

      // Revertir cargo al acreedor
      if (budgetToDelete.creditor_id) {
        const creditor = creditors.find(c => c.id === budgetToDelete.creditor_id);
        if (creditor) {
          await supabase.from('creditors').update({ current_balance: creditor.current_balance - budgetToDelete.total_amount }).eq('id', creditor.id);
        }
      }

      await supabase.from('shared_budgets').delete().eq('id', budgetId);
      showSuccess(`Presupuesto ${budgetName} eliminado.`);
      fetchAllData();
    } catch (error: any) {
      showError('Error al eliminar presupuesto: ' + error.message);
    }
  };

  const totalSharedAmount = budgets.reduce((sum, budget) => sum + budget.total_amount, 0);

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Presupuestos Compartidos</h1>

      <Card className="border-l-4 border-indigo-500 bg-indigo-50 text-indigo-800">
        <CardHeader>
          <CardTitle>Monto Total Compartido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">${totalSharedAmount.toFixed(2)}</div>
          <p className="text-xs text-indigo-700">Monto total de gastos registrados para dividir.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mis Presupuestos</CardTitle>
          <Button size="sm" className="h-8 gap-1" onClick={() => navigate('/shared-budgets/create')}>
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Nuevo Presupuesto
            </span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Monto Total</TableHead>
                  <TableHead>Acreedor</TableHead>
                  <TableHead>Deuda Pendiente</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((budget) => {
                  const pendingParticipants = budget.budget_participants.filter(p => !p.is_paid);
                  const totalPendingDebt = budget.budget_participants.reduce((sum, p) => 
                    sum + (p.share_amount - (p.paid_amount || 0)), 0
                  );
                  const creditor = budget.creditor_id ? creditors.find(c => c.id === budget.creditor_id) : null;
                  const creditorName = creditor ? creditor.name : (budget.creditor_id ? 'Acreedor eliminado' : 'Yo');
                  const isFullyPaid = pendingParticipants.length === 0;
                  
                  return (
                    <TableRow key={budget.id} className={cn(isFullyPaid && "bg-green-50/30")}>
                      <TableCell className="font-medium">{budget.name}</TableCell>
                      <TableCell>
                        {isFullyPaid ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Completado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1">
                            <Clock className="h-3 w-3" /> Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>${budget.total_amount.toFixed(2)}</TableCell>
                      <TableCell>{creditorName}</TableCell>
                      <TableCell className={cn(totalPendingDebt > 0 ? "text-red-600 font-semibold" : "text-green-600")}>
                        ${totalPendingDebt.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right flex gap-2 justify-end">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1">
                              <Users className="h-3.5 w-3.5" />
                              Pagos
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                              <DialogTitle className="flex items-center justify-between pr-6">
                                Pagos de {budget.name}
                                {!isFullyPaid && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-xs h-7 gap-1 border-green-600 text-green-600 hover:bg-green-50"
                                    onClick={() => handleMarkAllPaid(budget)}
                                    disabled={isProcessing}
                                  >
                                    <CheckCircle className="h-3 w-3" /> Liquidar Todo
                                  </Button>
                                )}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="py-4 overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Deudor</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Pagado</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {budget.budget_participants.map(p => (
                                    <TableRow key={p.id}>
                                      <TableCell>{p.debtors?.name || 'Deudor eliminado'}</TableCell>
                                      <TableCell>${p.share_amount.toFixed(2)}</TableCell>
                                      <TableCell>${(p.paid_amount || 0).toFixed(2)}</TableCell>
                                      <TableCell className="text-right">
                                        {p.is_paid ? (
                                          <span className="text-green-600 flex items-center justify-end gap-1 font-medium">
                                            <CheckCircle className="h-4 w-4" /> Pagado
                                          </span>
                                        ) : (
                                          <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            className="h-7 text-xs"
                                            onClick={() => handleOpenPaymentDialog(p, budget)}
                                            disabled={isProcessing}
                                          >
                                            Abonar
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <DialogFooter>
                              <DialogTrigger asChild>
                                <Button variant="ghost">Cerrar</Button>
                              </DialogTrigger>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se revertirán las deudas pendientes de los participantes y el cargo al acreedor. Los abonos ya realizados se mantendrán en tus cuentas.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteBudget(budget.id, budget.name)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
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

      {/* Diálogo para Registrar Abono */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Registrar Abono: {selectedParticipant?.debtorName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="payAmount" className="text-right">Monto</Label>
              <Input
                id="payAmount"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                className="col-span-3"
                placeholder="Ej. 50 o =100/2"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dest" className="text-right">Destino</Label>
              <Select value={paymentForm.destinationId} onValueChange={(v) => setPaymentForm({...paymentForm, destinationId: v})}>
                <SelectTrigger id="dest" className="col-span-3">
                  <SelectValue placeholder="Selecciona cuenta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo (Saldo: ${cashBalance.toFixed(2)})</SelectItem>
                  {cards.filter(c => c.type === "debit").map(card => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name} ({card.bank_name}) - ${card.current_balance.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cat" className="text-right">Categoría</Label>
              <Select value={paymentForm.categoryId} onValueChange={(v) => setPaymentForm({...paymentForm, categoryId: v})}>
                <SelectTrigger id="cat" className="col-span-3">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {incomeCategories.map(cat => (
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
            <DialogFooter>
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? "Registrando..." : "Confirmar Abono"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SharedBudgets;
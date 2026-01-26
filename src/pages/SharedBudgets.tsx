"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Users, CheckCircle, Trash2, Banknote } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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

interface Participant {
  id: string;
  debtor_id: string;
  debtors: Debtor; // Relación con la tabla debtors
  share_amount: number;
  is_paid: boolean;
}

interface SharedBudget {
  id: string;
  name: string;
  total_amount: number;
  split_type: string;
  description: string;
  budget_participants: Participant[];
  creditor_id?: string | null; // Nuevo campo
}

const SharedBudgets = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<SharedBudget[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]); // Necesario para la lógica de eliminación
  const [creditors, setCreditors] = useState<Creditor[]>([]); // Necesario para la lógica de eliminación

  const fetchBudgetsAndDebtors = async () => {
    if (!user) {
      setBudgets([]);
      setDebtors([]);
      setCreditors([]);
      return;
    }

    // Fetch Debtors (needed for deletion logic)
    const { data: debtorsData } = await supabase
      .from('debtors')
      .select('id, name, current_balance')
      .eq('user_id', user.id);
    setDebtors(debtorsData || []);

    // Fetch Creditors (needed for deletion logic)
    const { data: creditorsData } = await supabase
      .from('creditors')
      .select('id, name, current_balance')
      .eq('user_id', user.id);
    setCreditors(creditorsData || []);

    // Fetch Shared Budgets with participants
    const { data: budgetsData, error: budgetsError } = await supabase
      .from('shared_budgets')
      .select('*, budget_participants(id, debtor_id, share_amount, is_paid, debtors(id, name, current_balance))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (budgetsError) {
      showError('Error al cargar presupuestos: ' + budgetsError.message);
    } else {
      setBudgets(budgetsData || []);
    }
  };

  useEffect(() => {
    fetchBudgetsAndDebtors();
  }, [user]);

  const handleMarkPaid = async (participantId: string, budgetId: string, debtorId: string, shareAmount: number) => {
    if (!user) return;

    try {
      // 1. Mark participant as paid
      const { error: updateError } = await supabase
        .from('budget_participants')
        .update({ is_paid: true })
        .eq('id', participantId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // 2. Update Debtor balance (decrease current_balance by shareAmount)
      const debtor = debtors.find(d => d.id === debtorId);
      if (debtor) {
        const newDebtorBalance = debtor.current_balance - shareAmount;

        const { error: debtorUpdateError } = await supabase
          .from('debtors')
          .update({ current_balance: newDebtorBalance })
          .eq('id', debtorId)
          .eq('user_id', user.id);
        
        if (debtorUpdateError) throw debtorUpdateError;

        // 3. Record transaction in debtor_transactions (Payment/Abono)
        const { error: txError } = await supabase
          .from('debtor_transactions')
          .insert({
            user_id: user.id,
            debtor_id: debtorId,
            type: "payment",
            amount: shareAmount,
            description: `Abono por Presupuesto Compartido: ${budgets.find(b => b.id === budgetId)?.name}`,
            date: new Date().toISOString().split('T')[0], // Usar fecha local
          });
        if (txError) throw txError;
      }

      showSuccess("Pago registrado exitosamente. Deuda actualizada.");
      fetchBudgetsAndDebtors(); // Refresh data
    } catch (error: any) {
      showError('Error al registrar pago: ' + error.message);
      console.error("Mark paid error:", error);
    }
  };

  const handleDeleteBudget = async (budgetId: string, budgetName: string) => {
    if (!user) return;

    try {
      const budgetToDelete = budgets.find(b => b.id === budgetId);
      if (!budgetToDelete) return;

      // 1. Reverse debt for unpaid participants
      for (const participant of budgetToDelete.budget_participants) {
        if (!participant.is_paid) {
          const debtor = debtors.find(d => d.id === participant.debtor_id);
          if (debtor) {
            const newDebtorBalance = debtor.current_balance - participant.share_amount;
            
            // Update debtor balance
            await supabase
              .from('debtors')
              .update({ current_balance: newDebtorBalance })
              .eq('id', debtor.id)
              .eq('user_id', user.id);
            
            // Record reversal transaction (Payment/Abono)
            await supabase
              .from('debtor_transactions')
              .insert({
                user_id: user.id,
                debtor_id: debtor.id,
                type: "payment",
                amount: participant.share_amount,
                description: `Ajuste: Eliminación de Presupuesto Compartido: ${budgetName}`,
                date: new Date().toISOString().split('T')[0],
              });
          }
        }
      }

      // 2. Reverse creditor charge if applicable
      if (budgetToDelete.creditor_id) {
        const creditor = creditors.find(c => c.id === budgetToDelete.creditor_id);
        if (creditor) {
          const newCreditorBalance = creditor.current_balance - budgetToDelete.total_amount;

          // Update creditor balance
          await supabase
            .from('creditors')
            .update({ current_balance: newCreditorBalance })
            .eq('id', creditor.id)
            .eq('user_id', user.id);

          // Record reversal transaction (Payment/Abono)
          await supabase
            .from('creditor_transactions')
            .insert({
              user_id: user.id,
              creditor_id: creditor.id,
              type: "payment",
              amount: budgetToDelete.total_amount,
              description: `Ajuste: Reversión de Presupuesto Compartido: ${budgetName}`,
              date: new Date().toISOString().split('T')[0],
            });
        }
      }

      // 3. Delete the budget (cascades to participants)
      const { error } = await supabase
        .from('shared_budgets')
        .delete()
        .eq('id', budgetId)
        .eq('user_id', user.id);

      if (error) throw error;

      showSuccess(`Presupuesto ${budgetName} eliminado y deudas ajustadas.`);
      fetchBudgetsAndDebtors(); // Refresh data
    } catch (error: any) {
      showError('Error al eliminar presupuesto: ' + error.message);
      console.error("Delete budget error:", error);
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
                  <TableHead>Monto Total</TableHead>
                  <TableHead>Acreedor</TableHead>
                  <TableHead>Participantes</TableHead>
                  <TableHead>Deuda Pendiente</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((budget) => {
                  const totalParticipants = budget.budget_participants.length + 1;
                  const pendingParticipants = budget.budget_participants.filter(p => !p.is_paid);
                  const totalPendingDebt = pendingParticipants.reduce((sum, p) => sum + p.share_amount, 0);
                  const creditorName = budget.creditor_id ? creditors.find(c => c.id === budget.creditor_id)?.name : 'Yo';
                  
                  return (
                    <TableRow key={budget.id}>
                      <TableCell className="font-medium">{budget.name}</TableCell>
                      <TableCell>${budget.total_amount.toFixed(2)}</TableCell>
                      <TableCell>{creditorName}</TableCell>
                      <TableCell>{totalParticipants}</TableCell>
                      <TableCell className={cn(totalPendingDebt > 0 ? "text-red-600 font-semibold" : "text-green-600")}>
                        ${totalPendingDebt.toFixed(2)} ({pendingParticipants.length} pendientes)
                      </TableCell>
                      <TableCell className="text-right flex gap-2 justify-end">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1">
                              <Users className="h-3.5 w-3.5" />
                              Ver Pagos
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                              <DialogTitle>Pagos de {budget.name}</DialogTitle>
                            </DialogHeader>
                            <div className="py-4 overflow-x-auto">
                              <p className="text-sm mb-4">Monto por persona: ${(budget.total_amount / totalParticipants).toFixed(2)}</p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Deudor</TableHead>
                                    <TableHead>Monto</TableHead>
                                    <TableHead className="text-right">Estado</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {budget.budget_participants.map(p => (
                                    <TableRow key={p.id}>
                                      <TableCell>{p.debtors.name}</TableCell>
                                      <TableCell>${p.share_amount.toFixed(2)}</TableCell>
                                      <TableCell className="text-right">
                                        {p.is_paid ? (
                                          <span className="text-green-600 flex items-center justify-end gap-1">
                                            <CheckCircle className="h-4 w-4" /> Pagado
                                          </span>
                                        ) : (
                                          <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            className="h-7 text-xs"
                                            onClick={() => handleMarkPaid(p.id, budget.id, p.debtor_id, p.share_amount)}
                                          >
                                            Marcar como Pagado
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <DialogFooter>
                              <Button onClick={() => {}}>Cerrar</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará el presupuesto **{budget.name}** y revertirá las deudas pendientes asociadas en la lista de deudores y el cargo al acreedor (si aplica).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteBudget(budget.id, budget.name)}>
                                Eliminar Presupuesto
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
    </div>
  );
};

export default SharedBudgets;
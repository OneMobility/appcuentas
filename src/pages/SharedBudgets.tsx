"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Users, CheckCircle, Trash2, Banknote, CheckCircle2, Clock } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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
  creditor_id?: string | null;
}

const SharedBudgets = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<SharedBudget[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchBudgetsAndDebtors = async () => {
    if (!user) {
      setBudgets([]);
      setDebtors([]);
      setCreditors([]);
      return;
    }

    const { data: debtorsData } = await supabase
      .from('debtors')
      .select('id, name, current_balance')
      .eq('user_id', user.id);
    setDebtors(debtorsData || []);

    const { data: creditorsData } = await supabase
      .from('creditors')
      .select('id, name, current_balance')
      .eq('user_id', user.id);
    setCreditors(creditorsData || []);

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

  const handleMarkPaid = async (participantId: string, budgetId: string, debtorId: string, shareAmount: number, silent = false) => {
    if (!user) return;

    try {
      const { error: updateError } = await supabase
        .from('budget_participants')
        .update({ is_paid: true })
        .eq('id', participantId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      const debtor = debtors.find(d => d.id === debtorId);
      if (debtor) {
        const newDebtorBalance = debtor.current_balance - shareAmount;

        const { error: debtorUpdateError } = await supabase
          .from('debtors')
          .update({ current_balance: newDebtorBalance })
          .eq('id', debtorId)
          .eq('user_id', user.id);
        
        if (debtorUpdateError) throw debtorUpdateError;

        const { error: txError } = await supabase
          .from('debtor_transactions')
          .insert({
            user_id: user.id,
            debtor_id: debtorId,
            type: "payment",
            amount: shareAmount,
            description: `Abono por Presupuesto Compartido: ${budgets.find(b => b.id === budgetId)?.name}`,
            date: new Date().toISOString().split('T')[0],
          });
        if (txError) throw txError;
      }

      if (!silent) {
        showSuccess("Pago registrado exitosamente.");
        fetchBudgetsAndDebtors();
      }
    } catch (error: any) {
      if (!silent) showError('Error al registrar pago: ' + error.message);
      throw error;
    }
  };

  const handleMarkAllPaid = async (budget: SharedBudget) => {
    if (!user || isProcessing) return;
    
    const pendingParticipants = budget.budget_participants.filter(p => !p.is_paid);
    if (pendingParticipants.length === 0) return;

    setIsProcessing(true);
    try {
      for (const p of pendingParticipants) {
        await handleMarkPaid(p.id, budget.id, p.debtor_id, p.share_amount, true);
      }
      showSuccess(`Todos los participantes de "${budget.name}" han pagado.`);
      await fetchBudgetsAndDebtors();
    } catch (error: any) {
      showError('Error al procesar pagos masivos: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBudget = async (budgetId: string, budgetName: string) => {
    if (!user) return;

    try {
      const budgetToDelete = budgets.find(b => b.id === budgetId);
      if (!budgetToDelete) return;

      for (const participant of budgetToDelete.budget_participants) {
        if (!participant.is_paid) {
          const debtor = debtors.find(d => d.id === participant.debtor_id);
          if (debtor) {
            const newDebtorBalance = debtor.current_balance - participant.share_amount;
            
            await supabase
              .from('debtors')
              .update({ current_balance: newDebtorBalance })
              .eq('id', debtor.id)
              .eq('user_id', user.id);
            
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

      if (budgetToDelete.creditor_id) {
        const creditor = creditors.find(c => c.id === budgetToDelete.creditor_id);
        if (creditor) {
          const newCreditorBalance = creditor.current_balance - budgetToDelete.total_amount;

          await supabase
            .from('creditors')
            .update({ current_balance: newCreditorBalance })
            .eq('id', creditor.id)
            .eq('user_id', user.id);

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

      const { error } = await supabase
        .from('shared_budgets')
        .delete()
        .eq('id', budgetId)
        .eq('user_id', user.id);

      if (error) throw error;

      showSuccess(`Presupuesto ${budgetName} eliminado.`);
      fetchBudgetsAndDebtors();
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
                  const totalParticipants = budget.budget_participants.length + 1;
                  const pendingParticipants = budget.budget_participants.filter(p => !p.is_paid);
                  const totalPendingDebt = pendingParticipants.reduce((sum, p) => sum + p.share_amount, 0);
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
                          <DialogContent className="sm:max-w-[500px]">
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
                                    <CheckCircle className="h-3 w-3" /> Marcar todos
                                  </Button>
                                )}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="py-4 overflow-x-auto">
                              <p className="text-sm mb-4 text-muted-foreground">
                                Monto por persona: <span className="font-bold text-foreground">${(budget.total_amount / totalParticipants).toFixed(2)}</span>
                              </p>
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
                                      <TableCell>{p.debtors?.name || 'Deudor eliminado'}</TableCell>
                                      <TableCell>${p.share_amount.toFixed(2)}</TableCell>
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
                                            onClick={() => handleMarkPaid(p.id, budget.id, p.debtor_id, p.share_amount)}
                                            disabled={isProcessing}
                                          >
                                            Marcar Pago
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
                              <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se revertirán las deudas pendientes de los participantes y el cargo al acreedor. Los pagos ya realizados no se revertirán automáticamente.
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
    </div>
  );
};

export default SharedBudgets;
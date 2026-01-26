"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Users, DollarSign, CheckCircle, XCircle, Trash2, Edit, Divide } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { evaluateExpression } from "@/utils/math-helpers";

interface Debtor {
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
}

const SharedBudgets = () => {
  const { user } = useSession();
  const [budgets, setBudgets] = useState<SharedBudget[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [isAddBudgetDialogOpen, setIsAddBudgetDialogOpen] = useState(false);
  const [isEditBudgetDialogOpen, setIsEditBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<SharedBudget | null>(null);
  const [newBudget, setNewBudget] = useState({
    name: "",
    total_amount: "",
    split_type: "equal",
    description: "",
    selectedDebtors: [] as { debtorId: string; shareAmount: string }[],
    myShare: "" as string,
  });

  const fetchBudgetsAndDebtors = async () => {
    if (!user) {
      setBudgets([]);
      setDebtors([]);
      return;
    }

    // Fetch Debtors
    const { data: debtorsData, error: debtorsError } = await supabase
      .from('debtors')
      .select('id, name, current_balance')
      .eq('user_id', user.id);

    if (debtorsError) {
      showError('Error al cargar deudores: ' + debtorsError.message);
      return;
    }
    setDebtors(debtorsData || []);

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

  const resetForm = () => {
    setNewBudget({
      name: "",
      total_amount: "",
      split_type: "equal",
      description: "",
      selectedDebtors: [],
      myShare: "",
    });
    setEditingBudget(null);
  };

  const handleNewBudgetChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewBudget((prev) => ({ ...prev, [name]: value }));
  };

  const handleDebtorSelection = (debtorId: string, isChecked: boolean) => {
    setNewBudget((prev) => {
      let updatedDebtors = prev.selectedDebtors;
      if (isChecked) {
        if (!updatedDebtors.some(d => d.debtorId === debtorId)) {
          updatedDebtors = [...updatedDebtors, { debtorId, shareAmount: "" }];
        }
      } else {
        updatedDebtors = updatedDebtors.filter(d => d.debtorId !== debtorId);
      }
      return { ...prev, selectedDebtors: updatedDebtors };
    });
  };

  const handleDebtorShareChange = (debtorId: string, amount: string) => {
    setNewBudget((prev) => ({
      ...prev,
      selectedDebtors: prev.selectedDebtors.map(d =>
        d.debtorId === debtorId ? { ...d, shareAmount: amount } : d
      ),
    }));
  };

  const calculateShare = useMemo(() => {
    const totalAmountStr = newBudget.total_amount.startsWith('=') 
      ? evaluateExpression(newBudget.total_amount.substring(1))?.toFixed(2) 
      : newBudget.total_amount;
    
    const totalAmount = parseFloat(totalAmountStr || "0");
    const totalParticipants = newBudget.selectedDebtors.length + 1; // +1 for the user

    if (isNaN(totalAmount) || totalAmount <= 0 || totalParticipants === 0) {
      return { myShare: 0, debtorShare: 0, totalParticipants: 0 };
    }

    if (newBudget.split_type === 'equal') {
      const share = totalAmount / totalParticipants;
      return { myShare: share, debtorShare: share, totalParticipants };
    } 
    
    // Custom split logic (if implemented later, currently defaults to equal)
    return { myShare: totalAmount / totalParticipants, debtorShare: totalAmount / totalParticipants, totalParticipants };

  }, [newBudget.total_amount, newBudget.selectedDebtors.length, newBudget.split_type]);

  const handleSubmitBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión.");
      return;
    }

    let totalAmount: number;
    if (newBudget.total_amount.startsWith('=')) {
      const result = evaluateExpression(newBudget.total_amount.substring(1));
      if (result === null || isNaN(result) || result <= 0) {
        showError("Monto total inválido.");
        return;
      }
      totalAmount = parseFloat(result.toFixed(2));
    } else {
      totalAmount = parseFloat(newBudget.total_amount);
      if (isNaN(totalAmount) || totalAmount <= 0) {
        showError("Monto total inválido.");
        return;
      }
    }

    const shareAmount = calculateShare.debtorShare;
    if (shareAmount <= 0) {
      showError("El monto a dividir debe ser positivo.");
      return;
    }

    try {
      // 1. Insert Shared Budget
      const { data: budgetData, error: budgetError } = await supabase
        .from('shared_budgets')
        .insert({
          user_id: user.id,
          name: newBudget.name,
          total_amount: totalAmount,
          split_type: newBudget.split_type,
          description: newBudget.description,
        })
        .select()
        .single();

      if (budgetError) throw budgetError;
      const budgetId = budgetData.id;

      // 2. Prepare participant and debtor updates
      const participantInserts = newBudget.selectedDebtors.map(d => ({
        budget_id: budgetId,
        debtor_id: d.debtorId,
        share_amount: shareAmount,
        user_id: user.id,
        is_paid: false,
      }));

      // 3. Insert Participants
      const { error: participantsError } = await supabase
        .from('budget_participants')
        .insert(participantInserts);

      if (participantsError) throw participantsError;

      // 4. Update Debtor balances (increase current_balance by their share)
      for (const participant of newBudget.selectedDebtors) {
        const debtor = debtors.find(d => d.id === participant.debtorId);
        if (debtor) {
          const newDebtorBalance = debtor.current_balance + shareAmount;
          
          // Update debtor balance
          const { error: debtorUpdateError } = await supabase
            .from('debtors')
            .update({ current_balance: newDebtorBalance })
            .eq('id', debtor.id)
            .eq('user_id', user.id);
          
          if (debtorUpdateError) throw debtorUpdateError;

          // Record transaction in debtor_transactions (Charge)
          const { error: txError } = await supabase
            .from('debtor_transactions')
            .insert({
              user_id: user.id,
              debtor_id: debtor.id,
              type: "charge",
              amount: shareAmount,
              description: `Cargo por Presupuesto Compartido: ${newBudget.name}`,
              date: new Date().toISOString().split('T')[0],
            });
          if (txError) throw txError;
        }
      }

      showSuccess("Presupuesto compartido creado exitosamente. Deudas registradas.");
      resetForm();
      setIsAddBudgetDialogOpen(false);
      fetchBudgetsAndDebtors(); // Refresh data
    } catch (error: any) {
      showError('Error al crear presupuesto: ' + error.message);
      console.error("Budget creation error:", error);
    }
  };

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
            date: new Date().toISOString().split('T')[0],
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
      // Note: Deleting the budget automatically cascades and deletes participants.
      // However, we must manually handle the reversal of the debt in the debtors table.
      
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

      // 2. Delete the budget (cascades to participants)
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
          <Dialog open={isAddBudgetDialogOpen} onOpenChange={setIsAddBudgetDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1" onClick={resetForm}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Nuevo Presupuesto
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Presupuesto Compartido</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitBudget} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Nombre</Label>
                  <Input id="name" name="name" value={newBudget.name} onChange={handleNewBudgetChange} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="total_amount" className="text-right">Monto Total del Gasto</Label>
                  <Input
                    id="total_amount"
                    name="total_amount"
                    type="text"
                    value={newBudget.total_amount}
                    onChange={handleNewBudgetChange}
                    className="col-span-3"
                    required
                    placeholder="Ej. 400 o =100*4"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">Descripción (Opcional)</Label>
                  <Input id="description" name="description" value={newBudget.description} onChange={handleNewBudgetChange} className="col-span-3" />
                </div>

                <h3 className="text-lg font-semibold mt-4 col-span-4">Participantes (Deudores)</h3>
                <p className="text-sm text-muted-foreground col-span-4">Selecciona a quién le dividirás el gasto (tú eres un participante más).</p>

                <div className="col-span-4 grid gap-2">
                  {debtors.length === 0 ? (
                    <p className="text-muted-foreground">No tienes deudores registrados. Añade deudores primero.</p>
                  ) : (
                    debtors.map((debtor) => (
                      <div key={debtor.id} className="flex items-center justify-between border p-2 rounded-md">
                        <Label htmlFor={`debtor-${debtor.id}`} className="flex items-center gap-2 font-normal cursor-pointer">
                          <Input
                            type="checkbox"
                            id={`debtor-${debtor.id}`}
                            checked={newBudget.selectedDebtors.some(d => d.debtorId === debtor.id)}
                            onChange={(e) => handleDebtorSelection(debtor.id, e.target.checked)}
                            className="h-4 w-4"
                          />
                          {debtor.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>

                {newBudget.selectedDebtors.length > 0 && (
                  <div className="col-span-4 mt-4 p-3 bg-accent rounded-md">
                    <p className="font-semibold flex items-center gap-2">
                      <Divide className="h-4 w-4" /> División (Total de {calculateShare.totalParticipants} personas)
                    </p>
                    <p className="text-sm mt-1">Tu parte: ${calculateShare.myShare.toFixed(2)}</p>
                    <p className="text-sm">Parte de cada deudor: ${calculateShare.debtorShare.toFixed(2)}</p>
                  </div>
                )}

                <DialogFooter className="mt-4">
                  <Button type="submit" disabled={newBudget.selectedDebtors.length === 0}>
                    Crear Presupuesto y Registrar Deudas
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Monto Total</TableHead>
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
                  
                  return (
                    <TableRow key={budget.id}>
                      <TableCell className="font-medium">{budget.name}</TableCell>
                      <TableCell>${budget.total_amount.toFixed(2)}</TableCell>
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
                          <DialogContent className="sm:max-w-[450px]">
                            <DialogHeader>
                              <DialogTitle>Pagos de {budget.name}</DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
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
                                Esta acción eliminará el presupuesto **{budget.name}** y revertirá las deudas pendientes asociadas en la lista de deudores.
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
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Users, DollarSign, CheckCircle, Trash2, Divide, Banknote, UserPlus } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";

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

// --- Componentes de Creación Rápida ---

interface QuickCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (id: string, name: string) => void;
  type: 'debtor' | 'creditor';
}

const QuickCreateDialog: React.FC<QuickCreateDialogProps> = ({ isOpen, onClose, onSuccess, type }) => {
  const { user } = useSession();
  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = type === 'debtor' ? 'Añadir Nuevo Deudor' : 'Añadir Nuevo Acreedor';
  const tableName = type === 'debtor' ? 'debtors' : 'creditors';

  const resetForm = () => {
    setName("");
    setInitialBalance("");
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión.");
      return;
    }

    let balance: number;
    if (initialBalance.startsWith('=')) {
      const result = evaluateExpression(initialBalance.substring(1));
      if (result === null || isNaN(result) || result < 0) {
        showError("Expresión matemática inválida para el saldo inicial.");
        return;
      }
      balance = parseFloat(result.toFixed(2));
    } else {
      balance = parseFloat(initialBalance);
      if (isNaN(balance) || balance < 0) {
        showError("El saldo inicial debe ser un número positivo o cero.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from(tableName)
        .insert({
          user_id: user.id,
          name: name.trim(),
          initial_balance: balance,
          current_balance: balance,
        })
        .select()
        .single();

      if (error) throw error;

      showSuccess(`${title} registrado exitosamente.`);
      onSuccess(data.id, data.name);
      onClose();
    } catch (error: any) {
      showError(`Error al registrar ${type}: ` + error.message);
      console.error(`Quick create ${type} error:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nombre
            </Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="initial_balance" className="text-right">
              Saldo Inicial
            </Label>
            <Input
              id="initial_balance"
              name="initial_balance"
              type="text"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="col-span-3"
              required
              placeholder="Ej. 100 o =50+20*2"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// --- Componente Principal SharedBudgets ---

const SharedBudgets = () => {
  const { user } = useSession();
  const [budgets, setBudgets] = useState<SharedBudget[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [isAddBudgetDialogOpen, setIsAddBudgetDialogOpen] = useState(false);
  const [isQuickDebtorDialogOpen, setIsQuickDebtorDialogOpen] = useState(false);
  const [isQuickCreditorDialogOpen, setIsQuickCreditorDialogOpen] = useState(false);
  
  const [newBudget, setNewBudget] = useState({
    name: "",
    total_amount: "",
    split_type: "equal",
    description: "",
    selectedDebtors: [] as { debtorId: string; shareAmount: string }[],
    creditorId: "none" as string,
  });

  const fetchBudgetsAndDebtors = async () => {
    if (!user) {
      setBudgets([]);
      setDebtors([]);
      setCreditors([]);
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

    // Fetch Creditors
    const { data: creditorsData, error: creditorsError } = await supabase
      .from('creditors')
      .select('id, name, current_balance')
      .eq('user_id', user.id);

    if (creditorsError) {
      showError('Error al cargar acreedores: ' + creditorsError.message);
      return;
    }
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

  const resetForm = () => {
    setNewBudget({
      name: "",
      total_amount: "",
      split_type: "equal",
      description: "",
      selectedDebtors: [],
      creditorId: "none",
    });
  };

  const handleNewBudgetChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewBudget((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreditorChange = (value: string) => {
    setNewBudget((prev) => ({ ...prev, creditorId: value }));
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

  const handleQuickDebtorSuccess = (id: string, name: string) => {
    // Re-fetch debtors list
    fetchBudgetsAndDebtors(); 
    // Automatically select the newly created debtor
    setNewBudget(prev => ({
      ...prev,
      selectedDebtors: [...prev.selectedDebtors, { debtorId: id, shareAmount: "" }]
    }));
  };

  const handleQuickCreditorSuccess = (id: string, name: string) => {
    // Re-fetch creditors list
    fetchBudgetsAndDebtors();
    // Automatically select the newly created creditor
    setNewBudget(prev => ({
      ...prev,
      creditorId: id
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

    const creditorIdToUse = newBudget.creditorId === "none" ? null : newBudget.creditorId;

    try {
      // 1. Handle Creditor Charge (if selected)
      if (creditorIdToUse) {
        const creditor = creditors.find(c => c.id === creditorIdToUse);
        if (!creditor) throw new Error("Acreedor no encontrado.");

        const newCreditorBalance = creditor.current_balance + totalAmount;

        // Update creditor balance
        const { error: creditorUpdateError } = await supabase
          .from('creditors')
          .update({ current_balance: newCreditorBalance })
          .eq('id', creditor.id)
          .eq('user_id', user.id);
        
        if (creditorUpdateError) throw creditorUpdateError;

        // Record transaction in creditor_transactions (Charge)
        const { error: creditorTxError } = await supabase
          .from('creditor_transactions')
          .insert({
            user_id: user.id,
            creditor_id: creditor.id,
            type: "charge",
            amount: totalAmount,
            description: `Cargo por Presupuesto Compartido: ${newBudget.name}`,
            date: getLocalDateString(new Date()),
          });
        if (creditorTxError) throw creditorTxError;
      }

      // 2. Insert Shared Budget
      const { data: budgetData, error: budgetError } = await supabase
        .from('shared_budgets')
        .insert({
          user_id: user.id,
          name: newBudget.name,
          total_amount: totalAmount,
          split_type: newBudget.split_type,
          description: newBudget.description,
          creditor_id: creditorIdToUse,
        })
        .select()
        .single();

      if (budgetError) throw budgetError;
      const budgetId = budgetData.id;

      // 3. Prepare participant and debtor updates
      const participantInserts = newBudget.selectedDebtors.map(d => ({
        budget_id: budgetId,
        debtor_id: d.debtorId,
        share_amount: shareAmount,
        user_id: user.id,
        is_paid: false,
      }));

      // 4. Insert Participants
      const { error: participantsError } = await supabase
        .from('budget_participants')
        .insert(participantInserts);

      if (participantsError) throw participantsError;

      // 5. Update Debtor balances (increase current_balance by their share)
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
              date: getLocalDateString(new Date()),
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
            date: getLocalDateString(new Date()),
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
                date: getLocalDateString(new Date()),
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
              date: getLocalDateString(new Date()),
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
          <Dialog open={isAddBudgetDialogOpen} onOpenChange={setIsAddBudgetDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1" onClick={resetForm}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Nuevo Presupuesto
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Presupuesto Compartido</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitBudget} className="grid gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-1 gap-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input id="name" name="name" value={newBudget.name} onChange={handleNewBudgetChange} required />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Label htmlFor="total_amount">Monto Total del Gasto</Label>
                    <Input
                      id="total_amount"
                      name="total_amount"
                      type="text"
                      value={newBudget.total_amount}
                      onChange={handleNewBudgetChange}
                      required
                      placeholder="Ej. 400 o =100*4"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Label htmlFor="description">Descripción (Opcional)</Label>
                    <Input id="description" name="description" value={newBudget.description} onChange={handleNewBudgetChange} />
                  </div>
                </div>

                <h3 className="text-lg font-semibold mt-4 flex items-center justify-between">
                  Acreedor (Opcional)
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs gap-1"
                    onClick={() => setIsQuickCreditorDialogOpen(true)}
                  >
                    <UserPlus className="h-3 w-3" /> Añadir Rápido
                  </Button>
                </h3>
                <p className="text-sm text-muted-foreground">Si este gasto se cargó a un acreedor (ej. tarjeta de crédito, persona), selecciónalo aquí. El monto total se registrará como deuda a ese acreedor.</p>
                <div className="grid grid-cols-1 gap-2">
                  <Select value={newBudget.creditorId} onValueChange={handleCreditorChange}>
                    <SelectTrigger id="creditorId">
                      <SelectValue placeholder="Selecciona Acreedor (Opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Ninguno (Pagado por mí) --</SelectItem>
                      {creditors.map((creditor) => (
                        <SelectItem key={creditor.id} value={creditor.id}>
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4" />
                            {creditor.name} (Deuda: ${creditor.current_balance.toFixed(2)})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {creditors.length === 0 && newBudget.creditorId === "none" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Considera añadir un acreedor si el gasto fue a crédito.
                    </p>
                  )}
                </div>

                <h3 className="text-lg font-semibold mt-4 flex items-center justify-between">
                  Participantes (Deudores)
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs gap-1"
                    onClick={() => setIsQuickDebtorDialogOpen(true)}
                  >
                    <UserPlus className="h-3 w-3" /> Añadir Rápido
                  </Button>
                </h3>
                <p className="text-sm text-muted-foreground">Selecciona a quién le dividirás el gasto (tú eres un participante más).</p>

                <div className="grid gap-2 max-h-40 overflow-y-auto border p-2 rounded-md">
                  {debtors.length === 0 ? (
                    <p className="text-muted-foreground p-2">
                      No tienes deudores registrados. Usa el botón "Añadir Rápido" para crear uno.
                    </p>
                  ) : (
                    debtors.map((debtor) => (
                      <div key={debtor.id} className="flex items-center justify-between border-b last:border-b-0 py-1">
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
                  <div className="mt-4 p-3 bg-accent rounded-md">
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
      
      {/* Diálogos de Creación Rápida */}
      <QuickCreateDialog
        isOpen={isQuickDebtorDialogOpen}
        onClose={() => setIsQuickDebtorDialogOpen(false)}
        onSuccess={handleQuickDebtorSuccess}
        type="debtor"
      />
      <QuickCreateDialog
        isOpen={isQuickCreditorDialogOpen}
        onClose={() => setIsQuickCreditorDialogOpen(false)}
        onSuccess={handleQuickCreditorSuccess}
        type="creditor"
      />
    </div>
  );
};

export default SharedBudgets;
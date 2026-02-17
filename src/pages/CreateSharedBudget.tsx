"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Divide, Banknote, UserPlus, ArrowLeft } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { cn } from "@/lib/utils";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
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

const CreateSharedBudget: React.FC = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
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

  const fetchDebtorsAndCreditors = async () => {
    if (!user) {
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
  };

  useEffect(() => {
    fetchDebtorsAndCreditors();
  }, [user]);

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

  const handleQuickDebtorSuccess = (id: string, name: string) => {
    fetchDebtorsAndCreditors(); 
    setNewBudget(prev => ({
      ...prev,
      selectedDebtors: [...prev.selectedDebtors, { debtorId: id, shareAmount: "" }]
    }));
  };

  const handleQuickCreditorSuccess = (id: string, name: string) => {
    fetchDebtorsAndCreditors();
    setNewBudget(prev => ({
      ...prev,
      creditorId: id
    }));
  };

  const calculateShare = useMemo(() => {
    const totalAmountStr = newBudget.total_amount.startsWith('=') 
      ? (evaluateExpression(newBudget.total_amount.substring(1))?.toFixed(2) || "0") 
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
      navigate('/shared-budgets'); // Navigate back to the list
    } catch (error: any) {
      showError('Error al crear presupuesto: ' + error.message);
      console.error("Budget creation error:", error);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/shared-budgets')}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-3xl font-bold">Crear Nuevo Presupuesto Compartido</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalles del Gasto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitBudget} className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" value={newBudget.name} onChange={handleNewBudgetChange} required />
              </div>
              <div className="flex flex-col gap-2">
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
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Descripción (Opcional)</Label>
              <Input id="description" name="description" value={newBudget.description} onChange={handleNewBudgetChange} />
            </div>

            <Card className="p-4 border-indigo-200 bg-indigo-50">
              <h3 className="text-lg font-semibold flex items-center justify-between">
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
              <p className="text-sm text-muted-foreground mb-3">Si este gasto se cargó a un acreedor (ej. tarjeta de crédito, persona), selecciónalo aquí. El monto total se registrará como deuda a ese acreedor.</p>
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
            </Card>

            <Card className="p-4 border-green-200 bg-green-50">
              <h3 className="text-lg font-semibold flex items-center justify-between">
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
              <p className="text-sm text-muted-foreground mb-3">Selecciona a quién le dividirás el gasto (tú eres un participante más).</p>

              <div className="grid gap-2 max-h-40 overflow-y-auto border p-2 rounded-md bg-white">
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
            </Card>

            <div className="flex justify-end mt-4">
              <Button type="submit" disabled={newBudget.selectedDebtors.length === 0}>
                Crear Presupuesto y Registrar Deudas
              </Button>
            </div>
          </form>
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

export default CreateSharedBudget;
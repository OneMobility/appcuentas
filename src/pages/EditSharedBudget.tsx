"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Divide, Banknote, ArrowLeft, AlertCircle, Save, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";
import LoadingSpinner from "@/components/LoadingSpinner";

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
  share_amount: number;
  paid_amount: number;
}

const EditSharedBudget: React.FC = () => {
  const { budgetId } = useParams<{ budgetId: string }>();
  const { user } = useSession();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  
  const [budgetData, setBudgetData] = useState({
    name: "",
    total_amount: "",
    description: "",
    creditorId: "none",
    selectedDebtors: [] as { debtorId: string; paidAmount: number }[],
  });

  const [originalBudget, setOriginalBudget] = useState<any>(null);

  const fetchData = async () => {
    if (!user || !budgetId) return;

    try {
      // Cargar presupuesto y participantes
      const { data: budget, error: bError } = await supabase
        .from('shared_budgets')
        .select('*, budget_participants(*)')
        .eq('id', budgetId)
        .single();

      if (bError) throw bError;
      setOriginalBudget(budget);

      // Cargar Deudores y Acreedores
      const [debtorsRes, creditorsRes] = await Promise.all([
        supabase.from('debtors').select('id, name, current_balance').eq('user_id', user.id),
        supabase.from('creditors').select('id, name, current_balance').eq('user_id', user.id)
      ]);

      setDebtors(debtorsRes.data || []);
      setCreditors(creditorsRes.data || []);

      setBudgetData({
        name: budget.name,
        total_amount: budget.total_amount.toString(),
        description: budget.description || "",
        creditorId: budget.creditor_id || "none",
        selectedDebtors: budget.budget_participants.map((p: any) => ({
          debtorId: p.debtor_id,
          paidAmount: p.paid_amount || 0
        })),
      });

    } catch (error: any) {
      showError("Error al cargar el presupuesto: " + error.message);
      navigate('/shared-budgets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [budgetId, user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBudgetData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDebtorSelection = (debtorId: string, isChecked: boolean) => {
    setBudgetData((prev) => {
      let updated = [...prev.selectedDebtors];
      if (isChecked) {
        if (!updated.some(d => d.debtorId === debtorId)) {
          updated.push({ debtorId, paidAmount: 0 });
        }
      } else {
        updated = updated.filter(d => d.debtorId !== debtorId);
      }
      return { ...prev, selectedDebtors: updated };
    });
  };

  const calculateShare = useMemo(() => {
    let total = 0;
    if (budgetData.total_amount.startsWith('=')) {
      total = evaluateExpression(budgetData.total_amount.substring(1)) || 0;
    } else {
      total = parseFloat(budgetData.total_amount || "0");
    }
    
    const totalParticipants = budgetData.selectedDebtors.length + 1;
    if (total <= 0 || totalParticipants <= 0) return 0;
    return total / totalParticipants;
  }, [budgetData.total_amount, budgetData.selectedDebtors.length]);

  const handleUpdateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !originalBudget || isSaving) return;

    let newTotalAmount: number;
    if (budgetData.total_amount.startsWith('=')) {
      newTotalAmount = evaluateExpression(budgetData.total_amount.substring(1)) || 0;
    } else {
      newTotalAmount = parseFloat(budgetData.total_amount);
    }

    if (isNaN(newTotalAmount) || newTotalAmount <= 0) {
      showError("Monto total inválido.");
      return;
    }

    if (budgetData.selectedDebtors.length === 0) {
      showError("Debes seleccionar al menos un deudor.");
      return;
    }

    setIsSaving(true);
    const shareAmount = calculateShare;
    const transactionDate = getLocalDateString(new Date());

    try {
      // --- 1. REVERTIR ESTADO ANTERIOR ---
      
      // Revertir deudas de participantes originales (solo la parte pendiente)
      for (const p of originalBudget.budget_participants) {
        const debtor = debtors.find(d => d.id === p.debtor_id);
        if (debtor) {
          const remainingToRevert = p.share_amount - (p.paid_amount || 0);
          await supabase.from('debtors').update({ 
            current_balance: debtor.current_balance - remainingToRevert 
          }).eq('id', debtor.id);
        }
      }

      // Revertir cargo al acreedor original
      if (originalBudget.creditor_id) {
        const creditor = creditors.find(c => c.id === originalBudget.creditor_id);
        if (creditor) {
          await supabase.from('creditors').update({ 
            current_balance: creditor.current_balance - originalBudget.total_amount 
          }).eq('id', creditor.id);
        }
      }

      // --- 2. APLICAR NUEVO ESTADO ---

      // Actualizar presupuesto
      const creditorIdToUse = budgetData.creditorId === "none" ? null : budgetData.creditorId;
      const { error: bUpdateError } = await supabase
        .from('shared_budgets')
        .update({
          name: budgetData.name,
          total_amount: newTotalAmount,
          description: budgetData.description,
          creditor_id: creditorIdToUse,
        })
        .eq('id', budgetId);

      if (bUpdateError) throw bUpdateError;

      // Eliminar participantes antiguos
      await supabase.from('budget_participants').delete().eq('budget_id', budgetId);

      // Insertar nuevos participantes y actualizar saldos de deudores
      for (const dSelection of budgetData.selectedDebtors) {
        // Mantener el paidAmount si ya existía en el original
        const originalP = originalBudget.budget_participants.find((p: any) => p.debtor_id === dSelection.debtorId);
        const paidAmount = originalP ? originalP.paid_amount : 0;
        const isPaid = paidAmount >= shareAmount - 0.01;

        await supabase.from('budget_participants').insert({
          budget_id: budgetId,
          debtor_id: dSelection.debtorId,
          share_amount: shareAmount,
          paid_amount: paidAmount,
          is_paid: isPaid,
          user_id: user.id
        });

        // Actualizar saldo del deudor (sumar la nueva parte pendiente)
        const debtor = debtors.find(d => d.id === dSelection.debtorId);
        if (debtor) {
          const newPending = shareAmount - paidAmount;
          // Nota: El saldo del deudor ya fue restado arriba, ahora sumamos lo nuevo
          // Pero como los deudores en el estado local 'debtors' no se han actualizado, 
          // necesitamos obtener el saldo real actual o calcularlo.
          // Para simplificar, haremos un fetch rápido o usaremos la lógica de compensación.
          const { data: currentDebtor } = await supabase.from('debtors').select('current_balance').eq('id', debtor.id).single();
          if (currentDebtor) {
            await supabase.from('debtors').update({ 
              current_balance: currentDebtor.current_balance + newPending 
            }).eq('id', debtor.id);
          }
        }
      }

      // Aplicar nuevo cargo al acreedor
      if (creditorIdToUse) {
        const { data: currentCreditor } = await supabase.from('creditors').select('current_balance').eq('id', creditorIdToUse).single();
        if (currentCreditor) {
          await supabase.from('creditors').update({ 
            current_balance: currentCreditor.current_balance + newTotalAmount 
          }).eq('id', creditorIdToUse);
        }
      }

      showSuccess("Presupuesto actualizado y saldos recalculados.");
      navigate('/shared-budgets');
    } catch (error: any) {
      showError("Error al actualizar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/shared-budgets')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Editar Presupuesto</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ajustar Detalles y Participantes</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateBudget} className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" value={budgetData.name} onChange={handleInputChange} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="total_amount">Monto Total</Label>
                <Input
                  id="total_amount"
                  name="total_amount"
                  value={budgetData.total_amount}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Acreedor</Label>
              <Select value={budgetData.creditorId} onValueChange={(v) => setBudgetData({...budgetData, creditorId: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona Acreedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Ninguno (Pagado por mí) --</SelectItem>
                  {creditors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="p-4 border-green-200 bg-green-50">
              <h3 className="text-lg font-semibold mb-2">Participantes</h3>
              <div className="grid gap-2 max-h-48 overflow-y-auto border p-2 rounded-md bg-white">
                {debtors.map((debtor) => (
                  <div key={debtor.id} className="flex items-center gap-2 py-1">
                    <Checkbox 
                      id={`d-${debtor.id}`} 
                      checked={budgetData.selectedDebtors.some(d => d.debtorId === debtor.id)}
                      onCheckedChange={(checked) => handleDebtorSelection(debtor.id, !!checked)}
                    />
                    <Label htmlFor={`d-${debtor.id}`} className="font-normal cursor-pointer">{debtor.name}</Label>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-white/50 rounded-md border border-green-100">
                <p className="font-semibold flex items-center gap-2">
                  <Divide className="h-4 w-4" /> Nueva División ({budgetData.selectedDebtors.length + 1} personas)
                </p>
                <p className="text-sm mt-1">Parte de cada uno: <span className="font-bold">${calculateShare.toFixed(2)}</span></p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  <AlertCircle className="h-3 w-3 inline mr-1" /> 
                  Al guardar, se ajustarán automáticamente las deudas de los participantes seleccionados.
                </p>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="mr-2 h-4 w-4" /> Guardar Cambios</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditSharedBudget;
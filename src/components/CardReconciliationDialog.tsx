"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString, getStatementPeriod } from "@/utils/date-helpers";
import { cn } from "@/lib/utils";
import { format, addMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";

interface CardDataForReconciliation {
  id: string;
  name: string;
  current_balance: number;
  type: "credit" | "debit";
  credit_limit?: number;
  transactions: any[];
}

interface CardReconciliationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardDataForReconciliation;
  onReconciliationSuccess: () => void;
  onNoAdjustmentSuccess: () => void;
}

const CardReconciliationDialog: React.FC<CardReconciliationDialogProps> = ({
  isOpen,
  onClose,
  card,
  onReconciliationSuccess,
  onNoAdjustmentSuccess,
}) => {
  const { user } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modos de cuadre para crédito: "detailed" (Desglosado), "available" (Disponible)
  const [creditMode, setCreditMode] = useState<"detailed" | "available">("detailed");

  // Inputs para modo desglosado (Crédito)
  const [revolventeInput, setRevolventeInput] = useState<string>("");
  const [mesesInput, setMesesInput] = useState<string>("");
  const [adjustmentInstallments, setAdjustmentInstallments] = useState<string>("6");

  // Input para modo disponible (Crédito) o saldo (Débito)
  const [realValueInput, setRealValueInput] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setCreditMode("detailed");
      setRevolventeInput("");
      setMesesInput("");
      setRealValueInput("");
      setAdjustmentInstallments("6");
    }
  }, [isOpen]);

  // Calcular lo que la app "cree" que se debe actualmente a meses y revolvente
  const appMetrics = useMemo(() => {
    if (card.type !== "credit") return { meses: 0, revolvente: card.current_balance };
    
    const today = new Date();
    
    // Obtener el periodo de facturación actual de la tarjeta
    const statementPeriod = card.cut_off_day 
      ? getStatementPeriod(card.cut_off_day, today)
      : { start: startOfMonth(today), end: endOfMonth(today) };

    // La deuda a meses (diferido) son estrictamente las transacciones futuras (después del periodo actual)
    const mesesCharges = card.transactions
      .filter(tx => tx.type === "charge" && tx.installments_count && parseISO(tx.date) > statementPeriod.end)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    
    const mesesPayments = card.transactions
      .filter(tx => tx.type === "payment" && tx.installments_count && parseISO(tx.date) > statementPeriod.end)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const meses = Math.max(0, mesesCharges - mesesPayments);
    
    // La deuda revolvente (actual) es el resto de la deuda global actual de la tarjeta
    // Esto garantiza que revolvente + meses = card.current_balance en todo momento
    const revolvente = Math.max(0, card.current_balance - meses);

    return { meses, revolvente };
  }, [card.transactions, card.current_balance, card.type, card.cut_off_day]);

  // Valores evaluados de los inputs
  const revolventeVal = useMemo(() => {
    if (!revolventeInput) return appMetrics.revolvente;
    return revolventeInput.startsWith('=')
      ? (evaluateExpression(revolventeInput.substring(1)) || 0)
      : (parseFloat(revolventeInput) || 0);
  }, [revolventeInput, appMetrics.revolvente]);

  const mesesVal = useMemo(() => {
    if (!mesesInput) return appMetrics.meses;
    return mesesInput.startsWith('=')
      ? (evaluateExpression(mesesInput.substring(1)) || 0)
      : (parseFloat(mesesInput) || 0);
  }, [mesesInput, appMetrics.meses]);

  const realValueVal = useMemo(() => {
    if (!realValueInput) return 0;
    return realValueInput.startsWith('=')
      ? (evaluateExpression(realValueInput.substring(1)) || 0)
      : (parseFloat(realValueInput) || 0);
  }, [realValueInput]);

  // Diferencias individuales
  const revolventeDiff = useMemo(() => {
    if (card.type !== "credit" || creditMode !== "detailed") return 0;
    return revolventeVal - appMetrics.revolvente;
  }, [revolventeVal, appMetrics.revolvente, card.type, creditMode]);

  const mesesDiff = useMemo(() => {
    if (card.type !== "credit" || creditMode !== "detailed") return 0;
    return mesesVal - appMetrics.meses;
  }, [mesesVal, appMetrics.meses, card.type, creditMode]);

  // Cálculos de balance y diferencia global
  const appBalance = useMemo(() => {
    if (card.type === "debit") return card.current_balance;
    if (creditMode === "available") {
      return (card.credit_limit || 0) - card.current_balance;
    }
    return card.current_balance; // Deuda global en App
  }, [card, creditMode]);

  const calculatedDifference = useMemo(() => {
    if (card.type === "credit" && creditMode === "detailed") {
      return revolventeDiff + mesesDiff;
    }
    return realValueVal - appBalance;
  }, [card, creditMode, revolventeDiff, mesesDiff, realValueVal, appBalance]);

  const handleReconcile = async () => {
    if (!user) {
      showError("Debes iniciar sesión.");
      return;
    }

    const totalDiff = calculatedDifference;

    if (Math.abs(totalDiff) < 0.01) {
      onNoAdjustmentSuccess();
      onClose();
      return;
    }

    setIsSubmitting(true);
    const today = new Date();
    const todayStr = getLocalDateString(today);

    try {
      // MODO DETALLADO (CRÉDITO)
      if (card.type === "credit" && creditMode === "detailed") {
        // 1. Procesar ajuste de Revolvente (Deuda del periodo)
        if (Math.abs(revolventeDiff) >= 0.01) {
          const txType = revolventeDiff > 0 ? "charge" : "payment";
          const { error: revError } = await supabase
            .from('card_transactions')
            .insert({
              user_id: user.id,
              card_id: card.id,
              type: txType,
              amount: Math.abs(revolventeDiff),
              description: "Ajuste de Cuadre (Revolvente)",
              date: todayStr,
              is_adjustment: true,
            });
          if (revError) throw revError;
        }

        // 2. Procesar ajuste de Meses sin Intereses (Diferido)
        if (Math.abs(mesesDiff) >= 0.01) {
          const installmentsCount = parseInt(adjustmentInstallments);
          const txType = mesesDiff > 0 ? "charge" : "payment";
          const monthlyAmount = Math.abs(mesesDiff) / installmentsCount;

          const transactionInserts = [];
          for (let i = 0; i < installmentsCount; i++) {
            // Las mensualidades diferidas comienzan a partir del mes siguiente (i + 1)
            const installmentDate = addMonths(today, i + 1);
            transactionInserts.push({
              user_id: user.id,
              card_id: card.id,
              type: txType,
              amount: monthlyAmount,
              description: `Ajuste de Cuadre (Diferido ${i + 1}/${installmentsCount})`,
              date: getLocalDateString(installmentDate),
              installments_total_amount: Math.abs(mesesDiff),
              installments_count: installmentsCount,
              installment_number: i + 1,
              is_adjustment: true,
            });
          }

          const { error: mesesError } = await supabase
            .from('card_transactions')
            .insert(transactionInserts);
          if (mesesError) throw mesesError;
        }

        // 3. Actualizar saldo global de la tarjeta directamente a la suma declarada
        const newCurrentBalance = revolventeVal + mesesVal;
        const { error: cardError } = await supabase
          .from('cards')
          .update({ current_balance: newCurrentBalance })
          .eq('id', card.id);
        if (cardError) throw cardError;

      } else {
        // MODO DISPONIBLE (CRÉDITO) O SALDO (DÉBITO)
        const txType = card.type === "credit"
          ? (totalDiff > 0 ? "payment" : "charge") // Disponible real > app -> menos deuda -> abono
          : (totalDiff > 0 ? "payment" : "charge"); // Saldo real > app -> más dinero -> depósito

        const newCurrentBalance = card.type === "credit"
          ? card.current_balance - totalDiff
          : card.current_balance + totalDiff;

        const { error: transactionError } = await supabase
          .from('card_transactions')
          .insert({
            user_id: user.id,
            card_id: card.id,
            type: txType,
            amount: Math.abs(totalDiff),
            description: `Ajuste de Cuadre (${card.type === 'credit' ? 'Disponible' : 'Saldo'})`,
            date: todayStr,
            is_adjustment: true,
          });
        if (transactionError) throw transactionError;

        const { error: cardUpdateError } = await supabase
          .from('cards')
          .update({ current_balance: newCurrentBalance })
          .eq('id', card.id);
        if (cardUpdateError) throw cardUpdateError;
      }

      showSuccess("Tarjeta cuadrada exitosamente.");
      onReconciliationSuccess();
      onClose();
    } catch (error: any) {
      showError('Error al cuadrar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cuadre de Tarjeta: {card.name}</DialogTitle>
        </DialogHeader>

        {card.type === "credit" && (
          <Tabs value={creditMode} onValueChange={(v: any) => {
            setCreditMode(v);
            setRevolventeInput("");
            setMesesInput("");
            setRealValueInput("");
            setAdjustmentInstallments("6");
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl">
              <TabsTrigger value="detailed" className="rounded-lg">Cuadre Detallado</TabsTrigger>
              <TabsTrigger value="available" className="rounded-lg">Por Disponible</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="grid gap-4 py-4">
          {card.type === "credit" && creditMode === "detailed" ? (
            <>
              {/* Sección Revolvente */}
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="revolvente" className="font-semibold">Deuda del Periodo (Mes Actual)</Label>
                  <span className="text-[10px] text-muted-foreground">En App: ${appMetrics.revolvente.toFixed(2)}</span>
                </div>
                <Input
                  id="revolvente"
                  type="text"
                  value={revolventeInput}
                  onChange={e => setRevolventeInput(e.target.value)}
                  placeholder={`Ej. ${appMetrics.revolvente.toFixed(0)} o =1000+500`}
                  className="rounded-xl"
                />
                {Math.abs(revolventeDiff) >= 0.01 && (
                  <span className={cn("text-[10px] font-bold", revolventeDiff > 0 ? "text-red-600" : "text-green-600")}>
                    Ajuste revolvente: {revolventeDiff > 0 ? "Cargo" : "Abono"} de ${Math.abs(revolventeDiff).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Sección Meses */}
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="meses" className="font-semibold">Deuda a Meses (Diferido)</Label>
                  <span className="text-[10px] text-muted-foreground">En App: ${appMetrics.meses.toFixed(2)}</span>
                </div>
                <Input
                  id="meses"
                  type="text"
                  value={mesesInput}
                  onChange={e => setMesesInput(e.target.value)}
                  placeholder={`Ej. ${appMetrics.meses.toFixed(0)} o =1000*3`}
                  className="rounded-xl"
                />
                {Math.abs(mesesDiff) >= 0.01 && (
                  <div className="space-y-2 mt-1">
                    <span className={cn("text-[10px] font-bold block", mesesDiff > 0 ? "text-red-600" : "text-green-600")}>
                      Ajuste diferido: {mesesDiff > 0 ? "Cargo" : "Abono"} de ${Math.abs(mesesDiff).toFixed(2)}
                    </span>
                    
                    <div className="bg-muted/40 p-3 rounded-2xl border space-y-1.5">
                      <Label className="text-xs font-bold">Plazo (Meses)</Label>
                      <Select value={adjustmentInstallments} onValueChange={setAdjustmentInstallments}>
                        <SelectTrigger className="rounded-xl bg-background h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                            <SelectItem key={num} value={num.toString()} className="text-xs">
                              {num} {num === 1 ? 'mes' : 'meses'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {parseInt(adjustmentInstallments) > 1 && (
                        <p className="text-[10px] text-primary font-medium">
                          Se generarán {adjustmentInstallments} mensualidades de ${(Math.abs(mesesDiff) / parseInt(adjustmentInstallments)).toFixed(2)} cada una a partir del próximo mes.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-muted/50 p-4 rounded-2xl space-y-2 border text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deuda Global Real (Suma):</span>
                  <span className="font-bold">${(revolventeVal + mesesVal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Deuda Global en App:</span>
                  <span className="font-bold">${card.current_balance.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right col-span-2">
                  {card.type === "debit" 
                    ? "Saldo en App:" 
                    : "Crédito Disponible en App:"}
                </Label>
                <span className="font-bold">${appBalance.toFixed(2)}</span>
              </div>
              
              <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="realValue" className="text-right col-span-2 font-semibold">
                  {card.type === "debit" 
                    ? "Saldo Real:" 
                    : "Crédito Disponible Real:"}
                </Label>
                <Input
                  id="realValue"
                  type="text"
                  value={realValueInput}
                  onChange={e => setRealValueInput(e.target.value)}
                  className="col-span-1 rounded-xl"
                  placeholder="0.00"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button 
            onClick={handleReconcile} 
            disabled={isSubmitting || (card.type === "credit" && creditMode === "detailed" ? (!revolventeInput && !mesesInput) : !realValueInput)}
            className="rounded-xl font-bold"
          >
            {isSubmitting ? "Ajustando..." : "Cuadrar Saldo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CardReconciliationDialog;
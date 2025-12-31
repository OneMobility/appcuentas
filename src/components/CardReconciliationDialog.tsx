"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { evaluateExpression } from "@/utils/math-helpers";
import { cn } from "@/lib/utils";

interface CardDataForReconciliation {
  id: string;
  name: string;
  current_balance: number;
  type: "credit" | "debit";
  credit_limit?: number; // Added credit_limit for credit cards
  transactions: any[]; // Added to get transaction count
}

interface CardReconciliationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardDataForReconciliation;
  onReconciliationSuccess: () => void;
  onNoAdjustmentSuccess: () => void; // New prop for success when no adjustment is needed
}

const CardReconciliationDialog: React.FC<CardReconciliationDialogProps> = ({
  isOpen,
  onClose,
  card,
  onReconciliationSuccess,
  onNoAdjustmentSuccess,
}) => {
  const { user } = useSession();
  const [realBalanceInput, setRealBalanceInput] = useState<string>("");
  const [calculatedDifference, setCalculatedDifference] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRealBalanceInput(""); // Reset input when dialog opens
      setCalculatedDifference(0);
    }
  }, [isOpen]);

  // Calculate appBalance based on card type
  const appBalance = card.type === "credit" && card.credit_limit !== undefined
    ? card.credit_limit - card.current_balance // For credit cards, show available credit
    : card.current_balance; // For debit cards, show current balance

  const handleRealBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRealBalanceInput(value);

    let realBalance: number | null = null;
    if (value.startsWith('=')) {
      realBalance = evaluateExpression(value.substring(1));
    } else {
      realBalance = parseFloat(value);
    }

    if (realBalance !== null && !isNaN(realBalance)) {
      setCalculatedDifference(realBalance - appBalance);
    } else {
      setCalculatedDifference(0);
    }
  };

  const handleReconcile = async () => {
    if (!user) {
      showError("Debes iniciar sesión para realizar la conciliación.");
      return;
    }

    let realBalance: number | null = null;
    if (realBalanceInput.startsWith('=')) {
      realBalance = evaluateExpression(realBalanceInput.substring(1));
    } else {
      realBalance = parseFloat(realBalanceInput);
    }

    if (realBalance === null || isNaN(realBalance)) {
      showError("Por favor, ingresa un saldo real válido.");
      return;
    }

    const difference = realBalance - appBalance;

    if (difference === 0) {
      onNoAdjustmentSuccess(); // Trigger success overlay
      onClose();
      return;
    }

    setIsSubmitting(true);
    const transactionDate = format(new Date(), "yyyy-MM-dd");
    const adjustmentAmount = Math.abs(difference);
    
    let transactionType: "charge" | "payment";

    if (card.type === "credit") {
      // If real available > app available (difference > 0), app's debt is higher than it should be. Need a 'payment' to reduce debt.
      // If real available < app available (difference < 0), app's debt is lower than it should be. Need a 'charge' to increase debt.
      transactionType = difference > 0 ? "payment" : "charge";
    } else { // Debit card
      // If real balance > app balance (difference > 0), app's balance is lower than it should be. Need a 'payment' (deposit) to increase balance.
      // If real balance < app balance (difference < 0), app's balance is higher than it should be. Need a 'charge' (withdrawal) to decrease balance.
      transactionType = difference > 0 ? "payment" : "charge";
    }

    try {
      // Insert adjustment transaction
      const { error: transactionError } = await supabase
        .from('card_transactions')
        .insert({
          user_id: user.id,
          card_id: card.id,
          type: transactionType,
          amount: adjustmentAmount,
          description: `Ajuste de Cuadre`, // Simplified description
          date: transactionDate,
          income_category_id: null, // Internal adjustment, no category
          expense_category_id: null, // Internal adjustment, no category
          is_adjustment: true, // Mark as adjustment
        });

      if (transactionError) throw transactionError;

      // Update card's current_balance
      // For credit cards, current_balance is debt. If available credit increases, debt decreases.
      // If available credit decreases, debt increases.
      const newCurrentBalanceForCard = card.type === "credit"
        ? card.current_balance - difference // If difference > 0 (available increased), debt decreases. If difference < 0 (available decreased), debt increases.
        : card.current_balance + difference; // For debit, direct adjustment to current_balance

      const { error: cardUpdateError } = await supabase
        .from('cards')
        .update({ current_balance: newCurrentBalanceForCard })
        .eq('id', card.id)
        .eq('user_id', user.id);

      if (cardUpdateError) throw cardUpdateError;

      showSuccess("Saldo de tarjeta ajustado exitosamente.");
      onReconciliationSuccess();
      onClose();
    } catch (error: any) {
      showError('Error al realizar el ajuste: ' + error.message);
      console.error("Supabase reconciliation error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cuadre de Tarjeta: {card.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-right col-span-2">
              {card.type === "credit" ? "Crédito Disponible en App:" : "Saldo en App:"}
            </Label>
            <span className="font-bold">${appBalance.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="realBalance" className="text-right col-span-2">
              {card.type === "credit" ? "Crédito Disponible Real:" : "Saldo Real de la Tarjeta:"}
            </Label>
            <Input
              id="realBalance"
              name="realBalance"
              type="text" // Allow expressions
              value={realBalanceInput}
              onChange={handleRealBalanceChange}
              className="col-span-1"
              placeholder="Ej. 100 o =50+20*2"
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-right col-span-2">Diferencia:</Label>
            <span className={cn("font-bold", calculatedDifference !== 0 && (calculatedDifference > 0 ? "text-green-600" : "text-red-600"))}>
              ${calculatedDifference.toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-right col-span-2">Registros en App:</Label>
            <span>{card.transactions?.length || 0}</span>
          </div>
          {calculatedDifference !== 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center">
              Se creará una transacción de ajuste para que el saldo de la app coincida con el saldo real.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleReconcile} disabled={isSubmitting}>
            {isSubmitting ? "Ajustando..." : "Cuadrar Saldo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CardReconciliationDialog;
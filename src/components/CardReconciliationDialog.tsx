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
  transactions: any[]; // Added to get transaction count
}

interface CardReconciliationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardDataForReconciliation;
  onReconciliationSuccess: () => void;
}

const CardReconciliationDialog: React.FC<CardReconciliationDialogProps> = ({
  isOpen,
  onClose,
  card,
  onReconciliationSuccess,
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

  const appBalance = card.current_balance;

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
      showSuccess("El saldo ya está cuadrado. No se necesita ajuste.");
      onClose();
      return;
    }

    setIsSubmitting(true);
    const transactionDate = format(new Date(), "yyyy-MM-dd");
    const adjustmentAmount = Math.abs(difference);
    // If real > app, app balance needs to increase. This is like a "payment" to the card.
    // If real < app, app balance needs to decrease. This is like a "charge" on the card.
    const transactionType = difference > 0 ? "payment" : "charge"; 

    try {
      // Insert adjustment transaction
      const { error: transactionError } = await supabase
        .from('card_transactions')
        .insert({
          user_id: user.id,
          card_id: card.id,
          type: transactionType,
          amount: adjustmentAmount,
          description: `Ajuste de cuadre: ${difference > 0 ? 'Aumento' : 'Disminución'} de saldo para coincidir con el saldo real.`,
          date: transactionDate,
          income_category_id: null, // Internal adjustment, no category
          expense_category_id: null, // Internal adjustment, no category
        });

      if (transactionError) throw transactionError;

      // Update card's current_balance
      const newCardBalance = appBalance + difference;
      const { error: cardUpdateError } = await supabase
        .from('cards')
        .update({ current_balance: newCardBalance })
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
            <Label className="text-right col-span-2">Saldo en la App:</Label>
            <span className="font-bold">${appBalance.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="realBalance" className="text-right col-span-2">
              Saldo Real de la Tarjeta:
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
          <Button onClick={handleReconcile} disabled={isSubmitting || calculatedDifference === 0}>
            {isSubmitting ? "Ajustando..." : "Cuadrar Saldo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CardReconciliationDialog;
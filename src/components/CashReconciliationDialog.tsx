"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { evaluateExpression } from "@/utils/math-helpers";
import { getLocalDateString } from "@/utils/date-helpers";

interface CashReconciliationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appBalance: number;
  transactionCount: number;
  onReconciliationSuccess: () => void;
  onNoAdjustmentSuccess: () => void;
}

const CashReconciliationDialog: React.FC<CashReconciliationDialogProps> = ({
  isOpen,
  onClose,
  appBalance,
  transactionCount,
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

    if (Math.abs(difference) < 0.01) { // Check for near zero difference
      onNoAdjustmentSuccess(); // Trigger success overlay
      onClose();
      return;
    }

    setIsSubmitting(true);
    const transactionDate = getLocalDateString(new Date());
    const adjustmentAmount = Math.abs(difference);
    
    // If difference > 0, we need an 'ingreso' (deposit) to increase the balance.
    // If difference < 0, we need an 'egreso' (withdrawal) to decrease the balance.
    const transactionType: "ingreso" | "egreso" = difference > 0 ? "ingreso" : "egreso";

    try {
      // Insert adjustment transaction
      const { error: transactionError } = await supabase
        .from('cash_transactions')
        .insert({
          user_id: user.id,
          type: transactionType,
          amount: adjustmentAmount,
          description: `Ajuste de Cuadre (Diferencia: ${difference.toFixed(2)})`,
          date: transactionDate,
          income_category_id: null, // Internal adjustment, no category
          expense_category_id: null, // Internal adjustment, no category
        });

      if (transactionError) throw transactionError;

      onReconciliationSuccess();
      onClose();
    } catch (error: any) {
      showError('Error al realizar el ajuste: ' + error.message);
      console.error("Supabase cash reconciliation error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cuadre de Efectivo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-right col-span-2">
              Saldo en App:
            </Label>
            <span className="font-bold">${appBalance.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="realBalance" className="text-right col-span-2">
              Saldo Real de Efectivo:
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
            <span>{transactionCount}</span>
          </div>
          {calculatedDifference !== 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center">
              Se creará una transacción de ajuste para que el saldo de la app coincida con el saldo real.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleReconcile} disabled={isSubmitting || realBalanceInput === ""}>
            {isSubmitting ? "Ajustando..." : "Cuadrar Saldo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CashReconciliationDialog;
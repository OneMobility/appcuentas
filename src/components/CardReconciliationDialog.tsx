"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { format } from "date-fns";
import { evaluateExpression } from "@/utils/math-helpers";
import { cn } from "@/lib/utils";

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
  const [realValueInput, setRealValueInput] = useState<string>("");
  const [calculatedDifference, setCalculatedDifference] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Nuevo: modo de cuadre para crédito (available o debt)
  const [creditMode, setCreditMode] = useState<"available" | "debt">("available");

  useEffect(() => {
    if (isOpen) {
      setRealValueInput("");
      setCalculatedDifference(0);
    }
  }, [isOpen]);

  // Cálculo del valor que la App tiene actualmente
  const getAppBalance = () => {
    if (card.type === "debit") return card.current_balance;
    
    // Para crédito
    if (creditMode === "available") {
      return (card.credit_limit || 0) - card.current_balance;
    } else {
      return card.current_balance; // Deuda actual
    }
  };

  const appBalance = getAppBalance();

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRealValueInput(value);

    let realBalance: number | null = null;
    if (value.startsWith('=')) {
      realBalance = evaluateExpression(value.substring(1));
    } else {
      realBalance = parseFloat(value);
    }

    if (realBalance !== null && !isNaN(realBalance)) {
      // En modo deuda, si el valor real es mayor, la diferencia es positiva (más deuda)
      // En modo disponible, si el valor real es mayor, la diferencia es positiva (menos deuda)
      setCalculatedDifference(realBalance - appBalance);
    } else {
      setCalculatedDifference(0);
    }
  };

  const handleReconcile = async () => {
    if (!user) {
      showError("Debes iniciar sesión.");
      return;
    }

    let realBalance: number | null = null;
    if (realValueInput.startsWith('=')) {
      realBalance = evaluateExpression(realValueInput.substring(1));
    } else {
      realBalance = parseFloat(realValueInput);
    }

    if (realBalance === null || isNaN(realBalance)) {
      showError("Ingresa un valor válido.");
      return;
    }

    const difference = realBalance - appBalance;

    if (Math.abs(difference) < 0.01) {
      onNoAdjustmentSuccess();
      onClose();
      return;
    }

    setIsSubmitting(true);
    const transactionDate = format(new Date(), "yyyy-MM-dd");
    const adjustmentAmount = Math.abs(difference);
    
    let transactionType: "charge" | "payment";
    let newCurrentBalanceForCard = card.current_balance;

    if (card.type === "credit") {
      if (creditMode === "available") {
        // Si disponible real > app (diff > 0) -> Tengo menos deuda de la que creía -> Pago (abono)
        transactionType = difference > 0 ? "payment" : "charge";
        newCurrentBalanceForCard = card.current_balance - difference;
      } else {
        // Modo Deuda: Si deuda real > app (diff > 0) -> Debo más de lo que creía -> Cargo (gasto)
        transactionType = difference > 0 ? "charge" : "payment";
        newCurrentBalanceForCard = card.current_balance + difference;
      }
    } else {
      // Débito: Si real > app (diff > 0) -> Tengo más dinero -> Pago (depósito)
      transactionType = difference > 0 ? "payment" : "charge";
      newCurrentBalanceForCard = card.current_balance + difference;
    }

    try {
      const { error: transactionError } = await supabase
        .from('card_transactions')
        .insert({
          user_id: user.id,
          card_id: card.id,
          type: transactionType,
          amount: adjustmentAmount,
          description: `Ajuste de Cuadre (${creditMode === 'debt' ? 'por Deuda' : 'por Saldo'})`,
          date: transactionDate,
          is_adjustment: true,
        });

      if (transactionError) throw transactionError;

      const { error: cardUpdateError } = await supabase
        .from('cards')
        .update({ current_balance: newCurrentBalanceForCard })
        .eq('id', card.id);

      if (cardUpdateError) throw cardUpdateError;

      showSuccess("Saldo ajustado correctamente.");
      onReconciliationSuccess();
      onClose();
    } catch (error: any) {
      showError('Error: ' + error.message);
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

        {card.type === "credit" && (
          <Tabs value={creditMode} onValueChange={(v: any) => {
            setCreditMode(v);
            setRealValueInput("");
            setCalculatedDifference(0);
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="available">Por Disponible</TabsTrigger>
              <TabsTrigger value="debt">Por Deuda Total</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-right col-span-2">
              {card.type === "debit" 
                ? "Saldo en App:" 
                : (creditMode === "available" ? "Crédito Disponible en App:" : "Deuda Actual en App:")}
            </Label>
            <span className="font-bold">${appBalance.toFixed(2)}</span>
          </div>
          
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="realValue" className="text-right col-span-2 font-semibold">
              {card.type === "debit" 
                ? "Saldo Real:" 
                : (creditMode === "available" ? "Crédito Disponible Real:" : "Deuda Real (Lo que debes):")}
            </Label>
            <Input
              id="realValue"
              type="text"
              value={realValueInput}
              onChange={handleValueChange}
              className="col-span-1"
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-right col-span-2">Diferencia:</Label>
            <span className={cn(
              "font-bold", 
              calculatedDifference !== 0 && (
                // En modo deuda, diferencia positiva es malo (más deuda). En disponible/débito es bueno (más dinero).
                (card.type === "credit" && creditMode === "debt")
                  ? (calculatedDifference > 0 ? "text-red-600" : "text-green-600")
                  : (calculatedDifference > 0 ? "text-green-600" : "text-red-600")
              )
            )}>
              {calculatedDifference > 0 ? "+" : ""}{calculatedDifference.toFixed(2)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleReconcile} disabled={isSubmitting || !realValueInput}>
            {isSubmitting ? "Ajustando..." : "Cuadrar Saldo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CardReconciliationDialog;
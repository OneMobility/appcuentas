"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { format } from "date-fns";
import { evaluateExpression } from "@/utils/math-helpers";
import { cn } from "@/lib/utils";
import { AlertCircle, HelpCircle } from "lucide-react";

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
  const [showHelp, setShowHelp] = useState(false);
  
  // Modos de cuadre para crédito: "detailed" (Desglosado), "available" (Disponible)
  const [creditMode, setCreditMode] = useState<"detailed" | "available">("detailed");

  // Inputs para modo desglosado (Crédito)
  const [revolventeInput, setRevolventeInput] = useState<string>("");
  const [mesesInput, setMesesInput] = useState<string>("");

  // Input para modo disponible (Crédito) o saldo (Débito)
  const [realValueInput, setRealValueInput] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setRevolventeInput("");
      setMesesInput("");
      setRealValueInput("");
      setShowHelp(false);
    }
  }, [isOpen]);

  // Valores evaluados
  const revolventeVal = useMemo(() => {
    if (!revolventeInput) return 0;
    return revolventeInput.startsWith('=')
      ? (evaluateExpression(revolventeInput.substring(1)) || 0)
      : (parseFloat(revolventeInput) || 0);
  }, [revolventeInput]);

  const mesesVal = useMemo(() => {
    if (!mesesInput) return 0;
    return mesesInput.startsWith('=')
      ? (evaluateExpression(mesesInput.substring(1)) || 0)
      : (parseFloat(mesesInput) || 0);
  }, [mesesInput]);

  const realValueVal = useMemo(() => {
    if (!realValueInput) return 0;
    return realValueInput.startsWith('=')
      ? (evaluateExpression(realValueInput.substring(1)) || 0)
      : (parseFloat(realValueInput) || 0);
  }, [realValueInput]);

  // Cálculos de balance and diferencia
  const appBalance = useMemo(() => {
    if (card.type === "debit") return card.current_balance;
    if (creditMode === "available") {
      return (card.credit_limit || 0) - card.current_balance;
    }
    return card.current_balance; // Deuda global en App
  }, [card, creditMode]);

  const calculatedDifference = useMemo(() => {
    if (card.type === "credit" && creditMode === "detailed") {
      const totalRealDebt = revolventeVal + mesesVal;
      return totalRealDebt - card.current_balance; // Diferencia contra la deuda global de la app
    }
    return realValueVal - appBalance;
  }, [card, creditMode, revolventeVal, mesesVal, realValueVal, appBalance]);

  const handleReconcile = async () => {
    if (!user) {
      showError("Debes iniciar sesión.");
      return;
    }

    const difference = calculatedDifference;

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
      if (creditMode === "detailed") {
        // Si la deuda real (revolvente + meses) es mayor que la de la app (diff > 0) -> Debo más -> Cargo (gasto)
        transactionType = difference > 0 ? "charge" : "payment";
        newCurrentBalanceForCard = card.current_balance + difference;
      } else {
        // Modo Disponible: Si disponible real > app (diff > 0) -> Tengo menos deuda -> Pago (abono)
        transactionType = difference > 0 ? "payment" : "charge";
        newCurrentBalanceForCard = card.current_balance - difference;
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
          description: `Ajuste de Cuadre (${card.type === 'credit' ? (creditMode === 'detailed' ? 'Desglosado' : 'Disponible') : 'Saldo'})`,
          date: transactionDate,
          is_adjustment: true,
        });

      if (transactionError) throw transactionError;

      const { error: cardUpdateError } = await supabase
        .from('cards')
        .update({ current_balance: newCurrentBalanceForCard })
        .eq('id', card.id);

      if (cardUpdateError) throw cardUpdateError;

      showSuccess("Saldo de tarjeta ajustado correctamente.");
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
      <DialogContent className="sm:max-w-[425px] rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>Cuadre de Tarjeta: {card.name}</DialogTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full" 
              onClick={() => setShowHelp(!showHelp)}
              title="¿Cómo funciona?"
            >
              <HelpCircle className="h-5 w-5 text-primary" />
            </Button>
          </div>
        </DialogHeader>

        {showHelp && (
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-xs text-blue-800 space-y-2 animate-in fade-in duration-200">
            <p className="font-bold flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> ¿Cómo organizar tus montos?
            </p>
            <p>
              • <b>Deuda Revolvente:</b> Es lo que debes de tus compras normales del mes (las que pagas completas en tu fecha límite).
            </p>
            <p>
              • <b>Deuda a Meses (MSI):</b> Es la suma total de lo que te falta por pagar de tus compras diferidas. <i>No necesitas desglosar los meses aquí</i>, ya que la app los distribuye automáticamente mes a mes según la fecha de cada mensualidad.
            </p>
            <p>
              • El cuadre creará un movimiento de ajuste para que tu saldo global en la app coincida perfectamente con tu estado de cuenta real.
            </p>
          </div>
        )}

        {card.type === "credit" && (
          <Tabs value={creditMode} onValueChange={(v: any) => {
            setCreditMode(v);
            setRevolventeInput("");
            setMesesInput("");
            setRealValueInput("");
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
              <div className="grid gap-2">
                <Label htmlFor="revolvente" className="font-semibold">Deuda Actual / Revolvente (Real)</Label>
                <Input
                  id="revolvente"
                  type="text"
                  value={revolventeInput}
                  onChange={e => setRevolventeInput(e.target.value)}
                  placeholder="Ej. 1500 o =1000+500"
                  className="rounded-xl"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="meses" className="font-semibold">Deuda a Meses / Diferido (Real)</Label>
                <Input
                  id="meses"
                  type="text"
                  value={mesesInput}
                  onChange={e => setMesesInput(e.target.value)}
                  placeholder="Ej. 3000 o =1000*3"
                  className="rounded-xl"
                />
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

          <div className="grid grid-cols-3 items-center gap-4 border-t pt-2">
            <Label className="text-right col-span-2 font-bold">Diferencia a Ajustar:</Label>
            <span className={cn(
              "font-black text-base", 
              calculatedDifference !== 0 && (
                // En modo deuda desglosada, diferencia positiva es malo (más deuda). En disponible/débito es bueno (más dinero).
                (card.type === "credit" && creditMode === "detailed")
                  ? (calculatedDifference > 0 ? "text-red-600" : "text-green-600")
                  : (calculatedDifference > 0 ? "text-green-600" : "text-red-600")
              )
            )}>
              {calculatedDifference > 0 ? "+" : ""}{calculatedDifference.toFixed(2)}
            </span>
          </div>
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
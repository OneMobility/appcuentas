"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { format } from "date-fns";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  last_four_digits: string;
  type: "credit" | "debit";
  current_balance: number;
  credit_limit?: number;
}

interface CardTransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardData[];
  cashBalance: number;
  onTransferSuccess: () => void;
  initialSourceId?: string; // Prop opcional para pre-seleccionar el origen
}

const CardTransferDialog: React.FC<CardTransferDialogProps> = ({ 
  isOpen, 
  onClose, 
  cards, 
  cashBalance, 
  onTransferSuccess,
  initialSourceId 
}) => {
  const { user } = useSession();
  const [sourceAccountId, setSourceAccountId] = useState<string>("");
  const [destinationAccountId, setDestinationAccountId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setSourceAccountId(initialSourceId || "");
      setDestinationAccountId("");
      setAmount("");
      setDescription("");
    }
  }, [isOpen, initialSourceId]);

  // Si el origen seleccionado es igual al destino, limpiamos el destino
  useEffect(() => {
    if (sourceAccountId && sourceAccountId === destinationAccountId) {
      setDestinationAccountId("");
    }
  }, [sourceAccountId, destinationAccountId]);

  // Separar las tarjetas para agruparlas en el selector de origen
  const debitCards = cards.filter(card => card.type === "debit");
  const creditCards = cards.filter(card => card.type === "credit");

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para realizar transferencias.");
      return;
    }
    if (!sourceAccountId || !destinationAccountId) {
      showError("Por favor, selecciona una cuenta de origen y una de destino.");
      return;
    }
    if (sourceAccountId === destinationAccountId) {
      showError("La cuenta de origen y destino no pueden ser la misma.");
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      showError("El monto de la transferencia debe ser un número positivo.");
      return;
    }

    // Buscar información de las cuentas origen y destino
    let sourceBalance = 0;
    let sourceName = "";

    if (sourceAccountId === "cash") {
      sourceBalance = cashBalance;
      sourceName = "Efectivo";
    } else {
      const sourceCard = cards.find(c => c.id === sourceAccountId);
      if (!sourceCard) {
        showError("Cuenta de origen no encontrada.");
        return;
      }
      sourceName = `Tarjeta ${sourceCard.name}`;
      // Si es crédito, el saldo disponible es límite - deuda.
      // Si es débito, el saldo disponible es current_balance.
      sourceBalance = sourceCard.type === "credit" 
        ? (sourceCard.credit_limit || 0) - sourceCard.current_balance
        : sourceCard.current_balance;
    }

    let destinationName = "";
    if (destinationAccountId === "cash") {
      destinationName = "Efectivo";
    } else {
      const destCard = cards.find(c => c.id === destinationAccountId);
      if (!destCard) {
        showError("Cuenta de destino no encontrada.");
        return;
      }
      destinationName = `Tarjeta ${destCard.name}`;
    }

    // Validar saldo suficiente en origen
    if (sourceBalance < transferAmount) {
      showError(`Saldo o crédito disponible insuficiente en origen (${sourceName}).`);
      return;
    }

    const transactionDate = format(new Date(), "yyyy-MM-dd");
    const transferDescription = description.trim() || `Transferencia a ${destinationName}`;

    try {
      // 1. CARGO O RETIRO DE LA CUENTA ORIGEN
      if (sourceAccountId === "cash") {
        const { error: cashError } = await supabase.from('cash_transactions').insert({
          user_id: user.id,
          type: "egreso",
          amount: transferAmount,
          description: `Transferencia a ${destinationName}: ${transferDescription}`,
          date: transactionDate,
        });
        if (cashError) throw cashError;
      } else {
        const sourceCard = cards.find(c => c.id === sourceAccountId)!;
        let newSourceCardBalance = sourceCard.current_balance;

        if (sourceCard.type === "credit") {
          // Transferir desde tarjeta de crédito aumenta la deuda de la tarjeta de crédito (disposición de fondos)
          newSourceCardBalance += transferAmount;
        } else {
          // Transferir desde tarjeta de débito disminuye su saldo
          newSourceCardBalance -= transferAmount;
        }

        const { error: sourceCardError } = await supabase
          .from('cards')
          .update({ current_balance: newSourceCardBalance })
          .eq('id', sourceCard.id);
        
        if (sourceCardError) throw sourceCardError;

        const { error: sourceTxError } = await supabase.from('card_transactions').insert({
          user_id: user.id,
          card_id: sourceCard.id,
          type: "charge", // Se registra como un cargo/gasto en la tarjeta origen
          amount: transferAmount,
          description: `Transferencia a ${destinationName}: ${transferDescription}`,
          date: transactionDate,
        });
        if (sourceTxError) throw sourceTxError;
      }

      // 2. DEPÓSITO O ABONO A LA CUENTA DESTINO
      if (destinationAccountId === "cash") {
        const { error: cashDestError } = await supabase.from('cash_transactions').insert({
          user_id: user.id,
          type: "ingreso",
          amount: transferAmount,
          description: `Transferencia desde ${sourceName}: ${transferDescription}`,
          date: transactionDate,
        });
        if (cashDestError) throw cashDestError;
      } else {
        const destinationCard = cards.find(c => c.id === destinationAccountId)!;
        let newDestinationCardBalance = destinationCard.current_balance;

        if (destinationCard.type === "credit") {
          // Depositar a tarjeta de crédito reduce su deuda (pago)
          newDestinationCardBalance -= transferAmount;
          if (newDestinationCardBalance < 0) {
            toast.info(`Has sobrepagado tu tarjeta ${destinationCard.name}. Tu saldo actual es de $${newDestinationCardBalance.toFixed(2)} (a tu favor).`, {
              style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
              duration: 10000
            });
          }
        } else {
          // Depositar a tarjeta de débito aumenta su saldo
          newDestinationCardBalance += transferAmount;
        }

        const { error: destCardError } = await supabase
          .from('cards')
          .update({ current_balance: newDestinationCardBalance })
          .eq('id', destinationCard.id);
        
        if (destCardError) throw destCardError;

        const { error: destTxError } = await supabase.from('card_transactions').insert({
          user_id: user.id,
          card_id: destinationCard.id,
          type: "payment", // Se registra como un abono/pago en la tarjeta destino
          amount: transferAmount,
          description: `Transferencia desde ${sourceName}: ${transferDescription}`,
          date: transactionDate,
        });
        if (destTxError) throw destTxError;
      }

      showSuccess("Transferencia realizada exitosamente.");
      onTransferSuccess();
      onClose();
    } catch (error: any) {
      showError('Error al realizar la transferencia: ' + error.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" /> Realizar Transferencia
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleTransfer} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sourceAccount" className="text-right">
              Origen
            </Label>
            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
              <SelectTrigger id="sourceAccount" className="col-span-3 rounded-xl">
                <SelectValue placeholder="Selecciona origen" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Efectivo</SelectLabel>
                  <SelectItem value="cash">Efectivo (Saldo: ${cashBalance.toFixed(2)})</SelectItem>
                </SelectGroup>
                
                {debitCards.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Tarjetas de Débito</SelectLabel>
                    {debitCards.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.bank_name} ****{c.last_four_digits}) - Saldo: ${c.current_balance.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {creditCards.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Tarjetas de Crédito</SelectLabel>
                    {creditCards.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.bank_name} ****{c.last_four_digits}) - Disp: ${((c.credit_limit || 0) - c.current_balance).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="destinationAccount" className="text-right">
              Destino
            </Label>
            <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
              <SelectTrigger id="destinationAccount" className="col-span-3 rounded-xl">
                <SelectValue placeholder="Selecciona destino" />
              </SelectTrigger>
              <SelectContent>
                {/* Excluimos el origen seleccionado de las opciones de destino */}
                {sourceAccountId !== "cash" && (
                  <SelectGroup>
                    <SelectLabel>Efectivo</SelectLabel>
                    <SelectItem value="cash">Efectivo (Saldo: ${cashBalance.toFixed(2)})</SelectItem>
                  </SelectGroup>
                )}
                
                {debitCards.filter(c => c.id !== sourceAccountId).length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Tarjetas de Débito</SelectLabel>
                    {debitCards.filter(c => c.id !== sourceAccountId).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.bank_name} ****{c.last_four_digits}) - Saldo: ${c.current_balance.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {creditCards.filter(c => c.id !== sourceAccountId).length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Tarjetas de Crédito</SelectLabel>
                    {creditCards.filter(c => c.id !== sourceAccountId).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.bank_name} ****{c.last_four_digits}) - Disp: ${((c.credit_limit || 0) - c.current_balance).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Monto
            </Label>
            <Input
              id="amount"
              name="amount"
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="col-span-3 rounded-xl h-10"
              placeholder="Ej. 100 o =50+50"
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right text-xs">
              Nota (Opcional)
            </Label>
            <Input
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 rounded-xl h-10"
              placeholder="Ej. Pago de cena..."
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full rounded-xl h-11 font-bold">Confirmar Transferencia</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CardTransferDialog;
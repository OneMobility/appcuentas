"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { format } from "date-fns";
import { CreditCard, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner"; // Importar toast de sonner

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
  onTransferSuccess: () => void;
}

const CardTransferDialog: React.FC<CardTransferDialogProps> = ({ isOpen, onClose, cards, onTransferSuccess }) => {
  const { user } = useSession();
  const [sourceCardId, setSourceCardId] = useState<string>("");
  const [destinationCardId, setDestinationCardId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setSourceCardId("");
      setDestinationCardId("");
      setAmount("");
      setDescription("");
    }
  }, [isOpen]);

  const debitCards = cards.filter(card => card.type === "debit");
  const availableDestinationCards = cards.filter(card => card.id !== sourceCardId);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("Debes iniciar sesión para realizar transferencias.");
      return;
    }
    if (!sourceCardId || !destinationCardId) {
      showError("Por favor, selecciona ambas tarjetas para la transferencia.");
      return;
    }
    if (sourceCardId === destinationCardId) {
      showError("La tarjeta de origen y destino no pueden ser la misma.");
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      showError("El monto de la transferencia debe ser un número positivo.");
      return;
    }

    const sourceCard = cards.find(c => c.id === sourceCardId);
    const destinationCard = cards.find(c => c.id === destinationCardId);

    if (!sourceCard || !destinationCard) {
      showError("Tarjetas no encontradas.");
      return;
    }

    if (sourceCard.current_balance < transferAmount) {
      showError(`Saldo insuficiente en la tarjeta de origen (${sourceCard.name}).`);
      return;
    }

    // Calculate new balances
    const newSourceBalance = sourceCard.current_balance - transferAmount;
    let newDestinationBalance = destinationCard.current_balance;

    if (destinationCard.type === "credit") {
      // For credit card, payment reduces current_balance (debt)
      newDestinationBalance -= transferAmount;
      // Permitir que el saldo sea negativo para reflejar sobrepago
      if (newDestinationBalance < 0) {
        toast.info(`Has sobrepagado tu tarjeta ${destinationCard.name}. Tu saldo actual es de $${newDestinationBalance.toFixed(2)} (a tu favor).`, {
          style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
          duration: 10000
        });
      }
    } else { // Debit card
      // For debit card, payment increases current_balance
      newDestinationBalance += transferAmount;
    }

    const transactionDate = format(new Date(), "yyyy-MM-dd");
    const transferDescription = description.trim() || `Transferencia a ${destinationCard.name} (${destinationCard.bank_name})`;

    try {
      // Update source card balance
      const { error: sourceUpdateError } = await supabase
        .from('cards')
        .update({ current_balance: newSourceBalance })
        .eq('id', sourceCard.id)
        .eq('user_id', user.id);
      if (sourceUpdateError) throw sourceUpdateError;

      // Insert transaction for source card (type: 'charge' as money leaves)
      const { error: sourceTxError } = await supabase
        .from('card_transactions')
        .insert({
          user_id: user.id,
          card_id: sourceCard.id,
          type: "charge",
          amount: transferAmount,
          description: `Transferencia a ${destinationCard.name} (${destinationCard.bank_name}): ${transferDescription}`,
          date: transactionDate,
        });
      if (sourceTxError) throw sourceTxError;

      // Update destination card balance
      const { error: destUpdateError } = await supabase
        .from('cards')
        .update({ current_balance: newDestinationBalance })
        .eq('id', destinationCard.id)
        .eq('user_id', user.id);
      if (destUpdateError) throw destUpdateError;

      // Insert transaction for destination card (type: 'payment' as money arrives)
      const { error: destTxError } = await supabase
        .from('card_transactions')
        .insert({
          user_id: user.id,
          card_id: destinationCard.id,
          type: "payment",
          amount: transferAmount,
          description: `Transferencia desde ${sourceCard.name} (${sourceCard.bank_name}): ${transferDescription}`,
          date: transactionDate,
        });
      if (destTxError) throw destTxError;

      showSuccess("Transferencia realizada exitosamente.");
      onTransferSuccess(); // Refresh data in parent component
      onClose();
    } catch (error: any) {
      showError('Error al realizar la transferencia: ' + error.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" /> Realizar Transferencia
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleTransfer} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sourceCard" className="text-right">
              Origen (Débito)
            </Label>
            <Select value={sourceCardId} onValueChange={setSourceCardId}>
              <SelectTrigger id="sourceCard" className="col-span-3">
                <SelectValue placeholder="Selecciona tarjeta de origen" />
              </SelectTrigger>
              <SelectContent>
                {debitCards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name} ({card.bank_name} ****{card.last_four_digits})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="destinationCard" className="text-right">
              Destino
            </Label>
            <Select value={destinationCardId} onValueChange={setDestinationCardId}>
              <SelectTrigger id="destinationCard" className="col-span-3">
                <SelectValue placeholder="Selecciona tarjeta de destino" />
              </SelectTrigger>
              <SelectContent>
                {availableDestinationCards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name} ({card.bank_name} ****{card.last_four_digits})
                  </SelectItem>
                ))}
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
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Descripción (Opcional)
            </Label>
            <Input
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
            />
          </div>
          <DialogFooter>
            <Button type="submit">Confirmar Transferencia</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CardTransferDialog;
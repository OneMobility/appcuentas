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
import { CreditCard, ArrowRightLeft, Wallet } from "lucide-react"; // Importar Wallet para efectivo
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
  cashBalance: number; // Nuevo: Saldo actual de efectivo
  onTransferSuccess: () => void;
}

const CardTransferDialog: React.FC<CardTransferDialogProps> = ({ isOpen, onClose, cards, cashBalance, onTransferSuccess }) => {
  const { user } = useSession();
  const [sourceAccountId, setSourceAccountId] = useState<string>("");
  const [destinationAccountId, setDestinationAccountId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setSourceAccountId("");
      setDestinationAccountId("");
      setAmount("");
      setDescription("");
    }
  }, [isOpen]);

  const allSourceAccounts = [
    { id: "cash", name: "Efectivo", type: "cash", current_balance: cashBalance, display: `Efectivo (Saldo: $${cashBalance.toFixed(2)})` },
    ...cards.filter(card => card.type === "debit").map(card => ({
      ...card,
      type: "card", // Usar 'card' para diferenciar en la lógica
      display: `Tarjeta ${card.name} (${card.bank_name} ****${card.last_four_digits}) (Saldo: $${card.current_balance.toFixed(2)})`
    }))
  ];

  const allDestinationAccounts = [
    { id: "cash", name: "Efectivo", type: "cash", current_balance: cashBalance, display: `Efectivo (Saldo: $${cashBalance.toFixed(2)})` },
    ...cards.map(card => ({
      ...card,
      type: card.type, // Mantener 'credit' o 'debit' para tarjetas
      display: `Tarjeta ${card.name} (${card.bank_name} ****${card.last_four_digits}) (Saldo: $${card.current_balance.toFixed(2)})`
    }))
  ];

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

    const sourceAccount = allSourceAccounts.find(acc => acc.id === sourceAccountId);
    const destinationAccount = allDestinationAccounts.find(acc => acc.id === destinationAccountId);

    if (!sourceAccount || !destinationAccount) {
      showError("Cuentas de origen o destino no encontradas.");
      return;
    }

    // Check source balance
    if (sourceAccount.current_balance < transferAmount) {
      showError(`Saldo insuficiente en la cuenta de origen (${sourceAccount.name}).`);
      return;
    }

    const transactionDate = format(new Date(), "yyyy-MM-dd");
    const transferDescription = description.trim() || `Transferencia a ${destinationAccount.name}`;

    try {
      // Handle Source Account Update and Transaction
      if (sourceAccount.id === "cash") {
        const newCashBalance = cashBalance - transferAmount;
        const { error: cashTxError } = await supabase
          .from('cash_transactions')
          .insert({
            user_id: user.id,
            type: "egreso",
            amount: transferAmount,
            description: `Transferencia a ${destinationAccount.name}: ${transferDescription}`,
            date: transactionDate,
            expense_category_id: null, // No category for internal transfers
            income_category_id: null,
          });
        if (cashTxError) throw cashTxError;
      } else { // Source is a card
        const sourceCard = cards.find(c => c.id === sourceAccountId);
        if (!sourceCard) throw new Error("Tarjeta de origen no encontrada.");
        
        const newSourceCardBalance = sourceCard.current_balance - transferAmount;
        const { error: sourceUpdateError } = await supabase
          .from('cards')
          .update({ current_balance: newSourceCardBalance })
          .eq('id', sourceCard.id)
          .eq('user_id', user.id);
        if (sourceUpdateError) throw sourceUpdateError;

        const { error: sourceTxError } = await supabase
          .from('card_transactions')
          .insert({
            user_id: user.id,
            card_id: sourceCard.id,
            type: "charge",
            amount: transferAmount,
            description: `Transferencia a ${destinationAccount.name}: ${transferDescription}`,
            date: transactionDate,
            expense_category_id: null, // No category for internal transfers
            income_category_id: null,
          });
        if (sourceTxError) throw sourceTxError;
      }

      // Handle Destination Account Update and Transaction
      if (destinationAccount.id === "cash") {
        const newCashBalance = cashBalance + transferAmount;
        const { error: cashTxError } = await supabase
          .from('cash_transactions')
          .insert({
            user_id: user.id,
            type: "ingreso",
            amount: transferAmount,
            description: `Transferencia desde ${sourceAccount.name}: ${transferDescription}`,
            date: transactionDate,
            income_category_id: null, // No category for internal transfers
            expense_category_id: null,
          });
        if (cashTxError) throw cashTxError;
      } else { // Destination is a card
        const destinationCard = cards.find(c => c.id === destinationAccountId);
        if (!destinationCard) throw new Error("Tarjeta de destino no encontrada.");

        let newDestinationCardBalance = destinationCard.current_balance;
        if (destinationCard.type === "credit") {
          newDestinationCardBalance -= transferAmount; // Payment to credit card reduces debt
          if (newDestinationCardBalance < 0) {
            toast.info(`Has sobrepagado tu tarjeta ${destinationCard.name}. Tu saldo actual es de $${newDestinationCardBalance.toFixed(2)} (a tu favor).`, {
              style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
              duration: 10000
            });
          }
        } else { // Debit card
          newDestinationCardBalance += transferAmount; // Deposit to debit card increases balance
        }

        const { error: destUpdateError } = await supabase
          .from('cards')
          .update({ current_balance: newDestinationCardBalance })
          .eq('id', destinationCard.id)
          .eq('user_id', user.id);
        if (destUpdateError) throw destUpdateError;

        const { error: destTxError } = await supabase
          .from('card_transactions')
          .insert({
            user_id: user.id,
            card_id: destinationCard.id,
            type: "payment",
            amount: transferAmount,
            description: `Transferencia desde ${sourceAccount.name}: ${transferDescription}`,
            date: transactionDate,
            income_category_id: null, // No category for internal transfers
            expense_category_id: null,
          });
        if (destTxError) throw destTxError;
      }

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
            <Label htmlFor="sourceAccount" className="text-right">
              Origen
            </Label>
            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
              <SelectTrigger id="sourceAccount" className="col-span-3">
                <SelectValue placeholder="Selecciona cuenta de origen" />
              </SelectTrigger>
              <SelectContent>
                {allSourceAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="destinationAccount" className="text-right">
              Destino
            </Label>
            <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
              <SelectTrigger id="destinationAccount" className="col-span-3">
                <SelectValue placeholder="Selecciona cuenta de destino" />
              </SelectTrigger>
              <SelectContent>
                {allDestinationAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.display}
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
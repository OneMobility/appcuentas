"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, DollarSign, History, Trash2, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface CardTransaction {
  id: string;
  type: "charge" | "payment";
  amount: number; // Monto mensual si es a meses, o monto total si es pago único
  description: string;
  date: string;
  installments_total_amount?: number; // Monto total del cargo original si es a meses
  installments_count?: number; // Número total de meses si es a meses
  installment_number?: number; // Número de cuota actual (1, 2, 3...)
}

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  last_four_digits: string;
  expiration_date: string;
  type: "credit" | "debit";
  initial_balance: number;
  current_balance: number;
  credit_limit?: number;
  cut_off_day?: number;
  days_to_pay_after_cut_off?: number;
  color: string;
  transactions: CardTransaction[];
}

interface CardDisplayProps {
  card: CardData;
  onAddTransaction: (cardId: string) => void;
  onViewDetails: (card: CardData) => void;
  onDeleteCard: (cardId: string) => void;
  onEditCard: (card: CardData) => void;
}

const CardDisplay: React.FC<CardDisplayProps> = ({ card, onAddTransaction, onViewDetails, onDeleteCard, onEditCard }) => {
  const isCredit = card.type === "credit";
  const creditAvailable = isCredit && card.credit_limit !== undefined ? card.credit_limit - card.current_balance : 0;

  return (
    <Card className={cn(
      "relative w-full max-w-sm mx-auto p-6 rounded-xl shadow-lg overflow-hidden text-white"
    )} style={{ backgroundColor: card.color }}>
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <CreditCard className="w-full h-full" />
      </div>
      <CardHeader className="p-0 mb-4 relative z-10">
        <CardTitle className="text-xl font-bold flex items-center justify-between">
          <span>{card.bank_name}</span>
          <span className="text-sm font-normal opacity-80">{isCredit ? "CRÉDITO" : "DÉBITO"}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 relative z-10">
        <div className="mb-4">
          <p className="text-sm opacity-80">
            {isCredit ? "Deuda Pendiente" : "Saldo Disponible"}
          </p>
          <p className="text-3xl font-extrabold">
            ${card.current_balance.toFixed(2)}
          </p>
          {isCredit && card.credit_limit !== undefined && (
            <p className="text-sm opacity-80 mt-1">
              Crédito Disponible: ${creditAvailable.toFixed(2)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div>
            <p className="opacity-80">Número</p>
            <p className="font-semibold">**** {card.last_four_digits}</p>
          </div>
          <div className="text-right">
            <p className="opacity-80">Expira</p>
            <p className="font-semibold">{card.expiration_date}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAddTransaction(card.id)}
            className="flex-1 bg-white/20 hover:bg-white/30 text-white"
          >
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            {isCredit ? "Cargo/Pago" : "Transacción"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onViewDetails(card)}
            className="flex-1 bg-white/20 hover:bg-white/30 text-white"
          >
            <History className="h-3.5 w-3.5 mr-1" />
            Ver Detalles
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEditCard(card)}
            className="w-10 p-0 bg-white/20 hover:bg-white/30 text-white"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="w-10 p-0 bg-white/20 hover:bg-red-600 text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Esto eliminará permanentemente la tarjeta 
                  **{card.name}** y todas sus transacciones asociadas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDeleteCard(card.id)}>
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};

export default CardDisplay;
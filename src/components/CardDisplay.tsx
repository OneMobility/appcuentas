"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, DollarSign, History, Trash2, Edit, ArrowRightLeft } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";

interface CardPocket {
  id: string;
  amount: number;
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
  color: string;
  card_pockets?: CardPocket[];
}

interface CardDisplayProps {
  card: CardData;
  onAddTransaction: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onEditCard: (card: any) => void;
  onTransfer: () => void;
}

const CardDisplay: React.FC<CardDisplayProps> = ({ card, onAddTransaction, onDeleteCard, onEditCard, onTransfer }) => {
  const navigate = useNavigate();
  const isCredit = card.type === "credit";
  
  const pocketsBalance = (card.card_pockets || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalBalance = card.current_balance + pocketsBalance;
  const availableCredit = isCredit && card.credit_limit ? card.credit_limit - card.current_balance : 0;

  const handleViewDetails = () => {
    navigate(`/cards/${card.id}`);
  };

  return (
    <Card className="relative w-full max-w-sm mx-auto p-6 rounded-xl shadow-lg overflow-hidden text-white" style={{ backgroundColor: card.color }}>
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
        <div className="space-y-2 mb-4">
          {isCredit ? (
            <>
              <div className="flex justify-between items-center">
                <p className="text-xs opacity-80">Crédito Disponible:</p>
                <p className="text-xl font-bold">${availableCredit.toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-center opacity-90 border-t border-white/20 pt-1">
                <p className="text-xs opacity-80">Deuda Actual:</p>
                <p className="text-sm font-semibold">${card.current_balance.toFixed(2)}</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <p className="text-xs opacity-80">Saldo Disponible:</p>
                <p className="text-xl font-bold">${card.current_balance.toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-center opacity-90">
                <p className="text-xs opacity-80">Saldo en Apartados:</p>
                <p className="text-sm font-semibold">${pocketsBalance.toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-center border-t border-white/20 pt-1">
                <p className="text-xs font-bold">Saldo Total:</p>
                <p className="text-lg font-black">${totalBalance.toFixed(2)}</p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] mb-4 opacity-80">
          <div>
            <p>Número</p>
            <p className="font-semibold">**** {card.last_four_digits}</p>
          </div>
          <div className="text-right">
            <p>Expira</p>
            <p className="font-semibold">{card.expiration_date}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={() => onAddTransaction(card.id)} className="flex-1 bg-white/20 hover:bg-white/30 text-white border-none h-8 text-xs">
            <DollarSign className="h-3 w-3 mr-1" /> Movimiento
          </Button>
          <Button variant="secondary" size="sm" onClick={handleViewDetails} className="flex-1 bg-white/20 hover:bg-white/30 text-white border-none h-8 text-xs">
            <History className="h-3 w-3 mr-1" /> Detalles
          </Button>
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" onClick={onTransfer} className="w-8 h-8 p-0 bg-white/20 hover:bg-white/30 text-white border-none">
              <ArrowRightLeft className="h-3 w-3" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onEditCard(card)} className="w-8 h-8 p-0 bg-white/20 hover:bg-white/30 text-white border-none">
              <Edit className="h-3 w-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-8 h-8 p-0 bg-white/20 hover:bg-red-600 text-white border-none">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar tarjeta?</AlertDialogTitle>
                  <AlertDialogDescription>Se borrarán todos los registros y apartados asociados.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDeleteCard(card.id)}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CardDisplay;
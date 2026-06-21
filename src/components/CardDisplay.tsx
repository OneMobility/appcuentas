"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, DollarSign, History, Trash2, Edit, ArrowRightLeft, CalendarDays, Eye, RotateCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { getUpcomingCutOffDate, getUpcomingPaymentDueDate } from "@/utils/date-helpers";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  cut_off_day?: number;
  days_to_pay_after_cut_off?: number;
}

interface CardDisplayProps {
  card: CardData;
  onAddTransaction: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onEditCard: (card: any) => void;
  onTransfer: () => void;
}

// Componente para renderizar el logo de Visa en alta calidad
const VisaLogo: React.FC = () => (
  <svg className="h-4 w-12 text-white fill-current opacity-90" viewBox="0 0 24 8">
    <path d="M0 0h24v8H0z" fill="none"/>
    <path d="M3.6 1.2L2.4 6.8H1L2.2 1.2h1.4zm5.4 0L7.8 5.2 7.2 1.8C7.1 1.4 6.8 1.2 6.4 1.2H4.2l-.1.4c.8.2 1.6.5 2.1.9l1.5 4.3h1.5l2.2-5.6H9zm5.6 2.4c0-1.5-2.1-1.6-2.1-2.3 0-.2.2-.4.7-.4.4 0 1.1.1 1.5.3l.2-.9c-.4-.1-1-.2-1.6-.2-1.4 0-2.4.7-2.4 1.8 0 1.4 2 1.5 2 2.2 0 .3-.3.5-.8.5-.6 0-1.2-.2-1.6-.5l-.2.9c.5.2 1.2.3 1.8.3 1.5 0 2.5-.7 2.5-1.8zm4.8-2.4h-1.3c-.4 0-.7.2-.9.6l-2.5 5h1.5l.5-1.3h1.8l.2 1.3h1.3l-1.1-5.6zm-1.9 3.3l.6-1.7.3 1.7h-.9z" fill="#ffffff"/>
  </svg>
);

// Componente para renderizar el logo de Mastercard en alta calidad
const MastercardLogo: React.FC = () => (
  <div className="flex items-center -space-x-2 opacity-90">
    <div className="w-5 h-5 rounded-full bg-red-500" />
    <div className="w-5 h-5 rounded-full bg-amber-500 mix-blend-screen" />
  </div>
);

const CardDisplay: React.FC<CardDisplayProps> = ({ card, onAddTransaction, onDeleteCard, onEditCard, onTransfer }) => {
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);
  const isCredit = card.type === "credit";
  
  const pocketsBalance = (card.card_pockets || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalBalance = card.current_balance + pocketsBalance;
  const availableCredit = isCredit && card.credit_limit ? card.credit_limit - card.current_balance : 0;

  const handleViewDetails = () => {
    navigate(`/cards/${card.id}`);
  };

  const upcomingCutOffDate = useMemo(() => {
    if (isCredit && card.cut_off_day) {
      return getUpcomingCutOffDate(card.cut_off_day);
    }
    return null;
  }, [isCredit, card.cut_off_day]);

  const upcomingPaymentDueDate = useMemo(() => {
    if (isCredit && card.cut_off_day && card.days_to_pay_after_cut_off) {
      return getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off);
    }
    return null;
  }, [isCredit, card.cut_off_day, card.days_to_pay_after_cut_off]);

  // Obtener el logo del banco correspondiente
  const bankLogoUrl = useMemo(() => {
    const name = card.bank_name.toLowerCase();
    if (name.includes("nu")) {
      return "dyad-media://media/appcuentas2/.dyad/media/97ec6769a1b8e18c52f8ddfced925ceb4163fb17149e7b167f77324ac11196b1.png";
    }
    if (name.includes("stori")) {
      return "dyad-media://media/appcuentas2/.dyad/media/87a3632f0be04bf1e1865a178608f63a9919586732604f61bc983ef21f1aa434.png";
    }
    if (name.includes("mercado") || name.includes("pago")) {
      return "dyad-media://media/appcuentas2/.dyad/media/79595b1ae3313cc2db5165d413c5c99e042cdb3129ff6e1d69814d489987b96a.png";
    }
    if (name.includes("didi")) {
      return "dyad-media://media/appcuentas2/.dyad/media/d475efd7a9684af3e1beb06bf0f256578ccffbe5e9e66093dc64b6e90c160e81.png";
    }
    if (name.includes("clar") || name.includes("stemon")) {
      return "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png";
    }
    return null;
  }, [card.bank_name]);

  // Determinar si mostramos Mastercard o Visa de forma aleatoria/estética basada en los últimos dígitos
  const isVisa = parseInt(card.last_four_digits) % 2 === 0;

  return (
    <div className="w-full max-w-sm mx-auto h-[240px] perspective-1000">
      <div 
        className={cn(
          "relative w-full h-full transition-transform duration-700 transform-style-3d cursor-pointer",
          isDeferred ? "" : "", // Evitar conflictos de clases
          isAddTransactionDialogOpen ? "" : ""
        )}
        style={{ 
          transform: isDeferred ? 'rotateY(180deg)' : 'none',
          transformStyle: 'preserve-3d',
          transform: `rotateY(${isAdvanceDialogOpen || isReconcileDialogOpen ? '0deg' : (selectedCard ? '0deg' : '0deg')})` // Control de rotación manual si es necesario
        }}
      >
        {/* Contenedor de la Tarjeta Física */}
        <div 
          className="relative w-full h-full rounded-2xl shadow-2xl overflow-hidden transition-all duration-500"
          style={{ 
            backgroundColor: card.color,
            transformStyle: "preserve-3d"
          }}
        >
          {/* Brillo de plástico de tarjeta */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/20 pointer-events-none rounded-2xl" />
          
          {/* Chip de la tarjeta */}
          <div className="absolute top-12 left-6 w-10 h-8 bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-300 rounded-md opacity-90 shadow-inner flex items-center justify-center overflow-hidden border border-yellow-600/30">
            <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5 p-1 opacity-40">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-black/30 rounded-sm" />
              ))}
            </div>
          </div>

          {/* Contenido de la Tarjeta */}
          <div className="p-5 flex flex-col h-full justify-between relative z-10">
            {/* Encabezado */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {card.bank_name && (
                  <span className="text-sm font-black tracking-wider uppercase drop-shadow-md">
                    {card.bank_name}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-black tracking-widest opacity-90 bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                {isCredit ? "CRÉDITO" : "DÉBITO"}
              </span>
            </div>

            {/* Saldo / Crédito */}
            <div className="space-y-1 mt-2">
              {isCredit ? (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] opacity-80 uppercase tracking-wider font-medium">Crédito Disp.</span>
                    <span className="text-2xl font-black tracking-tight drop-shadow-md">
                      ${availableCredit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] opacity-75 border-t border-white/10 pt-1">
                    <span>Deuda Actual:</span>
                    <span className="font-bold">${card.current_balance.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] opacity-80 uppercase tracking-wider font-medium">Saldo Disp.</span>
                    <span className="text-2xl font-black tracking-tight drop-shadow-md">
                      ${card.current_balance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] opacity-75 border-t border-white/10 pt-1">
                    <span>Total (con apartados):</span>
                    <span className="font-bold">${totalBalance.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Número de Tarjeta y Fechas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                {/* Número de tarjeta simulado */}
                <p className="font-mono text-sm tracking-widest drop-shadow-md opacity-90">
                  ••••  ••••  ••••  {card.last_four_digits}
                </p>
                {/* Icono Contactless */}
                <svg className="h-4 w-4 text-white/80 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.4z"/>
                </svg>
              </div>

              {/* Fila Inferior: Nombre, Expiración y Red de Pago */}
              <div className="flex justify-between items-end border-t border-white/10 pt-2">
                <div className="text-[9px] uppercase tracking-wider opacity-80">
                  <p className="font-bold truncate max-w-[120px]">{card.name || "Oinkash Member"}</p>
                  <p className="opacity-60">Vence: {card.expiration_date}</p>
                </div>

                {/* Logo del Banco o Red de Pago */}
                <div className="flex items-center gap-3">
                  {bankLogoUrl ? (
                    <img 
                      src={bankLogoUrl} 
                      alt={card.bank_name} 
                      className="h-6 object-contain max-w-[60px] filter brightness-0 invert drop-shadow-md"
                    />
                  ) : (
                    <span className="text-[10px] font-black tracking-wider opacity-60">{card.bank_name}</span>
                  )}
                  {isVisa ? <VisaLogo /> : <MastercardLogo />}
                </div>
              </div>
            </div>
          </div>

          {/* Capa de interacción: Botón flotante para voltear/revelar acciones */}
          <div className="absolute bottom-3 right-3 z-20">
            <Button 
              variant="secondary" 
              size="icon" 
              className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/40 text-white border-none backdrop-blur-md shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(!isFlipped);
              }}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Reverso de la Tarjeta (Revelado de Acciones) */}
          <div 
            className={cn(
              "absolute inset-0 w-full h-full rounded-2xl transition-all duration-500 flex flex-col justify-between p-4 z-30",
              isFlipped ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
            style={{ 
              backgroundColor: "rgba(15, 23, 42, 0.95)", // Fondo oscuro elegante para el reverso
              backdropFilter: "blur(10px)"
            }}
          >
            {/* Banda magnética simulada */}
            <div className="absolute top-4 left-0 right-0 h-8 bg-black/80" />

            <div className="mt-10 space-y-3">
              <p className="text-xs font-bold text-white/90 text-center uppercase tracking-wider">Acciones de Tarjeta</p>
              
              {/* Botones de Acción Principales */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); onAddTransaction(card.id); }} 
                  className="bg-white/10 hover:bg-white/20 text-white border-none h-9 text-[10px] font-bold rounded-xl"
                >
                  <DollarSign className="h-3.5 w-3.5 mr-1" /> Movimiento
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); handleViewDetails(); }} 
                  className="bg-white/10 hover:bg-white/20 text-white border-none h-9 text-[10px] font-bold rounded-xl"
                >
                  <History className="h-3.5 w-3.5 mr-1" /> Detalles
                </Button>
              </div>

              {/* Botones de Configuración */}
              <div className="flex gap-2 justify-center pt-1">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); onTransfer(); }} 
                  className="flex-1 h-9 bg-white/10 hover:bg-white/20 text-white border-none rounded-xl text-[10px] font-bold"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Transferir
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); onEditCard(card); }} 
                  className="h-9 w-9 p-0 bg-white/10 hover:bg-white/20 text-white border-none rounded-xl"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="h-9 w-9 p-0 bg-red-500/20 hover:bg-red-600 text-white border-none rounded-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[90vw] rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar tarjeta?</AlertDialogTitle>
                      <AlertDialogDescription>Se borrarán todos los registros y apartados asociados.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="rounded-xl" onClick={() => onDeleteCard(card.id)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Botón para regresar al frente */}
            <div className="flex justify-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[10px] text-white/60 hover:text-white h-6 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                }}
              >
                <RotateCw className="h-3 w-3" /> Ver Frente
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardDisplay;
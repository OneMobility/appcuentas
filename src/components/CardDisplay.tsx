"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, DollarSign, History, Trash2, Edit, ArrowRightLeft, CalendarDays, Eye, RotateCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { getUpcomingCutOffDate, getUpcomingPaymentDueDate } from "@/utils/date-helpers";
import { getContrastColor } from "@/utils/color-helpers";
import { getBankLogoUrl, getFallbackBankLogoUrl } from "@/utils/logo-helper";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

  // Calcular colores de contraste dinámicos
  const textColor = useMemo(() => getContrastColor(card.color), [card.color]);
  const isDarkText = textColor === "#0F172A";
  const isDarkCard = !isDarkText;
  const badgeBg = isDarkText ? "bg-black/10" : "bg-white/20";
  const borderStyle = isDarkText ? "border-black/10" : "border-white/10";
  const opacityClass = isDarkText ? "opacity-80" : "opacity-90";
  const subOpacityClass = isDarkText ? "opacity-60" : "opacity-75";

  // Estado para manejar la URL del logo y sus fallbacks
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoAttempt, setLogoAttempt] = useState<"primary" | "fallback" | "failed">("primary");

  useEffect(() => {
    setLogoUrl(getBankLogoUrl(card.bank_name, isDarkCard));
    setLogoAttempt("primary");
  }, [card.bank_name, isDarkCard]);

  const handleLogoError = () => {
    if (logoAttempt === "primary") {
      setLogoUrl(getFallbackBankLogoUrl(card.bank_name));
      setLogoAttempt("fallback");
    } else {
      setLogoUrl(null);
      setLogoAttempt("failed");
    }
  };

  // Determinar si mostramos Mastercard o Visa de forma aleatoria/estética basada en los últimos dígitos
  const isVisa = parseInt(card.last_four_digits) % 2 === 0;

  const networkLogoUrl = isVisa 
    ? "dyad-media://media/appcuentas2/.dyad/media/871ca618ef91fce40699c8478faf0f9f0d05a828b899b8e84349ab3e6c0be6a2.png" // Visa real
    : "dyad-media://media/appcuentas2/.dyad/media/5f361a174a286c7611adb5860e3f3390a33f3958c2329e451f071a4c5af9962a.png"; // Mastercard real

  return (
    <div className="w-full max-w-sm mx-auto h-[240px] perspective-1000">
      <div 
        className="relative w-full h-full transition-transform duration-700 transform-style-3d"
        style={{ 
          transform: isFlipped ? 'rotateY(180deg)' : 'none',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* CARA FRONTAL DE LA TARJETA */}
        <div 
          className="absolute inset-0 w-full h-full rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 cursor-pointer"
          onClick={() => setIsFlipped(true)}
          style={{ 
            backgroundColor: card.color,
            color: textColor,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            pointerEvents: isFlipped ? "none" : "auto",
            zIndex: isFlipped ? 0 : 2,
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
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt={card.bank_name} 
                    onError={handleLogoError}
                    className="h-7 object-contain max-w-[100px] drop-shadow-md"
                  />
                ) : (
                  <span className="text-sm font-black tracking-wider uppercase drop-shadow-md">
                    {card.bank_name}
                  </span>
                )}
              </div>
              <span className={cn("text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full backdrop-blur-sm", badgeBg)}>
                {isCredit ? "CRÉDITO" : "DÉBITO"}
              </span>
            </div>

            {/* Saldo / Crédito */}
            <div className="space-y-1 mt-2">
              {isCredit ? (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className={cn("text-[10px] uppercase tracking-wider font-medium", subOpacityClass)}>Crédito Disp.</span>
                    <span className="text-2xl font-black tracking-tight drop-shadow-md">
                      ${availableCredit.toFixed(2)}
                    </span>
                  </div>
                  <div className={cn("flex justify-between items-center text-[10px] border-t pt-1", borderStyle, subOpacityClass)}>
                    <span>Deuda Actual:</span>
                    <span className="font-bold">${card.current_balance.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className={cn("text-[10px] uppercase tracking-wider font-medium", subOpacityClass)}>Saldo Disp.</span>
                    <span className="text-2xl font-black tracking-tight drop-shadow-md">
                      ${card.current_balance.toFixed(2)}
                    </span>
                  </div>
                  <div className={cn("flex justify-between items-center text-[10px] border-t pt-1", borderStyle, subOpacityClass)}>
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
                <p className={cn("font-mono text-sm tracking-widest drop-shadow-md", opacityClass)}>
                  ••••  ••••  ••••  {card.last_four_digits}
                </p>
                {/* Icono Contactless */}
                <svg className={cn("h-4 w-4 fill-current", opacityClass)} viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.4z"/>
                </svg>
              </div>

              {/* Fila Inferior: Nombre, Expiración y Red de Pago */}
              <div className={cn("flex justify-between items-end border-t pt-2", borderStyle)}>
                <div className={cn("text-[9px] uppercase tracking-wider", subOpacityClass)}>
                  <p className="font-bold truncate max-w-[120px]">{card.name || "Oinkash Member"}</p>
                  <p className="opacity-60">Vence: {card.expiration_date}</p>
                </div>

                {/* Logo de Red de Pago */}
                <div className="flex items-center gap-3">
                  <img 
                    src={networkLogoUrl} 
                    alt="Network" 
                    className={cn(
                      "h-6 object-contain max-w-[45px] drop-shadow-md",
                      isDarkText ? "brightness-0" : "brightness-0 invert"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Capa de interacción: Botón flotante para voltear/revelar acciones (Solo visible en Desktop) */}
          <div className="absolute bottom-3 right-3 z-20 hidden md:block">
            <Button 
              variant="secondary" 
              size="icon" 
              className={cn(
                "h-8 w-8 rounded-full border-none backdrop-blur-md shadow-lg",
                isDarkText ? "bg-black/10 hover:bg-black/20 text-slate-900" : "bg-white/20 hover:bg-white/40 text-white"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(true);
              }}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* CARA TRASERA DE LA TARJETA (VOLTEADA) */}
        <div 
          className="absolute inset-0 w-full h-full rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between p-4 cursor-pointer"
          onClick={() => setIsFlipped(false)}
          style={{ 
            backgroundColor: "rgba(15, 23, 42, 0.95)", // Fondo oscuro elegante para el reverso
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            pointerEvents: isFlipped ? "auto" : "none",
            zIndex: isFlipped ? 2 : 0,
          }}
        >
          {/* Banda magnética simulada */}
          <div className="absolute top-4 left-0 right-0 h-8 bg-black/80" />

          <div className="mt-10 space-y-3 z-10">
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

          {/* Botón para regresar al frente (Solo visible en Desktop) */}
          <div className="absolute bottom-3 right-3 z-20 hidden md:block">
            <Button 
              variant="secondary" 
              size="icon" 
              className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/40 text-white border-none backdrop-blur-md shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(false);
              }}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardDisplay;
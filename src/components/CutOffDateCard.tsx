"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getUpcomingCutOffDate } from "@/utils/date-helpers";

interface CardDataForCutOff {
  id: string;
  name: string;
  bank_name: string;
  type: "credit" | "debit";
  cut_off_day?: number;
}

interface CutOffDateCardProps {
  card: CardDataForCutOff;
}

const CutOffDateCard: React.FC<CutOffDateCardProps> = ({ card }) => {
  if (card.type !== "credit" || card.cut_off_day === undefined) {
    return null; // Solo mostrar para tarjetas de crédito con día de corte definido
  }

  const cutOffDate = getUpcomingCutOffDate(card.cut_off_day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = differenceInDays(cutOffDate, today);

  // No mostrar si la fecha de corte ya pasó o si faltan muchos días (ej. más de 30)
  if (daysRemaining < 0 || daysRemaining > 30) {
    return null;
  }

  const formattedCutOffDate = format(cutOffDate, "dd 'de' MMMM, yyyy", { locale: es });

  let message = "";
  let cardClasses = "";
  let iconClasses = "";

  if (daysRemaining === 0) {
    message = `¡Hoy es el día de corte para tu tarjeta ${card.name}!`;
    cardClasses = "border-red-500 bg-red-50 text-red-800";
    iconClasses = "text-red-600";
  } else if (daysRemaining === 1) {
    message = `¡Mañana es el día de corte para tu tarjeta ${card.name}!`;
    cardClasses = "border-red-400 bg-red-50 text-red-700";
    iconClasses = "text-red-500";
  } else if (daysRemaining < 10) { // Menos de 10 días (pero más de 1)
    message = `Faltan ${daysRemaining} días para el corte de tu tarjeta ${card.name}.`;
    cardClasses = "border-pink-500 bg-pink-50 text-pink-800";
    iconClasses = "text-pink-600";
  } else { // 10 días o más
    message = `Faltan ${daysRemaining} días para el corte de tu tarjeta ${card.name}.`;
    cardClasses = "border-green-500 bg-green-50 text-green-800";
    iconClasses = "text-green-600";
  }

  return (
    <Card className={cn("relative p-4 shadow-md", cardClasses)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Próxima Fecha de Corte
        </CardTitle>
        <CalendarDays className={cn("h-4 w-4", iconClasses)} />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold mb-1">{message}</div>
        <p className="text-xs">
          Fecha de corte: <span className="font-semibold">{formattedCutOffDate}</span>
        </p>
      </CardContent>
    </Card>
  );
};

export default CutOffDateCard;
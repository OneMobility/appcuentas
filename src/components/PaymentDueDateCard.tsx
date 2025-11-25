"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getUpcomingPaymentDueDate } from "@/utils/date-helpers";

interface CardDataForDueDate {
  id: string;
  name: string;
  bank_name: string;
  type: "credit" | "debit";
  cut_off_day?: number;
  days_to_pay_after_cut_off?: number;
}

interface PaymentDueDateCardProps {
  card: CardDataForDueDate;
}

const PaymentDueDateCard: React.FC<PaymentDueDateCardProps> = ({ card }) => {
  if (card.type !== "credit" || card.cut_off_day === undefined || card.days_to_pay_after_cut_off === undefined) {
    return null; // Solo mostrar para tarjetas de crédito con datos de pago definidos
  }

  const paymentDueDate = getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = differenceInDays(paymentDueDate, today);

  // No mostrar si la fecha de pago ya pasó o si faltan muchos días (ej. más de 30)
  if (daysRemaining < 0 || daysRemaining > 30) {
    return null;
  }

  const formattedDueDate = format(paymentDueDate, "dd 'de' MMMM, yyyy", { locale: es });

  let message = "";
  let cardClasses = "border-orange-500 bg-orange-50 text-orange-800"; // Default warning
  let iconClasses = "text-orange-600";

  if (daysRemaining === 0) {
    message = `¡Hoy es el último día para pagar tu tarjeta ${card.name}!`;
    cardClasses = "border-red-500 bg-red-50 text-red-800";
    iconClasses = "text-red-600";
  } else if (daysRemaining === 1) {
    message = `¡Mañana es el último día para pagar tu tarjeta ${card.name}!`;
    cardClasses = "border-red-400 bg-red-50 text-red-700";
    iconClasses = "text-red-500";
  } else if (daysRemaining <= 7) {
    message = `Faltan ${daysRemaining} días para el pago de tu tarjeta ${card.name}.`;
    cardClasses = "border-yellow-500 bg-yellow-50 text-yellow-800";
    iconClasses = "text-yellow-600";
  } else {
    message = `Faltan ${daysRemaining} días para el pago de tu tarjeta ${card.name}.`;
  }

  return (
    <Card className={cn("relative p-4 shadow-md", cardClasses)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Ojo con tu fecha límite de pago
        </CardTitle>
        <Eye className={cn("h-4 w-4", iconClasses)} />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold mb-1">{message}</div>
        <p className="text-xs">
          Fecha límite: <span className="font-semibold">{formattedDueDate}</span>
        </p>
      </CardContent>
    </Card>
  );
};

export default PaymentDueDateCard;
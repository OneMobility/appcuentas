"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Eye, CalendarIcon } from "lucide-react";
import { format, differenceInDays, isBefore, isSameDay, addDays } from "date-fns";
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

interface GroupedPaymentDueDatesCardProps {
  cards: CardDataForDueDate[];
}

const GroupedPaymentDueDatesCard: React.FC<GroupedPaymentDueDatesCardProps> = ({ cards }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoDaysFromNow = addDays(today, 2);

  const upcomingPayments = cards
    .filter(card => card.type === "credit" && card.cut_off_day !== undefined && card.days_to_pay_after_cut_off !== undefined)
    .map(card => {
      const paymentDueDate = getUpcomingPaymentDueDate(card.cut_off_day!, card.days_to_pay_after_cut_off!, today);
      const daysRemaining = differenceInDays(paymentDueDate, today);

      // Solo incluir pagos que no han pasado y que están dentro de los próximos 30 días
      if (daysRemaining >= 0 && daysRemaining <= 30) {
        return {
          cardName: card.name,
          bankName: card.bank_name,
          paymentDueDate,
          daysRemaining,
        };
      }
      return null;
    })
    .filter(Boolean) // Eliminar entradas nulas
    .sort((a, b) => a!.paymentDueDate.getTime() - b!.paymentDueDate.getTime()); // Ordenar por fecha

  if (upcomingPayments.length === 0) {
    return null; // No mostrar la tarjeta si no hay pagos próximos
  }

  return (
    <Card className="relative p-4 shadow-md border-l-4 border-blue-500 bg-blue-50 text-blue-800">
      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-bold text-blue-800">
          Tu calendario de pagos
        </CardTitle>
        <img
          src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Calendario.png"
          alt="Calendario de Pagos"
          className="absolute top-4 right-4 h-[100px] w-[100px] z-10 -mt-2 md:top-0 md:right-[50px] md:h-[150px] md:w-[150px] md:-mt-8"
        />
      </CardHeader>
      <CardContent>
        {upcomingPayments.map((payment, index) => {
          if (!payment) return null; // Double check for nulls

          const formattedDueDate = format(payment.paymentDueDate, "dd 'de' MMMM, yyyy", { locale: es });
          let message = "";
          let textColorClass = "text-blue-700";

          if (payment.daysRemaining === 0) {
            message = `¡Hoy es el último día para pagar tu tarjeta ${payment.cardName}!`;
            textColorClass = "text-red-600 font-semibold";
          } else if (payment.daysRemaining === 1) {
            message = `¡Mañana es el último día para pagar tu tarjeta ${payment.cardName}!`;
            textColorClass = "text-red-500 font-semibold";
          } else if (payment.daysRemaining <= 7) {
            message = `Faltan ${payment.daysRemaining} días para el pago de tu tarjeta ${payment.cardName}.`;
            textColorClass = "text-orange-600";
          } else {
            message = `Faltan ${payment.daysRemaining} días para el pago de tu tarjeta ${payment.cardName}.`;
          }

          return (
            <div key={index} className={cn("mb-2 last:mb-0", textColorClass)}>
              <p className="text-sm font-medium">{message}</p>
              <p className="text-xs">
                Fecha límite: <span className="font-semibold">{formattedDueDate}</span>
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default GroupedPaymentDueDatesCard;
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
  current_balance: number; // Añadido para verificar deuda
}

interface GroupedPaymentDueDatesCardProps {
  cards: CardDataForDueDate[];
}

const GroupedPaymentDueDatesCard: React.FC<GroupedPaymentDueDatesCardProps> = ({ cards }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingPayments = cards
    .filter(card => 
      card.type === "credit" && 
      card.cut_off_day !== undefined && 
      card.days_to_pay_after_cut_off !== undefined &&
      card.current_balance > 0 // Solo tarjetas de crédito con deuda pendiente
    )
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

  // Estilo de la tarjeta siempre azul
  const cardBaseClasses = "relative p-4 shadow-md border-l-4 border-blue-500 bg-blue-50 text-blue-800";

  if (upcomingPayments.length === 0) {
    return (
      <Card className={cardBaseClasses}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-bold text-blue-800">
            ¡Vas bien!
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center pr-4 md:block md:pr-48"> {/* Flex column on mobile, block on desktop */}
          <img
            src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Calendario.png" // Updated URL
            alt="Calendario"
            className="h-[180px] w-[180px] mb-4 md:absolute md:top-[-10px] md:right-4 md:z-10" // Static on mobile, absolute on desktop
          />
          <div className="text-lg font-bold text-center md:text-left"> {/* Center text on mobile */}
            No hay pagos de tarjetas<br />
            programados para los<br />
            próximos 30 días.
          </div>
          <p className="text-xs text-blue-700 mt-1 text-center md:text-left">
            ¡Sigue así con tus finanzas!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardBaseClasses}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-bold text-blue-800">
          Tu calendario de pagos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center pr-4 md:block md:pr-48"> {/* Flex column on mobile, block on desktop */}
        <img
          src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Calendario.png" // Updated URL
          alt="Calendario de Pagos"
          className="h-[180px] w-[180px] mb-4 md:absolute md:top-[-10px] md:right-4 md:z-10" // Static on mobile, absolute on desktop
        />
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
            <div key={index} className={cn("mb-2 last:mb-0 text-center md:text-left", textColorClass)}>
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
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, CalendarIcon } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getUpcomingPaymentDueDate, isPaymentDoneForCurrentStatement, getLocalDateString } from "@/utils/date-helpers";
import { showSuccess } from "@/utils/toast";

interface CardDataForDueDate {
  id: string;
  name: string;
  bank_name: string;
  type: "credit" | "debit";
  cut_off_day?: number;
  days_to_pay_after_cut_off?: number;
  current_balance: number;
}

interface GroupedPaymentDueDatesCardProps {
  cards: CardDataForDueDate[];
  onUpdate?: () => void;
}

const GroupedPaymentDueDatesCard: React.FC<GroupedPaymentDueDatesCardProps> = ({ cards, onUpdate }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Cargar pagos manuales desde localStorage para control local
  const [manualPayments, setManualPayments] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('oinkash_manual_payments');
    if (saved) {
      try {
        setManualPayments(JSON.parse(saved));
      } catch (e) {
        setManualPayments({});
      }
    }
  }, []);

  const handleTogglePayment = (cardId: string, isChecked: boolean) => {
    const updated = { ...manualPayments };
    if (isChecked) {
      const todayStr = getLocalDateString(new Date());
      updated[cardId] = todayStr;
      showSuccess("Pago marcado como realizado.");
    } else {
      delete updated[cardId];
      showSuccess("Pago marcado como pendiente.");
    }
    localStorage.setItem('oinkash_manual_payments', JSON.stringify(updated));
    setManualPayments(updated);
    if (onUpdate) {
      onUpdate();
    }
  };

  // Obtener todas las tarjetas de crédito con configuración de pago
  const creditCards = cards.filter(card => 
    card.type === "credit" && 
    card.cut_off_day !== undefined && 
    card.days_to_pay_after_cut_off !== undefined
  );

  const paymentTasks = creditCards.map(card => {
    const paymentDueDate = getUpcomingPaymentDueDate(card.cut_off_day!, card.days_to_pay_after_cut_off!, today);
    const daysRemaining = differenceInDays(paymentDueDate, today);
    const lastPaymentDate = manualPayments[card.id];
    const isPaid = isPaymentDoneForCurrentStatement(lastPaymentDate, card.cut_off_day!, card.days_to_pay_after_cut_off!);

    return {
      cardId: card.id,
      cardName: card.name,
      bankName: card.bank_name,
      paymentDueDate,
      daysRemaining,
      isPaid,
      currentBalance: card.current_balance,
    };
  }).sort((a, b) => {
    // Mostrar primero los pendientes, luego los pagados, y ordenar por fecha de vencimiento
    if (a.isPaid !== b.isPaid) {
      return a.isPaid ? 1 : -1;
    }
    return a.paymentDueDate.getTime() - b.paymentDueDate.getTime();
  });

  const cardBaseClasses = "relative p-4 shadow-sm border-none bg-blue-50/50 text-blue-900";

  if (paymentTasks.length === 0) {
    return (
      <Card className={cardBaseClasses}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-bold text-blue-900">Lista de Pagos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center pr-4 md:block md:pr-48">
          <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Calendario.png" alt="Calendario" className="h-[180px] w-[180px] mb-4 md:absolute md:top-[-10px] md:right-4 md:z-10" />
          <div className="text-lg font-bold text-center md:text-left">
            No tienes tarjetas de crédito<br />configuradas para pagos.
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingTasks = paymentTasks.filter(t => !t.isPaid);

  return (
    <Card className={cardBaseClasses}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-bold text-blue-900">Lista de Pagos Pendientes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center pr-4 md:block md:pr-48">
        <img src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Calendario.png" alt="Calendario" className="h-[180px] w-[180px] mb-4 md:absolute md:top-[-10px] md:right-4 md:z-10" />
        
        {paymentTasks.length > 0 ? (
          <div className="w-full space-y-3 mt-2">
            {paymentTasks.map((task) => {
              const formattedDueDate = format(task.paymentDueDate, "dd 'de' MMMM, yyyy", { locale: es });
              let statusMessage = "";
              let statusColorClass = "text-blue-700";

              if (task.isPaid) {
                statusMessage = "¡Pago completado!";
                statusColorClass = "text-green-600 line-through opacity-60";
              } else if (task.daysRemaining === 0) {
                statusMessage = "¡Hoy es el último día para pagar!";
                statusColorClass = "text-red-600 font-bold";
              } else if (task.daysRemaining < 0) {
                statusMessage = "¡Pago vencido!";
                statusColorClass = "text-red-700 font-bold";
              } else if (task.daysRemaining === 1) {
                statusMessage = "¡Mañana es el último día para pagar!";
                statusColorClass = "text-red-500 font-semibold";
              } else {
                statusMessage = `Faltan ${task.daysRemaining} días para pagar.`;
              }

              return (
                <div 
                  key={task.cardId} 
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-2xl bg-white border border-blue-100 shadow-sm transition-all",
                    task.isPaid && "bg-white/50 border-dashed opacity-80"
                  )}
                >
                  <Checkbox 
                    id={`task-${task.cardId}`}
                    checked={task.isPaid}
                    onCheckedChange={(checked) => handleTogglePayment(task.cardId, !!checked)}
                    className="h-5 w-5 rounded-md border-blue-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label 
                      htmlFor={`task-${task.cardId}`}
                      className={cn(
                        "text-sm font-bold block cursor-pointer text-blue-950",
                        task.isPaid && "line-through text-muted-foreground"
                      )}
                    >
                      {task.cardName} ({task.bankName})
                    </label>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className={cn("text-xs", statusColorClass)}>
                        {statusMessage}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" /> Límite: {formattedDueDate}
                      </span>
                      {task.currentBalance > 0 && !task.isPaid && (
                        <span className="text-xs font-bold text-blue-900 bg-blue-100/50 px-2 py-0.5 rounded-full">
                          Deuda: ${task.currentBalance.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center md:text-left mt-4">
            <div className="text-lg font-bold text-blue-900">¡Vas al día!</div>
            <p className="text-xs text-blue-700 mt-1 flex items-center gap-1 justify-center md:justify-start">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> No tienes pagos pendientes para los próximos 30 días.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GroupedPaymentDueDatesCard;
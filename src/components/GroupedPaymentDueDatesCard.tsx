"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PiggyBank, CalendarIcon, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getUpcomingPaymentDueDate, isPaymentDoneForCurrentStatement, getLocalDateString } from "@/utils/date-helpers";
import { showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";

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

  const [manualPayments, setManualPayments] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

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
  }).sort((a, b) => a.paymentDueDate.getTime() - b.paymentDueDate.getTime());

  const pendingTasks = paymentTasks.filter(t => !t.isPaid);
  const completedTasks = paymentTasks.filter(t => t.isPaid);

  const cardBaseClasses = "relative p-3 shadow-sm border-none bg-blue-50/50 text-blue-900 transition-all duration-200";

  if (paymentTasks.length === 0) {
    return (
      <Card className={cardBaseClasses}>
        <CardContent className="p-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-blue-950">No tienes tarjetas de crédito configuradas para pagos.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderTaskRow = (task: typeof paymentTasks[0]) => {
    const formattedDueDate = format(task.paymentDueDate, "dd 'de' MMM", { locale: es });
    let statusMessage = "";
    let statusColorClass = "text-blue-700";

    if (task.isPaid) {
      statusMessage = "¡Pago completado!";
      statusColorClass = "text-green-600 line-through opacity-60";
    } else if (task.daysRemaining === 0) {
      statusMessage = "¡Hoy vence!";
      statusColorClass = "text-red-600 font-bold";
    } else if (task.daysRemaining < 0) {
      statusMessage = "¡Vencido!";
      statusColorClass = "text-red-700 font-bold";
    } else if (task.daysRemaining === 1) {
      statusMessage = "¡Vence mañana!";
      statusColorClass = "text-red-500 font-semibold";
    } else {
      statusMessage = `Faltan ${task.daysRemaining} días`;
    }

    return (
      <div 
        key={task.cardId} 
        className={cn(
          "flex items-center gap-2.5 py-1.5 px-2.5 rounded-xl bg-white border border-blue-100/60 shadow-sm transition-all text-xs",
          task.isPaid && "bg-white/40 border-dashed opacity-70"
        )}
      >
        <Checkbox 
          id={`task-${task.cardId}`}
          checked={task.isPaid}
          onCheckedChange={(checked) => handleTogglePayment(task.cardId, !!checked)}
          className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <label 
            htmlFor={`task-${task.cardId}`}
            className={cn(
              "font-bold cursor-pointer text-blue-950 truncate",
              task.isPaid && "line-through text-muted-foreground font-normal"
            )}
          >
            {task.cardName} <span className="text-[10px] font-normal text-muted-foreground">({task.bankName})</span>
          </label>
          <div className="flex items-center gap-2 shrink-0">
            {task.currentBalance > 0 && !task.isPaid && (
              <span className="font-bold text-blue-900 bg-blue-100/60 px-1.5 py-0.5 rounded-md text-[10px]">
                ${task.currentBalance.toFixed(0)}
              </span>
            )}
            <span className={cn("font-medium text-[10px]", statusColorClass)}>
              {statusMessage}
            </span>
            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
              <CalendarIcon className="h-2.5 w-2.5" /> {formattedDueDate}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className={cardBaseClasses}>
      {/* Cabecera Desplegable Compacta */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between cursor-pointer p-1 select-none"
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-lg transition-colors",
            pendingTasks.length > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
          )}>
            <PiggyBank className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-950">Lista de Pagos</h3>
            <p className="text-[11px] text-blue-700 font-medium">
              {pendingTasks.length > 0 
                ? `Tienes ${pendingTasks.length} pago${pendingTasks.length > 1 ? 's' : ''} pendiente${pendingTasks.length > 1 ? 's' : ''}`
                : "¡Al corriente! Sin pagos pendientes"
              }
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-900 hover:bg-blue-100/50 rounded-full">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Contenido Desplegable */}
      {isExpanded && (
        <CardContent className="p-1 pt-3 flex flex-col gap-2 border-t border-blue-100/50 mt-2">
          {/* Sección de Pendientes */}
          {pendingTasks.length > 0 ? (
            <div className="space-y-1.5">
              {pendingTasks.map(renderTaskRow)}
            </div>
          ) : (
            <div className="text-center py-2 bg-white/40 rounded-xl border border-dashed border-blue-100">
              <p className="text-xs text-green-700 font-bold flex items-center gap-1 justify-center">
                <PiggyBank className="h-3.5 w-3.5 text-green-600" /> ¡Todo pagado por ahora!
              </p>
            </div>
          )}

          {/* Sección de Completados (Colapsable Interno) */}
          {completedTasks.length > 0 && (
            <div className="pt-1 border-t border-blue-100/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCompleted(!showCompleted);
                }}
                className="h-7 px-2 text-[10px] font-bold text-blue-700 hover:bg-blue-100/30 flex items-center gap-1 w-full justify-between"
              >
                <span>Pagos completados ({completedTasks.length})</span>
                {showCompleted ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              
              {showCompleted && (
                <div className="space-y-1.5 mt-1.5">
                  {completedTasks.map(renderTaskRow)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default GroupedPaymentDueDatesCard;
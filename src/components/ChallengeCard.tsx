"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Trophy, XCircle, CheckCircle, Clock, PiggyBank, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, isAfter, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { Category } from "@/context/CategoryContext"; // Importar Category

export interface ChallengeData {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed" | "failed" | "regular"; // Añadido 'regular'
  forbidden_category_ids: string[];
  badge_id?: string;
  user_id?: string;
  challenge_template_id: string; // Para identificar el tipo de reto
  // Propiedades para retos de ahorro
  saving_goal?: {
    id: string;
    name: string;
    current_balance: number;
    target_amount: number | null; // Permitir que sea null
    color: string;
  } | null;
  expense_categories?: Category[]; // Para mostrar nombres de categorías prohibidas
}

interface ChallengeCardProps {
  challenge?: ChallengeData | null;
  onStartNewChallenge: () => void;
  onViewBadges: () => void;
  onRefreshChallenges: () => void; // Para refrescar después de evaluar
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, onStartNewChallenge, onViewBadges, onRefreshChallenges }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getStatusDisplay = (challenge: ChallengeData) => {
    const startDate = new Date(challenge.start_date);
    const endDate = new Date(challenge.end_date);
    const daysRemaining = differenceInDays(endDate, today);

    let statusText = "";
    let cardClasses = "";
    let icon = null;

    if (challenge.status === "active") {
      if (isAfter(today, endDate) || isSameDay(today, endDate)) {
        // Challenge has ended, but status is still 'active'. Needs evaluation.
        statusText = "Reto finalizado, evaluando resultados...";
        cardClasses = "border-l-4 border-gray-500 bg-gray-50 text-gray-800";
        icon = <Clock className="h-4 w-4 text-gray-600" />;
      } else if (daysRemaining === 0) {
        statusText = "¡Hoy es el último día del reto!";
        cardClasses = "border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800";
        icon = <Clock className="h-4 w-4 text-yellow-600" />;
      } else if (daysRemaining > 0) {
        statusText = `Faltan ${daysRemaining} días para completar el reto.`;
        cardClasses = "border-l-4 border-blue-500 bg-blue-50 text-blue-800";
        icon = <Clock className="h-4 w-4 text-blue-600" />;
      }
    } else if (challenge.status === "completed") {
      statusText = "¡Reto completado! ¡Felicidades!";
      cardClasses = "border-l-4 border-green-500 bg-green-50 text-green-800";
      icon = <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (challenge.status === "failed") {
      statusText = "Reto fallido. ¡No te rindas, inténtalo de nuevo!";
      cardClasses = "border-l-4 border-red-500 bg-red-50 text-red-800";
      icon = <XCircle className="h-4 w-4 text-red-600" />;
    } else if (challenge.status === "regular") {
      statusText = "Reto regular. ¡Casi lo logras, sigue esforzándote!";
      cardClasses = "border-l-4 border-orange-500 bg-orange-50 text-orange-800";
      icon = <TrendingUp className="h-4 w-4 text-orange-600" />;
    }

    return { statusText, cardClasses, icon };
  };

  // Determinar si hay un reto activo y en curso (no finalizado ni evaluado)
  const isChallengeOngoing = challenge && challenge.status === "active" && (isAfter(new Date(challenge.end_date), today) || isSameDay(new Date(challenge.end_date), today));

  if (challenge) {
    const { statusText, cardClasses, icon } = getStatusDisplay(challenge);
    const isSavingGoal = challenge.challenge_template_id.startsWith("saving-goal");
    const isNoSpend = challenge.challenge_template_id.startsWith("no-spend");

    let progress = 0;
    const savingGoal = challenge.saving_goal; // Usar una variable local para mayor claridad
    if (isSavingGoal && savingGoal && savingGoal.target_amount !== null && savingGoal.target_amount !== undefined && savingGoal.target_amount > 0) {
      progress = (savingGoal.current_balance / savingGoal.target_amount) * 100;
    }

    return (
      <Card className={cn("relative p-4 shadow-md", cardClasses)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Reto Activo: {challenge.name}
          </CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold mb-1">{statusText}</div>
          <p className="text-xs text-muted-foreground">
            Inició: {format(new Date(challenge.start_date), "dd/MM/yyyy", { locale: es })} | Finaliza: {format(new Date(challenge.end_date), "dd/MM/yyyy", { locale: es })}
          </p>

          {isSavingGoal && savingGoal && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-1">Progreso de Ahorro:</p>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="w-full" indicatorColor={savingGoal.color} />
                <span className="text-sm font-semibold">{progress.toFixed(0)}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ${savingGoal.current_balance.toFixed(2)} / ${
                  savingGoal.target_amount !== null && savingGoal.target_amount !== undefined
                    ? savingGoal.target_amount.toFixed(2)
                    : "N/A"
                }
              </p>
            </div>
          )}

          {isNoSpend && challenge.expense_categories && challenge.expense_categories.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-1">Categorías a Evitar:</p>
              <ul className="list-disc list-inside text-xs text-muted-foreground">
                {challenge.expense_categories.map(cat => (
                  <li key={cat.id}>{cat.name}</li>
                ))}
              </ul>
            </div>
          )}

          {isChallengeOngoing ? (
            <Button className="mt-4 w-full" disabled>
              Ya tienes un reto activo
            </Button>
          ) : (
            <Button onClick={onStartNewChallenge} className="mt-4 w-full">
              Empezar otro reto
            </Button>
          )}
          {/* {challenge.status === "completed" && (
            <Button onClick={onViewBadges} className="mt-4 w-full">
              Ver mis insignias
            </Button>
          )} */}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("relative p-4 shadow-md border-l-4 border-purple-500 bg-purple-50 text-purple-800")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-purple-800">
          ¡Empieza un Reto de Ahorro!
        </CardTitle>
        <Lightbulb className="h-4 w-4 text-purple-600" />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold">Desafíate a ti mismo y mejora tus finanzas.</div>
        <p className="text-xs text-purple-700 mt-1">
          Elige un reto y mejora tus hábitos financieros.
        </p>
        <Button onClick={onStartNewChallenge} className="mt-4 w-full">
          Elegir un Reto
        </Button>
      </CardContent>
    </Card>
  );
};

export default ChallengeCard;
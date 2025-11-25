"use client";

import React from "react";
import { ChallengeData } from "./ChallengeCard";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import DynamicLucideIcon from "./DynamicLucideIcon";

interface ChallengeAlbumBackContentProps {
  challenge: ChallengeData;
}

const ChallengeAlbumBackContent: React.FC<ChallengeAlbumBackContentProps> = ({ challenge }) => {
  const isSavingGoal = challenge.challenge_template_id.startsWith("saving-goal");
  const isNoSpend = challenge.challenge_template_id.startsWith("no-spend");

  let progress = 0;
  const savingGoal = challenge.saving_goal;
  if (isSavingGoal && savingGoal && savingGoal.target_amount !== null && savingGoal.target_amount !== undefined && savingGoal.target_amount > 0) {
    progress = (savingGoal.current_balance / savingGoal.target_amount) * 100;
  }

  const formattedStartDate = challenge.start_date ? format(parseISO(challenge.start_date), "dd/MM/yyyy", { locale: es }) : "N/A";
  const formattedEndDate = challenge.end_date ? format(parseISO(challenge.end_date), "dd/MM/yyyy", { locale: es }) : "N/A";
  const formattedCompletionDate = isSavingGoal && savingGoal?.completion_date ? format(parseISO(savingGoal.completion_date), "dd/MM/yyyy", { locale: es }) : "N/A";


  let statusText = "";
  let statusColorClass = "";
  let isCompleted = false; // Variable para controlar la insignia
  if (challenge.status === "completed") {
    statusText = "¡Completado!";
    statusColorClass = "text-green-600";
    isCompleted = true;
  } else if (challenge.status === "failed") {
    statusText = "Fallido";
    statusColorClass = "text-red-600";
  } else if (challenge.status === "regular") {
    statusText = "Regular";
    statusColorClass = "text-orange-600";
  }

  return (
    <div className="flex flex-col h-full p-4 bg-green-100 text-green-900 rounded-lg border-2 border-green-300">
      <h3 className="text-xl font-bold mb-2">{challenge.name}</h3>
      <p className="text-sm mb-1">{challenge.description}</p>
      <p className={cn("text-base font-semibold mb-2", statusColorClass)}>Estado: {statusText}</p>
      <p className="text-xs text-gray-700">Inicio: {formattedStartDate}</p>
      <p className="text-xs text-gray-700">Fin: {formattedEndDate}</p>
      {isSavingGoal && savingGoal?.target_amount && (
        <p className="text-xs text-gray-700">Cumplimiento: {formattedCompletionDate}</p>
      )}

      {isSavingGoal && savingGoal && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-1">Progreso de Ahorro:</p>
          <div className="flex items-center gap-2">
            <Progress value={progress} className="w-full" style={{ backgroundColor: savingGoal.color }} />
            <span className="text-sm font-semibold">{progress.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-gray-700 mt-1">
            ${savingGoal.current_balance !== null && savingGoal.current_balance !== undefined ? savingGoal.current_balance.toFixed(2) : "0.00"} / ${
              savingGoal.target_amount !== null && savingGoal.target_amount !== undefined
                ? savingGoal.target_amount.toFixed(2)
                : "N/A"
            }
          </p>
        </div>
      )}

      {isNoSpend && challenge.expense_categories && challenge.expense_categories.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Categorías Evitadas:</p>
          <div className="flex flex-wrap gap-1">
            {challenge.expense_categories.map(cat => (
              <Badge key={cat.id} style={{ backgroundColor: cat.color, color: 'white' }} className="flex items-center gap-1 text-xs">
                <DynamicLucideIcon iconName={cat.icon || "Tag"} className="h-3 w-3" />
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {challenge.badge && isCompleted && (
        <div className="mt-auto flex items-center gap-2 pt-4 border-t border-green-200">
          <img src={challenge.badge.image_url} alt={challenge.badge.name} className="h-10 w-10" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Insignia:</span>
            <span className="text-xs text-gray-700">{challenge.badge.name}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChallengeAlbumBackContent;
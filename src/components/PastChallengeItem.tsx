"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { XCircle, CheckCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import DynamicLucideIcon from "./DynamicLucideIcon";
import { ChallengeData } from "./ChallengeCard"; // Import ChallengeData type

interface PastChallengeItemProps {
  challenge: ChallengeData;
}

const PastChallengeItem: React.FC<PastChallengeItemProps> = ({ challenge }) => {
  const isCompleted = challenge.status === "completed";
  const isFailed = challenge.status === "failed";
  const isRegular = challenge.status === "regular";

  let cardClasses = "";
  let statusIcon = null;
  let statusText = "";
  let titleClasses = "";
  let descriptionClasses = "";

  if (isCompleted) {
    cardClasses = "border-l-4 border-green-500 bg-green-50";
    statusIcon = <CheckCircle className="h-5 w-5 text-green-600" />;
    statusText = "Completado";
  } else if (isFailed) {
    cardClasses = "border-l-4 border-red-500 bg-red-50";
    statusIcon = <XCircle className="h-5 w-5 text-red-600" />;
    statusText = "Fallido";
    titleClasses = "line-through";
    descriptionClasses = "line-through";
  } else if (isRegular) {
    cardClasses = "border-l-4 border-orange-500 bg-orange-50";
    statusIcon = <TrendingUp className="h-5 w-5 text-orange-600" />;
    statusText = "Regular";
    titleClasses = "line-through";
    descriptionClasses = "line-through";
  } else {
    // Fallback for any other unexpected status
    cardClasses = "border-l-4 border-gray-300 bg-gray-50";
    statusIcon = <XCircle className="h-5 w-5 text-gray-500" />;
    statusText = "Desconocido";
    titleClasses = "line-through";
    descriptionClasses = "line-through";
  }

  const formattedEndDate = challenge.end_date ? format(new Date(challenge.end_date), "dd/MM/yyyy", { locale: es }) : "N/A";

  return (
    <Card className={cn("p-4 shadow-sm", cardClasses)}>
      <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
        <CardTitle className={cn("text-base font-semibold", titleClasses)}>
          {challenge.name}
        </CardTitle>
        {statusIcon}
      </CardHeader>
      <CardContent className="p-0">
        <p className={cn("text-sm text-muted-foreground", descriptionClasses)}>
          {challenge.description}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Finalizado: <span className="font-medium">{formattedEndDate}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Estado: <span className={cn(
            isCompleted && "text-green-600 font-medium",
            isFailed && "text-red-600 font-medium",
            isRegular && "text-orange-600 font-medium"
          )}>
            {statusText}
          </span>
        </p>

        {isCompleted && challenge.badge && (
          <div className="mt-3 flex items-center gap-2">
            <img src={challenge.badge.image_url} alt={challenge.badge.name} className="h-10 w-10" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Insignia: {challenge.badge.name}</span>
              <span className="text-xs text-muted-foreground">{challenge.badge.description}</span>
            </div>
          </div>
        )}
        {(isFailed || isRegular) && (
          <div className="mt-3 flex items-center gap-2 text-red-600">
            <XCircle className="h-6 w-6" />
            <span className="text-sm font-medium">No se obtuvo insignia.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PastChallengeItem;
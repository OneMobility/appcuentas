"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { XCircle, CheckCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns"; // Importar parseISO
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import DynamicLucideIcon from "./DynamicLucideIcon";
import { ChallengeData } from "./ChallengeCard"; // Import ChallengeData type

interface PastChallengeItemProps {
  challenge: ChallengeData;
}

const FAILED_CHALLENGE_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Fallido.png";
const COMPLETED_CHALLENGE_IMAGES: { [key: string]: string } = {
  "saving-goal-150": "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Reto%20150%20pesos.png",
  "no-netflix-more-books": "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Reto%20menos%20netflix.png",
};

const PastChallengeItem: React.FC<PastChallengeItemProps> = ({ challenge }) => {
  const isCompleted = challenge.status === "completed";
  const isFailed = challenge.status === "failed";
  const isRegular = challenge.status === "regular";

  let cardClasses = "";
  let statusIcon = null;
  let statusText = "";
  let titleClasses = "";
  let descriptionClasses = "";
  let imageToDisplay: string | undefined = undefined;
  let imageAltText = "";

  if (isCompleted) {
    cardClasses = "border-l-4 border-green-500 bg-green-50 text-green-800";
    statusIcon = <CheckCircle className="h-5 w-5 text-green-600" />;
    statusText = "Completado";
    imageToDisplay = COMPLETED_CHALLENGE_IMAGES[challenge.challenge_template_id] || challenge.badge?.image_url;
    imageAltText = challenge.badge?.name || challenge.name;
  } else if (isFailed) {
    cardClasses = "border-l-4 border-pink-500 bg-pink-50 text-pink-800"; // Tarjeta rosa para fallido
    statusIcon = <XCircle className="h-5 w-5 text-red-600" />;
    statusText = "Fallido";
    titleClasses = "line-through";
    descriptionClasses = "line-through";
    imageToDisplay = FAILED_CHALLENGE_IMAGE;
    imageAltText = "Reto Fallido";
  } else if (isRegular) {
    cardClasses = "border-l-4 border-orange-500 bg-orange-50 text-orange-800";
    statusIcon = <TrendingUp className="h-5 w-5 text-orange-600" />;
    statusText = "Regular";
    titleClasses = "line-through";
    descriptionClasses = "line-through";
  } else {
    // Fallback para cualquier otro estado inesperado
    cardClasses = "border-l-4 border-gray-300 bg-gray-50 text-gray-800";
    statusIcon = <XCircle className="h-5 w-5 text-gray-500" />;
    statusText = "Desconocido";
    titleClasses = "line-through";
    descriptionClasses = "line-through";
  }

  // Usar parseISO para asegurar que la fecha se interprete correctamente
  const formattedEndDate = challenge.end_date ? format(parseISO(challenge.end_date), "dd/MM/yyyy", { locale: es }) : "N/A";

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
            isFailed && "text-red-600 font-medium", // Texto de estado en rojo para fallido
            isRegular && "text-orange-600 font-medium"
          )}>
            {statusText}
          </span>
        </p>

        {imageToDisplay && (
          <div className="mt-3 flex items-center gap-2">
            <img src={imageToDisplay} alt={imageAltText} className="h-12 w-12" /> {/* Tamaño 120x120 se ajusta a h-12 w-12 */}
            {isFailed && <span className="text-red-600 font-medium">Reto fallido</span>}
            {isCompleted && challenge.badge && (
              <div className="flex flex-col">
                <span className="text-sm font-medium">Insignia: {challenge.badge.name}</span>
                <span className="text-xs text-muted-foreground">{challenge.badge.description}</span>
              </div>
            )}
          </div>
        )}
        {/* Si no hay imagen específica y no está completado con insignia, y es regular, mostrar mensaje genérico */}
        {(!imageToDisplay && isRegular) && (
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
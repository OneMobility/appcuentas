"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { XCircle, CheckCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import DynamicLucideIcon from "./DynamicLucideIcon";
import { ChallengeData } from "./ChallengeCard";
import FlippableChallengeCard from "./FlippableChallengeCard"; // Importar el nuevo componente

interface PastChallengeItemProps {
  challenge: ChallengeData;
}

const FAILED_CHALLENGE_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Fallido.png";
const COMPLETED_CHALLENGE_IMAGES: { [key: string]: string } = {
  "saving-goal-150": "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Reto%20150%20pesos.png",
  "no-netflix-more-books": "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Reto%20menos%20netflix.png",
  // Añadir otras imágenes específicas para retos completados aquí
};
const GENERIC_COMPLETED_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Meta%202.png"; // Imagen genérica para retos completados
const GENERIC_REGULAR_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Calendario.png"; // Imagen genérica para retos regulares

const PastChallengeItem: React.FC<PastChallengeItemProps> = ({ challenge }) => {
  const isCompleted = challenge.status === "completed";
  const isFailed = challenge.status === "failed";
  const isRegular = challenge.status === "regular";

  let cardClasses = "";
  let statusIcon = null;
  let statusText = "";
  let titleClasses = "";
  let descriptionClasses = "";
  let frontImageSrc: string | undefined = undefined;
  let frontImageAlt: string = challenge.name;

  if (isCompleted) {
    cardClasses = "border-l-4 border-green-500 bg-green-50 text-green-800";
    statusIcon = <CheckCircle className="h-5 w-5 text-green-600" />;
    statusText = "Completado";
    frontImageSrc = COMPLETED_CHALLENGE_IMAGES[challenge.challenge_template_id] || challenge.badge?.image_url || GENERIC_COMPLETED_IMAGE;
    frontImageAlt = challenge.badge?.name || challenge.name;
  } else if (isFailed) {
    cardClasses = "border-l-4 border-pink-500 bg-pink-50 text-pink-800";
    statusIcon = <XCircle className="h-5 w-5 text-red-600" />;
    statusText = "Fallido";
    titleClasses = "line-through";
    descriptionClasses = "line-through";
    frontImageSrc = FAILED_CHALLENGE_IMAGE;
    frontImageAlt = "Reto Fallido";
  } else if (isRegular) {
    cardClasses = "border-l-4 border-orange-500 bg-orange-50 text-orange-800";
    statusIcon = <TrendingUp className="h-5 w-5 text-orange-600" />;
    statusText = "Regular";
    titleClasses = "line-through";
    descriptionClasses = "line-through";
    frontImageSrc = GENERIC_REGULAR_IMAGE; // Usar imagen genérica para regular
    frontImageAlt = "Reto Regular";
  } else {
    cardClasses = "border-l-4 border-gray-300 bg-gray-50 text-gray-800";
    statusIcon = <XCircle className="h-5 w-5 text-gray-500" />;
    statusText = "Desconocido";
    titleClasses = "line-through";
    descriptionClasses = "line-through";
  }

  const formattedEndDate = challenge.end_date ? format(parseISO(challenge.end_date), "dd/MM/yyyy", { locale: es }) : "N/A";

  const backContent = (
    <Card className={cn("p-0 shadow-none border-none h-full flex flex-col justify-between", cardClasses)}>
      <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
        <CardTitle className={cn("text-base font-semibold", titleClasses)}>
          {challenge.name}
        </CardTitle>
        {statusIcon}
      </CardHeader>
      <CardContent className="p-0 flex-1">
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
        {((isFailed || isRegular) && !isCompleted) && ( // Mostrar solo si es fallido/regular y no completado con insignia
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
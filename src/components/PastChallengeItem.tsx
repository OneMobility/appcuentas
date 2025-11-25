"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { XCircle, CheckCircle, TrendingUp, Lock } from "lucide-react"; // Importar Lock para retos no ganados
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import DynamicLucideIcon from "./DynamicLucideIcon";
import { ChallengeData } from "./ChallengeCard";
import FlippableChallengeCard from "./FlippableChallengeCard";
import { ChallengeTemplate } from "@/utils/challenge-templates"; // Importar ChallengeTemplate

interface PastChallengeItemProps {
  template: ChallengeTemplate; // La plantilla del reto
  userChallenge?: ChallengeData | null; // El reto del usuario si existe
}

const FAILED_CHALLENGE_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Fallido.png";
const UNEARNED_BADGE_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Badge%20Bloqueado.png";
const COMPLETED_CHALLENGE_IMAGES: { [key: string]: string } = {
  "saving-goal-150": "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Reto%20150%20pesos.png",
  "no-netflix-more-books": "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Reto%20menos%20netflix.png",
  // Añadir otras imágenes específicas para retos completados aquí
};
const GENERIC_COMPLETED_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Meta%202.png";
const GENERIC_REGULAR_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Calendario.png";

const PastChallengeItem: React.FC<PastChallengeItemProps> = ({ template, userChallenge }) => {
  const isCompleted = userChallenge?.status === "completed";
  const isFailed = userChallenge?.status === "failed";
  const isRegular = userChallenge?.status === "regular";
  const isEarned = isCompleted || isRegular; // Considerar 'regular' como 'ganado' para mostrar la imagen del reto

  let cardClasses = "";
  let statusIcon = null;
  let statusText = "";
  let titleClasses = "";
  let descriptionClasses = "";
  let frontImageSrc: string | undefined = undefined;
  let frontImageAlt: string = template.name;

  if (!userChallenge) {
    // Reto no ganado
    cardClasses = "border-l-4 border-gray-300 bg-gray-100 text-gray-600";
    statusIcon = <Lock className="h-5 w-5 text-gray-500" />;
    statusText = "No Ganado";
    frontImageSrc = UNEARNED_BADGE_IMAGE;
    frontImageAlt = "Reto Bloqueado";
  } else if (isCompleted) {
    cardClasses = "border-l-4 border-green-500 bg-green-50 text-green-800";
    statusIcon = <CheckCircle className="h-5 w-5 text-green-600" />;
    statusText = "Completado";
    frontImageSrc = COMPLETED_CHALLENGE_IMAGES[template.id] || userChallenge.badge?.image_url || GENERIC_COMPLETED_IMAGE;
    frontImageAlt = userChallenge.badge?.name || template.name;
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
    frontImageSrc = GENERIC_REGULAR_IMAGE;
    frontImageAlt = "Reto Regular";
  }

  const formattedEndDate = userChallenge?.end_date ? format(parseISO(userChallenge.end_date), "dd/MM/yyyy", { locale: es }) : "N/A";

  const backContent = (
    <Card className={cn("p-0 shadow-none border-none h-full flex flex-col justify-between", cardClasses)}>
      <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
        <CardTitle className={cn("text-base font-semibold", titleClasses)}>
          {template.name}
        </CardTitle>
        {statusIcon}
      </CardHeader>
      <CardContent className="p-0 flex-1">
        <p className={cn("text-sm text-muted-foreground", descriptionClasses)}>
          {template.description}
        </p>
        {userChallenge ? (
          <>
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

            {isCompleted && userChallenge.badge && (
              <div className="mt-3 flex items-center gap-2">
                <img src={userChallenge.badge.image_url} alt={userChallenge.badge.name} className="h-10 w-10" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Insignia: {userChallenge.badge.name}</span>
                  <span className="text-xs text-muted-foreground">{userChallenge.badge.description}</span>
                </div>
              </div>
            )}
            {((isFailed || isRegular) && !isCompleted) && (
              <div className="mt-3 flex items-center gap-2 text-red-600">
                <XCircle className="h-6 w-6" />
                <span className="text-sm font-medium">No se obtuvo insignia.</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">
            Completa este reto para ganar la insignia y desbloquear sus detalles.
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <FlippableChallengeCard
      frontImageSrc={frontImageSrc}
      frontImageAlt={frontImageAlt}
      backContent={backContent}
      cardClasses={cardClasses}
    />
  );
};

export default PastChallengeItem;
"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChallengeData } from "./ChallengeCard"; // Assuming ChallengeData is defined here
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface ChallengeAlbumImageProps {
  challenge: ChallengeData;
}

const FAILED_CHALLENGE_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Fallido.png";
const COMPLETED_CHALLENGE_IMAGES: { [key: string]: string } = {
  "saving-goal-150": "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Reto%20150%20pesos.png",
  "no-netflix-more-books": "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Reto%20menos%20netflix.png",
  // Añadir otras imágenes específicas para retos completados aquí
};
const GENERIC_COMPLETED_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Meta%202.png";
const GENERIC_REGULAR_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Calendario.png";

const ChallengeAlbumImage: React.FC<ChallengeAlbumImageProps> = ({ challenge }) => {
  const isCompleted = challenge.status === "completed";
  const isFailed = challenge.status === "failed";
  const isRegular = challenge.status === "regular";

  let frontImageSrc: string | undefined = undefined;
  let statusText = "";
  let overlayClasses = "";

  if (isCompleted) {
    frontImageSrc = COMPLETED_CHALLENGE_IMAGES[challenge.challenge_template_id] || challenge.badge?.image_url || GENERIC_COMPLETED_IMAGE;
    statusText = "Completado";
    overlayClasses = "bg-green-500/70";
  } else if (isFailed) {
    frontImageSrc = FAILED_CHALLENGE_IMAGE;
    statusText = "Fallido";
    overlayClasses = "bg-red-500/70";
  } else if (isRegular) {
    frontImageSrc = GENERIC_REGULAR_IMAGE;
    statusText = "Regular";
    overlayClasses = "bg-orange-500/70";
  } else {
    // Fallback para cualquier otro estado inesperado, aunque este componente solo debería recibir retos realizados
    frontImageSrc = FAILED_CHALLENGE_IMAGE; // O una imagen genérica de "desconocido"
    statusText = "Desconocido";
    overlayClasses = "bg-gray-500/70";
  }

  const formattedEndDate = challenge.end_date ? format(parseISO(challenge.end_date), "dd/MM/yyyy", { locale: es }) : "N/A";

  return (
    <div className="relative w-full aspect-square rounded-lg overflow-hidden shadow-md group">
      <img
        src={frontImageSrc}
        alt={challenge.name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        onError={(e) => {
          e.currentTarget.src = FAILED_CHALLENGE_IMAGE; // Fallback si la imagen falla en cargar
        }}
      />
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center text-white p-2 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        overlayClasses
      )}>
        <h3 className="text-lg font-bold leading-tight">{challenge.name}</h3>
        <p className="text-sm mt-1">{statusText}</p>
        <p className="text-xs mt-0.5">Finalizado: {formattedEndDate}</p>
      </div>
    </div>
  );
};

export default ChallengeAlbumImage;
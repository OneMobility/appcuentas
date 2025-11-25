"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import DynamicLucideIcon from "./DynamicLucideIcon"; // Para iconos de fallback
import { XCircle } from "lucide-react"; // Importar XCircle para el fallback de depuración

interface FlippableChallengeCardProps {
  frontImageSrc?: string;
  frontImageAlt: string;
  backContent: React.ReactNode;
  cardClasses?: string; // Clases para el contenedor de la tarjeta
  iconComponent?: React.ElementType; // Para mostrar un icono si no hay imagen
}

const FlippableChallengeCard: React.FC<FlippableChallengeCardProps> = ({
  frontImageSrc,
  frontImageAlt,
  backContent,
  cardClasses,
  iconComponent: Icon = DynamicLucideIcon, // Default to DynamicLucideIcon if not provided
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false); // Resetear el estado de error de la imagen cuando la fuente de la imagen cambie
    console.log("FlippableChallengeCard: frontImageSrc changed to", frontImageSrc);
  }, [frontImageSrc]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    console.log("FlippableChallengeCard: isFlipped toggled to", !isFlipped);
  };

  const handleImageError = () => {
    setImageError(true);
    console.error("FlippableChallengeCard: Image failed to load for src:", frontImageSrc);
  };

  return (
    <motion.div
      className={cn(
        "relative w-full h-full cursor-pointer rounded-lg shadow-md bg-white", // Añadido bg-white para asegurar un fondo
        cardClasses
      )}
      onClick={handleFlip}
      initial={false}
      animate={{ rotateY: isFlipped ? 180 : 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Front of the card */}
      <div
        className="absolute inset-0 backface-hidden rounded-lg flex items-center justify-center p-4"
        style={{ backfaceVisibility: "hidden" }}
      >
        {frontImageSrc && !imageError ? (
          <img
            src={frontImageSrc}
            alt={frontImageAlt}
            className="max-h-full max-w-full object-contain"
            onError={handleImageError}
          />
        ) : (
          // Fallback a un icono si no hay src, o la imagen falló en cargar
          <XCircle className="h-32 w-32 text-red-500" /> // Icono de depuración más grande y visible
        )}
      </div>

      {/* Back of the card */}
      <div
        className="absolute inset-0 backface-hidden rounded-lg rotate-y-180"
        style={{ backfaceVisibility: "hidden" }}
      >
        {backContent}
      </div>
    </motion.div>
  );
};

export default FlippableChallengeCard;
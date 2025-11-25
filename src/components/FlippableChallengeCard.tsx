"use client";

import React, { useState, useEffect } from "react"; // Importar useEffect
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import DynamicLucideIcon from "./DynamicLucideIcon"; // Para iconos de fallback

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
  const [imageError, setImageError] = useState(false); // Nuevo estado para rastrear errores de carga de imagen

  useEffect(() => {
    // Resetear el estado de error de la imagen cuando la fuente de la imagen cambie
    setImageError(false);
  }, [frontImageSrc]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <motion.div
      className={cn(
        "relative w-full h-full cursor-pointer rounded-lg shadow-md",
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
        {frontImageSrc && !imageError ? ( // Solo intentar renderizar la imagen si hay src y no hay error
          <img
            src={frontImageSrc}
            alt={frontImageAlt}
            className="max-h-full max-w-full object-contain"
            onError={handleImageError} // Usar el nuevo manejador de errores
          />
        ) : (
          // Fallback a un icono si no hay src o la imagen falló en cargar
          <Icon iconName="Lightbulb" className="h-24 w-24 text-gray-400" />
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
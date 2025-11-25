"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import DynamicLucideIcon from "./DynamicLucideIcon"; // Para iconos de fallback

interface FlippableChallengeCardProps {
  frontImageSrc?: string;
  frontImageAlt: string;
  backContent: React.ReactNode;
  cardClasses: string; // Clases para el contenedor de la tarjeta
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

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <motion.div
      className={cn(
        "relative w-full h-full cursor-pointer rounded-lg shadow-md perspective-1000",
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
        {frontImageSrc ? (
          <img
            src={frontImageSrc}
            alt={frontImageAlt}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Icon iconName="Lightbulb" className="h-24 w-24 text-gray-400" /> // Fallback icon
        )}
      </div>

      {/* Back of the card */}
      <div
        className="absolute inset-0 backface-hidden rounded-lg rotate-y-180 p-4 flex flex-col justify-between"
        style={{ backfaceVisibility: "hidden" }}
      >
        {backContent}
      </div>
    </motion.div>
  );
};

export default FlippableChallengeCard;
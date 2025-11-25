"use client";

import React, { useState } from "react";
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

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
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
        {frontImageSrc ? (
          <img
            src={frontImageSrc}
            alt={frontImageAlt}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              // Fallback a un icono si la imagen falla en cargar
              e.currentTarget.style.display = 'none'; // Ocultar la imagen rota
              const parent = e.currentTarget.parentElement;
              if (parent && !parent.querySelector('.fallback-icon')) {
                const fallbackDiv = document.createElement('div');
                fallbackDiv.className = 'fallback-icon flex items-center justify-center w-full h-full';
                parent.appendChild(fallbackDiv);
                // Renderizar el icono de fallback dentro del div
                // Esto es un poco más complejo en React, pero para un fallback simple, podemos usar un icono estático
                // Para una solución más robusta, se podría pasar un prop `onImageError` al componente padre
                // Por ahora, solo mostraremos un mensaje o un icono simple si la imagen falla
                const FallbackIconComponent = Icon;
                const root = (window as any).ReactDOM.createRoot(fallbackDiv);
                root.render(<FallbackIconComponent iconName="ImageOff" className="h-24 w-24 text-gray-400" />);
              }
            }}
          />
        ) : (
          <Icon iconName="Lightbulb" className="h-24 w-24 text-gray-400" /> // Fallback icon si no hay src
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
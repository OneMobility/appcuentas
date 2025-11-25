"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FeedbackOverlayProps {
  message: string;
  imageSrc: string;
  bgColor: string;
  textColor: string;
  onClose: () => void;
  duration?: number; // Duración opcional, por defecto 4 segundos
}

const FeedbackOverlay: React.FC<FeedbackOverlayProps> = ({
  message,
  imageSrc,
  bgColor,
  textColor,
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const variants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  };

  return (
    <AnimatePresence>
      <motion.div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${bgColor} p-4`}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={variants}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <img src={imageSrc} alt="Feedback" className="h-48 w-48 mb-4" />
        <p className={`text-2xl font-bold text-center ${textColor}`}>
          {message}
        </p>
      </motion.div>
    </AnimatePresence>
  );
};

export default FeedbackOverlay;
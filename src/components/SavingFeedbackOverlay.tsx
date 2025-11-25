"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SavingFeedbackOverlayProps {
  type: "deposit" | "withdrawal";
  onClose: () => void;
}

const SavingFeedbackOverlay: React.FC<SavingFeedbackOverlayProps> = ({ type, onClose }) => {
  const isDeposit = type === "deposit";
  const bgColor = isDeposit ? "bg-pink-100" : "bg-blue-100"; // Rosa pastel y azul pastel
  const textColor = isDeposit ? "text-pink-800" : "text-blue-800";
  const imageSrc = isDeposit
    ? "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png"
    : "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro%20Triste.png";
  const message = isDeposit
    ? "¡Felicidades! ¡Un paso más cerca de tus metas!"
    : "Pensé que éramos amigos... ¡No te rindas!";

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000); // Duración de 4 segundos

    return () => clearTimeout(timer);
  }, [onClose]);

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
        <img src={imageSrc} alt="Cochinito" className="h-48 w-48 mb-4" />
        <p className={`text-2xl font-bold text-center ${textColor}`}>
          {message}
        </p>
      </motion.div>
    </AnimatePresence>
  );
};

export default SavingFeedbackOverlay;
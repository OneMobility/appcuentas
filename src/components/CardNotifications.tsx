"use client";

import React, { useEffect } from "react";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { Capacitor } from '@capacitor/core';
import { Share } from "lucide-react";

const CardNotifications: React.FC = () => {
  const { user } = useSession();
  const isMobilePlatform = Capacitor.isNativePlatform();

  // Lógica de instalación (PWA) para móvil
  useEffect(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isMobilePlatform || isPWA) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      setTimeout(() => {
        toast.info("¡Instala Oinkash!", {
          description: "Pulsa Compartir ↑ y 'Añadir a inicio' + para recibir alertas.",
          duration: 12000,
          icon: <Share className="h-5 w-5 text-primary" />,
        });
      }, 5000);
    }
  }, [isMobilePlatform]);

  return null;
};

export default CardNotifications;
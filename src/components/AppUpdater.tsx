"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const APP_VERSION = "1.0.1"; // Esta versión debe coincidir con la de public/version.json

const AppUpdater = () => {
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        // Añadimos un timestamp para evitar el cache del navegador/webvie
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (!response.ok) return;
        
        const data = await response.json();
        
        if (data.version !== APP_VERSION) {
          toast.info("¡Nueva actualización disponible!", {
            description: "Hay mejoras en Oinkash. Pulsa para aplicar los cambios.",
            action: {
              label: "Actualizar",
              onClick: () => window.location.reload(),
            },
            duration: Infinity,
            icon: <RefreshCw className="h-4 w-4 animate-spin" />,
          });
        }
      } catch (error) {
        console.error("Error verificando actualizaciones:", error);
      }
    };

    // Verificar al cargar la app
    checkForUpdates();

    // También verificar cada 10 minutos por si el usuario deja la app abierta mucho tiempo
    const interval = setInterval(checkForUpdates, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null;
};

export default AppUpdater;
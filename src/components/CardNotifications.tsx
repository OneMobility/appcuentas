"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, addDays, isBefore, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Capacitor } from '@capacitor/core';
import { Download, Share, Sparkles } from "lucide-react";

const SAVING_TIPS = [
  "Aplica la regla de las 48 horas: espera dos días antes de una compra grande. 🐷",
  "¿Ya revisaste tus suscripciones este mes? Cancela lo que no uses. ✂️",
  "Prepara café en casa; ese gasto hormiga suma miles al año. ☕",
  "Ahorra primero, gasta después. ¡Es el secreto de la abundancia!",
  "Usa efectivo para tus salidas de fin de semana; cuando se acabe, se acabó la fiesta. 🎟️"
];

const CardNotifications: React.FC = () => {
  const { user } = useSession();
  const isMobilePlatform = Capacitor.isNativePlatform();

  const createNotification = async (title: string, body: string, type: 'info' | 'warning' | 'success' | 'error' = 'info') => {
    if (!user) return;
    
    // Verificar si ya notificamos esto hoy para no spamear
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', title)
      .gte('created_at', today);

    if (existing && existing.length > 0) return;

    await supabase.from('notifications').insert({
      user_id: user.id,
      title,
      body,
      type
    });
  };

  useEffect(() => {
    const checkFinancialEvents = async () => {
      if (!user) return;

      const { data: cards } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', user.id);

      if (!cards) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const twoDaysFromNow = addDays(today, 2);

      cards.forEach(card => {
        if (card.type === "credit") {
          // 1. Notificar Límite Excedido
          if (card.credit_limit && card.current_balance > card.credit_limit) {
            createNotification(
              `⚠️ Límite Excedido: ${card.name}`,
              `Tu deuda de $${card.current_balance} superó tu límite. ¡Cuidado!`,
              'error'
            );
          }

          // 2. Notificar Día de Corte Próximo
          if (card.cut_off_day) {
            let cutOffDate = new Date(today.getFullYear(), today.getMonth(), card.cut_off_day);
            if (isBefore(cutOffDate, today)) {
              cutOffDate = new Date(today.getFullYear(), today.getMonth() + 1, card.cut_off_day);
            }
            if (isSameDay(cutOffDate, today) || (isBefore(cutOffDate, twoDaysFromNow) && !isBefore(cutOffDate, today))) {
              createNotification(
                `📅 Corte de Tarjeta: ${card.name}`,
                `Tu tarjeta corta el ${format(cutOffDate, "d 'de' MMMM", { locale: es })}. Revisa tus gastos.`,
                'warning'
              );
            }
          }
        }
      });

      // 3. Tip de Ahorro Aleatorio (Una vez al día)
      if (Math.random() > 0.7) { // 30% de probabilidad al abrir la app
        const randomTip = SAVING_TIPS[Math.floor(Math.random() * SAVING_TIPS.length)];
        createNotification("💡 Tip de Ahorro Oinkash", randomTip, "success");
      }
    };

    checkFinancialEvents();
  }, [user]);

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
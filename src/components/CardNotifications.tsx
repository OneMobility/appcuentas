"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, addDays, isBefore, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Capacitor } from '@capacitor/core';
import { getUpcomingPaymentDueDate } from "@/utils/date-helpers";

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  expiration_date: string;
  type: "credit" | "debit";
  cut_off_day?: number;
  days_to_pay_after_cut_off?: number;
  current_balance: number; // Añadido para la lógica de límite de crédito
  credit_limit?: number; // Añadido para la lógica de límite de crédito
}

const CardNotifications: React.FC = () => {
  const { user } = useSession();
  const [cards, setCards] = useState<CardData[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const isMobilePlatform = Capacitor.isNativePlatform();

  // Fetch cards for notifications
  useEffect(() => {
    const fetchCards = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('cards')
        .select('id, name, bank_name, expiration_date, type, cut_off_day, days_to_pay_after_cut_off, current_balance, credit_limit') // Incluir current_balance y credit_limit
        .eq('user_id', user.id);

      if (error) {
        showError('Error al cargar tarjetas para notificaciones: ' + error.message);
      } else {
        setCards(data || []);
      }
    };

    fetchCards();
  }, [user]);

  // Display toast notifications for upcoming card dates and credit limit (Web only)
  useEffect(() => {
    // Solo mostrar toasts si no es una plataforma móvil nativa
    if (!isMobilePlatform && cards.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalizar today al inicio del día
      const twoDaysFromNow = addDays(today, 2);

      cards.forEach(card => {
        if (card.type === "credit") {
          // Check Credit Limit Exceeded
          if (card.credit_limit !== undefined && card.current_balance > card.credit_limit) {
            toast.info(
              `¡Atención! El saldo actual de tu tarjeta ${card.name} (${card.bank_name}) excede tu límite de crédito.`,
              { style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }, duration: 10000 }
            );
          }

          // Check Cut-off Day
          if (card.cut_off_day !== undefined && card.cut_off_day > 0) {
            let cutOffDate = new Date(today.getFullYear(), today.getMonth(), card.cut_off_day);
            cutOffDate.setHours(0, 0, 0, 0); // Normalizar

            // Si el día de corte ya pasó este mes, se considera el del próximo mes para la notificación de corte
            if (isBefore(cutOffDate, today)) {
              cutOffDate = new Date(today.getFullYear(), today.getMonth() + 1, card.cut_off_day);
              cutOffDate.setHours(0, 0, 0, 0); // Normalizar
            }

            if (isBefore(cutOffDate, twoDaysFromNow) || isSameDay(cutOffDate, twoDaysFromNow)) {
              toast.info(
                `Fecha de corte próxima para ${card.name} (${card.bank_name}): ${format(cutOffDate, "dd 'de' MMMM", { locale: es })}`,
                { style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } }
              );
            }
          }

          // Check Payment Due Day (calculated using the new helper function)
          if (card.cut_off_day !== undefined && card.days_to_pay_after_cut_off !== undefined) {
            const paymentDueDate = getUpcomingPaymentDueDate(card.cut_off_day, card.days_to_pay_after_cut_off, today);

            if (isBefore(paymentDueDate, twoDaysFromNow) || isSameDay(paymentDueDate, twoDaysFromNow)) {
              toast.info(
                `Fecha límite de pago próxima para ${card.name} (${card.bank_name}): ${format(paymentDueDate, "dd 'de' MMMM", { locale: es })}`,
                { style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } }
              );
            }
          }
        }
      });
    }
  }, [cards, isMobilePlatform]);

  // PWA Install Prompt (Web only)
  useEffect(() => {
    if (!isMobilePlatform) { // Solo para web
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (!isPWA) {
        const handler = (e: Event) => {
          e.preventDefault();
          setDeferredPrompt(e);
          toast.info("¡Crea un acceso directo para una mejor experiencia!", {
            description: "Puedes instalar esta aplicación en tu dispositivo para un acceso rápido.",
            action: {
              label: "Instalar",
              onClick: () => {
                if (deferredPrompt) {
                  (deferredPrompt as any).prompt();
                  (deferredPrompt as any).userChoice.then((choiceResult: any) => {
                    if (choiceResult.outcome === 'accepted') {
                      showSuccess('Aplicación instalada exitosamente!');
                    } else {
                      showError('Instalación cancelada.');
                    }
                    setDeferredPrompt(null);
                  });
                }
              },
            },
            duration: 10000,
            style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }
          });
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
          window.removeEventListener('beforeinstallprompt', handler);
        };
      }
    }
  }, [deferredPrompt, isMobilePlatform]);

  return null;
};

export default CardNotifications;
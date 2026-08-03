"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, addDays, isBefore, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Capacitor } from '@capacitor/core';

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  expiration_date: string;
  type: "credit" | "debit";
  cut_off_day?: number;
  days_to_pay_after_cut_off?: number;
  current_balance: number;
  credit_limit?: number;
}

const CardNotifications: React.FC = () => {
  const { user } = useSession();
  const [cards, setCards] = useState<CardData[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const isMobilePlatform = Capacitor.isNativePlatform();

  useEffect(() => {
    const fetchCards = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('cards')
        .select('id, name, bank_name, expiration_date, type, cut_off_day, days_to_pay_after_cut_off, current_balance, credit_limit')
        .eq('user_id', user.id);
      if (error) {
        showError('Error al cargar tarjetas para notificaciones: ' + error.message);
      } else {
        setCards(data || []);
      }
    };
    fetchCards();
  }, [user]);

  useEffect(() => {
    if (!isMobilePlatform && cards.length > 0 && !sessionStorage.getItem('cardNotificationsShown')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const twoDaysFromNow = addDays(today, 2);

      cards.forEach(card => {
        if (card.type === "credit") {
          if (card.credit_limit !== undefined && card.current_balance > card.credit_limit) {
            toast.info(
              `¡Atención! El saldo actual de tu tarjeta ${card.name} excede tu límite.`,
              { style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }, duration: 10000 }
            );
          }
          if (card.cut_off_day !== undefined && card.cut_off_day > 0) {
            let cutOffDate = new Date(today.getFullYear(), today.getMonth(), card.cut_off_day);
            cutOffDate.setHours(0, 0, 0, 0);
            if (isBefore(cutOffDate, today)) {
              cutOffDate = new Date(today.getFullYear(), today.getMonth() + 1, card.cut_off_day);
            }
            if (isBefore(cutOffDate, twoDaysFromNow) || isSameDay(cutOffDate, twoDaysFromNow)) {
              toast.info(
                `Corte próximo para ${card.name}: ${format(cutOffDate, "dd 'de' MMMM", { locale: es })}`,
                { style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } }
              );
            }
          }
        }
      });
      sessionStorage.setItem('cardNotificationsShown', 'true');
    }
  }, [cards, isMobilePlatform]);

  useEffect(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (!isMobilePlatform && !isPWA) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        
        // Mostrar invitación de instalación
        toast.info("¡Instala Oinkash en tu dispositivo!", {
          description: "Añade un acceso directo a tu pantalla de inicio para una experiencia más fluida.",
          action: {
            label: "Instalar",
            onClick: () => {
              if (e) {
                (e as any).prompt();
                (e as any).userChoice.then((choiceResult: any) => {
                  if (choiceResult.outcome === 'accepted') {
                    showSuccess('¡Oinkash instalada!');
                  }
                  setDeferredPrompt(null);
                });
              }
            },
          },
          duration: 15000,
          style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }
        });
      };

      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, [isMobilePlatform]);

  return null;
};

export default CardNotifications;
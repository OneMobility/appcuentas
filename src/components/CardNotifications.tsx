"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, addDays, isBefore, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Capacitor } from '@capacitor/core';
import { Download, Share, PlusSquare } from "lucide-react";

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
        showError('Error al cargar tarjetas: ' + error.message);
      } else {
        setCards(data || []);
      }
    };
    fetchCards();
  }, [user]);

  // Notificaciones de tarjetas (Solo en web, no nativo para no duplicar)
  useEffect(() => {
    if (!isMobilePlatform && cards.length > 0 && !sessionStorage.getItem('cardNotificationsShown')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const twoDaysFromNow = addDays(today, 2);

      cards.forEach(card => {
        if (card.type === "credit") {
          if (card.credit_limit !== undefined && card.current_balance > card.credit_limit) {
            toast.error(
              `¡Límite excedido! ${card.name}`,
              { description: "Tu deuda actual supera el límite de crédito configurado.", duration: 8000 }
            );
          }
          if (card.cut_off_day !== undefined) {
            let cutOffDate = new Date(today.getFullYear(), today.getMonth(), card.cut_off_day);
            if (isBefore(cutOffDate, today)) {
              cutOffDate = new Date(today.getFullYear(), today.getMonth() + 1, card.cut_off_day);
            }
            if (isBefore(cutOffDate, twoDaysFromNow) || isSameDay(cutOffDate, twoDaysFromNow)) {
              toast.warning(
                `Corte próximo: ${card.name}`,
                { description: `El corte es el ${format(cutOffDate, "dd 'de' MMMM", { locale: es })}.`, duration: 8000 }
              );
            }
          }
        }
      });
      sessionStorage.setItem('cardNotificationsShown', 'true');
    }
  }, [cards, isMobilePlatform]);

  // Lógica de instalación (PWA)
  useEffect(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    // Si ya es nativa o ya está instalada, no mostramos nada
    if (isMobilePlatform || isPWA) return;

    // 1. Detectar iOS (iPhone/iPad)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (isIOS) {
      // Mostrar instrucciones manuales para iOS
      setTimeout(() => {
        toast.info("¡Lleva Oinkash en tu iPhone!", {
          description: "Pulsa el botón de 'Compartir' ↑ y luego selecciona 'Añadir a la pantalla de inicio' +",
          duration: 12000,
          icon: <Share className="h-5 w-5 text-primary" />,
        });
      }, 3000);
      return;
    }

    // 2. Detectar Android/PC (Navegadores con soporte beforeinstallprompt)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      toast.info("¡Instala Oinkash!", {
        description: "Accede más rápido y con mejor experiencia instalando la app.",
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
        duration: 20000,
        icon: <Download className="h-5 w-5 text-primary animate-bounce" />,
      });
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isMobilePlatform]);

  return null;
};

export default CardNotifications;
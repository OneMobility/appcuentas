"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, addDays, isBefore, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema, Token, ActionPerformed } from '@capacitor/push-notifications';

interface CardData {
  id: string;
  name: string;
  bank_name: string;
  expiration_date: string;
  type: "credit" | "debit";
  cut_off_day?: number;
  days_to_pay_after_cut_off?: number; // Nuevo campo
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
        .select('id, name, bank_name, expiration_date, type, cut_off_day, days_to_pay_after_cut_off') // Seleccionar nuevo campo
        .eq('user_id', user.id);

      if (error) {
        showError('Error al cargar tarjetas para notificaciones: ' + error.message);
      } else {
        setCards(data || []);
      }
    };

    fetchCards();
  }, [user]);

  // Display toast notifications for upcoming card dates (Web only)
  useEffect(() => {
    if (!isMobilePlatform && cards.length > 0) {
      const today = new Date();
      const twoDaysFromNow = addDays(today, 2);

      cards.forEach(card => {
        if (card.type === "credit") {
          // Check Cut-off Day
          if (card.cut_off_day !== undefined && card.cut_off_day > 0) {
            let cutOffDate = new Date(today.getFullYear(), today.getMonth(), card.cut_off_day);
            if (isBefore(cutOffDate, today)) {
              cutOffDate = new Date(today.getFullYear(), today.getMonth() + 1, card.cut_off_day);
            }

            if (isBefore(cutOffDate, twoDaysFromNow) || isSameDay(cutOffDate, twoDaysFromNow)) {
              toast.info(
                `Fecha de corte próxima para ${card.name} (${card.bank_name}): ${format(cutOffDate, "dd 'de' MMMM", { locale: es })}`,
                { style: { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } }
              );
            }
          }

          // Check Payment Due Day (calculated from days_to_pay_after_cut_off)
          if (card.cut_off_day !== undefined && card.days_to_pay_after_cut_off !== undefined) {
            let cutOffDateForPayment = new Date(today.getFullYear(), today.getMonth(), card.cut_off_day);
            // Si el día de corte ya pasó este mes, se considera el del próximo mes para calcular la fecha de pago
            if (cutOffDateForPayment.getDate() < today.getDate() && cutOffDateForPayment.getMonth() === today.getMonth()) {
              cutOffDateForPayment = new Date(today.getFullYear(), today.getMonth() + 1, card.cut_off_day);
            } else if (cutOffDateForPayment.getDate() > today.getDate() && cutOffDateForPayment.getMonth() !== today.getMonth()) {
              // Si el día de corte es en un mes futuro (ej. hoy es 30 de enero, corte es 1 de marzo), usar el mes actual
              cutOffDateForPayment = new Date(today.getFullYear(), today.getMonth(), card.cut_off_day);
            }

            const paymentDueDate = addDays(cutOffDateForPayment, card.days_to_pay_after_cut_off);

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
    if (!isMobilePlatform) {
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

  // Capacitor Push Notifications (Mobile only)
  useEffect(() => {
    if (isMobilePlatform && user) {
      const registerPushNotifications = async () => {
        let permStatus = await PushNotifications.requestPermissions();

        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        } else {
          showError('Permisos de notificación no concedidos.');
        }

        PushNotifications.addListener('registration', async (token: Token) => {
          console.log('Push registration success, token: ' + token.value);
          // Save token to Supabase
          const { error } = await supabase
            .from('user_devices')
            .upsert({ user_id: user.id, push_token: token.value }, { onConflict: 'push_token' });
          if (error) {
            showError('Error al guardar el token de notificación: ' + error.message);
          } else {
            showSuccess('Notificaciones push registradas.');
          }
        });

        PushNotifications.addListener('registrationError', (error: any) => {
          showError('Error en el registro de notificaciones push: ' + JSON.stringify(error));
        });

        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('Push received: ' + JSON.stringify(notification));
          toast.info(notification.title || 'Notificación', {
            description: notification.body,
            duration: 5000,
          });
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
          console.log('Push action performed: ' + JSON.stringify(notification));
          // Handle navigation or specific actions based on notification data
        });
      };

      registerPushNotifications();

      return () => {
        PushNotifications.removeAllListeners();
      };
    }
  }, [isMobilePlatform, user]);

  return null;
};

export default CardNotifications;
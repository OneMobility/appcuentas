"use client";

import React, { useEffect } from 'react';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/context/SessionContext';
import { showError } from '@/utils/toast';

const PushNotificationManager: React.FC = () => {
  const { user } = useSession();

  useEffect(() => {
    // Solo ejecutar en dispositivos nativos (Android/iOS)
    if (!Capacitor.isNativePlatform() || !user) return;

    const setupPush = async () => {
      try {
        // 1. Pedir permisos
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn("[Push] Permisos denegados por el usuario.");
          return;
        }

        // 2. Registrar el dispositivo en el servicio de notificaciones
        await PushNotifications.register();

        // 3. Escuchar cuando se genera el token
        PushNotifications.addListener('registration', async (token: Token) => {
          console.log('[Push] Token generado:', token.value);
          
          // Guardar el token en Supabase
          const { error } = await supabase
            .from('fcm_tokens')
            .upsert({
              user_id: user.id,
              token: token.value,
              device_platform: Capacitor.getPlatform(),
            }, { onConflict: 'token' });

          if (error) console.error("[Push] Error al guardar token:", error.message);
        });

        // 4. Manejar errores de registro
        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('[Push] Error en registro:', JSON.stringify(error));
        });

        // 5. Manejar qué pasa cuando llega una notificación y la app está abierta
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[Push] Notificación recibida:', notification);
        });

        // 6. Manejar qué pasa cuando el usuario toca la notificación
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('[Push] Acción realizada:', notification);
        });

      } catch (e) {
        console.error("[Push] Error general en setup:", e);
      }
    };

    setupPush();

    // Limpiar listeners al desmontar
    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [user]);

  return null; // Este componente no renderiza nada visual
};

export default PushNotificationManager;
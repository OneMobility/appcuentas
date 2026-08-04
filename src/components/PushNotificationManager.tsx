"use client";

import React, { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/context/SessionContext';
import { showSuccess, showError } from '@/utils/toast';

const PushNotificationManager: React.FC = () => {
  const { user } = useSession();

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return;

    const registerPush = async () => {
      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt') {
          perm = await PushNotifications.requestPermissions();
        }

        if (perm.receive !== 'granted') {
          console.warn('Permisos de notificación denegados');
          return;
        }

        await PushNotifications.register();

        // Listeners
        PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token:', token.value);
          
          // Guardar el token en Supabase
          const { error } = await supabase
            .from('user_device_tokens')
            .upsert({
              user_id: user.id,
              token: token.value,
              platform: Capacitor.getPlatform(),
            }, { onConflict: 'user_id, token' });

          if (error) console.error('Error guardando token push:', error.message);
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.error('Push registration error:', err.error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received:', notification);
          // Opcionalmente mostrar un toast si el app está en primer plano
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push action performed:', notification.actionId);
          // Navegar a alguna ruta si viene en el payload
        });

      } catch (e) {
        console.error('Error inicializando push:', e);
      }
    };

    registerPush();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user]);

  return null; // Componente lógico, no renderiza nada
};

export default PushNotificationManager;
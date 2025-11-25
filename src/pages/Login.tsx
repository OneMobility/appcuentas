"use client";

import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <Auth
          supabaseClient={supabase}
          providers={[]}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--primary))',
                  brandAccent: 'hsl(var(--primary-foreground))',
                },
              },
            },
          }}
          theme="light"
          redirectTo={window.location.origin + '/dashboard'}
          localization={{
            variables: {
              sign_in: {
                email_label: 'Correo electrónico',
                password_label: 'Contraseña',
                email_input_placeholder: 'Tu correo electrónico',
                password_input_placeholder: 'Tu contraseña',
                button_label: 'Iniciar sesión',
                social_provider_text: 'Iniciar sesión con {{provider}}',
                link_text: '¿Ya tienes una cuenta? Inicia sesión',
              },
              sign_up: {
                email_label: 'Correo electrónico',
                password_label: 'Contraseña',
                email_input_placeholder: 'Tu correo electrónico',
                password_input_placeholder: 'Tu contraseña',
                button_label: 'Registrarse',
                social_provider_text: 'Registrarse con {{provider}}',
                link_text: '¿No tienes una cuenta? Regístrate',
              },
              forgotten_password: {
                email_label: 'Correo electrónico',
                password_label: 'Tu contraseña',
                email_input_placeholder: 'Tu correo electrónico',
                button_label: 'Enviar instrucciones de recuperación',
                link_text: '¿Olvidaste tu contraseña?',
              },
              update_password: {
                password_label: 'Nueva contraseña',
                password_input_placeholder: 'Tu nueva contraseña',
                button_label: 'Actualizar contraseña',
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default Login;
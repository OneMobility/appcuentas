"use client";

import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { PiggyBank } from 'lucide-react'; // Importar el icono de PiggyBank

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
        <div className="flex flex-col items-center justify-center mb-6">
          <img
            src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Oinkash%20Logo.png"
            alt="Oinkash Logo"
            className="h-12 w-12 text-primary mb-2"
          />
          <h2 className="text-2xl font-bold text-center text-foreground">Bienvenido a Oinkash</h2>
          <p className="text-sm text-muted-foreground text-center">Organiza tus finanzas de forma sencilla.</p>
        </div>
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
                title: 'Inicia Sesión',
                email_label: 'Correo electrónico',
                password_label: 'Contraseña',
                email_input_placeholder: 'Tu correo electrónico',
                password_input_placeholder: 'Tu contraseña',
                button_label: 'Iniciar sesión',
                social_provider_text: 'Iniciar sesión con {{provider}}',
                link_text: '¿Ya tienes una cuenta? Inicia sesión',
              },
              sign_up: {
                title: 'Regístrate',
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
          signUp={{
            data: {
              first_name: '',
              last_name: '',
            },
          }}
        />
      </div>
    </div>
  );
};

export default Login;
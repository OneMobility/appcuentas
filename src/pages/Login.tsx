"use client";

import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';

const APP_LOGO = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/ChatGPT%20Image%203%20ago%202026,%2003_44_08%20p.m..png";

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-md">
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="p-1 bg-slate-50 rounded-2xl shadow-inner mb-4">
            <img
              src={APP_LOGO}
              alt="Oinkash Logo"
              className="h-20 w-20 object-cover rounded-xl"
            />
          </div>
          <h2 className="text-2xl font-black text-center text-foreground tracking-tighter">Bienvenido a Oinkash</h2>
          <p className="text-sm text-muted-foreground text-center font-medium">Organiza tus finanzas de forma sencilla.</p>
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
                radii: {
                  buttonRadius: '1rem',
                  inputRadius: '1rem',
                }
              },
            },
          }}
          theme="light"
          redirectTo={window.location.origin + '/reset-password'}
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
                title: 'Recuperar Contraseña',
                email_label: 'Correo electrónico',
                email_input_placeholder: 'Tu correo electrónico',
                button_label: 'Enviar instrucciones',
                link_text: '¿Olvidaste tu contraseña?',
              }
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
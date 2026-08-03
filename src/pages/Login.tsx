"use client";

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Mail, Lock, User, ArrowRight } from 'lucide-react';

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        if (!firstName.trim()) {
          showError("El nombre es obligatorio.");
          setIsSubmitting(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim() || null,
            },
            emailRedirectTo: window.location.origin + '/dashboard',
          },
        });

        if (error) throw error;

        if (data.session) {
          showSuccess("¡Registro exitoso! Bienvenido a Oinkash.");
        } else {
          showSuccess("¡Registro exitoso! Por favor verifica tu correo electrónico para confirmar tu cuenta.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        showSuccess("¡Bienvenido de vuelta!");
      }
    } catch (error: any) {
      showError(error.message || "Ocurrió un error durante el proceso.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-3xl shadow-xl border-none bg-card">
        <CardHeader className="flex flex-col items-center justify-center pb-2">
          <img
            src="https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Logo%20App.png"
            alt="Oinkash Logo"
            className="h-16 w-12 object-contain mb-2"
          />
          <CardTitle className="text-2xl font-black text-center text-foreground">
            {isSignUp ? "Crea tu Cuenta" : "Bienvenido a Oinkash"}
          </CardTitle>
          <CardDescription className="text-center text-xs">
            {isSignUp 
              ? "Regístrate para empezar a organizar tus finanzas de forma sencilla." 
              : "Inicia sesión para continuar organizando tus finanzas."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="firstName">Nombre</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Nombre"
                      required
                      className="rounded-xl h-10 pl-9"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lastName">Apellido</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Apellido"
                      className="rounded-xl h-10 pl-9"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  required
                  className="rounded-xl h-10 pl-9"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="rounded-xl h-10 pl-9"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <Button type="submit" className="w-full rounded-xl h-11 font-bold mt-2" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  {isSignUp ? "Registrarse" : "Iniciar Sesión"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setFirstName('');
                  setLastName('');
                }}
                className="text-xs text-primary hover:underline font-semibold"
                disabled={isSubmitting}
              >
                {isSignUp 
                  ? "¿Ya tienes una cuenta? Inicia sesión" 
                  : "¿No tienes una cuenta? Regístrate"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
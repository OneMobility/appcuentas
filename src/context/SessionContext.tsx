"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom'; // Importar useLocation
import LoadingSpinner from '@/components/LoadingSpinner';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation(); // Obtener la ubicación actual

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user || null);
        setIsLoading(false);

        if (event === 'SIGNED_IN') {
          const lastVisitedRoute = localStorage.getItem('lastVisitedRoute');
          if (lastVisitedRoute && lastVisitedRoute !== '/login') {
            navigate(lastVisitedRoute, { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem('lastVisitedRoute'); // Limpiar al cerrar sesión
          navigate('/login', { replace: true });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setIsLoading(false);
      if (!currentSession) {
        navigate('/login', { replace: true });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  // Guardar la última ruta visitada (solo rutas protegidas)
  useEffect(() => {
    if (!isLoading && session && location.pathname !== '/login') {
      localStorage.setItem('lastVisitedRoute', location.pathname);
    }
  }, [location.pathname, session, isLoading]);

  return (
    <SessionContext.Provider value={{ session, user, isLoading }}>
      {isLoading && <LoadingSpinner />}
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user || null);
        setIsLoading(false);

        if (event === 'PASSWORD_RECOVERY') {
          // Redirigir inmediatamente a la página de restablecimiento de contraseña
          navigate('/reset-password', { replace: true });
        } else if (event === 'SIGNED_IN') {
          // Solo redirigir al dashboard si no estamos en medio de una recuperación de contraseña
          const isRecovery = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
          if (isRecovery) {
            navigate('/reset-password', { replace: true });
          } else {
            const lastVisitedRoute = localStorage.getItem('lastVisitedRoute');
            if (lastVisitedRoute && lastVisitedRoute !== '/login' && lastVisitedRoute !== '/reset-password') {
              navigate(lastVisitedRoute, { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          }
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem('lastVisitedRoute');
          navigate('/login', { replace: true });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setIsLoading(false);
      
      const isRecovery = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
      if (isRecovery) {
        navigate('/reset-password', { replace: true });
      } else if (!currentSession && location.pathname !== '/login' && location.pathname !== '/reset-password') {
        navigate('/login', { replace: true });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  // Guardar la última ruta visitada (solo rutas protegidas)
  useEffect(() => {
    if (!isLoading && session && location.pathname !== '/login' && location.pathname !== '/reset-password') {
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
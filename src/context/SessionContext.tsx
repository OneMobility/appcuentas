"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import LoadingSpinner from '@/components/LoadingSpinner';

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  updated_at?: string | null;
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error.message);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("Error in fetchProfile:", err);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        const currentUser = currentSession?.user || null;
        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        
        setIsLoading(false);

        if (event === 'PASSWORD_RECOVERY') {
          if (location.pathname !== '/reset-password') {
            navigate('/reset-password', { replace: true });
          }
        } else if (event === 'SIGNED_IN') {
          const isRecovery = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
          if (isRecovery) {
            if (location.pathname !== '/reset-password') {
              navigate('/reset-password', { replace: true });
            }
          } else {
            // Redirigir siempre al iniciar sesión con éxito
            const lastVisitedRoute = localStorage.getItem('lastVisitedRoute');
            if (lastVisitedRoute && lastVisitedRoute !== '/login' && lastVisitedRoute !== '/reset-password') {
              navigate(lastVisitedRoute, { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          }
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem('lastVisitedRoute');
          if (location.pathname !== '/login') {
            navigate('/login', { replace: true });
          }
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      setSession(currentSession);
      const currentUser = currentSession?.user || null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser.id);
      }
      
      setIsLoading(false);
      
      const isRecovery = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
      if (isRecovery) {
        if (location.pathname !== '/reset-password') {
          navigate('/reset-password', { replace: true });
        }
      } else if (!currentSession && location.pathname !== '/login' && location.pathname !== '/reset-password') {
        navigate('/login', { replace: true });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  // Guardar la última ruta visitada (solo rutas protegidas)
  useEffect(() => {
    if (!isLoading && session && location.pathname !== '/login' && location.pathname !== '/reset-password') {
      localStorage.setItem('lastVisitedRoute', location.pathname);
    }
  }, [location.pathname, session, isLoading]);

  const isPublicPage = location.pathname === '/login' || location.pathname === '/reset-password';

  return (
    <SessionContext.Provider value={{ session, user, profile, isLoading, refreshProfile }}>
      {isLoading && !isPublicPage && <LoadingSpinner />}
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
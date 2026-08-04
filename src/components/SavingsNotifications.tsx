"use client";

import React, { useEffect } from "react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/context/SessionContext";
import { TrendingUp, AlertCircle, Trophy, Sparkles } from "lucide-react";

const SavingsNotifications: React.FC = () => {
  const { user } = useSession();

  useEffect(() => {
    const checkSavings = async () => {
      if (!user) return;

      const { data: savings } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', user.id);

      if (!savings || savings.length === 0) return;

      // Usamos sessionStorage para no repetir notificaciones en la misma sesión
      if (sessionStorage.getItem('savingsNotificationsShown')) return;

      savings.forEach(saving => {
        const progress = saving.target_amount ? (saving.current_balance / saving.target_amount) * 100 : 0;
        const daysSinceUpdate = differenceInDays(new Date(), parseISO(saving.updated_at || saving.created_at));

        // 1. Notificación de Inactividad Grave
        if (daysSinceUpdate > 30) {
          toast.error(`¡Meta Abandonada!: ${saving.name}`, {
            description: "Han pasado más de 30 días sin aportaciones. ¡No te rindas ahora!",
            icon: <AlertCircle className="h-5 w-5" />,
            duration: 10000,
          });
        } 
        // 2. Notificación de Hito (Casi cumplida)
        else if (progress >= 90 && progress < 100) {
          toast.success(`¡Casi lo tienes!: ${saving.name}`, {
            description: "Estás al 90% de tu meta. ¡Solo falta un último esfuerzo!",
            icon: <Trophy className="h-5 w-5 text-yellow-500" />,
            duration: 8000,
          });
        }
        // 3. Notificación de Inactividad Media
        else if (daysSinceUpdate >= 15 && daysSinceUpdate <= 30) {
          toast.warning(`Meta con hambre: ${saving.name}`, {
            description: "Hace 15 días no alimentas a tu cochinito. ¿Tienes una moneda por ahí? 🐷",
            icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
            duration: 8000,
          });
        }
        // 4. Milestone 50%
        else if (progress >= 50 && progress < 55) {
          toast.info(`¡Mitad de camino!: ${saving.name}`, {
            description: "Has alcanzado el 50%. ¡Vas por muy buen camino!",
            icon: <Sparkles className="h-5 w-5 text-blue-500" />,
          });
        }
      });

      sessionStorage.setItem('savingsNotificationsShown', 'true');
    };

    checkSavings();
  }, [user]);

  return null;
};

export default SavingsNotifications;
"use client";

import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { format, isAfter } from "date-fns";

interface ChallengeData {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed" | "failed";
  forbidden_category_ids: string[];
  badge_id?: string;
  user_id?: string;
}

export const checkChallengeStatus = async (userId: string, expenseCategoryId: string, refreshCallback?: () => void) => {
  const { data: activeChallenge, error: challengeError } = await supabase
    .from('challenges')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (challengeError && challengeError.code !== 'PGRST116') { // PGRST116 means no rows found
    console.error("Error al buscar reto activo:", challengeError.message);
    return;
  }

  if (activeChallenge) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(activeChallenge.end_date);
    endDate.setHours(0, 0, 0, 0);

    // Check if the challenge has already ended naturally
    if (isAfter(today, endDate)) {
      // If the challenge ended and was not failed, mark as completed
      if (activeChallenge.status === 'active') {
        const { error: updateError } = await supabase
          .from('challenges')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', activeChallenge.id);

        if (updateError) {
          console.error("Error al marcar reto como completado:", updateError.message);
          showError("Error al actualizar el estado del reto a completado.");
        } else {
          showSuccess(`¡Felicidades! Has completado el reto: "${activeChallenge.name}"`);
          if (refreshCallback) refreshCallback();
        }
      }
      return; // No need to check for forbidden categories if already ended
    }

    // Check if the expense category is forbidden for the active challenge
    if (activeChallenge.forbidden_category_ids && activeChallenge.forbidden_category_ids.includes(expenseCategoryId)) {
      const { error: updateError } = await supabase
        .from('challenges')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', activeChallenge.id);

      if (updateError) {
        console.error("Error al marcar reto como fallido:", updateError.message);
        showError("Error al actualizar el estado del reto a fallido.");
      } else {
        showError(`¡Oh no! Has roto el reto: "${activeChallenge.name}". Se detectó un gasto en una categoría prohibida.`);
        if (refreshCallback) refreshCallback();
      }
    }
  }
};
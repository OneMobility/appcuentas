"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import ChallengeCard, { ChallengeData } from "@/components/ChallengeCard";
import ChallengeCreationDialog from "@/components/ChallengeCreationDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { isAfter, isSameDay, format } from "date-fns";
import { useCategoryContext } from "@/context/CategoryContext"; // Importar useCategoryContext

interface ChallengesProps {
  challengeRefreshKey: number;
  setChallengeRefreshKey: React.Dispatch<React.SetStateAction<number>>;
}

const Challenges: React.FC<ChallengesProps> = ({ challengeRefreshKey, setChallengeRefreshKey }) => {
  const { user } = useSession();
  const { expenseCategories, incomeCategories, isLoadingCategories, getCategoryById } = useCategoryContext();
  const [activeChallenge, setActiveChallenge] = useState<ChallengeData | null>(null);
  const [isChallengeCreationDialogOpen, setIsChallengeCreationDialogOpen] = useState(false);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(true);
  // const [refreshKey, setRefreshKey] = useState(0); // Removed local refreshKey, using prop

  const fetchActiveChallenge = async () => {
    if (!user || isLoadingCategories) {
      setActiveChallenge(null);
      setIsLoadingChallenges(false);
      return;
    }
    setIsLoadingChallenges(true);
    const { data, error } = await supabase
      .from('challenges')
      .select('*, savings(id, name, current_balance, target_amount, color)') // Fetch linked saving goal
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      showError('Error al cargar reto activo: ' + error.message);
      setActiveChallenge(null);
    } else if (data) {
      console.log("Fetched raw challenge data:", data); // Debug log

      let savingGoalData = null;
      if (data.savings) {
        if (Array.isArray(data.savings)) {
          savingGoalData = data.savings.length > 0 ? data.savings[0] : null;
        } else {
          savingGoalData = data.savings;
        }
      }

      const challenge: ChallengeData = {
        ...data,
        saving_goal: savingGoalData,
        expense_categories: data.forbidden_category_ids
          ? data.forbidden_category_ids.map(id => getCategoryById(id, "expense")).filter(Boolean) as Category[]
          : [],
      };
      console.log("Processed challenge for state:", challenge); // Debug log
      setActiveChallenge(challenge);
      // Check if challenge needs evaluation
      const endDate = new Date(challenge.end_date);
      endDate.setHours(23, 59, 59, 999); // End of day
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (challenge.status === "active" && (isAfter(today, endDate) || isSameDay(today, endDate))) {
        await evaluateChallenge(challenge);
      }
    } else {
      setActiveChallenge(null);
    }
    setIsLoadingChallenges(false);
  };

  const evaluateChallenge = async (challenge: ChallengeData) => {
    if (!user) return;

    let newStatus: "completed" | "failed" | "regular" = "failed";

    if (challenge.challenge_template_id.startsWith("no-spend")) {
      // No-Spend Challenge evaluation
      const { data: expenseTransactions, error: txError } = await supabase
        .from('cash_transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'egreso')
        .in('category_id', challenge.forbidden_category_ids)
        .gte('date', challenge.start_date)
        .lte('date', challenge.end_date);

      const { data: cardTransactions, error: cardTxError } = await supabase
        .from('card_transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'charge')
        .in('category_id', challenge.forbidden_category_ids)
        .gte('date', challenge.start_date)
        .lte('date', challenge.end_date);

      if (txError || cardTxError) {
        console.error("Error fetching transactions for challenge evaluation:", txError?.message || cardTxError?.message);
        showError("Error al evaluar el reto de cero gastos.");
        return;
      }

      if (expenseTransactions?.length === 0 && cardTransactions?.length === 0) {
        newStatus = "completed";
        showSuccess(`¡Reto '${challenge.name}' completado! ¡Felicidades!`);
      } else {
        newStatus = "failed";
        showError(`Reto '${challenge.name}' fallido. Se registraron gastos en categorías prohibidas.`);
      }
    } else if (challenge.challenge_template_id.startsWith("saving-goal") && challenge.saving_goal) {
      // Saving Goal Challenge evaluation
      const saving = challenge.saving_goal;
      if (saving.target_amount !== null && saving.target_amount !== undefined && saving.target_amount > 0) {
        const progress = (saving.current_balance / saving.target_amount) * 100;
        if (progress >= 100) {
          newStatus = "completed";
          showSuccess(`¡Reto '${challenge.name}' completado! ¡Alcanzaste tu meta de ahorro!`);
        } else if (progress >= 50) {
          newStatus = "regular";
          showSuccess(`Reto '${challenge.name}' regular. ¡Casi lo logras, sigue así!`);
        } else {
          newStatus = "failed";
          showError(`Reto '${challenge.name}' fallido. No alcanzaste el 50% de tu meta de ahorro.`);
        }
      } else {
        newStatus = "failed"; // Target amount was 0 or invalid
        showError(`Reto '${challenge.name}' fallido. La meta de ahorro no era válida.`);
      }
    }

    // Update challenge status in DB
    const { error: updateError } = await supabase
      .from('challenges')
      .update({ status: newStatus })
      .eq('id', challenge.id)
      .eq('user_id', user.id);

    if (updateError) {
      showError('Error al actualizar el estado del reto: ' + updateError.message);
    } else {
      setChallengeRefreshKey(prev => prev + 1); // Force re-fetch to show updated status
    }
  };

  useEffect(() => {
    fetchActiveChallenge();
  }, [user, challengeRefreshKey, isLoadingCategories]); // Depend on prop refreshKey

  const handleChallengeStarted = () => {
    setChallengeRefreshKey(prev => prev + 1); // Force re-fetch
  };

  const handleRefreshChallenges = () => {
    setChallengeRefreshKey(prevKey => prevKey + 1);
    showSuccess("Retos actualizados.");
  };

  if (isLoadingChallenges) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tus Retos de Ahorro</h1>
        <Button variant="outline" size="sm" onClick={handleRefreshChallenges}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar Retos
        </Button>
      </div>

      <ChallengeCard
        challenge={activeChallenge}
        onStartNewChallenge={() => setIsChallengeCreationDialogOpen(true)}
        onViewBadges={() => { /* TODO: Navigate to badges page */ }}
        onRefreshChallenges={handleRefreshChallenges}
      />

      <ChallengeCreationDialog
        isOpen={isChallengeCreationDialogOpen}
        onClose={() => setIsChallengeCreationDialogOpen(false)}
        onChallengeStarted={handleChallengeStarted}
      />
    </div>
  );
};

export default Challenges;
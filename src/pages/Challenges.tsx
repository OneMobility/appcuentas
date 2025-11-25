"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trophy } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import ChallengeCard, { ChallengeData } from "@/components/ChallengeCard";
import ChallengeCreationDialog from "@/components/ChallengeCreationDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { isAfter, isSameDay, format } from "date-fns";
import { useCategoryContext } from "@/context/CategoryContext"; // Importar useCategoryContext
import DynamicLucideIcon from "@/components/DynamicLucideIcon"; // Importar DynamicLucideIcon
import { cn } from "@/lib/utils";

interface ChallengesProps {
  challengeRefreshKey: number;
  setChallengeRefreshKey: React.Dispatch<React.SetStateAction<number>>;
}

interface BadgeData {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
}

const badgeMapping: { [key: string]: string } = {
  "no-netflix-more-books": "Lector Digital",
  "no-more-blouses": "Estilista Consciente",
  "no-entertainment": "Maestro del Ahorro Social",
  "no-apps": "Desintoxicador Digital",
  "saving-goal-150": "Ahorrador Nivel 1",
  "saving-goal-300": "Ahorrador Nivel 2",
  "saving-goal-200": "Ahorrador Nivel 1.5",
  "saving-goal-500": "Ahorrador Nivel 3",
};

const Challenges: React.FC<ChallengesProps> = ({ challengeRefreshKey, setChallengeRefreshKey }) => {
  const { user } = useSession();
  const { expenseCategories, incomeCategories, isLoadingCategories, getCategoryById } = useCategoryContext();
  const [activeChallenge, setActiveChallenge] = useState<ChallengeData | null>(null);
  const [pastChallenges, setPastChallenges] = useState<ChallengeData[]>([]); // Para el álbum
  const [isChallengeCreationDialogOpen, setIsChallengeCreationDialogOpen] = useState(false);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(true);

  const fetchChallenges = async () => {
    if (!user || isLoadingCategories) {
      setActiveChallenge(null);
      setPastChallenges([]);
      setIsLoadingChallenges(false);
      return;
    }
    setIsLoadingChallenges(true);

    // Fetch active challenge
    const { data: activeChallengeData, error: activeChallengeError } = await supabase
      .from('challenges')
      .select('*, savings(id, name, current_balance, target_amount, color), badges(id, name, description, image_url)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (activeChallengeError && activeChallengeError.code !== 'PGRST116') {
      showError('Error al cargar reto activo: ' + activeChallengeError.message);
      setActiveChallenge(null);
    } else if (activeChallengeData) {
      let savingGoalData = null;
      if (activeChallengeData.savings) {
        if (Array.isArray(activeChallengeData.savings)) {
          savingGoalData = activeChallengeData.savings.length > 0 ? activeChallengeData.savings[0] : null;
        } else {
          savingGoalData = activeChallengeData.savings;
        }
      }
      const challenge: ChallengeData = {
        ...activeChallengeData,
        saving_goal: savingGoalData,
        expense_categories: activeChallengeData.forbidden_category_ids
          ? activeChallengeData.forbidden_category_ids.map(id => getCategoryById(id, "expense")).filter(Boolean) as Category[]
          : [],
        badge: activeChallengeData.badges as BadgeData | null, // Asignar la insignia
      };
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

    // Fetch past challenges (completed and failed) for the album
    const { data: pastChallengesData, error: pastChallengesError } = await supabase
      .from('challenges')
      .select('*, savings(id, name, current_balance, target_amount, color), badges(id, name, description, image_url)')
      .eq('user_id', user.id)
      .in('status', ['completed', 'failed'])
      .order('end_date', { ascending: false });

    if (pastChallengesError) {
      showError('Error al cargar retos anteriores: ' + pastChallengesError.message);
      setPastChallenges([]);
    } else {
      const formattedPastChallenges = (pastChallengesData || []).map(data => {
        let savingGoalData = null;
        if (data.savings) {
          if (Array.isArray(data.savings)) {
            savingGoalData = data.savings.length > 0 ? data.savings[0] : null;
          } else {
            savingGoalData = data.savings;
          }
        }
        return {
          ...data,
          saving_goal: savingGoalData,
          expense_categories: data.forbidden_category_ids
            ? data.forbidden_category_ids.map(id => getCategoryById(id, "expense")).filter(Boolean) as Category[]
            : [],
          badge: data.badges as BadgeData | null,
        };
      });
      setPastChallenges(formattedPastChallenges);
    }

    setIsLoadingChallenges(false);
  };

  const evaluateChallenge = async (challenge: ChallengeData) => {
    if (!user) return;

    let newStatus: "completed" | "failed" | "regular" = "failed";
    let awardedBadgeId: string | null = null;

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

    // Award badge if completed
    if (newStatus === "completed") {
      const badgeName = badgeMapping[challenge.challenge_template_id];
      if (badgeName) {
        const { data: badgeData, error: badgeError } = await supabase
          .from('badges')
          .select('id')
          .eq('name', badgeName)
          .single();

        if (badgeError) {
          console.error("Error fetching badge ID:", badgeError.message);
        } else if (badgeData) {
          awardedBadgeId = badgeData.id;
        }
      }
    }

    // Update challenge status and badge_id in DB
    const { error: updateError } = await supabase
      .from('challenges')
      .update({ status: newStatus, badge_id: awardedBadgeId })
      .eq('id', challenge.id)
      .eq('user_id', user.id);

    if (updateError) {
      showError('Error al actualizar el estado del reto: ' + updateError.message);
    } else {
      setChallengeRefreshKey(prev => prev + 1); // Force re-fetch to show updated status and badge
    }
  };

  useEffect(() => {
    fetchChallenges();
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

      {pastChallenges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Álbum de Retos Anteriores
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastChallenges.map((challenge) => (
              <Card key={challenge.id} className={cn(
                "p-4 shadow-sm",
                challenge.status === "completed" ? "border-l-4 border-green-500 bg-green-50" :
                challenge.status === "failed" ? "border-l-4 border-red-500 bg-red-50" :
                "border-l-4 border-gray-300 bg-gray-50"
              )}>
                <CardHeader className="p-0 pb-2">
                  <CardTitle className={cn(
                    "text-base font-semibold",
                    (challenge.status === "completed" || challenge.status === "failed") && "line-through"
                  )}>
                    {challenge.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className={cn(
                    "text-sm text-muted-foreground",
                    (challenge.status === "completed" || challenge.status === "failed") && "line-through"
                  )}>
                    {challenge.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Finalizado: {format(new Date(challenge.end_date), "dd/MM/yyyy", { locale: es })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Estado: <span className={cn(
                      challenge.status === "completed" && "text-green-600 font-medium",
                      challenge.status === "failed" && "text-red-600 font-medium",
                      challenge.status === "regular" && "text-orange-600 font-medium"
                    )}>
                      {challenge.status === "completed" ? "Completado" :
                       challenge.status === "failed" ? "Fallido" :
                       challenge.status === "regular" ? "Regular" : "Desconocido"}
                    </span>
                  </p>
                  {challenge.badge && challenge.status === "completed" && (
                    <div className="mt-3 flex items-center gap-2">
                      <img src={challenge.badge.image_url} alt={challenge.badge.name} className="h-10 w-10" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Insignia: {challenge.badge.name}</span>
                        <span className="text-xs text-muted-foreground">{challenge.badge.description}</span>
                      </div>
                    </div>
                  )}
                  {challenge.status === "failed" && (
                    <div className="mt-3 flex items-center gap-2 text-red-600">
                      <XCircle className="h-6 w-6" />
                      <span className="text-sm font-medium">No se obtuvo insignia.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Challenges;
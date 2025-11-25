"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trophy, XCircle } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import ChallengeCard, { ChallengeData } from "@/components/ChallengeCard";
import ChallengeCreationDialog from "@/components/ChallengeCreationDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { isAfter, isSameDay, format } from "date-fns";
import { es } from "date-fns/locale";
import { useCategoryContext } from "@/context/CategoryContext";
import DynamicLucideIcon from "@/components/DynamicLucideIcon";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Importar Tooltip
import ChallengeAlbumBackContent from "@/components/ChallengeAlbumBackContent"; // Importar el contenido trasero
import { challengeTemplates, ChallengeTemplate } from "@/utils/challenge-templates"; // Importar plantillas

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
  "no-food-spend": "Chef Financiero",
  "saving-goal-150": "Ahorrador Nivel 1",
  "saving-goal-300": "Ahorrador Nivel 2",
  "saving-goal-200": "Ahorrador Nivel 1.5",
  "saving-goal-500": "Ahorrador Nivel 3",
};

const SUPABASE_STORAGE_BASE_URL = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/";

const FAILED_CHALLENGE_IMAGE = `${SUPABASE_STORAGE_BASE_URL}Fallido.png`;
const GENERIC_COMPLETED_IMAGE = `${SUPABASE_STORAGE_BASE_URL}Meta%202.png`;
const GENERIC_REGULAR_IMAGE = `${SUPABASE_STORAGE_BASE_URL}Cochinito%20Calendario.png`;

// Nombres de las insignias de recompensa genéricas que se crearán en la base de datos
const GENERIC_REWARD_BADGE_NAMES = [
  'Recompensa de Reto 1',
  'Recompensa de Reto 2',
  'Recompensa de Reto 3',
  'Recompensa de Reto 4',
  'Recompensa de Reto 5',
  'Recompensa de Reto 6',
  'Recompensa de Reto 7',
  'Recompensa de Reto 8', // Nueva
];


const Challenges: React.FC<ChallengesProps> = ({ challengeRefreshKey, setChallengeRefreshKey }) => {
  const { user } = useSession();
  const { expenseCategories, incomeCategories, isLoadingCategories, getCategoryById } = useCategoryContext();
  const [activeChallenge, setActiveChallenge] = useState<ChallengeData | null>(null);
  const [userPastChallenges, setUserPastChallenges] = useState<ChallengeData[]>([]);
  const [isChallengeCreationDialogOpen, setIsChallengeCreationDialogOpen] = useState(false);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(true);
  const [rewardBadgeIds, setRewardBadgeIds] = useState<string[]>([]); // Estado para almacenar los IDs de las insignias de recompensa

  // Cargar los IDs de las insignias de recompensa al iniciar el componente
  useEffect(() => {
    const fetchRewardBadges = async () => {
      const { data, error } = await supabase
        .from('badges')
        .select('id')
        .in('name', GENERIC_REWARD_BADGE_NAMES);
      if (error) {
        console.error("Error fetching reward badge IDs:", error.message);
      } else {
        setRewardBadgeIds(data.map(b => b.id));
      }
    };
    fetchRewardBadges();
  }, []);

  const fetchChallenges = async () => {
    if (!user || isLoadingCategories) {
      setActiveChallenge(null);
      setUserPastChallenges([]);
      setIsLoadingChallenges(false);
      return;
    }
    setIsLoadingChallenges(true);

    // Fetch active challenge
    const { data: activeChallengeData, error: activeChallengeError } = await supabase
      .from('challenges')
      .select('*, savings(id, name, current_balance, target_amount, color, completion_date), badges(id, name, description, image_url)')
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
        badge: activeChallengeData.badges as BadgeData | null,
      };
      setActiveChallenge(challenge);

      // Check if challenge needs evaluation
      const endDate = new Date(challenge.end_date);
      endDate.setHours(23, 59, 59, 999);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (challenge.status === "active" && (isAfter(today, endDate) || isSameDay(today, endDate))) {
        await evaluateChallenge(challenge);
      }
    } else {
      setActiveChallenge(null);
    }

    // Fetch all past challenges (completed, failed, regular) for the user
    const { data: pastChallengesData, error: pastChallengesError } = await supabase
      .from('challenges')
      .select('*, savings(id, name, current_balance, target_amount, color, completion_date), badges(id, name, description, image_url)')
      .eq('user_id', user.id)
      .in('status', ['completed', 'failed', 'regular'])
      .order('end_date', { ascending: false });

    if (pastChallengesError) {
      showError('Error al cargar retos anteriores: ' + pastChallengesError.message);
      setUserPastChallenges([]);
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
      setUserPastChallenges(formattedPastChallenges);
    }

    setIsLoadingChallenges(false);
  };

  const evaluateChallenge = async (challenge: ChallengeData) => {
    if (!user) return;

    let newStatus: "completed" | "failed" | "regular" = "failed";
    let awardedBadgeId: string | null = null;
    const evaluationDate = format(new Date(), "yyyy-MM-dd");

    if (challenge.challenge_template_id.startsWith("no-spend")) {
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
      } else {
        newStatus = "failed";
      }
    } else if (challenge.challenge_template_id.startsWith("saving-goal") && challenge.saving_goal) {
      const saving = challenge.saving_goal;
      if (saving.target_amount !== null && saving.target_amount !== undefined && saving.target_amount > 0) {
        const progress = (saving.current_balance / saving.target_amount) * 100;
        if (progress >= 100) {
          newStatus = "completed";
        } else if (progress >= 50) {
          newStatus = "regular";
        } else {
          newStatus = "failed";
        }
      } else {
        newStatus = "failed";
      }
    }

    if (newStatus === "completed") {
      // Asignar una insignia de recompensa aleatoria
      if (rewardBadgeIds.length > 0) {
        const randomIndex = Math.floor(Math.random() * rewardBadgeIds.length);
        awardedBadgeId = rewardBadgeIds[randomIndex];
        showSuccess(`¡Reto '${challenge.name}' completado! ¡Has ganado una insignia de recompensa!`);
      } else {
        console.warn("No reward badge IDs available to assign.");
        showSuccess(`¡Reto '${challenge.name}' completado!`); // Mensaje de fallback
      }
    } else if (newStatus === "failed") {
      showError(`Reto '${challenge.name}' fallido. ¡No te rindas, inténtalo de nuevo!`);
    } else if (newStatus === "regular") {
      showSuccess(`Reto '${challenge.name}' regular. ¡Casi lo logras, sigue esforzándote!`);
    }


    const { error: updateError } = await supabase
      .from('challenges')
      .update({ status: newStatus, badge_id: awardedBadgeId, end_date: evaluationDate })
      .eq('id', challenge.id)
      .eq('user_id', user.id);

    if (updateError) {
      showError('Error al actualizar el estado del reto: ' + updateError.message);
    } else {
      setChallengeRefreshKey(prev => prev + 1);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, [user, challengeRefreshKey, isLoadingCategories, rewardBadgeIds]); // Añadir rewardBadgeIds a las dependencias

  const handleChallengeStarted = () => {
    setChallengeRefreshKey(prev => prev + 1);
  };

  const handleRefreshChallenges = () => {
    setChallengeRefreshKey(prevKey => prevKey + 1);
    showSuccess("Retos actualizados.");
  };

  const getFrontImageSrc = (challenge: ChallengeData) => {
    const isCompleted = challenge.status === "completed";
    const isFailed = challenge.status === "failed";
    const isRegular = challenge.status === "regular";

    let imageUrl = GENERIC_REGULAR_IMAGE; // Default fallback

    if (isCompleted) {
      imageUrl = challenge.badge?.image_url || GENERIC_COMPLETED_IMAGE;
    } else if (isFailed) {
      imageUrl = FAILED_CHALLENGE_IMAGE;
    } else if (isRegular) {
      imageUrl = GENERIC_REGULAR_IMAGE;
    }
    
    console.log(`Challenge: ${challenge.name}, Status: ${challenge.status}, Badge ID: ${challenge.badge_id}, Image URL: ${imageUrl}`);
    return imageUrl;
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Álbum de Retos Anteriores
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {userPastChallenges.length > 0 ? (
            userPastChallenges.map((challenge) => (
              // Eliminado TooltipProvider redundante
              <Tooltip key={challenge.id} delayDuration={300}> {/* Añadido delayDuration */}
                <TooltipTrigger asChild>
                  <div className="relative w-full h-[200px] flex items-center justify-center rounded-lg shadow-md bg-white p-4 cursor-pointer">
                    <img
                      src={getFrontImageSrc(challenge)}
                      alt={challenge.name}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        console.error(`Error al cargar la imagen del reto "${challenge.name}":`, e.currentTarget.src);
                        e.currentTarget.src = FAILED_CHALLENGE_IMAGE; // Fallback a una imagen de error
                      }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="w-[300px] p-0 z-50">
                  <ChallengeAlbumBackContent challenge={challenge} />
                </TooltipContent>
              </Tooltip>
            ))
          ) : (
            <p className="col-span-full text-center text-muted-foreground">
              Aún no has completado ningún reto. ¡Empieza uno nuevo!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Challenges;
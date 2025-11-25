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
import FlippableChallengeCard from "@/components/FlippableChallengeCard"; // Importar el componente flippable
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
  "saving-goal-150": "Ahorrador Nivel 1",
  "saving-goal-300": "Ahorrador Nivel 2",
  "saving-goal-200": "Ahorrador Nivel 1.5",
  "saving-goal-500": "Ahorrador Nivel 3",
};

const FAILED_CHALLENGE_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Fallido.png";
const COMPLETED_CHALLENGE_IMAGES: { [key: string]: string } = {
  "saving-goal-150": "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Reto%20150%20pesos.png",
  "no-netflix-more-books": "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Reto%20menos%20netflix.png",
  // Añadir otras imágenes específicas para retos completados aquí
};
const GENERIC_COMPLETED_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Meta%202.png";
const GENERIC_REGULAR_IMAGE = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Calendario.png";


const Challenges: React.FC<ChallengesProps> = ({ challengeRefreshKey, setChallengeRefreshKey }) => {
  const { user } = useSession();
  const { expenseCategories, incomeCategories, isLoadingCategories, getCategoryById } = useCategoryContext();
  const [activeChallenge, setActiveChallenge] = useState<ChallengeData | null>(null);
  const [userPastChallenges, setUserPastChallenges] = useState<ChallengeData[]>([]); // Renombrado para evitar conflicto
  const [isChallengeCreationDialogOpen, setIsChallengeCreationDialogOpen] = useState(false);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(true);

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
      .select('*, savings(id, name, current_balance, target_amount, color, completion_date), badges(id, name, description, image_url)') // Incluir completion_date
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
      .select('*, savings(id, name, current_balance, target_amount, color, completion_date), badges(id, name, description, image_url)') // Incluir completion_date
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
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Establecer a inicio del día local
    const evaluationDate = format(today, "yyyy-MM-dd");

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
        showSuccess(`¡Reto '${challenge.name}' completado! ¡Felicidades!`);
      } else {
        newStatus = "failed";
        showError(`Reto '${challenge.name}' fallido. Se registraron gastos en categorías prohibidas.`);
      }
    } else if (challenge.challenge_template_id.startsWith("saving-goal") && challenge.saving_goal) {
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
        newStatus = "failed";
        showError(`Reto '${challenge.name}' fallido. La meta de ahorro no era válida.`);
      }
    }

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
  }, [user, challengeRefreshKey, isLoadingCategories]);

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

    let imageUrl: string | undefined;

    if (isCompleted) {
      imageUrl = COMPLETED_CHALLENGE_IMAGES[challenge.challenge_template_id] || challenge.badge?.image_url || GENERIC_COMPLETED_IMAGE;
    } else if (isFailed) {
      imageUrl = FAILED_CHALLENGE_IMAGE;
    } else if (isRegular) {
      imageUrl = GENERIC_REGULAR_IMAGE;
    }
    console.log(`Challenge ${challenge.name} (status: ${challenge.status}): Front image URL: ${imageUrl}`);
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
              <div key={challenge.id} className="w-[350px] h-[350px] mx-auto"> {/* Contenedor de 350x350 */}
                <FlippableChallengeCard
                  frontImageSrc={getFrontImageSrc(challenge)}
                  frontImageAlt={challenge.name}
                  backContent={<ChallengeAlbumBackContent challenge={challenge} />}
                />
              </div>
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
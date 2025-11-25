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

const Challenges: React.FC = () => {
  const { user } = useSession();
  const [activeChallenge, setActiveChallenge] = useState<ChallengeData | null>(null);
  const [isChallengeCreationDialogOpen, setIsChallengeCreationDialogOpen] = useState(false);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchActiveChallenge = async () => {
    if (!user) {
      setActiveChallenge(null);
      setIsLoadingChallenges(false);
      return;
    }
    setIsLoadingChallenges(true);
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      showError('Error al cargar reto activo: ' + error.message);
      setActiveChallenge(null);
    } else if (data) {
      setActiveChallenge(data as ChallengeData);
    } else {
      setActiveChallenge(null);
    }
    setIsLoadingChallenges(false);
  };

  useEffect(() => {
    fetchActiveChallenge();
  }, [user, refreshKey]);

  const handleChallengeStarted = () => {
    fetchActiveChallenge(); // Refresh active challenge after a new one is started
    setRefreshKey(prev => prev + 1); // Force re-fetch
  };

  const handleRefreshChallenges = () => {
    setRefreshKey(prevKey => prevKey + 1);
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
      />

      {/* Aquí podrías añadir una sección para retos completados/fallidos si fuera necesario */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Historial de Retos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Próximamente: Ver tus retos completados y fallidos.</p>
        </CardContent>
      </Card> */}

      <ChallengeCreationDialog
        isOpen={isChallengeCreationDialogOpen}
        onClose={() => setIsChallengeCreationDialogOpen(false)}
        onChallengeStarted={handleChallengeStarted}
      />
    </div>
  );
};

export default Challenges;
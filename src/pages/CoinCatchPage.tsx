"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CoinCatch from "@/components/minigames/CoinCatch";
import { Card } from "@/components/ui/card";

const CoinCatchPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto overflow-hidden">
      {/* Header fijo para no perder espacio */}
      <div className="flex items-center gap-4 p-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/minigames')} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-black tracking-tighter">Coin Catch</h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Agilidad Financiera</p>
        </div>
      </div>

      {/* Contenedor del juego que ocupa el resto del espacio disponible */}
      <div className="flex-1 px-2 pb-4 md:px-6 md:pb-10 overflow-hidden">
        <Card className="h-full rounded-[2.5rem] border-none shadow-soft bg-white overflow-hidden relative">
          <CoinCatch />
        </Card>
      </div>
    </div>
  );
};

export default CoinCatchPage;
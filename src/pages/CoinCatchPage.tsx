"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CoinCatch from "@/components/minigames/CoinCatch";

const CoinCatchPage = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden">
      {/* Header flotante minimalista sobre el juego */}
      <div className="absolute top-0 left-0 right-0 z-[60] flex items-center gap-3 p-4 pointer-events-none">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/minigames')} 
          className="rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10 pointer-events-auto h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="bg-black/20 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10">
          <h1 className="text-sm font-black text-white tracking-tighter leading-none">COIN CATCH</h1>
        </div>
      </div>

      {/* El juego ahora ocupa el 100% de la pantalla */}
      <div className="flex-1 w-full h-full">
        <CoinCatch />
      </div>
    </div>
  );
};

export default CoinCatchPage;
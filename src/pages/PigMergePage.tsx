"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PigMerge from "@/components/minigames/PigMerge";

const PigMergePage = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col overflow-hidden">
      {/* Header flotante minimalista sobre el juego */}
      <div className="absolute top-0 left-0 right-0 z-[110] flex items-center gap-3 p-4 pointer-events-none">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/minigames')} 
          className="rounded-full bg-black/40 backdrop-blur-md text-white border border-white/10 pointer-events-auto h-12 w-12 active:scale-90 transition-transform"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-white/10">
          <h1 className="text-sm font-black text-white tracking-tighter leading-none uppercase">PIG MERGE</h1>
        </div>
      </div>

      {/* El juego ocupa el 100% de la pantalla sin menús de la app */}
      <div className="flex-1 w-full h-full">
        <PigMerge />
      </div>
    </div>
  );
};

export default PigMergePage;
"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

const GIF_GAME = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/games.gif";

const Minigames = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      <header className="relative">
        <div className="absolute inset-0 bg-indigo-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-slate-900 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="p-8 relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 flex-1 text-center md:text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Oinkash Arcade 🐷</p>
              <h1 className="text-4xl font-black tracking-tighter">Zona de Juegos</h1>
              <p className="text-sm font-medium text-slate-400">Diviértete mientras aprendes sobre ahorro y disciplina financiera.</p>
            </div>
            <div className="flex-shrink-0">
              <img src={GIF_GAME} alt="Juegos" className="h-32 w-32 object-contain" />
            </div>
          </div>
        </Card>
      </header>

      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="bg-indigo-50 p-6 rounded-full">
          <Sparkles className="h-12 w-12 text-indigo-500 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">¡Nuevas experiencias en camino!</h2>
          <p className="text-slate-500 font-medium max-w-md">Estamos preparando juegos más emocionantes para ayudarte a dominar tus finanzas mientras te diviertes.</p>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mt-4">Vuelve pronto para ver las novedades</p>
      </div>
    </div>
  );
};

export default Minigames;
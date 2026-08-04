"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkles, Gamepad2 } from "lucide-react";
import PigMerge from "@/components/minigames/PigMerge";

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

      <section className="grid gap-8">
        <div className="flex items-center gap-3 px-2">
          <div className="h-10 w-10 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Juegos Disponibles</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          <Card className="rounded-[3rem] border-none shadow-soft bg-white overflow-hidden">
            <div className="p-6 md:p-10">
              <PigMerge />
            </div>
          </Card>
        </div>
      </section>

      <div className="flex flex-col items-center justify-center py-10 text-center gap-4 opacity-50">
        <div className="bg-indigo-50 p-4 rounded-full">
          <Sparkles className="h-6 w-6 text-indigo-500 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-black text-slate-900 uppercase">Más juegos próximamente</h3>
          <p className="text-xs text-slate-500 font-medium">Estamos horneando nuevas experiencias para ti.</p>
        </div>
      </div>
    </div>
  );
};

export default Minigames;
"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Gamepad2, ChevronRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const GIF_GAME = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/games.gif";

const games = [
  {
    id: "pig-merge",
    name: "Pig Merge",
    description: "Combina monedas y billetes para llenar tu alcancía.",
    icon: "/pig-merge-icon.png",
    type: "image",
    color: "bg-pink-500",
    path: "/minigames/pig-merge"
  },
  {
    id: "coin-catch",
    name: "Coin Catch",
    description: "Atrapa todas las monedas que puedas antes de que caigan.",
    icon: "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/IconoJuego2.png",
    type: "image",
    color: "bg-emerald-500",
    path: "/minigames/coin-catch"
  }
];

const Minigames = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 pb-24 max-w-5xl mx-auto">
      <header className="relative">
        <div className="absolute inset-0 bg-indigo-100/50 blur-3xl rounded-full -z-10" />
        <Card className="bg-slate-900 text-white rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="p-8 relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 flex-1 text-center md:text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Oinkash Arcade 🐷</p>
              <h1 className="text-4xl font-black tracking-tighter">Zona de Juegos</h1>
              <p className="text-sm font-medium text-slate-400">Diviértete mientras aprendes sobre ahorro.</p>
            </div>
            <div className="flex-shrink-0">
              <img src={GIF_GAME} alt="Juegos" className="h-32 w-32 object-contain" />
            </div>
          </div>
        </Card>
      </header>

      <section className="grid gap-6">
        <div className="flex items-center gap-3 px-2">
          <div className="h-10 w-10 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Escoge un desafío</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {games.map((game) => (
            <Card 
              key={game.id} 
              className="group rounded-[2rem] border-none shadow-soft bg-white overflow-hidden cursor-pointer hover:shadow-xl transition-all active:scale-95"
              onClick={() => navigate(game.path)}
            >
              <div className="p-8 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={cn(
                    "h-16 w-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner shrink-0 overflow-hidden",
                    game.color,
                  )}>
                    <img src={game.icon} alt={game.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900">{game.name}</h3>
                    <p className="text-xs font-medium text-slate-500 max-w-[200px] leading-snug">
                      {game.description}
                    </p>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <div className="flex flex-col items-center justify-center py-10 text-center gap-4 opacity-50">
        <div className="bg-indigo-50 p-4 rounded-full">
          <Sparkles className="h-6 w-6 text-indigo-500 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-black text-slate-900 uppercase">Más juegos próximamente</h3>
        </div>
      </div>
    </div>
  );
};

export default Minigames;
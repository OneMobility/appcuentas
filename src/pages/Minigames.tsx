"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, Trophy, Coins, Brain, ArrowLeft, Sparkles, Zap } from "lucide-react";
import PiggyClicker from "@/components/minigames/PiggyClicker";
import FinanceQuiz from "@/components/minigames/FinanceQuiz";
import PiggyRunner from "@/components/minigames/PiggyRunner";
import { cn } from "@/lib/utils";

const GIF_GAME = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/metasfeliz.gif";

const Minigames = () => {
  const [activeGame, setActiveGame] = useState<'none' | 'clicker' | 'quiz' | 'runner'>('none');

  if (activeGame !== 'none') {
    return (
      <div className="flex flex-col gap-6 p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setActiveGame('none')} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-black">
            {activeGame === 'clicker' ? 'Cochinito Clicker' : 
             activeGame === 'quiz' ? 'Oinkash Quiz' : 'Piggy Run'}
          </h1>
        </div>
        
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden max-w-md mx-auto w-full">
          <CardContent className="pt-6">
            {activeGame === 'clicker' ? <PiggyClicker /> : 
             activeGame === 'quiz' ? <FinanceQuiz /> : <PiggyRunner />}
          </CardContent>
        </Card>
      </div>
    );
  }

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card 
          className="rounded-[2rem] border-none shadow-sm hover:shadow-xl transition-all bg-white overflow-hidden cursor-pointer group"
          onClick={() => setActiveGame('runner')}
        >
          <div className="p-6 space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
              <Zap className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Piggy Run</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Juego de Reflejos</p>
            </div>
            <p className="text-sm text-slate-500">Salta sobre los gastos hormiga para que no se coman tu ahorro. ¡Estilo Dino de Chrome!</p>
            <Button className="w-full rounded-xl font-black bg-rose-500 hover:bg-rose-600">¡Correr Ahora!</Button>
          </div>
        </Card>

        <Card 
          className="rounded-[2rem] border-none shadow-sm hover:shadow-xl transition-all bg-white overflow-hidden cursor-pointer group"
          onClick={() => setActiveGame('clicker')}
        >
          <div className="p-6 space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-600 group-hover:scale-110 transition-transform">
              <Coins className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Cochinito Clicker</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Habilidad</p>
            </div>
            <p className="text-sm text-slate-500">¿Qué tan rápido puedes ahorrar? ¡Haz click en el cochinito para recolectar monedas!</p>
            <Button className="w-full rounded-xl font-black bg-yellow-600 hover:bg-yellow-700">¡Ahorrar!</Button>
          </div>
        </Card>

        <Card 
          className="rounded-[2rem] border-none shadow-sm hover:shadow-xl transition-all bg-white overflow-hidden cursor-pointer group"
          onClick={() => setActiveGame('quiz')}
        >
          <div className="p-6 space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <Brain className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Oinkash Quiz</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Conocimiento</p>
            </div>
            <p className="text-sm text-slate-500">Demuestra que eres un experto en finanzas respondiendo correctamente nuestras trivias.</p>
            <Button className="w-full rounded-xl font-black bg-indigo-600 hover:bg-indigo-700">Comenzar</Button>
          </div>
        </Card>
      </div>

      <div className="flex flex-col items-center justify-center py-10 opacity-30 text-center gap-2">
        <Sparkles className="h-8 w-8 text-indigo-500" />
        <p className="text-[10px] font-black uppercase tracking-widest">Más juegos próximamente...</p>
      </div>
    </div>
  );
};

export default Minigames;
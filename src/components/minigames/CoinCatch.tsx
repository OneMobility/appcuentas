"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RefreshCw, Lightbulb, Sparkles, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRandomTip, OinkashTip } from "@/utils/oinkash-tips";

/**
 * 🪙 COIN CATCH — Versión Premium con Niveles y Metas
 */

const STARTING_LIVES = 3;
const PIG_Y_PERCENT = 77; 
const CATCH_LINE_START = 70; 
const CATCH_LINE_END = 85;   
const MISS_LINE = 95;        
const BASKET_HALF_WIDTH = 12; 
const CATCH_TOLERANCE = 10; 
const STREAK_PER_MULT_LEVEL = 3; 
const MAX_MULTIPLIER = 5;
const BASE_MOVE_SPEED = 140; 

// Metas por nivel
const LEVEL_GOALS = [500, 1500, 3000, 5000, 10000];

// URLs de recursos
const PIG_MASCOT = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/3bd895fd1ea2a510faa68f516cfc88ad9408d50cff95156f2fb48a61d8d7349d.png";
const COIN_IMG = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/IconoJuego2.png";

type Kind = "coin" | "bill" | "bag" | "gasto" | "impuesto" | "factura";

const ITEM_DEFS: Record<Kind, { emoji?: string; image?: string; points: number; bad: boolean; weight: number }> = {
  coin: { image: COIN_IMG, points: 10, bad: false, weight: 5 },
  bill: { emoji: "💵", points: 25, bad: false, weight: 3 },
  bag: { emoji: "💰", points: 50, bad: false, weight: 1 },
  gasto: { emoji: "💸", points: 0, bad: true, weight: 4 },
  impuesto: { emoji: "🏛️", points: 0, bad: true, weight: 3 },
  factura: { emoji: "🧾", points: -20, bad: true, weight: 3 },
};

const GOOD_KINDS: Kind[] = ["coin", "bill", "bag"];
const BAD_KINDS: Kind[] = ["gasto", "impuesto", "factura"];

interface FallingItem {
  id: number;
  kind: Kind;
  x: number; 
  y: number; 
  speed: number; 
}

export default function CoinCatch() {
  const [phase, setPhase] = useState<"idle" | "playing" | "over">("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [multiplier, setMultiplier] = useState(1);
  const [level, setLevel] = useState(1);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [basketX, setBasketX] = useState(50);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [gameOverTip, setGameOverTip] = useState<OinkashTip | null>(null);
  
  const fieldRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<FallingItem[]>([]);
  const basketXRef = useRef(50);
  const nextIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const spawnAccumulatorRef = useRef(0);
  const draggingRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const levelRef = useRef(1);

  // Audio Refs
  const audioEndRef = useRef<HTMLAudioElement | null>(null);
  const audioCoinRef = useRef<HTMLAudioElement | null>(null);
  const audioErrorRef = useRef<HTMLAudioElement | null>(null);
  const audioLevelUpRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioEndRef.current = new Audio("/sounds/end-point.wav");
    audioCoinRef.current = new Audio("/sounds/coin.wav");
    audioErrorRef.current = new Audio("/sounds/error.mp3");
    audioLevelUpRef.current = new Audio("/sounds/achievement.mp3");
    
    const saved = localStorage.getItem("oinkash_coincatch_best");
    if (saved) setBest(parseInt(saved));
  }, []);

  const playSound = (audio: HTMLAudioElement | null) => {
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };

  const showFlash = useCallback((kind: "good" | "bad") => {
    setFlash(kind);
    setTimeout(() => setFlash(null), 150);
  }, []);

  const endGame = useCallback(() => {
    setPhase("over");
    setGameOverTip(getRandomTip());
    playSound(audioEndRef.current);
    if (scoreRef.current > best) {
      setBest(scoreRef.current);
      localStorage.setItem("oinkash_coincatch_best", scoreRef.current.toString());
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [best]);

  const startGame = useCallback(() => {
    // Resetear todo al estado inicial
    itemsRef.current = [];
    nextIdRef.current = 0;
    spawnAccumulatorRef.current = 0;
    streakRef.current = 0;
    livesRef.current = STARTING_LIVES;
    scoreRef.current = 0;
    levelRef.current = 1;
    basketXRef.current = 50;
    
    setItems([]);
    setScore(0);
    setLives(STARTING_LIVES);
    setLevel(1);
    setMultiplier(1);
    setBasketX(50);
    setGameOverTip(null);
    setPhase("playing");
    
    lastTimeRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;

    const tick = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Movimiento con teclado
      if (keysRef.current.has("ArrowLeft")) basketXRef.current = Math.max(BASKET_HALF_WIDTH, basketXRef.current - BASE_MOVE_SPEED * dt);
      if (keysRef.current.has("ArrowRight")) basketXRef.current = Math.min(100 - BASKET_HALF_WIDTH, basketXRef.current + BASE_MOVE_SPEED * dt);

      // Lógica de Niveles
      const currentGoal = LEVEL_GOALS[levelRef.current - 1] || 100000;
      if (scoreRef.current >= currentGoal) {
        levelRef.current += 1;
        setLevel(levelRef.current);
        playSound(audioLevelUpRef.current);
      }

      // Spawn según dificultad del nivel
      const difficultyMult = 1 + (levelRef.current - 1) * 0.25;
      const spawnInterval = 1.0 / (0.8 * difficultyMult); 
      const fallSpeed = 50 * (1 + (levelRef.current - 1) * 0.15);

      spawnAccumulatorRef.current += dt;
      if (spawnAccumulatorRef.current >= spawnInterval) {
        spawnAccumulatorRef.current = 0;
        const isBad = Math.random() < 0.35;
        const kinds = isBad ? BAD_KINDS : GOOD_KINDS;
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        itemsRef.current.push({
          id: nextIdRef.current++,
          kind,
          x: 10 + Math.random() * 80,
          y: -10,
          speed: fallSpeed + Math.random() * 20,
        });
      }

      // Actualizar Items
      const remaining: FallingItem[] = [];
      for (const item of itemsRef.current) {
        const newY = item.y + item.speed * dt;
        
        // Colisión con el cerdito
        if (newY >= CATCH_LINE_START && newY <= CATCH_LINE_END) {
          const dx = Math.abs(item.x - basketXRef.current);
          if (dx <= CATCH_TOLERANCE) {
            const def = ITEM_DEFS[item.kind];
            if (def.bad) {
              livesRef.current -= 1;
              streakRef.current = 0;
              scoreRef.current = Math.max(0, scoreRef.current + def.points);
              showFlash("bad");
              playSound(audioErrorRef.current);
            } else {
              streakRef.current += 1;
              const mult = Math.min(MAX_MULTIPLIER, 1 + Math.floor(streakRef.current / STREAK_PER_MULT_LEVEL));
              scoreRef.current += def.points * mult;
              setMultiplier(mult);
              showFlash("good");
              playSound(audioCoinRef.current);
            }
            setLives(livesRef.current);
            setScore(scoreRef.current);
            continue; 
          }
        }
        
        if (newY > MISS_LINE) {
          if (!ITEM_DEFS[item.kind].bad) streakRef.current = 0;
          continue; 
        }

        remaining.push({ ...item, y: newY });
      }
      
      itemsRef.current = remaining;
      setItems([...itemsRef.current]);
      setBasketX(basketXRef.current);

      if (livesRef.current <= 0) { endGame(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, endGame, showFlash]);

  // Manejo de controles Globales
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") keysRef.current.add(e.key);
      if (e.code === "Space") {
        if (phase === "idle" || phase === "over") startGame();
      }
    };
    const handleUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => { window.removeEventListener("keydown", handleDown); window.removeEventListener("keyup", handleUp); };
  }, [phase, startGame]);

  const handlePointer = (e: React.PointerEvent | React.TouchEvent) => {
    if (phase !== "playing") return;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    basketXRef.current = Math.max(BASKET_HALF_WIDTH, Math.min(100 - BASKET_HALF_WIDTH, pct));
    setBasketX(basketXRef.current);
  };

  const currentLevelGoal = LEVEL_GOALS[level - 1] || 100000;
  const prevLevelGoal = level > 1 ? LEVEL_GOALS[level - 2] : 0;
  const progressPercent = Math.min(100, ((score - prevLevelGoal) / (currentLevelGoal - prevLevelGoal)) * 100);

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col relative overflow-hidden font-sans select-none touch-none">
      {/* Zona de Juego */}
      <div 
        ref={fieldRef}
        className={cn(
          "relative flex-1 transition-all duration-200",
          flash === "good" ? "bg-emerald-500/10" : flash === "bad" ? "bg-rose-500/10" : "bg-transparent"
        )}
        onPointerDown={(e) => { draggingRef.current = true; handlePointer(e); }}
        onPointerMove={(e) => draggingRef.current && handlePointer(e)}
        onPointerUp={() => draggingRef.current = false}
        onTouchStart={(e) => { draggingRef.current = true; handlePointer(e); }}
        onTouchMove={(e) => draggingRef.current && handlePointer(e)}
        onTouchEnd={() => draggingRef.current = false}
      >
        {/* HUD Superior */}
        <div className="absolute top-16 left-0 right-0 p-6 flex flex-col gap-4 z-40 pointer-events-none">
          <div className="flex justify-between items-start">
            <div className="bg-black/40 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 text-white shadow-2xl">
              <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Saldo Ahorrado</p>
              <p className="text-3xl font-black">${score.toLocaleString()}</p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 bg-black/40 backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-2xl">
                {Array.from({ length: STARTING_LIVES }).map((_, i) => (
                  <motion.span 
                    key={i} 
                    animate={i >= lives ? { scale: 0.8, opacity: 0.2, filter: 'grayscale(1)' } : { scale: 1 }}
                    className="text-2xl"
                  >
                    🐷
                  </motion.span>
                ))}
              </div>
              {multiplier > 1 && (
                <motion.div 
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="bg-yellow-400 text-yellow-950 text-[10px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1"
                >
                  <Zap className="h-3 w-3 fill-current" /> COMBO X{multiplier}
                </motion.div>
              )}
            </div>
          </div>

          {/* Barra de Meta de Nivel */}
          <div className="w-full max-w-xs mx-auto space-y-1.5">
            <div className="flex justify-between items-end px-1">
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-tighter">NIVEL {level}</span>
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-tighter">META: ${currentLevelGoal}</span>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full border border-white/10 p-0.5 overflow-hidden">
               <motion.div 
                 className="h-full bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
                 animate={{ width: `${progressPercent}%` }}
               />
            </div>
          </div>
        </div>

        {/* Personaje (Cerdito) */}
        <div 
          className="absolute z-30 pointer-events-none transition-transform duration-75"
          style={{ 
            left: `${basketX}%`, 
            top: `${PIG_Y_PERCENT}%`, 
            transform: 'translate(-50%, -50%)',
            width: '120px',
            height: '120px',
          }}
        >
          {/* Sombra */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-black/40 blur-lg rounded-full" />
          {/* Imagen Principal */}
          <img src={PIG_MASCOT} className="w-full h-full object-contain drop-shadow-2xl" alt="Oinkash" />
          
          {/* Efectos de Flash */}
          <AnimatePresence>
            {flash && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1.2 }} exit={{ opacity: 0 }}
                className={cn(
                  "absolute -top-10 left-1/2 -translate-x-1/2 font-black text-xl italic",
                  flash === "good" ? "text-emerald-400" : "text-rose-500"
                )}
              >
                {flash === "good" ? "+$" : "¡OUCH!"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Objetos Cayendo */}
        {items.map((item) => {
          const def = ITEM_DEFS[item.kind];
          return (
            <div 
              key={item.id} 
              className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
            >
              {def.image ? (
                <img src={def.image} className="w-12 h-12 object-contain drop-shadow-lg animate-pulse" alt="money" />
              ) : (
                <span className="text-4xl drop-shadow-md select-none">{def.emoji}</span>
              )}
            </div>
          );
        })}

        {/* Overlays de Interfaz */}
        <AnimatePresence>
          {phase === "idle" && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center text-white"
            >
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                <img src={PIG_MASCOT} className="h-40 w-40 object-contain relative z-10 animate-bounce" alt="Start" />
              </div>
              <h2 className="text-5xl font-black tracking-tighter mb-4 italic">COIN CATCH</h2>
              <div className="space-y-2 mb-10 max-w-[280px]">
                <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest">Atrapa la Prosperidad 💰</p>
                <p className="text-slate-400 text-xs font-medium">Mueve el cerdito para recolectar monedas. Evita las facturas y deudas a toda costa.</p>
              </div>
              <Button onClick={startGame} className="h-20 px-12 rounded-3xl bg-indigo-600 text-white font-black text-2xl shadow-[0_15px_30px_-5px_rgba(79,70,229,0.5)] active:scale-95 transition-all">
                ¡JUGAR AHORA!
              </Button>
              <p className="mt-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Presiona Espacio o Toca la pantalla</p>
            </motion.div>
          )}

          {phase === "over" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} 
              className="absolute inset-0 z-[100] bg-rose-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center text-white"
            >
              <div className="bg-white/10 p-4 rounded-3xl mb-4 border border-white/10">
                <Trophy className="h-16 w-16 text-yellow-400 animate-pulse" />
              </div>
              <h2 className="text-4xl font-black tracking-tighter mb-2 italic">¡BANCARROTA!</h2>
              
              <div className="bg-white/10 px-10 py-6 rounded-[2.5rem] mb-8 border border-white/10 shadow-inner">
                <p className="text-[10px] font-black uppercase text-white/40 mb-1 tracking-widest">Puntaje Final</p>
                <p className="text-6xl font-black text-white">${score.toLocaleString()}</p>
                {score >= best && score > 0 && (
                  <p className="text-[9px] font-black text-yellow-400 uppercase mt-2">🌟 ¡NUEVO RÉCORD! 🌟</p>
                )}
              </div>

              {gameOverTip && (
                <div className="bg-indigo-600/30 border border-indigo-500/20 p-5 rounded-[2rem] mb-10 max-w-xs backdrop-blur-sm">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-yellow-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Consejo del Día</span>
                  </div>
                  <p className="text-sm font-bold italic leading-tight text-indigo-50">"{gameOverTip.text}"</p>
                </div>
              )}

              <Button 
                onClick={startGame} 
                className="h-16 px-12 rounded-full bg-white text-rose-950 font-black text-xl shadow-2xl flex gap-3 hover:bg-slate-100 active:scale-95 transition-all"
              >
                <RefreshCw className="h-6 w-6" /> REINTENTAR
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
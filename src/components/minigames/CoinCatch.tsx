"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RefreshCw, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRandomTip, OinkashTip } from "@/utils/oinkash-tips";

/**
 * 🪙 COIN CATCH — Versión Corregida
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
const BASE_MOVE_SPEED = 120; 

// URLs de recursos desde Supabase
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
  const [phase, setPhase] = useState<"idle" | "playing" | "over" | "tip">("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [multiplier, setMultiplier] = useState(1);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [basketX, setBasketX] = useState(50);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [currentTip, setCurrentTip] = useState("");
  const [gameOverTip, setGameOverTip] = useState<OinkashTip | null>(null);
  const [showBien, setShowBien] = useState(false);
  
  const fieldRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<FallingItem[]>([]);
  const basketXRef = useRef(50);
  const nextIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const spawnAccumulatorRef = useRef(0);
  const elapsedRef = useRef(0);
  const draggingRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const lastTipThreshold = useRef(0);
  const lastBienThreshold = useRef(0);

  // Audio Refs
  const audioEndRef = useRef<HTMLAudioElement | null>(null);
  const audioCoinRef = useRef<HTMLAudioElement | null>(null);
  const audioErrorRef = useRef<HTMLAudioElement | null>(null);
  const audioAchievementRef = useRef<HTMLAudioElement | null>(null);
  const audioTipRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioEndRef.current = new Audio("/sounds/end-point.wav");
    audioCoinRef.current = new Audio("/sounds/coin.wav");
    audioErrorRef.current = new Audio("/sounds/error.mp3");
    audioAchievementRef.current = new Audio("/sounds/achievement.mp3");
    audioTipRef.current = new Audio("/sounds/tip.mp3");
    
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
    setTimeout(() => setFlash(null), 200);
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
    // Resetear TODAS las referencias de juego
    itemsRef.current = [];
    nextIdRef.current = 0;
    spawnAccumulatorRef.current = 0;
    elapsedRef.current = 0;
    streakRef.current = 0;
    livesRef.current = STARTING_LIVES;
    scoreRef.current = 0;
    basketXRef.current = 50;
    lastTipThreshold.current = 0;
    lastBienThreshold.current = 0;
    lastTimeRef.current = performance.now(); // Resetear tiempo base

    setItems([]);
    setScore(0);
    setLives(STARTING_LIVES);
    setMultiplier(1);
    setBasketX(50);
    setGameOverTip(null);
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      elapsedRef.current += dt;

      // Eventos por puntaje
      if (scoreRef.current >= lastBienThreshold.current + 2500) {
        lastBienThreshold.current = Math.floor(scoreRef.current / 2500) * 2500;
        setShowBien(true);
        playSound(audioAchievementRef.current);
        setTimeout(() => setShowBien(false), 1500);
      }

      const currentMoveSpeed = BASE_MOVE_SPEED;
      if (keysRef.current.has("ArrowLeft")) basketXRef.current = Math.max(BASKET_HALF_WIDTH, basketXRef.current - currentMoveSpeed * dt);
      if (keysRef.current.has("ArrowRight")) basketXRef.current = Math.min(100 - BASKET_HALF_WIDTH, basketXRef.current + currentMoveSpeed * dt);

      // Spawn
      const scoreSpeedMult = 1 + (Math.floor(scoreRef.current / 2000) * 0.15); 
      const spawnInterval = 1.0 / scoreSpeedMult; 
      const fallDuration = Math.max(1.5, 3.5 - (scoreSpeedMult * 0.2)); 

      spawnAccumulatorRef.current += dt;
      if (spawnAccumulatorRef.current >= spawnInterval) {
        spawnAccumulatorRef.current = 0;
        const isBad = Math.random() < 0.4;
        const kinds = isBad ? BAD_KINDS : GOOD_KINDS;
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        itemsRef.current.push({
          id: nextIdRef.current++,
          kind,
          x: 10 + Math.random() * 80,
          y: -10,
          speed: 100 / fallDuration,
        });
      }

      // Actualizar Items
      const remaining: FallingItem[] = [];
      for (const item of itemsRef.current) {
        const newY = item.y + item.speed * dt;
        
        // Colisión
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

  useEffect(() => {
    const down = (e: KeyboardEvent) => (e.key === "ArrowLeft" || e.key === "ArrowRight") && keysRef.current.add(e.key);
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const handlePointer = (e: React.PointerEvent) => {
    if (phase !== "playing") return;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    basketXRef.current = Math.max(BASKET_HALF_WIDTH, Math.min(100 - BASKET_HALF_WIDTH, pct));
    setBasketX(basketXRef.current);
  };

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col">
      <div 
        ref={fieldRef}
        className={cn(
          "relative flex-1 overflow-hidden touch-none select-none transition-all duration-300",
          flash === "good" ? "ring-8 ring-emerald-500/30 ring-inset" : flash === "bad" ? "ring-8 ring-rose-500/30 ring-inset" : ""
        )}
        onPointerDown={(e) => { draggingRef.current = true; handlePointer(e); }}
        onPointerMove={(e) => draggingRef.current && handlePointer(e)}
        onPointerUp={() => draggingRef.current = false}
      >
        {/* Fondo con degradado si la imagen falla */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-900 opacity-50" />

        <AnimatePresence>
          {showBien && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} exit={{ scale: 2, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
            >
              <div className="bg-indigo-600 text-white px-6 py-2 rounded-full font-black text-2xl shadow-2xl border-4 border-white">
                ¡BIEN! 🐷
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD */}
        <div className="absolute top-16 left-0 right-0 p-6 flex justify-between items-start z-30 pointer-events-none">
          <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-white">
            <p className="text-[10px] font-black uppercase opacity-60">Score</p>
            <p className="text-2xl font-black">{score.toLocaleString()}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1.5 bg-black/40 backdrop-blur-md p-2 rounded-2xl border border-white/10">
              {Array.from({ length: STARTING_LIVES }).map((_, i) => (
                <span key={i} className={cn("text-xl transition-all duration-300", i >= lives && "grayscale opacity-20 scale-75")}>🐷</span>
              ))}
            </div>
          </div>
        </div>

        {/* Items Cayendo */}
        {items.map((item) => {
          const def = ITEM_DEFS[item.kind];
          return (
            <div 
              key={item.id} 
              className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
            >
              {def.image ? (
                <img src={def.image} className="w-12 h-12 object-contain drop-shadow-lg" alt="coin" />
              ) : (
                <span className="text-4xl drop-shadow-md">{def.emoji}</span>
              )}
            </div>
          );
        })}

        {/* El Personaje (Cerdito) */}
        <div 
          className="absolute z-20 pointer-events-none"
          style={{ 
            left: `${basketX}%`, 
            top: `${PIG_Y_PERCENT}%`, 
            transform: 'translate(-50%, -50%)',
            width: '100px',
            height: '100px',
          }}
        >
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-14 h-4 bg-black/30 blur-md rounded-full" />
          <img src={PIG_MASCOT} className="w-full h-full object-contain drop-shadow-xl" alt="piggy" />
        </div>

        {/* Overlays */}
        <AnimatePresence>
          {phase === "idle" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center text-white">
              <img src={PIG_MASCOT} className="h-40 w-40 object-contain mb-8 animate-bounce" alt="start" />
              <h2 className="text-5xl font-black tracking-tighter mb-4">COIN CATCH</h2>
              <p className="text-slate-300 text-sm font-medium mb-10 max-w-[280px]">
                Desliza para atrapar monedas y billetes. Evita las facturas 🧾 y deudas.
              </p>
              <Button onClick={startGame} className="h-16 px-12 rounded-full bg-indigo-600 text-white font-black text-xl shadow-2xl active:scale-95 transition-transform">
                ¡EMPEZAR! 🚀
              </Button>
            </motion.div>
          )}

          {phase === "over" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[100] bg-rose-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center text-white">
              <Trophy className="h-20 w-20 text-yellow-400 mb-4" />
              <h2 className="text-4xl font-black tracking-tighter mb-2">¡GAME OVER!</h2>
              <div className="bg-white/10 px-10 py-6 rounded-3xl mb-8 border border-white/10">
                <p className="text-[10px] font-black uppercase text-white/50 mb-1">Puntaje Final</p>
                <p className="text-5xl font-black">{score.toLocaleString()}</p>
              </div>

              {gameOverTip && (
                <div className="bg-indigo-600/30 border border-indigo-500/30 p-5 rounded-3xl mb-10 max-w-xs">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-yellow-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Tip del Cerdito</span>
                  </div>
                  <p className="text-sm font-bold italic leading-tight text-indigo-50">
                    "{gameOverTip.text}"
                  </p>
                </div>
              )}

              <Button onClick={startGame} className="h-16 px-12 rounded-full bg-white text-slate-900 font-black text-xl shadow-xl flex gap-3 active:scale-95 transition-transform">
                <RefreshCw className="h-6 w-6" /> VOLVER A INTENTAR
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RefreshCw, Lightbulb, Sparkles, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRandomTip, OinkashTip } from "@/utils/oinkash-tips";

/**
 * 🪙 COIN CATCH — Versión Restaurada
 */

const STARTING_LIVES = 3;
const PIG_Y_PERCENT = 75; 
const CATCH_LINE_START = 65; 
const CATCH_LINE_END = 85;   
const MISS_LINE = 95;        
const BASKET_HALF_WIDTH = 12; 
const CATCH_TOLERANCE = 12; 
const STREAK_PER_MULT_LEVEL = 3; 
const MAX_MULTIPLIER = 5;
const BASE_MOVE_SPEED = 150; 

const LEVEL_GOALS = [500, 1500, 3000, 6000, 12000];

// Mascot original para Coin Catch
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
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    itemsRef.current = [];
    nextIdRef.current = 0;
    spawnAccumulatorRef.current = 0;
    streakRef.current = 0;
    livesRef.current = STARTING_LIVES;
    scoreRef.current = 0;
    levelRef.current = 1;
    basketXRef.current = 50;
    lastTimeRef.current = 0; // Se inicializará en el primer tick
    
    setItems([]);
    setScore(0);
    setLives(STARTING_LIVES);
    setLevel(1);
    setMultiplier(1);
    setBasketX(50);
    setGameOverTip(null);
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;

    const tick = (now: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      if (keysRef.current.has("ArrowLeft")) basketXRef.current = Math.max(BASKET_HALF_WIDTH, basketXRef.current - BASE_MOVE_SPEED * dt);
      if (keysRef.current.has("ArrowRight")) basketXRef.current = Math.min(100 - BASKET_HALF_WIDTH, basketXRef.current + BASE_MOVE_SPEED * dt);

      const currentGoal = LEVEL_GOALS[levelRef.current - 1] || 100000;
      if (scoreRef.current >= currentGoal) {
        levelRef.current += 1;
        setLevel(levelRef.current);
        playSound(audioLevelUpRef.current);
        livesRef.current = Math.min(STARTING_LIVES, livesRef.current + 1);
        setLives(livesRef.current);
      }

      const difficultyMult = 1 + (levelRef.current - 1) * 0.3;
      const spawnInterval = 1.2 / difficultyMult; 
      const fallSpeed = 55 * (1 + (levelRef.current - 1) * 0.2);

      spawnAccumulatorRef.current += dt;
      if (spawnAccumulatorRef.current >= spawnInterval) {
        spawnAccumulatorRef.current = 0;
        const isBad = Math.random() < (0.3 + (levelRef.current * 0.05));
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

      const remaining: FallingItem[] = [];
      for (const item of itemsRef.current) {
        const newY = item.y + item.speed * dt;
        if (newY >= CATCH_LINE_START && newY <= CATCH_LINE_END) {
          const dx = Math.abs(item.x - basketXRef.current);
          if (dx <= CATCH_TOLERANCE) {
            const def = ITEM_DEFS[item.kind];
            if (def.bad) {
              livesRef.current -= 1;
              streakRef.current = 0;
              playSound(audioErrorRef.current);
              showFlash("bad");
            } else {
              streakRef.current += 1;
              const mult = Math.min(MAX_MULTIPLIER, 1 + Math.floor(streakRef.current / STREAK_PER_MULT_LEVEL));
              scoreRef.current += def.points * mult;
              setMultiplier(mult);
              playSound(audioCoinRef.current);
              showFlash("good");
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
    const handleDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") keysRef.current.add(e.key);
      if (e.code === "Space" && phase !== "playing") startGame();
    };
    const handleUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => { window.removeEventListener("keydown", handleDown); window.removeEventListener("keyup", handleUp); };
  }, [phase, startGame]);

  const handlePointer = (e: React.PointerEvent | React.TouchEvent) => {
    if (phase !== "playing") { startGame(); return; }
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as any).clientX;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    basketXRef.current = Math.max(BASKET_HALF_WIDTH, Math.min(100 - BASKET_HALF_WIDTH, pct));
    setBasketX(basketXRef.current);
  };

  const currentLevelGoal = LEVEL_GOALS[level - 1] || 100000;
  const prevLevelGoal = level > 1 ? LEVEL_GOALS[level - 2] : 0;
  const progressPercent = Math.min(100, ((score - prevLevelGoal) / (currentLevelGoal - prevLevelGoal)) * 100);

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col relative overflow-hidden font-sans select-none touch-none">
      <div 
        ref={fieldRef}
        className={cn(
          "relative flex-1 transition-all duration-200 z-10",
          flash === "good" ? "bg-emerald-500/10" : flash === "bad" ? "bg-rose-500/10" : "bg-transparent"
        )}
        onPointerDown={(e) => { draggingRef.current = true; handlePointer(e); }}
        onPointerMove={(e) => draggingRef.current && handlePointer(e)}
        onPointerUp={() => draggingRef.current = false}
        onTouchStart={(e) => { draggingRef.current = true; handlePointer(e); }}
        onTouchMove={(e) => draggingRef.current && handlePointer(e)}
        onTouchEnd={() => draggingRef.current = false}
      >
        <div className="absolute top-16 left-0 right-0 p-6 flex flex-col gap-4 z-50 pointer-events-none">
          <div className="flex justify-between items-start">
            <div className="bg-black/60 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 text-white">
              <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Saldo</p>
              <p className="text-3xl font-black text-indigo-400">${score.toLocaleString()}</p>
            </div>
            <div className="flex gap-2 bg-black/60 backdrop-blur-xl p-3 rounded-2xl border border-white/10">
              {Array.from({ length: STARTING_LIVES }).map((_, i) => (
                <span key={i} className={cn("text-2xl", i >= lives && "opacity-20 grayscale")}>🐷</span>
              ))}
            </div>
          </div>
          <div className="w-full max-w-xs mx-auto space-y-1.5">
             <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                <motion.div className="h-full bg-indigo-500" animate={{ width: `${progressPercent}%` }} />
             </div>
          </div>
        </div>

        <div 
          className="absolute z-40 pointer-events-none transition-transform duration-75"
          style={{ left: `${basketX}%`, top: `${PIG_Y_PERCENT}%`, transform: 'translate(-50%, -50%)', width: '120px', height: '120px' }}
        >
          <img src={PIG_MASCOT} className="w-full h-full object-contain drop-shadow-2xl" alt="Pig" />
        </div>

        {items.map((item) => {
          const def = ITEM_DEFS[item.kind];
          return (
            <div key={item.id} className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-30" style={{ left: `${item.x}%`, top: `${item.y}%` }}>
              {def.image ? <img src={def.image} className="w-12 h-12 object-contain" alt="item" /> : <span className="text-4xl drop-shadow-xl">{def.emoji}</span>}
            </div>
          );
        })}

        <AnimatePresence>
          {phase === "idle" && (
            <motion.div className="absolute inset-0 z-[60] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center text-white">
              <h2 className="text-5xl font-black mb-8 italic text-indigo-400">COIN CATCH</h2>
              <Button onClick={startGame} className="h-16 px-12 rounded-full bg-indigo-600 font-black text-xl">¡JUGAR! 🚀</Button>
            </motion.div>
          )}
          {phase === "over" && (
            <motion.div className="absolute inset-0 z-[100] bg-rose-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center text-white">
              <h2 className="text-4xl font-black mb-6">¡BANCARROTA!</h2>
              <div className="bg-black/40 px-10 py-6 rounded-[2rem] mb-8">
                <p className="text-6xl font-black">${score}</p>
              </div>
              <Button onClick={startGame} className="h-16 px-12 rounded-full bg-white text-rose-950 font-black text-lg">REINTENTAR</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
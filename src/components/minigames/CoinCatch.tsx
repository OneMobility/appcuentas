import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize, Minimize, RefreshCw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 🪙 COIN CATCH — Versión Pantalla Completa UI Integrada
 */

const STARTING_LIVES = 3;
const CATCH_LINE = 82; // Ajustado para que coincida con la nueva posición del cerdo
const MISS_LINE = 101; 
const BASKET_HALF_WIDTH = 12; 
const CATCH_TOLERANCE = 12; 
const STREAK_PER_MULT_LEVEL = 3; 
const MAX_MULTIPLIER = 5;
const BASE_MOVE_SPEED = 90; 
const SPEED_PENALTY_PER_LIFE = 20; 

type Kind = "coin" | "bill" | "bag" | "gasto" | "impuesto" | "factura";

const ITEM_DEFS: Record<Kind, { emoji?: string; image?: string; points: number; bad: boolean; weight: number }> = {
  coin: { image: "/game-coin.png", points: 10, bad: false, weight: 5 },
  bill: { image: "/game-coin.png", points: 25, bad: false, weight: 3 },
  bag: { image: "/game-coin.png", points: 50, bad: false, weight: 1 },
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
  const [items, setItems] = useState<FallingItem[]>([]);
  const [basketX, setBasketX] = useState(50);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const saved = localStorage.getItem("oinkash_coincatch_best");
    if (saved) setBest(parseInt(saved));
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const showFlash = useCallback((kind: "good" | "bad") => {
    setFlash(kind);
    setTimeout(() => setFlash(null), 200);
  }, []);

  const endGame = useCallback(() => {
    setPhase("over");
    if (scoreRef.current > best) {
      setBest(scoreRef.current);
      localStorage.setItem("oinkash_coincatch_best", scoreRef.current.toString());
    }
  }, [best]);

  const startGame = useCallback(() => {
    itemsRef.current = [];
    nextIdRef.current = 0;
    spawnAccumulatorRef.current = 0;
    elapsedRef.current = 0;
    streakRef.current = 0;
    livesRef.current = STARTING_LIVES;
    scoreRef.current = 0;
    basketXRef.current = 50;

    setItems([]);
    setScore(0);
    setLives(STARTING_LIVES);
    setMultiplier(1);
    setBasketX(50);
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      elapsedRef.current += dt;

      const currentMoveSpeed = Math.max(30, BASE_MOVE_SPEED - ((STARTING_LIVES - livesRef.current) * SPEED_PENALTY_PER_LIFE));

      if (keysRef.current.has("ArrowLeft")) basketXRef.current = Math.max(BASKET_HALF_WIDTH, basketXRef.current - currentMoveSpeed * dt);
      if (keysRef.current.has("ArrowRight")) basketXRef.current = Math.min(100 - BASKET_HALF_WIDTH, basketXRef.current + currentMoveSpeed * dt);

      const timeProgress = Math.min(1, elapsedRef.current / 120);
      const scoreSpeedMult = 1 + (Math.floor(scoreRef.current / 1500) * 0.15); 
      const spawnInterval = (0.9 - 0.5 * timeProgress) / scoreSpeedMult; 
      const fallDuration = (3.2 - 1.5 * timeProgress) / scoreSpeedMult; 

      spawnAccumulatorRef.current += dt;
      if (spawnAccumulatorRef.current >= spawnInterval) {
        spawnAccumulatorRef.current = 0;
        const isBad = Math.random() < 0.38;
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

      const remaining: FallingItem[] = [];
      for (const item of itemsRef.current) {
        const newY = item.y + item.speed * dt;
        if (newY >= CATCH_LINE && newY < MISS_LINE) {
          const dx = Math.abs(item.x - basketXRef.current);
          if (dx <= CATCH_TOLERANCE) {
            const def = ITEM_DEFS[item.kind];
            if (def.bad) {
              livesRef.current -= 1;
              streakRef.current = 0;
              scoreRef.current = Math.max(0, scoreRef.current + def.points);
              showFlash("bad");
            } else {
              streakRef.current += 1;
              const mult = Math.min(MAX_MULTIPLIER, 1 + Math.floor(streakRef.current / STREAK_PER_MULT_LEVEL));
              scoreRef.current += def.points * mult;
              setMultiplier(mult);
              showFlash("good");
            }
            setLives(livesRef.current);
            setScore(scoreRef.current);
            continue; 
          }
        }
        if (newY >= MISS_LINE) {
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
    <div ref={containerRef} className="w-full h-full bg-slate-950 flex items-center justify-center p-0 md:p-4">
      <div 
        ref={fieldRef}
        className={cn(
          "relative w-full max-w-[500px] aspect-[9/16] md:aspect-[3/4] bg-white rounded-none md:rounded-[3rem] overflow-hidden touch-none select-none shadow-2xl transition-all duration-300",
          flash === "good" ? "ring-8 ring-emerald-500/30 ring-inset" : flash === "bad" ? "ring-8 ring-rose-500/30 ring-inset" : ""
        )}
        onPointerDown={(e) => { draggingRef.current = true; handlePointer(e); }}
        onPointerMove={(e) => draggingRef.current && handlePointer(e)}
        onPointerUp={() => draggingRef.current = false}
      >
        {/* FONDO */}
        <div 
          className="absolute inset-0 bg-cover bg-center" 
          style={{ backgroundImage: 'url(/game-bg.png)' }} 
        />

        {/* OVERLAY DE INTERFAZ (STATS) */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30 pointer-events-none">
          <div className="flex flex-col gap-1">
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
              <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Puntos</p>
              <p className="text-2xl font-black text-white tracking-tighter">{score.toLocaleString()}</p>
            </div>
            <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-xl border border-white/5 inline-fit">
              <p className="text-[8px] font-black text-white/40 uppercase">Récord: {best}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1.5 bg-black/40 backdrop-blur-md p-2 rounded-2xl border border-white/10">
              {Array.from({ length: STARTING_LIVES }).map((_, i) => (
                <span key={i} className={cn("text-xl transition-all duration-300", i >= lives && "grayscale opacity-20 scale-75")}>🐷</span>
              ))}
            </div>
            {multiplier > 1 && (
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="bg-yellow-400 text-yellow-950 text-[10px] font-black px-3 py-1 rounded-full shadow-lg"
              >
                COMBO x{multiplier} 🔥
              </motion.div>
            )}
          </div>
        </div>

        {/* BOTÓN FULLSCREEN */}
        <button 
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          className="absolute bottom-6 right-6 z-40 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 text-white hover:bg-white/20 transition-all pointer-events-auto"
        >
          {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>

        {/* OBJETOS CAYENDO */}
        {items.map((item) => {
          const def = ITEM_DEFS[item.kind];
          return (
            <div 
              key={item.id} 
              className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 drop-shadow-lg z-20"
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
            >
              {def.image ? (
                <img src={def.image} className="w-10 h-10 object-contain" />
              ) : (
                <span className="text-4xl">{def.emoji}</span>
              )}
            </div>
          );
        })}

        {/* PERSONAJE (CERDITO) */}
        <div 
          className="absolute z-20 pointer-events-none transition-opacity"
          style={{ 
            left: `${basketX}%`, 
            top: '84%', // Posición ajustada para la banqueta
            transform: 'translate(-50%, -50%)',
            width: '90px',
            height: '90px',
          }}
        >
          {/* Sombra de contacto */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-12 h-3 bg-black/20 blur-md rounded-full" />
          <img src="/game-character.png" className="w-full h-full object-contain drop-shadow-md" />
        </div>

        {/* PANTALLAS DE ESTADO */}
        <AnimatePresence>
          {phase === "idle" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-20 animate-pulse" />
                <img src="/game-character.png" className="h-32 w-32 object-contain relative z-10" />
              </div>
              <h2 className="text-4xl font-black text-white tracking-tighter mb-2">COIN CATCH</h2>
              <p className="text-slate-300 text-sm font-medium mb-8 max-w-[240px]">Atrapa monedas para ganar puntos. ¡Las facturas 🧾 te restan vida!</p>
              <Button onClick={startGame} className="h-16 px-10 rounded-[2rem] bg-indigo-600 text-white font-black text-xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">¡A JUGAR! 🐷</Button>
            </motion.div>
          )}

          {phase === "over" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-rose-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center text-white">
              <Trophy className="h-20 w-20 text-yellow-400 mb-6" />
              <h2 className="text-4xl font-black tracking-tighter mb-2">¡FIN DEL JUEGO!</h2>
              <div className="bg-white/10 px-8 py-4 rounded-3xl mb-8 border border-white/10">
                <p className="text-[10px] font-black uppercase text-white/50 mb-1">Puntaje Final</p>
                <p className="text-5xl font-black text-white">{score.toLocaleString()}</p>
              </div>
              <Button onClick={startGame} className="h-16 px-10 rounded-[2rem] bg-white text-slate-900 font-black text-xl shadow-xl hover:bg-slate-100 active:scale-95 transition-all flex gap-3">
                <RefreshCw className="h-6 w-6" /> REINTENTAR
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
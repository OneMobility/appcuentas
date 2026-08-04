import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize, Minimize, RefreshCw, Trophy, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 🪙 COIN CATCH — Versión Responsiva para App y PC
 */

const STARTING_LIVES = 3;
const CATCH_LINE = 78; 
const MISS_LINE = 101; 
const BASKET_HALF_WIDTH = 10; 
const CATCH_TOLERANCE = 7; 
const STREAK_PER_MULT_LEVEL = 3; 
const MAX_MULTIPLIER = 5;
const BASE_MOVE_SPEED = 90; 
const SPEED_PENALTY_PER_LIFE = 20; 

const SAVING_TIPS = [
  "¡Prepara tu café en casa y ahorra hasta $1,200 al mes! ☕",
  "¡Aplica la regla de las 48 horas antes de comprar algo por impulso! ⏱️",
  "¡Usa efectivo para tus salidas; cuando se acaba, se acaba la fiesta! 💵",
  "¡Revisa tus suscripciones y cancela la que no hayas usado este mes! ✂️",
  "¡Compara precios en al menos 3 tiendas antes de una compra grande! 🔍",
  "¡Ahorra el cambio de tus compras diarias en un frasco real! 🫙",
  "¡Haz una lista de súper y apégate a ella estrictamente! 🛒",
  "¡Desconecta los aparatos que no uses para evitar el consumo vampiro! 🔌"
];

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
  const [phase, setPhase] = useState<"idle" | "playing" | "over" | "tip">("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [multiplier, setMultiplier] = useState(1);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [basketX, setBasketX] = useState(50);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTip, setCurrentTip] = useState("");
  const [showBien, setShowBien] = useState(false);
  
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
  const lastTipThreshold = useRef(0);
  const lastBienThreshold = useRef(0);

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
    lastTipThreshold.current = 0;
    lastBienThreshold.current = 0;

    setItems([]);
    setScore(0);
    setLives(STARTING_LIVES);
    setMultiplier(1);
    setBasketX(50);
    setPhase("playing");
  }, []);

  const continueAfterTip = () => {
    setPhase("playing");
    lastTimeRef.current = performance.now();
  };

  useEffect(() => {
    if (phase !== "playing") return;
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      elapsedRef.current += dt;

      if (scoreRef.current >= lastBienThreshold.current + 2500) {
        lastBienThreshold.current = Math.floor(scoreRef.current / 2500) * 2500;
        setShowBien(true);
        setTimeout(() => setShowBien(false), 1500);
      }

      if (scoreRef.current >= lastTipThreshold.current + 5000) {
        lastTipThreshold.current = Math.floor(scoreRef.current / 5000) * 5000;
        setCurrentTip(SAVING_TIPS[Math.floor(Math.random() * SAVING_TIPS.length)]);
        setPhase("tip");
        return; 
      }

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
    <div ref={containerRef} className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div 
        ref={fieldRef}
        className={cn(
          "relative w-full h-full md:aspect-[3/4] md:h-auto md:max-w-[500px] bg-white overflow-hidden touch-none select-none transition-all duration-300",
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

        {/* MENSAJE "BIEN" */}
        <AnimatePresence>
          {showBien && (
            <motion.div 
              initial={{ scale: 0, opacity: 0, y: 50 }}
              animate={{ scale: 1.5, opacity: 1, y: -20 }}
              exit={{ scale: 2, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-[45] pointer-events-none"
            >
              <div className="bg-indigo-600 text-white px-6 py-2 rounded-full font-black text-2xl shadow-2xl border-4 border-white">
                ¡BIEN! 🐷
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* OVERLAY DE INTERFAZ (STATS) */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-30 pointer-events-none">
          <div className="flex flex-col gap-1">
            <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
              <p className="text-[8px] font-black text-white/60 uppercase tracking-widest">Puntos</p>
              <p className="text-xl font-black text-white tracking-tighter">{score.toLocaleString()}</p>
            </div>
            <div className="bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/5 inline-fit">
              <p className="text-[7px] font-black text-white/40 uppercase">Best: {best}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-1 bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
              {Array.from({ length: STARTING_LIVES }).map((_, i) => (
                <span key={i} className={cn("text-sm transition-all duration-300", i >= lives && "grayscale opacity-20 scale-75")}>🐷</span>
              ))}
            </div>
            {multiplier > 1 && (
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="bg-yellow-400 text-yellow-950 text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg"
              >
                COMBO x{multiplier} 🔥
              </motion.div>
            )}
          </div>
        </div>

        {/* BOTÓN FULLSCREEN (Solo PC) */}
        <button 
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          className="absolute bottom-4 right-4 z-40 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 text-white hover:bg-white/20 transition-all pointer-events-auto hidden md:block"
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
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
                <img src={def.image} className="w-8 h-8 md:w-10 md:h-10 object-contain" />
              ) : (
                <span className="text-3xl md:text-4xl">{def.emoji}</span>
              )}
            </div>
          );
        })}

        {/* PERSONAJE (CERDITO) */}
        <div 
          className="absolute z-20 pointer-events-none transition-opacity"
          style={{ 
            left: `${basketX}%`, 
            top: '80%', 
            transform: 'translate(-50%, -50%)',
            width: '80px',
            height: '80px',
          }}
        >
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-10 h-2 bg-black/20 blur-md rounded-full" />
          <img src="/game-character.png" className="w-full h-full object-contain drop-shadow-md" />
        </div>

        {/* PANTALLAS DE ESTADO */}
        <AnimatePresence>
          {phase === "idle" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
              <img src="/game-character.png" className="h-24 w-24 object-contain mb-6" />
              <h2 className="text-3xl font-black text-white tracking-tighter mb-2">COIN CATCH</h2>
              <p className="text-slate-300 text-xs font-medium mb-8 max-w-[200px]">Atrapa monedas para ganar puntos. ¡Las facturas 🧾 te restan vida!</p>
              <Button onClick={startGame} className="h-14 px-10 rounded-2xl bg-indigo-600 text-white font-black text-lg shadow-xl hover:bg-indigo-700">¡A JUGAR! 🐷</Button>
            </motion.div>
          )}

          {phase === "tip" && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 z-50 bg-indigo-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
              <div className="bg-white/10 p-6 rounded-[2.5rem] border border-white/20 shadow-2xl space-y-4">
                <div className="flex justify-center">
                  <div className="h-16 w-16 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg rotate-12">
                    <Lightbulb className="h-8 w-8 text-yellow-950" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tighter flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-400" /> CONSEJO OINKASH
                  </h3>
                  <p className="text-base font-bold leading-tight italic">"{currentTip}"</p>
                </div>
                <Button onClick={continueAfterTip} className="w-full h-14 rounded-xl bg-white text-indigo-900 font-black text-lg">
                  ¡ENTENDIDO! 🚀
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "over" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-rose-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center text-white">
              <Trophy className="h-16 w-16 text-yellow-400 mb-6" />
              <h2 className="text-3xl font-black tracking-tighter mb-2">¡FIN DEL JUEGO!</h2>
              <div className="bg-white/10 px-6 py-3 rounded-2xl mb-8 border border-white/10">
                <p className="text-[8px] font-black uppercase text-white/50 mb-1">Puntaje Final</p>
                <p className="text-4xl font-black text-white">{score.toLocaleString()}</p>
              </div>
              <Button onClick={startGame} className="h-14 px-8 rounded-2xl bg-white text-slate-900 font-black text-lg flex gap-2">
                <RefreshCw className="h-5 w-5" /> REINTENTAR
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
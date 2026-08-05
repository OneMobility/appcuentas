"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RefreshCw, Lightbulb, Sparkles, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRandomTip, OinkashTip } from "@/utils/oinkash-tips";

/**
 * 🐷 PIG FLAP INFINITO — Recolecta monedas, evita deudas.
 */

const pigMascot = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/ChatGPT%20Image%204%20ago%202026,%2003_46_40%20p.m..png";
const coinImage = "/game-coin.png";

// ---------- Config física ----------
const BIRD_X = 25; 
const BIRD_SIZE = 50; 
const GRAVITY = 1350; 
const FLAP_VELOCITY = -420; 
const MAX_FALL_SPEED = 800; 

// ---------- Config Obstáculos ----------
const PIPE_WIDTH = 65; 
const COIN_SIZE = 35;

type Phase = "idle" | "playing" | "gameover";

interface Pipe {
  id: number;
  x: number;
  gapY: number;
  gapHeight: number;
  coinCollected: boolean;
}

export default function PigFlap() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [birdY, setBirdY] = useState(300);
  const [birdAngle, setBirdAngle] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [gameOverTip, setGameOverTip] = useState<OinkashTip | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  // Refs de lógica (Single Source of Truth)
  const birdYRef = useRef(300);
  const birdVelRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const nextPipeIdRef = useRef(0);
  const spawnAccRef = useRef(0);
  const scoreRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");

  // Audio Refs
  const audioCoinRef = useRef<HTMLAudioElement | null>(null);
  const audioEndRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioCoinRef.current = new Audio("/sounds/coin.wav");
    audioEndRef.current = new Audio("/sounds/end-point.wav");
    
    // Cargar Récord guardado
    const saved = localStorage.getItem("oinkash_flap_best");
    if (saved) setBest(parseInt(saved));
  }, []);

  const playSound = (audio: HTMLAudioElement | null) => {
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };

  const getDifficulty = (currentScore: number) => {
    const factor = Math.min(1, currentScore / 1000); 
    return {
      speed: 220 + (140 * factor),
      gapHeight: 220 - (50 * factor),
      spacing: 380 - (60 * factor)
    };
  };

  const resetRun = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    const height = containerRef.current?.offsetHeight || 600;
    birdYRef.current = height / 2;
    birdVelRef.current = 0;
    pipesRef.current = [];
    nextPipeIdRef.current = 0;
    spawnAccRef.current = 0;
    scoreRef.current = 0;
    phaseRef.current = "idle";

    setBirdY(birdYRef.current);
    setBirdAngle(0);
    setPipes([]);
    setScore(0);
    setGameOverTip(null);
    setPhase("idle");
    
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const saveHighScore = useCallback((currentScore: number) => {
    const saved = localStorage.getItem("oinkash_flap_best");
    const currentBest = saved ? parseInt(saved) : 0;
    if (currentScore > currentBest) {
      setBest(currentScore);
      localStorage.setItem("oinkash_flap_best", currentScore.toString());
    }
  }, []);

  const die = useCallback(() => {
    if (phaseRef.current === "gameover") return;
    
    setPhase("gameover");
    phaseRef.current = "gameover";
    setGameOverTip(getRandomTip());
    playSound(audioEndRef.current);
    saveHighScore(scoreRef.current);
  }, [saveHighScore]);

  const flap = useCallback(() => {
    if (phaseRef.current === "gameover") return;
    
    if (phaseRef.current === "idle") {
      setPhase("playing");
      phaseRef.current = "playing";
    }

    birdVelRef.current = FLAP_VELOCITY;
  }, []);

  const tick = useCallback((now: number) => {
    const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
    lastTimeRef.current = now;

    if (phaseRef.current === "playing") {
      const height = containerRef.current?.offsetHeight || 600;
      const width = containerRef.current?.offsetWidth || 400;
      const diff = getDifficulty(scoreRef.current);

      // Física
      birdVelRef.current = Math.min(MAX_FALL_SPEED, birdVelRef.current + GRAVITY * dt);
      birdYRef.current += birdVelRef.current * dt;
      
      if (birdYRef.current < 0 || birdYRef.current > height) {
        die();
      }

      setBirdY(birdYRef.current);
      setBirdAngle(Math.max(-25, Math.min(70, birdVelRef.current * 0.1)));

      // Obstáculos
      spawnAccRef.current += dt * 1000;
      if (spawnAccRef.current >= (diff.spacing / diff.speed) * 1000) {
        spawnAccRef.current = 0;
        const margin = 80;
        pipesRef.current.push({
          id: nextPipeIdRef.current++,
          x: width + 100,
          gapY: margin + Math.random() * (height - margin * 2 - diff.gapHeight),
          gapHeight: diff.gapHeight,
          coinCollected: false,
        });
      }

      const birdWorldX = (BIRD_X / 100) * width;
      const birdRect = {
        left: birdWorldX - 18,
        right: birdWorldX + 18,
        top: birdYRef.current - 18,
        bottom: birdYRef.current + 18
      };

      const remaining: Pipe[] = [];
      for (const pipe of pipesRef.current) {
        pipe.x -= diff.speed * dt;
        
        // Colisión con tubos
        if (pipe.x < birdRect.right && pipe.x + PIPE_WIDTH > birdRect.left) {
          if (birdRect.top < pipe.gapY || birdRect.bottom > pipe.gapY + pipe.gapHeight) {
            die();
          }
        }

        // Colisión con moneda
        if (!pipe.coinCollected) {
          const coinCenterX = pipe.x + PIPE_WIDTH / 2;
          const coinCenterY = pipe.gapY + pipe.gapHeight / 2;
          
          const dx = birdWorldX - coinCenterX;
          const dy = birdYRef.current - coinCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < (BIRD_SIZE / 2 + COIN_SIZE / 2)) {
            pipe.coinCollected = true;
            scoreRef.current += 10;
            setScore(scoreRef.current);
            playSound(audioCoinRef.current);
            
            // Actualizar mejor récord si lo superamos en tiempo real
            const currentBest = parseInt(localStorage.getItem("oinkash_flap_best") || "0");
            if (scoreRef.current > currentBest) {
              setBest(scoreRef.current);
            }
          }
        }

        if (pipe.x > -PIPE_WIDTH) remaining.push(pipe);
      }
      pipesRef.current = remaining;
      setPipes([...pipesRef.current]);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [die]);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [tick]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); flap(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden touch-none select-none bg-sky-400"
      onPointerDown={flap}
    >
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000"
        style={{ backgroundImage: 'url(/flappy-bg.png)' }}
      />

      {pipes.map(p => (
        <React.Fragment key={p.id}>
          <div className="absolute bg-rose-600 border-x-4 border-rose-800 rounded-b-3xl z-10 shadow-lg" style={{ left: p.x, top: 0, width: PIPE_WIDTH, height: p.gapY }}></div>
          <div className="absolute bg-rose-600 border-x-4 border-rose-800 rounded-t-3xl z-10 shadow-lg" style={{ left: p.x, top: p.gapY + p.gapHeight, width: PIPE_WIDTH, height: 1000 }}></div>
          
          {!p.coinCollected && (
            <motion.div 
              className="absolute z-20"
              animate={{ y: [0, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{ 
                left: p.x + PIPE_WIDTH / 2 - COIN_SIZE / 2, 
                top: p.gapY + p.gapHeight / 2 - COIN_SIZE / 2, 
                width: COIN_SIZE, 
                height: COIN_SIZE 
              }}
            >
              <img src={coinImage} className="w-full h-full object-contain drop-shadow-md" />
            </motion.div>
          )}
        </React.Fragment>
      ))}

      <motion.div
        className="absolute z-40 pointer-events-none"
        animate={{ top: birdY, rotate: birdAngle }}
        transition={{ type: 'tween', duration: 0 }}
        style={{ left: `${BIRD_X}%`, width: BIRD_SIZE, height: BIRD_SIZE, marginLeft: -BIRD_SIZE/2, marginTop: -BIRD_SIZE/2 }}
      >
        <img src={pigMascot} className="w-full h-full object-contain drop-shadow-2xl" />
      </motion.div>

      <div className="absolute top-16 left-0 right-0 p-6 flex justify-between items-start z-30 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md px-5 py-2 rounded-2xl border border-white/20 text-white shadow-2xl">
          <p className="text-[10px] font-black uppercase opacity-60 flex items-center gap-1">
            <Coins className="h-3 w-3" /> Ahorro Actual
          </p>
          <p className="text-3xl font-black tracking-tighter">{score}</p>
        </div>
        
        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 text-white shadow-lg text-right">
          <p className="text-[8px] font-black uppercase opacity-50">Récord Máximo</p>
          <p className="text-lg font-black text-yellow-400">{best}</p>
        </div>
      </div>

      <AnimatePresence>
        {phase === "idle" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center text-white">
            <img src={pigMascot} className="h-32 w-32 mb-8 animate-bounce" />
            <h2 className="text-5xl font-black tracking-tighter mb-2">PIG FLAP</h2>
            <p className="text-sm font-medium mb-10 opacity-80 max-w-[240px]">
              ¡Atrapa las monedas para sumar ahorros y esquiva los gastos!
            </p>
            <Button onClick={flap} className="h-16 px-12 rounded-full bg-white text-indigo-900 font-black text-xl pointer-events-auto shadow-2xl">
              ¡A VOLAR! 🚀
            </Button>
          </motion.div>
        )}

        {phase === "gameover" && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 z-50 bg-rose-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center text-white pointer-events-auto">
            <Trophy className="h-20 w-20 text-yellow-400 mb-4" />
            <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">¡Bancarrota!</h2>
            
            <div className="bg-white/10 px-10 py-6 rounded-[2rem] mb-6 border border-white/10 shadow-inner">
               <p className="text-6xl font-black mb-1">{score}</p>
               <p className="text-[10px] font-black uppercase opacity-40">Puntos recolectados</p>
            </div>

            <div className="mb-8 flex flex-col items-center">
              <p className="text-[10px] font-black uppercase text-rose-300">Mejor Récord Personal</p>
              <p className="text-2xl font-black text-yellow-400 tracking-tight">{best}</p>
            </div>

            {gameOverTip && (
              <div className="bg-indigo-600/30 border border-indigo-500/30 p-5 rounded-3xl mb-8 max-w-xs">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-yellow-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Tip del Cerdito</span>
                </div>
                <p className="text-sm font-bold italic leading-tight text-indigo-50">"{gameOverTip.text}"</p>
              </div>
            )}

            <Button onClick={resetRun} className="h-16 px-12 rounded-full bg-white text-slate-900 font-black text-xl shadow-2xl flex gap-3 active:scale-95 transition-transform">
              <RefreshCw className="h-6 w-6" /> REINTENTAR
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
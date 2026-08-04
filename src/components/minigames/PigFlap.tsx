"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RefreshCw, Lightbulb, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRandomTip, OinkashTip } from "@/utils/oinkash-tips";

/**
 * 🐷 PIG FLAP — Versión Inmersiva
 * 3 Niveles Largos + Jefe Final
 */

const pigMascot = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/3bd895fd1ea2a510faa68f516cfc88ad9408d50cff95156f2fb48a61d8d7349d.png";

// ---------- Config física ----------
const BIRD_X = 25; 
const BIRD_SIZE = 60; // Aumentado ligeramente para que se vea mejor el nuevo arte
const GRAVITY = 1100; 
const FLAP_VELOCITY = -380; 
const MAX_FALL_SPEED = 700; 

// ---------- Config niveles ----------
const PIPES_PER_LEVEL = 15; 
const LEVELS = [
  { speed: 200, gapHeight: 220, spacing: 350 }, // Nivel 1
  { speed: 250, gapHeight: 190, spacing: 320 }, // Nivel 2
  { speed: 320, gapHeight: 160, spacing: 280 }, // Nivel 3
];
const PIPE_WIDTH = 60; 

// ---------- Config jefe ----------
const BOSS_WIDTH = 100; 
const BOSS_GAP_HEIGHT = 180; 
const BOSS_MAX_HEALTH = 8;
const BOSS_HIT_INTERVAL = 1.5; 
const BOSS_ENTER_SPEED = 150; 
const BOSS_REST_X_PCT = 70; 

type Phase = "idle" | "playing" | "transition" | "boss" | "win" | "gameover";

interface Pipe {
  id: number;
  x: number;
  gapY: number;
  gapHeight: number;
  passed: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  emoji: string;
}

const PARTICLE_EMOJIS = ["🪙", "💰", "💵", "✨"];

export default function PigFlap() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [birdY, setBirdY] = useState(300);
  const [birdAngle, setBirdAngle] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [bossState, setBossState] = useState({
    x: 1000,
    gapY: 300,
    health: BOSS_MAX_HEALTH,
    hitFlash: false,
  });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [gameOverTip, setGameOverTip] = useState<OinkashTip | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const birdYRef = useRef(300);
  const birdVelRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const nextPipeIdRef = useRef(0);
  const spawnAccRef = useRef(0);
  const pipesPassedRef = useRef(0);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");

  const bossXRef = useRef(1000);
  const bossGapYRef = useRef(300);
  const bossHealthRef = useRef(BOSS_MAX_HEALTH);
  const bossTimeRef = useRef(0);
  const bossInsideTimerRef = useRef(0);
  const bossRestedRef = useRef(false);

  const particlesRef = useRef<Particle[]>([]);
  const nextParticleIdRef = useRef(0);

  // Audio Refs
  const audioCoinRef = useRef<HTMLAudioElement | null>(null);
  const audioEndRef = useRef<HTMLAudioElement | null>(null);
  const audioHitRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioCoinRef.current = new Audio("/sounds/coin.wav");
    audioEndRef.current = new Audio("/sounds/end-point.wav");
    audioHitRef.current = new Audio("/sounds/achievement.mp3");
    
    const saved = localStorage.getItem("oinkash_flap_best");
    if (saved) setBest(parseInt(saved));
  }, []);

  const playSound = (audio: HTMLAudioElement | null) => {
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };

  const spawnExplosion = useCallback((x: number, y: number) => {
    const created: Particle[] = [];
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      created.push({
        id: nextParticleIdRef.current++,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        emoji: PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)],
      });
    }
    particlesRef.current = [...particlesRef.current, ...created];
  }, []);

  const resetRun = useCallback(() => {
    const startY = containerRef.current ? containerRef.current.offsetHeight / 2 : 300;
    birdYRef.current = startY;
    birdVelRef.current = 0;
    pipesRef.current = [];
    nextPipeIdRef.current = 0;
    spawnAccRef.current = 0;
    pipesPassedRef.current = 0;
    levelRef.current = 1;
    scoreRef.current = 0;
    bossXRef.current = 2000;
    bossHealthRef.current = BOSS_MAX_HEALTH;
    bossTimeRef.current = 0;
    bossInsideTimerRef.current = 0;
    bossRestedRef.current = false;
    particlesRef.current = [];

    setBirdY(startY);
    setBirdAngle(0);
    setPipes([]);
    setScore(0);
    setLevel(1);
    setGameOverTip(null);
    
    // Resetear el tiempo para evitar el salto inicial "loco"
    lastTimeRef.current = performance.now();
  }, []);

  const die = useCallback(() => {
    setPhase("gameover");
    phaseRef.current = "gameover";
    setGameOverTip(getRandomTip());
    playSound(audioEndRef.current);
    if (scoreRef.current > best) {
      setBest(scoreRef.current);
      localStorage.setItem("oinkash_flap_best", scoreRef.current.toString());
    }
  }, [best]);

  const flap = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();

    if (phaseRef.current === "idle" || phaseRef.current === "gameover" || phaseRef.current === "win") {
      resetRun();
      setPhase("playing");
      phaseRef.current = "playing";
      return;
    }
    if (phaseRef.current === "playing" || phaseRef.current === "boss") {
      birdVelRef.current = FLAP_VELOCITY;
    }
    if (phaseRef.current === "transition") {
      pipesPassedRef.current = 0;
      pipesRef.current = [];
      if (levelRef.current >= 3) {
        setPhase("boss");
        phaseRef.current = "boss";
      } else {
        levelRef.current += 1;
        setLevel(levelRef.current);
        setPhase("playing");
        phaseRef.current = "playing";
      }
      lastTimeRef.current = performance.now();
    }
  }, [resetRun]);

  useEffect(() => {
    const tick = (now: number) => {
      // dt debe ser pequeño, si es la primera vez o hubo pausa, lo limitamos
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      if (phaseRef.current === "playing" || phaseRef.current === "boss") {
        const height = containerRef.current?.offsetHeight || 600;
        const width = containerRef.current?.offsetWidth || 400;

        birdVelRef.current = Math.min(MAX_FALL_SPEED, birdVelRef.current + GRAVITY * dt);
        birdYRef.current += birdVelRef.current * dt;
        
        if (birdYRef.current < -50 || birdYRef.current > height + 50) {
          die();
          return;
        }

        setBirdY(birdYRef.current);
        setBirdAngle(Math.max(-25, Math.min(70, birdVelRef.current * 0.1)));

        if (phaseRef.current === "playing") {
          const cfg = LEVELS[levelRef.current - 1];
          spawnAccRef.current += dt * 1000;
          if (spawnAccRef.current >= (cfg.spacing / cfg.speed) * 1000) {
            spawnAccRef.current = 0;
            const margin = 100;
            pipesRef.current.push({
              id: nextPipeIdRef.current++,
              x: width + 50,
              gapY: margin + Math.random() * (height - margin * 2 - cfg.gapHeight),
              gapHeight: cfg.gapHeight,
              passed: false,
            });
          }

          const remaining: Pipe[] = [];
          for (const pipe of pipesRef.current) {
            pipe.x -= cfg.speed * dt;
            
            // Colisión
            const birdXPos = (BIRD_X / 100) * width;
            const birdLeft = birdXPos - 15;
            const birdRight = birdXPos + 15;
            const birdTop = birdYRef.current - 15;
            const birdBottom = birdYRef.current + 15;

            if (pipe.x < birdRight && pipe.x + PIPE_WIDTH > birdLeft) {
              if (birdYRef.current < pipe.gapY || birdYRef.current > pipe.gapY + pipe.gapHeight) {
                die();
                return;
              }
            }

            if (!pipe.passed && pipe.x < birdLeft) {
              pipe.passed = true;
              pipesPassedRef.current += 1;
              scoreRef.current += 10;
              setScore(scoreRef.current);
              playSound(audioCoinRef.current);
            }

            if (pipe.x > -PIPE_WIDTH) remaining.push(pipe);
          }
          pipesRef.current = remaining;
          setPipes([...pipesRef.current]);

          if (pipesPassedRef.current >= PIPES_PER_LEVEL) {
            setPhase("transition");
            phaseRef.current = "transition";
          }
        } else if (phaseRef.current === "boss") {
          const targetX = width * (BOSS_REST_X_PCT / 100);
          if (!bossRestedRef.current) {
            bossXRef.current -= BOSS_ENTER_SPEED * dt;
            if (bossXRef.current <= targetX) bossRestedRef.current = true;
          } else {
            bossTimeRef.current += dt;
          }

          const amplitude = (height - BOSS_GAP_HEIGHT) / 2 - 50;
          bossGapYRef.current = (height / 2 - BOSS_GAP_HEIGHT / 2) + Math.sin(bossTimeRef.current * 1.5) * amplitude;

          const birdXPos = (BIRD_X / 100) * width;
          if (birdXPos > bossXRef.current && birdXPos < bossXRef.current + BOSS_WIDTH) {
            if (birdYRef.current > bossGapYRef.current && birdYRef.current < bossGapYRef.current + BOSS_GAP_HEIGHT) {
              bossInsideTimerRef.current += dt;
              if (bossInsideTimerRef.current >= BOSS_HIT_INTERVAL) {
                bossInsideTimerRef.current = 0;
                bossHealthRef.current -= 1;
                scoreRef.current += 100;
                setScore(scoreRef.current);
                playSound(audioHitRef.current);
                spawnExplosion(bossXRef.current + BOSS_WIDTH / 2, bossGapYRef.current + BOSS_GAP_HEIGHT / 2);
                
                if (bossHealthRef.current <= 0) {
                  setPhase("win");
                  phaseRef.current = "win";
                  scoreRef.current += 1000;
                  setScore(scoreRef.current);
                }
              }
            } else {
              die();
              return;
            }
          }

          setBossState({
            x: bossXRef.current,
            gapY: bossGapYRef.current,
            health: bossHealthRef.current,
            hitFlash: bossInsideTimerRef.current > 0 && bossInsideTimerRef.current < 0.2
          });
        }
      }

      // Partículas
      if (particlesRef.current.length > 0) {
        particlesRef.current = particlesRef.current
          .map(p => ({
            ...p,
            x: p.x + p.vx * dt,
            y: p.y + p.vy * dt,
            vy: p.vy + 400 * dt,
            life: p.life - dt,
          }))
          .filter(p => p.life > 0);
        setParticles([...particlesRef.current]);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [die, spawnExplosion]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); flap(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap]);

  const bossHealthPct = (bossState.health / BOSS_MAX_HEALTH) * 100;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden touch-none select-none bg-sky-400"
      onPointerDown={(e) => flap()}
    >
      {/* Fondo personalizado */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000"
        style={{ backgroundImage: 'url(/flappy-bg.png)', transform: (phase === 'playing' || phase === 'boss') ? 'scale(1.05)' : 'scale(1)' }}
      />

      {/* Pipes (Gastos) */}
      {pipes.map(p => (
        <React.Fragment key={p.id}>
          <div className="absolute bg-rose-600 border-x-4 border-rose-800 rounded-b-3xl shadow-lg" style={{ left: p.x, top: 0, width: PIPE_WIDTH, height: p.gapY }}>
            <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-black text-rose-200 uppercase tracking-tighter">GASTO</div>
          </div>
          <div className="absolute bg-rose-600 border-x-4 border-rose-800 rounded-t-3xl shadow-lg" style={{ left: p.x, top: p.gapY + p.gapHeight, width: PIPE_WIDTH, height: 1000 }}>
            <div className="absolute top-4 left-0 right-0 text-center text-[10px] font-black text-rose-200 uppercase tracking-tighter">DEUDA</div>
          </div>
        </React.Fragment>
      ))}

      {/* Jefe Final (Monstruo de las Deudas) */}
      {phase === "boss" && (
        <div className="absolute z-20" style={{ left: bossState.x, top: 0, width: BOSS_WIDTH, height: '100%' }}>
          <div className={cn("absolute top-0 w-full rounded-b-[3rem] border-4 border-black/20 flex items-end justify-center pb-4 transition-colors", bossState.hitFlash ? "bg-white" : "bg-slate-900")} style={{ height: bossState.gapY }}>
             <span className="text-4xl">👹</span>
          </div>
          <div className={cn("absolute w-full rounded-t-[3rem] border-4 border-black/20 flex items-start justify-center pt-4 transition-colors", bossState.hitFlash ? "bg-white" : "bg-slate-900")} style={{ top: bossState.gapY + BOSS_GAP_HEIGHT, height: 1000 }}>
             <span className="text-4xl">💀</span>
          </div>
        </div>
      )}

      {/* HUD Superior */}
      <div className="absolute top-16 left-0 right-0 p-4 flex justify-between items-start z-30 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-white">
          <p className="text-[10px] font-black uppercase opacity-60">Puntos</p>
          <p className="text-2xl font-black">{score}</p>
        </div>

        {phase === "boss" ? (
          <div className="flex-1 max-w-[200px] mx-4 space-y-1">
            <p className="text-[10px] font-black text-white text-center uppercase tracking-widest">JEFE: DEUDA TOTAL</p>
            <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/20">
              <motion.div className="h-full bg-rose-500" animate={{ width: `${bossHealthPct}%` }} />
            </div>
          </div>
        ) : (
          <div className="bg-indigo-600 px-4 py-2 rounded-2xl border border-white/20 text-white text-center">
            <p className="text-[10px] font-black uppercase opacity-60">Nivel</p>
            <p className="text-xl font-black">{level} / 3</p>
          </div>
        )}
      </div>

      {/* El Cerdito */}
      <motion.div
        className="absolute z-30"
        style={{ 
          top: birdY, 
          left: `${BIRD_X}%`, 
          width: BIRD_SIZE, 
          height: BIRD_SIZE, 
          marginLeft: -BIRD_SIZE/2, 
          marginTop: -BIRD_SIZE/2,
          rotate: birdAngle 
        }}
      >
        <img src={pigMascot} className="w-full h-full object-contain drop-shadow-2xl" />
      </motion.div>

      {/* Partículas */}
      {particles.map(p => (
        <div key={p.id} className="absolute z-40 text-xl pointer-events-none" style={{ left: p.x, top: p.y, opacity: p.life }}>
          {p.emoji}
        </div>
      ))}

      {/* Overlays de Estado */}
      <AnimatePresence>
        {phase === "idle" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center text-white">
            <img src={pigMascot} className="h-24 w-24 mb-6 animate-bounce" />
            <h2 className="text-5xl font-black tracking-tighter mb-2">FLAPPY OINK</h2>
            <p className="text-sm font-medium mb-8 opacity-80 max-w-[280px]">Toca para saltar. Cruza los 3 niveles de gastos y vence al Jefe de las Deudas.</p>
            <Button onClick={(e) => flap(e)} className="h-16 px-12 rounded-full bg-white text-indigo-900 font-black text-xl shadow-2xl active:scale-95 transition-transform">¡EMPEZAR! 🚀</Button>
          </motion.div>
        )}

        {phase === "transition" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 text-center">
            <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-6">
              <div className="h-20 w-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto text-white">
                <Zap className="h-10 w-10 fill-current" />
              </div>
              <h2 className="text-3xl font-black text-slate-900">¡NIVEL {level} LISTO!</h2>
              <p className="text-slate-500 font-bold">
                {level < 3 ? "Prepárate para el siguiente reto." : "¡ATENCIÓN! El Jefe de las Deudas se aproxima."}
              </p>
              <Button onClick={(e) => flap(e)} className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-black active:scale-95 transition-transform">CONTINUAR ➔</Button>
            </div>
          </motion.div>
        )}

        {phase === "gameover" && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 z-50 bg-rose-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center text-white">
            <Trophy className="h-16 w-16 text-yellow-400 mb-4" />
            <h2 className="text-4xl font-black tracking-tighter">¡BANCARROTA!</h2>
            <div className="bg-white/10 px-8 py-4 rounded-3xl my-6 border border-white/10">
              <p className="text-[10px] font-black uppercase text-white/50 mb-1">Tu Puntuación</p>
              <p className="text-5xl font-black">{score}</p>
            </div>

            {gameOverTip && (
              <div className="bg-indigo-600/40 p-5 rounded-[2rem] mb-8 max-w-xs border border-white/10">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-yellow-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Consejo Oinkash</span>
                </div>
                <p className="text-sm font-bold italic leading-tight">"{gameOverTip.text}"</p>
              </div>
            )}

            <Button onClick={(e) => flap(e)} className="h-14 px-10 rounded-full bg-white text-slate-900 font-black text-lg shadow-xl flex gap-3 active:scale-95 transition-transform">
              <RefreshCw className="h-5 w-5" /> REINTENTAR
            </Button>
          </motion.div>
        )}

        {phase === "win" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-indigo-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center text-white">
            <div className="relative">
              <Sparkles className="absolute -top-10 -right-10 h-20 w-20 text-yellow-400 animate-pulse" />
              <Trophy className="h-32 w-32 text-yellow-400 mb-6" />
            </div>
            <h2 className="text-5xl font-black tracking-tighter mb-2">¡VICTORIA TOTAL!</h2>
            <p className="text-xl font-bold text-indigo-200 mb-8">Venciste al Monstruo de las Deudas.</p>
            <div className="bg-white/10 px-12 py-6 rounded-[2.5rem] border border-white/20 mb-8">
              <p className="text-sm font-black uppercase opacity-60">Puntaje Final Maestro</p>
              <p className="text-6xl font-black">{score}</p>
            </div>
            <Button onClick={(e) => flap(e)} className="h-16 px-12 rounded-full bg-emerald-500 text-white font-black text-xl shadow-2xl active:scale-95 transition-transform">¡SOY UN CRACK! 🐷</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
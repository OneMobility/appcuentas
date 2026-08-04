"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RefreshCw, Lightbulb, Sparkles, Zap, Flag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRandomTip, OinkashTip } from "@/utils/oinkash-tips";

/**
 * 🐷 PIG FLAP — Versión Final con Reinicio Corregido
 */

const pigMascot = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/ChatGPT%20Image%204%20ago%202026,%2003_46_40%20p.m..png";

// ---------- Config física ----------
const BIRD_X = 25; 
const BIRD_SIZE = 55; 
const GRAVITY = 1100; 
const FLAP_VELOCITY = -380; 
const MAX_FALL_SPEED = 700; 

// ---------- Config niveles ----------
const PIPES_PER_LEVEL = 15; 
const LEVELS = [
  { speed: 200, gapHeight: 230, spacing: 380 }, 
  { speed: 260, gapHeight: 200, spacing: 340 }, 
  { speed: 330, gapHeight: 170, spacing: 300 }, 
];
const PIPE_WIDTH = 65; 

// ---------- Config jefe ----------
const BOSS_WIDTH = 120; 
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
  const [pipesPassed, setPipesPassed] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  // Refs de estado real para la lógica de física (Evita lag de estado de React)
  const birdYRef = useRef(300);
  const birdVelRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const nextPipeIdRef = useRef(0);
  const spawnAccRef = useRef(0);
  const pipesPassedRef = useRef(0);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");

  const bossXRef = useRef(2000);
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
    // 1. Detener cualquier animación previa
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    // 2. Limpiar todos los valores lógicos en las REFS
    const containerH = containerRef.current?.offsetHeight || 600;
    birdYRef.current = containerH / 2;
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
    phaseRef.current = "idle";

    // 3. Limpiar los estados de React para la UI
    setBirdY(birdYRef.current);
    setBirdAngle(0);
    setPipes([]);
    setScore(0);
    setLevel(1);
    setPipesPassed(0);
    setGameOverTip(null);
    setPhase("idle");
    setParticles([]);
    
    // Reiniciar el loop principal
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const die = useCallback(() => {
    if (phaseRef.current === "gameover") return;
    
    setPhase("gameover");
    phaseRef.current = "gameover";
    setGameOverTip(getRandomTip());
    playSound(audioEndRef.current);
    
    if (scoreRef.current > best) {
      setBest(scoreRef.current);
      localStorage.setItem("oinkash_flap_best", scoreRef.current.toString());
    }
  }, [best]);

  const flap = useCallback(() => {
    // Si estamos en pantallas de fin, el botón se encarga del resetRun, no el flap global
    if (phaseRef.current === "gameover" || phaseRef.current === "win") return;
    
    if (phaseRef.current === "idle") {
      setPhase("playing");
      phaseRef.current = "playing";
      birdVelRef.current = FLAP_VELOCITY;
      return;
    }

    if (phaseRef.current === "playing" || phaseRef.current === "boss") {
      birdVelRef.current = FLAP_VELOCITY;
    }

    if (phaseRef.current === "transition") {
      pipesPassedRef.current = 0;
      setPipesPassed(0);
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
    }
  }, []);

  const tick = useCallback((now: number) => {
    const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
    lastTimeRef.current = now;

    if (phaseRef.current === "playing" || phaseRef.current === "boss") {
      const height = containerRef.current?.offsetHeight || 600;
      const width = containerRef.current?.offsetWidth || 400;

      // Gravedad
      birdVelRef.current = Math.min(MAX_FALL_SPEED, birdVelRef.current + GRAVITY * dt);
      birdYRef.current += birdVelRef.current * dt;
      
      // Colisión suelo/techo
      if (birdYRef.current < 0 || birdYRef.current > height) {
        die();
        // Seguimos para que se actualice la posición visual una última vez
      }

      setBirdY(birdYRef.current);
      setBirdAngle(Math.max(-25, Math.min(70, birdVelRef.current * 0.15)));

      // Lógica de Niveles (Tubos)
      if (phaseRef.current === "playing") {
        const cfg = LEVELS[levelRef.current - 1];
        spawnAccRef.current += dt * 1000;
        
        if (spawnAccRef.current >= (cfg.spacing / cfg.speed) * 1000) {
          spawnAccRef.current = 0;
          const margin = 80;
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
          const birdWorldX = (BIRD_X / 100) * width;
          const birdLeft = birdWorldX - 18;
          const birdRight = birdWorldX + 18;
          
          if (pipe.x < birdRight && pipe.x + PIPE_WIDTH > birdLeft) {
            const birdTop = birdYRef.current - 18;
            const birdBottom = birdYRef.current + 18;
            
            if (birdTop < pipe.gapY || birdBottom > pipe.gapY + pipe.gapHeight) {
              die();
            }
          }

          if (!pipe.passed && pipe.x < birdLeft) {
            pipe.passed = true;
            pipesPassedRef.current += 1;
            setPipesPassed(pipesPassedRef.current);
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
      } 
      
      // Lógica de Jefe
      else if (phaseRef.current === "boss") {
        const width = containerRef.current?.offsetWidth || 400;
        const targetX = width * (BOSS_REST_X_PCT / 100);
        
        if (!bossRestedRef.current) {
          bossXRef.current -= BOSS_ENTER_SPEED * dt;
          if (bossXRef.current <= targetX) bossRestedRef.current = true;
        } else {
          bossTimeRef.current += dt;
        }

        const amplitude = (height - BOSS_GAP_HEIGHT) / 2 - 50;
        bossGapYRef.current = (height / 2 - BOSS_GAP_HEIGHT / 2) + Math.sin(bossTimeRef.current * 1.5) * amplitude;

        const birdWorldX = (BIRD_X / 100) * width;
        if (birdWorldX > bossXRef.current && birdWorldX < bossXRef.current + BOSS_WIDTH) {
          if (birdYRef.current > bossGapYRef.current && birdYRef.current < birdYRef.current + BOSS_GAP_HEIGHT) {
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
  }, [die, spawnExplosion]);

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

  const bossHealthPct = (bossState.health / BOSS_MAX_HEALTH) * 100;
  const levelProgress = Math.min(100, (pipesPassed / PIPES_PER_LEVEL) * 100);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden touch-none select-none bg-sky-400"
      onPointerDown={flap}
    >
      {/* Fondo inmersivo */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000"
        style={{ 
          backgroundImage: 'url(/flappy-bg.png)', 
          transform: (phase === 'playing' || phase === 'boss') ? 'scale(1.1)' : 'scale(1)',
          filter: (phase === 'gameover') ? 'grayscale(0.5) brightness(0.5)' : 'none'
        }}
      />

      {/* Tubos */}
      {pipes.map(p => (
        <React.Fragment key={p.id}>
          <div className="absolute bg-rose-600 border-x-4 border-rose-800 rounded-b-3xl shadow-lg z-10" style={{ left: p.x, top: 0, width: PIPE_WIDTH, height: p.gapY }}>
            <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-black text-rose-200 uppercase tracking-tighter">GASTO</div>
          </div>
          <div className="absolute bg-rose-600 border-x-4 border-rose-800 rounded-t-3xl shadow-lg z-10" style={{ left: p.x, top: p.gapY + p.gapHeight, width: PIPE_WIDTH, height: 1000 }}>
            <div className="absolute top-4 left-0 right-0 text-center text-[10px] font-black text-rose-200 uppercase tracking-tighter">DEUDA</div>
          </div>
        </React.Fragment>
      ))}

      {/* Jefe */}
      {phase === "boss" && (
        <div className="absolute z-20" style={{ left: bossState.x, top: 0, width: BOSS_WIDTH, height: '100%' }}>
          <div className={cn("absolute top-0 w-full rounded-b-[3rem] border-4 border-black/20 flex items-end justify-center pb-4 transition-colors duration-100 shadow-2xl", bossState.hitFlash ? "bg-white" : "bg-slate-950")} style={{ height: bossState.gapY }}>
             <span className="text-5xl drop-shadow-lg">👹</span>
          </div>
          <div className={cn("absolute w-full rounded-t-[3rem] border-4 border-black/20 flex items-start justify-center pt-4 transition-colors duration-100 shadow-2xl", bossState.hitFlash ? "bg-white" : "bg-slate-950")} style={{ top: bossState.gapY + BOSS_GAP_HEIGHT, height: 1000 }}>
             <span className="text-5xl drop-shadow-lg">💀</span>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-16 left-0 right-0 p-4 flex flex-col gap-4 z-30 pointer-events-none">
        <div className="flex justify-between items-start">
          <div className="bg-black/50 backdrop-blur-md px-5 py-2 rounded-2xl border border-white/20 text-white shadow-xl">
            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Puntos</p>
            <p className="text-3xl font-black tracking-tight">{score}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="bg-indigo-600/90 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/20 text-white shadow-xl text-center">
              <p className="text-[10px] font-black uppercase opacity-60">Nivel</p>
              <p className="text-xl font-black">{level} / 3</p>
            </div>
            {best > 0 && <span className="text-[10px] font-black text-white bg-black/40 px-2 py-1 rounded-lg">Best: {best}</span>}
          </div>
        </div>

        {/* Barra de Meta */}
        <div className="w-full max-w-xs mx-auto space-y-1">
          <div className="flex justify-between items-center text-white text-[9px] font-black uppercase tracking-widest px-1">
            <span>Progreso</span>
            <span className="flex items-center gap-1"><Flag className="h-3 w-3 text-yellow-400" /> Meta</span>
          </div>
          <div className="h-4 w-full bg-black/30 rounded-full border border-white/20 overflow-hidden shadow-inner p-0.5">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full flex items-center justify-end px-2"
              animate={{ width: `${levelProgress}%` }}
              transition={{ type: 'spring', bounce: 0 }}
            >
               {levelProgress > 10 && <Sparkles className="h-2 w-2 text-white animate-pulse" />}
            </motion.div>
          </div>
        </div>

        {phase === "boss" && (
          <div className="w-full max-w-sm mx-auto space-y-1 pt-2">
            <p className="text-[10px] font-black text-white text-center uppercase tracking-widest drop-shadow-md">JEFE: DEUDA TOTAL 👾</p>
            <div className="h-3 w-full bg-black/60 rounded-full overflow-hidden border-2 border-rose-500 shadow-lg">
              <motion.div className="h-full bg-rose-500" animate={{ width: `${bossHealthPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Personaje */}
      <motion.div
        className="absolute z-40 pointer-events-none"
        animate={{ top: birdY, rotate: birdAngle }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{ left: `${BIRD_X}%`, width: BIRD_SIZE, height: BIRD_SIZE, marginLeft: -BIRD_SIZE/2, marginTop: -BIRD_SIZE/2 }}
      >
        <img src={pigMascot} className="w-full h-full object-contain drop-shadow-2xl" />
      </motion.div>

      {/* Partículas */}
      {particles.map(p => (
        <div key={p.id} className="absolute z-[45] text-2xl pointer-events-none drop-shadow-lg" style={{ left: p.x, top: p.y, opacity: p.life }}>
          {p.emoji}
        </div>
      ))}

      {/* Pantallas de Estado */}
      <AnimatePresence>
        {phase === "idle" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center text-white">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
              <img src={pigMascot} className="h-32 w-32 object-contain relative z-10 animate-bounce" />
            </div>
            <h2 className="text-5xl font-black tracking-tighter mb-2 drop-shadow-2xl text-white">PIG FLAP</h2>
            <p className="text-base font-bold mb-10 opacity-90 max-w-[300px] leading-tight text-white">
              Toca para saltar. Esquiva los gastos y <span className="text-emerald-400">¡llega a la meta de ahorro!</span>
            </p>
            <div className="space-y-4">
               <Button onClick={flap} className="h-16 px-12 rounded-full bg-white text-indigo-900 font-black text-xl shadow-2xl hover:scale-105 active:scale-95 transition-transform group pointer-events-auto">
                 ¡VOLAR AHORA! <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
               </Button>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">O usa la tecla Espacio</p>
            </div>
          </motion.div>
        )}

        {phase === "transition" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 text-center bg-black/40 backdrop-blur-sm pointer-events-auto">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl space-y-6 border-4 border-indigo-100">
              <div className="h-24 w-24 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto text-white shadow-lg shadow-emerald-200">
                <Zap className="h-12 w-12 fill-current" />
              </div>
              <div className="space-y-1">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">¡NIVEL {level} SUPERADO!</h2>
                <p className="text-lg text-slate-500 font-bold">Meta alcanzada.</p>
              </div>
              <Button onClick={flap} className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg shadow-xl shadow-indigo-100">
                SIGUIENTE NIVEL 🚀
              </Button>
            </div>
          </motion.div>
        )}

        {phase === "gameover" && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 z-50 bg-rose-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center text-white overflow-y-auto pointer-events-auto">
            <Trophy className="h-20 w-20 text-yellow-400 mb-4 drop-shadow-xl" />
            <h2 className="text-4xl font-black tracking-tighter">¡BANCARROTA! 💸</h2>
            <div className="bg-white/10 px-10 py-6 rounded-[2.5rem] my-8 border border-white/10 shadow-2xl">
              <p className="text-[10px] font-black uppercase text-white/50 mb-1 tracking-widest">Ahorro Acumulado</p>
              <p className="text-6xl font-black text-white">{score}</p>
            </div>

            {gameOverTip && (
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-indigo-600/40 p-6 rounded-[2rem] mb-10 max-w-xs border border-white/10 shadow-lg">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Lightbulb className="h-5 w-5 text-yellow-400" />
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-100">Consejo Oinkash</span>
                </div>
                <p className="text-sm font-bold italic leading-tight text-white/90">"{gameOverTip.text}"</p>
              </motion.div>
            )}

            <Button 
              onClick={(e) => { e.stopPropagation(); resetRun(); }} 
              className="h-16 px-12 rounded-full bg-white text-slate-900 font-black text-xl shadow-2xl flex gap-3 hover:scale-105 active:scale-95 transition-transform"
            >
              <RefreshCw className="h-6 w-6" /> REINTENTAR
            </Button>
          </motion.div>
        )}

        {phase === "win" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-indigo-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center text-white pointer-events-auto">
            <div className="relative mb-6">
              <Sparkles className="absolute -top-10 -right-10 h-24 w-24 text-yellow-400 animate-pulse" />
              <Trophy className="h-40 w-40 text-yellow-400 drop-shadow-2xl" />
            </div>
            <h2 className="text-5xl font-black tracking-tighter mb-4">¡LIBERTAD FINANCIERA! 🏆</h2>
            <div className="bg-white/10 px-12 py-8 rounded-[3rem] border border-white/20 mb-10 shadow-2xl">
              <p className="text-sm font-black uppercase opacity-60 tracking-widest">Puntaje Maestro</p>
              <p className="text-7xl font-black text-emerald-400">{score}</p>
            </div>
            <Button onClick={resetRun} className="h-16 px-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-2xl shadow-2xl">
              ¡SOY UN CRACK! 🐷
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
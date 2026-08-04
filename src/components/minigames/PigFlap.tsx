"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RefreshCw, Lightbulb, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRandomTip, OinkashTip } from "@/utils/oinkash-tips";

/**
 * 🐷 PIG FLAP — Versión Inmersiva con Personaje del Usuario
 */

// Personaje correcto para Flappy Oink
const PIG_MASCOT = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/ChatGPT%20Image%204%20ago%202026,%2003_46_40%20p.m..png";

const BIRD_X = 25; 
const BIRD_SIZE = 85; 
const GRAVITY = 1100; 
const FLAP_VELOCITY = -380; 
const MAX_FALL_SPEED = 700; 

const PIPES_PER_LEVEL = 12; 
const LEVELS = [
  { speed: 200, gapHeight: 220, spacing: 350 }, 
  { speed: 260, gapHeight: 190, spacing: 320 }, 
  { speed: 330, gapHeight: 160, spacing: 280 }, 
];
const PIPE_WIDTH = 60; 

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

export default function PigFlap() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [birdY, setBirdY] = useState(300);
  const [birdAngle, setBirdAngle] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [bossState, setBossState] = useState({
    x: 1000, gapY: 300, health: BOSS_MAX_HEALTH, hitFlash: false,
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
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
  };

  const die = useCallback(() => {
    setPhase("gameover");
    phaseRef.current = "gameover";
    setGameOverTip(getRandomTip());
    playSound(audioEndRef.current);
    if (scoreRef.current > best) {
      setBest(scoreRef.current);
      localStorage.setItem("oinkash_flap_best", scoreRef.current.toString());
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [best]);

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
    bossRestedRef.current = false;
    particlesRef.current = [];
    lastTimeRef.current = 0; // Reinicio crítico para el tick

    setBirdY(startY);
    setBirdAngle(0);
    setPipes([]);
    setScore(0);
    setLevel(1);
    setPhase("playing");
    phaseRef.current = "playing";
  }, []);

  const flap = useCallback((e?: any) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (phaseRef.current === "idle" || phaseRef.current === "gameover" || phaseRef.current === "win") {
      resetRun();
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
      lastTimeRef.current = 0;
    }
  }, [resetRun]);

  useEffect(() => {
    const tick = (now: number) => {
      if (phaseRef.current !== "playing" && phaseRef.current !== "boss") {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTimeRef.current === 0) {
        lastTimeRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      const height = containerRef.current?.offsetHeight || 600;
      const width = containerRef.current?.offsetWidth || 400;

      birdVelRef.current = Math.min(MAX_FALL_SPEED, birdVelRef.current + GRAVITY * dt);
      birdYRef.current += birdVelRef.current * dt;
      
      if (birdYRef.current < -100 || birdYRef.current > height + 100) { die(); return; }

      setBirdY(birdYRef.current);
      setBirdAngle(Math.max(-25, Math.min(70, birdVelRef.current * 0.1)));

      if (phaseRef.current === "playing") {
        const cfg = LEVELS[levelRef.current - 1];
        spawnAccRef.current += dt * 1000;
        if (spawnAccRef.current >= (cfg.spacing / cfg.speed) * 1000) {
          spawnAccRef.current = 0;
          pipesRef.current.push({
            id: nextPipeIdRef.current++,
            x: width + 100,
            gapY: 100 + Math.random() * (height - 200 - cfg.gapHeight),
            gapHeight: cfg.gapHeight,
            passed: false,
          });
        }

        const birdXPos = (BIRD_X / 100) * width;
        pipesRef.current = pipesRef.current.map(p => {
          p.x -= cfg.speed * dt;
          if (p.x < birdXPos + 20 && p.x + PIPE_WIDTH > birdXPos - 20) {
            if (birdYRef.current < p.gapY || birdYRef.current > p.gapY + p.gapHeight) { die(); }
          }
          if (!p.passed && p.x < birdXPos) {
            p.passed = true;
            pipesPassedRef.current += 1;
            scoreRef.current += 10;
            setScore(scoreRef.current);
            playSound(audioCoinRef.current);
          }
          return p;
        }).filter(p => p.x > -100);
        setPipes([...pipesRef.current]);

        if (pipesPassedRef.current >= PIPES_PER_LEVEL) {
          setPhase("transition");
          phaseRef.current = "transition";
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [die]);

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
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400 to-sky-200" />
      {pipes.map(p => (
        <React.Fragment key={p.id}>
          <div className="absolute bg-rose-600 border-x-4 border-rose-800 rounded-b-3xl" style={{ left: p.x, top: 0, width: PIPE_WIDTH, height: p.gapY }}>
             <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-black text-rose-200">GASTO</div>
          </div>
          <div className="absolute bg-rose-600 border-x-4 border-rose-800 rounded-t-3xl" style={{ left: p.x, top: p.gapY + p.gapHeight, width: PIPE_WIDTH, height: 1200 }}>
             <div className="absolute top-4 left-0 right-0 text-center text-[10px] font-black text-rose-200">DEUDA</div>
          </div>
        </React.Fragment>
      ))}

      <div className="absolute top-16 left-0 right-0 p-4 flex justify-between items-start z-30 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl text-white">
          <p className="text-[10px] font-black uppercase opacity-60">Score</p>
          <p className="text-2xl font-black">{score}</p>
        </div>
        <div className="bg-indigo-600 px-4 py-2 rounded-2xl text-white text-center">
          <p className="text-[10px] font-black uppercase opacity-60">Nivel</p>
          <p className="text-xl font-black">{level}</p>
        </div>
      </div>

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
        <img src={PIG_MASCOT} className="w-full h-full object-contain drop-shadow-2xl" alt="Piggy" />
      </motion.div>

      <AnimatePresence>
        {phase === "idle" && (
          <motion.div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center text-white">
            <img src={PIG_MASCOT} className="h-44 w-44 mb-6 animate-bounce" />
            <h2 className="text-5xl font-black mb-8 italic">FLAPPY OINK</h2>
            <Button onClick={flap} className="h-16 px-12 rounded-full bg-white text-indigo-900 font-black text-xl">¡A VOLAR! 🚀</Button>
          </motion.div>
        )}
        {phase === "gameover" && (
          <motion.div className="absolute inset-0 z-50 bg-rose-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center text-white">
            <h2 className="text-5xl font-black mb-6 italic">¡BANCARROTA!</h2>
            <div className="bg-white/10 px-12 py-6 rounded-3xl mb-8">
              <p className="text-6xl font-black">{score}</p>
            </div>
            <Button onClick={flap} className="h-16 px-12 rounded-full bg-white text-rose-950 font-black text-xl flex gap-3">
              <RefreshCw className="h-6 w-6" /> REINTENTAR
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
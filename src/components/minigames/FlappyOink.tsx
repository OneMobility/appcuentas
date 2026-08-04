"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RefreshCw, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRandomTip, OinkashTip } from "@/utils/oinkash-tips";

const GRAVITY = 0.6;
const JUMP_STRENGTH = -8;
const PIPE_SPEED = 3.5;
const PIPE_SPAWN_RATE = 1500;
const BIRD_SIZE = 40;
const PIPE_WIDTH = 60;
const GAP_SIZE = 160;

interface Pipe {
  id: number;
  x: number;
  topHeight: number;
  passed: boolean;
}

const FlappyOink = () => {
  const [gameStarted, setBirdGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [birdY, setBirdY] = useState(250);
  const [birdVelocity, setBirdVelocity] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [gameOverTip, setGameOverTip] = useState<OinkashTip | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const lastPipeRef = useRef<number>(0);
  
  // Audio Refs
  const audioCoinRef = useRef<HTMLAudioElement | null>(null);
  const audioEndRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioCoinRef.current = new Audio("/sounds/coin.wav");
    audioEndRef.current = new Audio("/sounds/end-point.wav");
    const savedBest = localStorage.getItem("oinkash_flappy_best");
    if (savedBest) setBestScore(parseInt(savedBest));
  }, []);

  const playSound = (audio: HTMLAudioElement | null) => {
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };

  const initGame = useCallback(() => {
    setBirdY(250);
    setBirdVelocity(0);
    setPipes([]);
    setScore(0);
    setGameOver(false);
    setBirdGameStarted(false);
    setGameOverTip(null);
  }, []);

  const handleJump = useCallback(() => {
    if (gameOver) return;
    if (!gameStarted) setBirdGameStarted(true);
    setBirdVelocity(JUMP_STRENGTH);
  }, [gameStarted, gameOver]);

  const updateGame = useCallback(() => {
    if (!gameStarted || gameOver) return;

    setBirdY((y) => {
      const newY = y + birdVelocity;
      if (newY < 0 || newY > 560) {
        onGameOver();
        return y;
      }
      return newY;
    });
    setBirdVelocity((v) => v + GRAVITY);

    setPipes((currentPipes) => {
      let nextPipes = currentPipes
        .map((p) => ({ ...p, x: p.x - PIPE_SPEED }))
        .filter((p) => p.x > -PIPE_WIDTH);

      // Spawn new pipe
      const now = Date.now();
      if (now - lastPipeRef.current > PIPE_SPAWN_RATE) {
        const topHeight = Math.random() * (400 - 100) + 50;
        nextPipes.push({ id: now, x: 400, topHeight, passed: false });
        lastPipeRef.current = now;
      }

      // Check collisions and scoring
      nextPipes = nextPipes.map((p) => {
        const birdX = 50; // Visual X offset
        const birdRight = birdX + BIRD_SIZE - 10;
        const birdLeft = birdX + 10;
        const pipeRight = p.x + PIPE_WIDTH;
        const pipeLeft = p.x;

        // Collision logic
        if (birdRight > pipeLeft && birdLeft < pipeRight) {
          if (birdY < p.topHeight || birdY + BIRD_SIZE > p.topHeight + GAP_SIZE) {
            onGameOver();
          }
        }

        // Score logic
        if (!p.passed && p.x + PIPE_WIDTH < birdX) {
          setScore((s) => {
            const newScore = s + 1;
            if (newScore > bestScore) {
              setBestScore(newScore);
              localStorage.setItem("oinkash_flappy_best", newScore.toString());
            }
            playSound(audioCoinRef.current);
            return newScore;
          });
          return { ...p, passed: true };
        }
        return p;
      });

      return nextPipes;
    });

    requestRef.current = requestAnimationFrame(updateGame);
  }, [gameStarted, gameOver, birdVelocity, birdY, bestScore]);

  const onGameOver = () => {
    setGameOver(true);
    setGameOverTip(getRandomTip());
    playSound(audioEndRef.current);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  };

  useEffect(() => {
    if (gameStarted && !gameOver) {
      requestRef.current = requestAnimationFrame(updateGame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameStarted, gameOver, updateGame]);

  return (
    <div 
      className="w-full h-full bg-sky-400 relative overflow-hidden touch-none select-none flex flex-col items-center justify-center"
      onPointerDown={handleJump}
    >
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-10 h-10 w-20 bg-white rounded-full blur-xl" />
        <div className="absolute top-40 right-20 h-14 w-32 bg-white rounded-full blur-2xl" />
        <div className="absolute bottom-10 left-1/4 h-8 w-24 bg-white rounded-full blur-lg" />
      </div>

      <div 
        className="relative w-full max-w-[400px] h-[600px] bg-sky-300/30 rounded-[3rem] border-8 border-white/20 overflow-hidden shadow-2xl"
        ref={containerRef}
      >
        {/* Score Display */}
        <div className="absolute top-8 left-0 right-0 z-20 flex flex-col items-center pointer-events-none">
          <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Ahorro Actual</p>
          <p className="text-5xl font-black text-white drop-shadow-lg">{score}</p>
        </div>

        {/* Bird (Oink) */}
        <motion.div
          className="absolute z-30"
          style={{ 
            top: birdY, 
            left: 50, 
            width: BIRD_SIZE, 
            height: BIRD_SIZE,
            rotate: birdVelocity * 3
          }}
        >
          <img src="/game-character.png" alt="Oink" className="w-full h-full object-contain drop-shadow-md" />
        </motion.div>

        {/* Pipes */}
        {pipes.map((p) => (
          <React.Fragment key={p.id}>
            {/* Top Pipe */}
            <div 
              className="absolute bg-rose-500 border-x-4 border-b-8 border-rose-700 rounded-b-2xl z-10"
              style={{ left: p.x, top: 0, width: PIPE_WIDTH, height: p.topHeight }}
            >
              <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-black text-rose-200 uppercase">Gasto</div>
            </div>
            {/* Bottom Pipe */}
            <div 
              className="absolute bg-rose-500 border-x-4 border-t-8 border-rose-700 rounded-t-2xl z-10"
              style={{ left: p.x, top: p.topHeight + GAP_SIZE, width: PIPE_WIDTH, height: 600 - (p.topHeight + GAP_SIZE) }}
            >
               <div className="absolute top-2 left-0 right-0 text-center text-[10px] font-black text-rose-200 uppercase">Deuda</div>
            </div>
          </React.Fragment>
        ))}

        {/* UI Overlay */}
        <AnimatePresence>
          {!gameStarted && !gameOver && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-40 bg-indigo-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center text-white">
              <img src="/game-character.png" className="h-24 w-24 mb-6 animate-bounce" />
              <h2 className="text-4xl font-black tracking-tighter mb-2">FLAPPY OINK</h2>
              <p className="text-sm font-medium mb-8 opacity-80">Toca para saltar y esquivar las deudas. ¡Mantén tus ahorros a salvo!</p>
              <div className="bg-white/10 px-6 py-2 rounded-full mb-8">
                <p className="text-[10px] font-black uppercase text-indigo-200">Mejor Puntuación: {bestScore}</p>
              </div>
              <Button className="h-16 px-12 rounded-full bg-white text-indigo-900 font-black text-xl">¡A VOLAR! 🚀</Button>
            </motion.div>
          )}

          {gameOver && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 z-50 bg-rose-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
              <Trophy className="h-16 w-16 text-yellow-400 mb-4" />
              <h2 className="text-3xl font-black tracking-tighter mb-1">¡UPS! BANCARROTA</h2>
              <div className="bg-white/10 px-8 py-4 rounded-3xl mb-6 border border-white/10">
                <p className="text-[10px] font-black uppercase text-white/50 mb-1">Puntuación</p>
                <p className="text-4xl font-black">{score}</p>
              </div>

              {gameOverTip && (
                <div className="bg-indigo-600/30 border border-indigo-500/30 p-4 rounded-3xl mb-8 max-w-xs">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-yellow-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Consejo Oinkash</span>
                  </div>
                  <p className="text-sm font-bold italic leading-tight text-indigo-50">"{gameOverTip.text}"</p>
                </div>
              )}

              <Button onClick={initGame} className="h-14 px-10 rounded-full bg-white text-slate-900 font-black text-lg shadow-xl flex gap-3">
                <RefreshCw className="h-5 w-5" /> REINTENTAR
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-8 text-white/40 text-[10px] font-black uppercase tracking-widest">Usa el mouse o toca la pantalla</p>
    </div>
  );
};

export default FlappyOink;
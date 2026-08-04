"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, Play, RefreshCw, AlertTriangle } from "lucide-react";

const COCHINITO_IMG = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/Cochinito%20Ahorro.png";

const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const GROUND_Y = 150;
const PIG_X = 50;
const OBSTACLE_SPEED_START = 5;

const PiggyRunner = () => {
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'gameover'>('waiting');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [pigY, setPigY] = useState(GROUND_Y);
  const [velocity, setVelocity] = useState(0);
  const [obstacles, setObstacles] = useState<{ id: number; x: number; type: string }[]>([]);
  
  const gameRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const obstacleTimerRef = useRef<number>(0);

  const jump = useCallback(() => {
    if (gameState === 'playing' && pigY === GROUND_Y) {
      setVelocity(JUMP_FORCE);
    } else if (gameState === 'waiting' || gameState === 'gameover') {
      startGame();
    }
  }, [gameState, pigY]);

  const startGame = () => {
    setScore(0);
    setPigY(GROUND_Y);
    setVelocity(0);
    setObstacles([]);
    setGameState('playing');
    obstacleTimerRef.current = 0;
  };

  const update = (time: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = time;
    }
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    if (gameState === 'playing') {
      setPigY(prevY => {
        const nextY = prevY + velocity;
        if (nextY >= GROUND_Y) {
          setVelocity(0);
          return GROUND_Y;
        }
        setVelocity(v => v + GRAVITY);
        return nextY;
      });

      setObstacles(prev => {
        const speed = OBSTACLE_SPEED_START + (score / 500);
        const next = prev
          .map(obs => ({ ...obs, x: obs.x - speed }))
          .filter(obs => obs.x > -50);

        obstacleTimerRef.current += deltaTime;
        if (obstacleTimerRef.current > (1500 + Math.random() * 2000)) {
          obstacleTimerRef.current = 0;
          next.push({ id: Date.now(), x: 400, type: 'gasto' });
        }

        const pigRect = { left: PIG_X + 10, right: PIG_X + 50, top: pigY + 10, bottom: pigY + 50 };
        for (const obs of next) {
          const obsRect = { left: obs.x + 5, right: obs.x + 35, top: GROUND_Y + 15, bottom: GROUND_Y + 50 };
          
          if (
            pigRect.right > obsRect.left &&
            pigRect.left < obsRect.right &&
            pigRect.bottom > obsRect.top
          ) {
            setGameState('gameover');
            if (score > highScore) setHighScore(score);
          }
        }

        return next;
      });

      setScore(s => s + 1);
    }

    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, velocity, pigY, score]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  return (
    <div className="flex flex-col items-center gap-6 p-4 w-full h-full" onClick={jump}>
      <div className="w-full flex justify-between px-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-slate-400">Score</span>
          <span className="text-2xl font-black text-slate-900">{Math.floor(score / 10)}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1 justify-end">
            <Trophy className="h-3 w-3" /> Record
          </span>
          <span className="text-2xl font-black text-slate-900">{Math.floor(highScore / 10)}</span>
        </div>
      </div>

      <div 
        ref={gameRef}
        className="relative w-full h-[250px] bg-slate-50 rounded-[2rem] border-2 border-slate-100 overflow-hidden cursor-pointer shadow-inner"
      >
        <div className="absolute top-10 left-10 opacity-20"><div className="h-4 w-12 bg-white rounded-full" /></div>
        <div className="absolute top-20 right-20 opacity-20"><div className="h-4 w-16 bg-white rounded-full" /></div>

        <div className="absolute bottom-[20px] left-0 right-0 h-0.5 bg-slate-200" />

        <motion.div
          style={{ left: PIG_X, top: pigY }}
          className="absolute w-12 h-12"
        >
          <img src={COCHINITO_IMG} alt="Pig" className="w-full h-full object-contain drop-shadow-md" />
        </motion.div>

        {obstacles.map(obs => (
          <div
            key={obs.id}
            style={{ left: obs.x, top: GROUND_Y + 10 }}
            className="absolute flex flex-col items-center"
          >
            <div className="bg-rose-500 p-1.5 rounded-lg shadow-lg">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <span className="text-[8px] font-black text-rose-600 uppercase mt-1">Gasto</span>
          </div>
        ))}

        <AnimatePresence>
          {gameState === 'waiting' && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-indigo-600/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
            >
              <Play className="h-12 w-12 text-white mb-4 animate-pulse" />
              <h3 className="text-xl font-black text-white">Piggy Run</h3>
              <p className="text-white/80 text-xs font-medium mt-2">Salta sobre los gastos hormiga para proteger tu ahorro.</p>
              <p className="text-white/40 text-[10px] font-bold uppercase mt-6 tracking-widest">Toca en cualquier parte para empezar</p>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6"
            >
              <h3 className="text-3xl font-black text-rose-500 tracking-tighter">¡OUCH! 🐷</h3>
              <p className="text-slate-500 font-bold text-sm mt-1">Un gasto hormiga te atrapó.</p>
              <div className="my-6 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Ahorro conseguido</span>
                <span className="text-2xl font-black text-slate-900">${Math.floor(score / 10)}</span>
              </div>
              <Button onClick={(e) => { e.stopPropagation(); startGame(); }} className="rounded-2xl h-14 px-8 bg-indigo-600 font-black gap-2 shadow-xl shadow-indigo-100">
                <RefreshCw className="h-5 w-5" /> Reintentar
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
        Toca cualquier parte de la pantalla para saltar
      </div>
    </div>
  );
};

export default PiggyRunner;
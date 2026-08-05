"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, RefreshCw, Smartphone, Keyboard, Flame, Sparkles, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRandomTip, OinkashTip } from "@/utils/oinkash-tips";

// Niveles del juego
const TIERS: Record<number, { label: string; emoji: string; color: string; text: string; message?: string }> = {
  2: { label: "$1", emoji: "🪙", color: "bg-yellow-400", text: "text-yellow-950" },
  4: { label: "$2", emoji: "💰", color: "bg-pink-500", text: "text-white" },
  8: { label: "$5", emoji: "💵", color: "bg-blue-500", text: "text-white" },
  16: { label: "$10", emoji: "💸", color: "bg-green-500", text: "text-white" },
  32: { label: "$20", emoji: "🐖", color: "bg-purple-600", text: "text-white" },
  64: { label: "$50", emoji: "🐷", color: "bg-rose-500", text: "text-white" },
  128: { label: "$100", emoji: "🏦", color: "bg-indigo-600", text: "text-white" },
  256: { label: "$200", emoji: "🏛️", color: "bg-teal-500", text: "text-white" },
  512: { label: "$500", emoji: "💎", color: "bg-orange-500", text: "text-white" },
  1024: { label: "$1k", emoji: "👑", color: "bg-pink-600", text: "text-white", message: "¡GENIAL!" },
  2048: { label: "$2k", emoji: "🏆", color: "bg-yellow-500", text: "text-yellow-950", message: "¡EXCELENTE!" },
  4096: { label: "META", emoji: "🔥", color: "bg-orange-600", text: "text-white", message: "¡ESTÁ QUE ARDE!" },
};

const GRID_SIZE = 4;

const PigMerge = () => {
  const [board, setBoard] = useState<(number | null)[][]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [achievement, setAchievement] = useState<string | null>(null);
  const [gameOverTip, setGameOverTip] = useState<OinkashTip | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  
  // Refs de Audio
  const audioEndRef = useRef<HTMLAudioElement | null>(null);
  const audioAchievementRef = useRef<HTMLAudioElement | null>(null);
  const audioTipRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioEndRef.current = new Audio("/sounds/end-point.wav");
    audioAchievementRef.current = new Audio("/sounds/achievement.mp3");
    audioTipRef.current = new Audio("/sounds/tip.mp3");
    
    const savedBest = localStorage.getItem("oinkash_pigmerge_best");
    if (savedBest) setBestScore(parseInt(savedBest));
  }, []);

  const playSound = (audio: HTMLAudioElement | null) => {
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.warn("Audio play blocked", e));
    }
  };

  const initGame = useCallback(() => {
    let newBoard = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    newBoard = addRandomTile(addRandomTile(newBoard));
    setBoard(newBoard);
    setScore(0);
    setGameOver(false);
    setAchievement(null);
    setGameOverTip(null);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem("oinkash_pigmerge_best", score.toString());
    }
  }, [score, bestScore]);

  const addRandomTile = (currentBoard: (number | null)[][]) => {
    const emptyCells = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (currentBoard[r][c] === null) emptyCells.push({ r, c });
      }
    }
    if (emptyCells.length === 0) return currentBoard;
    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const newBoard = currentBoard.map(row => [...row]);
    newBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
    return newBoard;
  };

  const onGameOver = useCallback(() => {
    setGameOver(true);
    setGameOverTip(getRandomTip());
    playSound(audioEndRef.current);
    playSound(audioTipRef.current);
  }, []);

  const move = useCallback((direction: "up" | "down" | "left" | "right") => {
    if (gameOver) return;

    setBoard(prevBoard => {
      let newBoard = prevBoard.map(row => [...row]);
      let moved = false;
      let pointsGained = 0;
      let highestMerged = 0;

      const rotateBoard = (times: number) => {
        for (let t = 0; t < times; t++) {
          const rotated = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
          for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
              rotated[c][GRID_SIZE - 1 - r] = newBoard[r][c];
            }
          }
          newBoard = rotated;
        }
      };

      if (direction === "up") rotateBoard(3);
      else if (direction === "right") rotateBoard(2);
      else if (direction === "down") rotateBoard(1);

      for (let r = 0; r < GRID_SIZE; r++) {
        let row = newBoard[r].filter(cell => cell !== null) as number[];
        for (let i = 0; i < row.length - 1; i++) {
          if (row[i] === row[i + 1]) {
            row[i] *= 2;
            pointsGained += row[i];
            highestMerged = Math.max(highestMerged, row[i]);
            row.splice(i + 1, 1);
            moved = true;
          }
        }
        while (row.length < GRID_SIZE) row.push(null as any);
        if (JSON.stringify(newBoard[r]) !== JSON.stringify(row)) moved = true;
        newBoard[r] = row;
      }

      if (direction === "up") rotateBoard(1);
      else if (direction === "right") rotateBoard(2);
      else if (direction === "down") rotateBoard(3);

      if (moved) {
        setScore(s => s + pointsGained);
        
        if (highestMerged >= 1024) {
          const msg = TIERS[highestMerged]?.message || (highestMerged > 2048 ? "¡ESTÁ QUE ARDE!" : null);
          if (msg) {
            setAchievement(msg);
            playSound(audioAchievementRef.current);
            setTimeout(() => setAchievement(null), 1500);
          }
        }

        const boardWithNew = addRandomTile(newBoard);
        if (checkGameOver(boardWithNew)) onGameOver();
        return boardWithNew;
      }
      return prevBoard;
    });
  }, [gameOver, onGameOver]);

  const checkGameOver = (currentBoard: (number | null)[][]) => {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (currentBoard[r][c] === null) return false;
        if (c < GRID_SIZE - 1 && currentBoard[r][c] === currentBoard[r][c + 1]) return false;
        if (r < GRID_SIZE - 1 && currentBoard[r][c] === currentBoard[r + 1][c]) return false;
      }
    }
    return true;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") move("up");
      if (e.key === "ArrowDown" || e.key === "s") move("down");
      if (e.key === "ArrowLeft" || e.key === "a") move("left");
      if (e.key === "ArrowRight" || e.key === "d") move("right");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  const onTouchStart = (e: React.TouchEvent | React.PointerEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    touchStart.current = { x: clientX, y: clientY };
  };

  const onTouchEnd = (e: React.TouchEvent | React.PointerEvent) => {
    if (!touchStart.current) return;
    const clientX = 'changedTouches' in e ? (e as React.TouchEvent).changedTouches[0].clientX : (e as React.PointerEvent).clientX;
    const clientY = 'changedTouches' in e ? (e as React.TouchEvent).changedTouches[0].clientY : (e as React.PointerEvent).clientY;
    
    const dx = clientX - touchStart.current.x;
    const dy = clientY - touchStart.current.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) move(dx > 0 ? "right" : "left");
    } else {
      if (Math.abs(dy) > 30) move(dy > 0 ? "down" : "up");
    }
    touchStart.current = null;
  };

  return (
    <div 
      className="w-full h-full flex flex-col bg-slate-900 p-4 md:p-10 justify-center items-center select-none overflow-hidden touch-none"
      onPointerDown={onTouchStart}
      onPointerUp={onTouchEnd}
    >
      {/* Header Integrado */}
      <div className="w-full max-w-md flex items-center justify-between mb-6 pointer-events-none">
        <div className="space-y-0.5">
          <h3 className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
            PIG MERGE <span className="text-xl animate-bounce">🐷</span>
          </h3>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Oinkash Arcade</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-center min-w-[70px]">
            <p className="text-[7px] font-black text-slate-400 uppercase">Score</p>
            <p className="text-lg font-black text-white leading-none">{score}</p>
          </div>
          <div className="bg-indigo-600 px-3 py-1.5 rounded-xl text-center min-w-[70px] text-white shadow-lg shadow-indigo-900/20">
            <p className="text-[7px] font-black opacity-60 uppercase">Best</p>
            <p className="text-lg font-black leading-none">{bestScore}</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {achievement && (
          <motion.div 
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1.2, opacity: 1, y: 0 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="absolute top-1/4 z-[120] pointer-events-none"
          >
            <div className="bg-orange-500 text-white px-8 py-3 rounded-full font-black text-2xl shadow-2xl border-4 border-white flex items-center gap-3">
              {achievement.includes("ARDE") && <Flame className="h-6 w-6 text-yellow-300 animate-pulse" />}
              {achievement}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tablero de Juego */}
      <div className="relative aspect-square w-full max-w-md bg-slate-800 p-3 rounded-[2rem] shadow-2xl border-4 border-slate-700/50">
        <div className="grid grid-cols-4 grid-rows-4 gap-2.5 h-full w-full">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="bg-slate-700/30 rounded-xl w-full h-full shadow-inner" />
          ))}
        </div>

        <div className="absolute inset-0 p-3 grid grid-cols-4 grid-rows-4 gap-2.5">
          <AnimatePresence>
            {board.map((row, r) => 
              row.map((cell, c) => cell && (
                <motion.div
                  key={`${r}-${c}-${cell}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  layout
                  className={cn(
                    "w-full h-full rounded-xl flex flex-col items-center justify-center shadow-xl border-b-4 border-black/20",
                    TIERS[cell]?.color || "bg-slate-300"
                  )}
                  style={{ gridRow: r + 1, gridColumn: c + 1 }}
                >
                  <span className="text-xl md:text-3xl mb-0.5 drop-shadow-md">{TIERS[cell]?.emoji}</span>
                  <span className={cn("text-[10px] md:text-xs font-black drop-shadow-sm", TIERS[cell]?.text)}>
                    {TIERS[cell]?.label}
                  </span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Game Over Modal Integrado */}
        <AnimatePresence>
          {gameOver && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-[1.8rem] flex flex-col items-center justify-center text-white p-6 text-center z-[130] overflow-y-auto"
            >
              <div className="relative mb-4 shrink-0">
                <Trophy className="h-14 w-14 text-yellow-400 animate-bounce" />
                <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-yellow-300 animate-pulse" />
              </div>
              
              <h4 className="text-2xl font-black mb-1 tracking-tighter uppercase">¡Ahorro Total!</h4>
              <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest">Puntaje Final</p>
              
              <div className="bg-white/10 px-8 py-3 rounded-2xl mb-6 border border-white/10">
                <span className="text-4xl font-black text-white">${score.toLocaleString()}</span>
              </div>

              {gameOverTip && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-indigo-600/20 border border-indigo-500/30 p-4 rounded-2xl mb-6 max-w-[280px]"
                >
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Tip de Ahorro</span>
                  </div>
                  <p className="text-[11px] font-bold italic leading-tight text-indigo-50">
                    "{gameOverTip.text}"
                  </p>
                </motion.div>
              )}

              <Button 
                onClick={(e) => { e.stopPropagation(); initGame(); }}
                className="rounded-full h-12 px-10 font-black bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-900/40 text-sm"
              >
                VOLVER A JUNTAR 🐷
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Info */}
      <div className="mt-8 flex flex-col items-center gap-4 pointer-events-none">
        <div className="flex gap-8 text-slate-600">
          <div className="flex flex-col items-center gap-1">
            <Smartphone className="h-4 w-4" />
            <span className="text-[8px] font-black uppercase tracking-widest">Desliza en pantalla</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Keyboard className="h-4 w-4" />
            <span className="text-[8px] font-black uppercase tracking-widest">Usa las Flechas</span>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          onClick={(e) => { e.stopPropagation(); initGame(); }}
          className="rounded-xl text-slate-500 hover:text-white hover:bg-white/5 font-black text-[10px] uppercase tracking-widest gap-2 h-9 pointer-events-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reiniciar
        </Button>
      </div>
    </div>
  );
};

export default PigMerge;
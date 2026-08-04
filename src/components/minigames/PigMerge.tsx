"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, RefreshCw, Smartphone, Keyboard, Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Definición de Niveles con colores VIVOS y etiquetas de ahorro solicitadas
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
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Inicializar tablero
  const initGame = useCallback(() => {
    let newBoard = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    newBoard = addRandomTile(addRandomTile(newBoard));
    setBoard(newBoard);
    setScore(0);
    setGameOver(false);
    setAchievement(null);
  }, []);

  useEffect(() => {
    initGame();
    const savedBest = localStorage.getItem("oinkash_pigmerge_best");
    if (savedBest) setBestScore(parseInt(savedBest));
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
        
        // Manejar mensajes de logros
        if (highestMerged >= 1024) {
          const msg = TIERS[highestMerged]?.message || (highestMerged > 2048 ? "¡ESTÁ QUE ARDE!" : null);
          if (msg) {
            setAchievement(msg);
            setTimeout(() => setAchievement(null), 1500);
          }
        }

        const boardWithNew = addRandomTile(newBoard);
        if (checkGameOver(boardWithNew)) setGameOver(true);
        return boardWithNew;
      }
      return prevBoard;
    });
  }, [gameOver]);

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

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) move(dx > 0 ? "right" : "left");
    } else {
      if (Math.abs(dy) > 30) move(dy > 0 ? "down" : "up");
    }
    touchStart.current = null;
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 p-6 md:p-10 justify-center items-center select-none overflow-hidden">
      
      {/* Header del Juego */}
      <div className="w-full max-w-md flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h3 className="text-3xl font-black tracking-tighter text-white flex items-center gap-2">
            PIG MERGE <span className="text-2xl animate-bounce">🐷</span>
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Combina y Ahorra</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl text-center min-w-[80px]">
            <p className="text-[8px] font-black text-slate-400 uppercase">Score</p>
            <p className="text-xl font-black text-white leading-none">{score}</p>
          </div>
          <div className="bg-indigo-600 px-4 py-2 rounded-2xl text-center min-w-[80px] text-white shadow-lg">
            <p className="text-[8px] font-black opacity-60 uppercase">Best</p>
            <p className="text-xl font-black leading-none">{bestScore}</p>
          </div>
        </div>
      </div>

      {/* Mensajes de Logro (Achievements) */}
      <AnimatePresence>
        {achievement && (
          <motion.div 
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1.2, opacity: 1, y: 0 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="absolute top-1/4 z-50 pointer-events-none"
          >
            <div className="bg-orange-500 text-white px-8 py-3 rounded-full font-black text-3xl shadow-2xl border-4 border-white flex items-center gap-3">
              {achievement.includes("ARDE") && <Flame className="h-8 w-8 text-yellow-300 animate-pulse" />}
              {achievement}
              {achievement.includes("ARDE") && <Flame className="h-8 w-8 text-yellow-300 animate-pulse" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tablero */}
      <div 
        className="relative aspect-square w-full max-w-md bg-slate-800 p-4 rounded-[2.5rem] shadow-2xl border-4 border-slate-700/50 touch-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="grid grid-cols-4 grid-rows-4 gap-3 h-full w-full">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="bg-slate-700/30 rounded-2xl w-full h-full shadow-inner" />
          ))}
        </div>

        {/* Fichas animadas */}
        <div className="absolute inset-0 p-4 grid grid-cols-4 grid-rows-4 gap-3">
          <AnimatePresence>
            {board.map((row, r) => 
              row.map((cell, c) => cell && (
                <motion.div
                  key={`${r}-${c}-${cell}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  layout
                  className={cn(
                    "w-full h-full rounded-2xl flex flex-col items-center justify-center shadow-xl border-b-4 border-black/20",
                    TIERS[cell]?.color || "bg-slate-300"
                  )}
                  style={{ gridRow: r + 1, gridColumn: c + 1 }}
                >
                  <span className="text-2xl md:text-4xl mb-1 drop-shadow-md">{TIERS[cell]?.emoji}</span>
                  <span className={cn("text-xs md:text-sm font-black drop-shadow-sm", TIERS[cell]?.text)}>
                    {TIERS[cell]?.label}
                  </span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Overlay Game Over */}
        <AnimatePresence>
          {gameOver && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-[2.5rem] flex flex-col items-center justify-center text-white p-8 text-center z-20"
            >
              <div className="relative mb-6">
                <Trophy className="h-20 w-20 text-yellow-400 animate-bounce" />
                <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-yellow-300 animate-pulse" />
              </div>
              <h4 className="text-4xl font-black mb-2 tracking-tighter">¡Meta Alcanzada!</h4>
              <p className="text-sm font-medium text-slate-400 mb-10 leading-relaxed">
                Lograste un ahorro acumulado de <br />
                <span className="text-2xl font-black text-white">${score.toLocaleString()}</span>
              </p>
              <Button 
                onClick={initGame}
                className="rounded-full h-16 px-12 font-black bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-900/40 text-xl"
              >
                Volver a Juntar
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controles e Info */}
      <div className="mt-10 flex flex-col items-center gap-6">
        <div className="flex gap-10 text-slate-500">
          <div className="flex flex-col items-center gap-1">
            <Keyboard className="h-5 w-5" />
            <span className="text-[9px] font-black uppercase tracking-tighter">Flechas</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Smartphone className="h-5 w-5" />
            <span className="text-[9px] font-black uppercase tracking-tighter">Deslizar</span>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          onClick={initGame}
          className="rounded-2xl text-slate-400 hover:text-white hover:bg-white/5 font-bold gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Reiniciar
        </Button>
      </div>
    </div>
  );
};

export default PigMerge;
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, RefreshCw, Smartphone, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

// Niveles de "Ahorro"
const TIERS: Record<number, { label: string; emoji: string; color: string; text: string }> = {
  2: { label: "$1", emoji: "🪙", color: "bg-orange-50", text: "text-orange-700" },
  4: { label: "$2", emoji: "💰", color: "bg-orange-100", text: "text-orange-800" },
  8: { label: "$5", emoji: "💵", color: "bg-emerald-50", text: "text-emerald-700" },
  16: { label: "$10", emoji: "💸", color: "bg-emerald-100", text: "text-emerald-800" },
  32: { label: "$20", emoji: "🐖", color: "bg-pink-50", text: "text-pink-700" },
  64: { label: "$50", emoji: "🐷", color: "bg-pink-100", text: "text-pink-800" },
  128: { label: "$100", emoji: "🏦", color: "bg-blue-50", text: "text-blue-700" },
  256: { label: "$200", emoji: "🏛️", color: "bg-blue-100", text: "text-blue-800" },
  512: { label: "$500", emoji: "💎", color: "bg-purple-50", text: "text-purple-700" },
  1024: { label: "$1k", emoji: "👑", color: "bg-purple-100", text: "text-purple-800" },
  2048: { label: "META", emoji: "🏆", color: "bg-yellow-400", text: "text-yellow-950" },
};

const GRID_SIZE = 4;

const PigMerge = () => {
  const [board, setBoard] = useState<(number | null)[][]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Inicializar tablero
  const initGame = useCallback(() => {
    let newBoard = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    newBoard = addRandomTile(addRandomTile(newBoard));
    setBoard(newBoard);
    setScore(0);
    setGameOver(false);
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

      // Normalizar movimiento a "izquierda"
      if (direction === "up") rotateBoard(3);
      else if (direction === "right") rotateBoard(2);
      else if (direction === "down") rotateBoard(1);

      for (let r = 0; r < GRID_SIZE; r++) {
        let row = newBoard[r].filter(cell => cell !== null) as number[];
        for (let i = 0; i < row.length - 1; i++) {
          if (row[i] === row[i + 1]) {
            row[i] *= 2;
            pointsGained += row[i];
            row.splice(i + 1, 1);
            moved = true;
          }
        }
        while (row.length < GRID_SIZE) row.push(null as any);
        if (JSON.stringify(newBoard[r]) !== JSON.stringify(row)) moved = true;
        newBoard[r] = row;
      }

      // Devolver a orientación original
      if (direction === "up") rotateBoard(1);
      else if (direction === "right") rotateBoard(2);
      else if (direction === "down") rotateBoard(3);

      if (moved) {
        setScore(s => s + pointsGained);
        const boardWithNew = addRandomTile(newBoard);
        
        // Verificar si perdió
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

  // Controles
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
    <div className="w-full max-w-md mx-auto space-y-6 select-none">
      {/* Header del Juego */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-2">
            PIG MERGE <span className="text-xl">🐷</span>
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Combina y Ahorra</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-slate-100 px-4 py-2 rounded-2xl text-center min-w-[70px]">
            <p className="text-[8px] font-black text-slate-400 uppercase">Score</p>
            <p className="text-lg font-black text-slate-900 leading-none">{score}</p>
          </div>
          <div className="bg-indigo-600 px-4 py-2 rounded-2xl text-center min-w-[70px] text-white">
            <p className="text-[8px] font-black opacity-60 uppercase">Best</p>
            <p className="text-lg font-black leading-none">{bestScore}</p>
          </div>
        </div>
      </div>

      {/* Tablero */}
      <div 
        className="relative aspect-square w-full bg-slate-200 p-3 rounded-[2.5rem] shadow-inner touch-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="grid grid-cols-4 grid-rows-4 gap-3 h-full w-full">
          {board.map((row, r) => 
            row.map((cell, c) => (
              <div key={`${r}-${c}`} className="bg-white/40 rounded-2xl w-full h-full" />
            ))
          )}
        </div>

        {/* Fichas animadas */}
        <div className="absolute inset-0 p-3 grid grid-cols-4 grid-rows-4 gap-3">
          <AnimatePresence>
            {board.map((row, r) => 
              row.map((cell, c) => cell && (
                <motion.div
                  key={`${r}-${c}-${cell}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={cn(
                    "w-full h-full rounded-2xl flex flex-col items-center justify-center shadow-md",
                    TIERS[cell]?.color || "bg-slate-300"
                  )}
                  style={{ gridRow: r + 1, gridColumn: c + 1 }}
                >
                  <span className="text-2xl md:text-3xl mb-1">{TIERS[cell]?.emoji}</span>
                  <span className={cn("text-[10px] md:text-xs font-black", TIERS[cell]?.text)}>
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
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-[2.5rem] flex flex-col items-center justify-center text-white p-6 text-center z-20"
            >
              <Trophy className="h-16 w-16 text-yellow-400 mb-4 animate-bounce" />
              <h4 className="text-3xl font-black mb-2 tracking-tighter">¡Alcancía Llena!</h4>
              <p className="text-sm font-medium opacity-80 mb-8">Has logrado un ahorro total de ${score.toLocaleString()}</p>
              <Button 
                onClick={initGame}
                className="rounded-2xl h-14 px-8 font-black bg-white text-slate-900 hover:bg-slate-100 shadow-xl"
              >
                Jugar de nuevo
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controles e Info */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-8 text-slate-400">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase">Usa las flechas</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase">Desliza el dedo</span>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          onClick={initGame}
          className="rounded-xl border-slate-200 text-slate-500 font-bold gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Reiniciar Partida
        </Button>
      </div>
    </div>
  );
};

export default PigMerge;
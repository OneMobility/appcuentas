"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, RefreshCw, Coins, Banknote, Landmark, Sparkles, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Tile = {
  id: number;
  value: number;
  x: number;
  y: number;
  isNew?: boolean;
  isMerged?: boolean;
};

const GRID_SIZE = 4;

const TILE_COLORS: Record<number, string> = {
  2: "bg-[#eee4da] text-[#776e65]",
  4: "bg-[#ede0c8] text-[#776e65]",
  8: "bg-[#f2b179] text-white",
  16: "bg-[#f59563] text-white",
  32: "bg-[#f67c5f] text-white",
  64: "bg-[#f65e3b] text-white",
  128: "bg-[#edcf72] text-white text-xl",
  256: "bg-[#edcc61] text-white text-xl",
  512: "bg-[#edc850] text-white text-xl",
  1024: "bg-[#edc53f] text-white text-lg",
  2048: "bg-[#edc22e] text-white text-lg shadow-[0_0_15px_#edc22e]",
};

const TILE_LABELS: Record<number, { label: string; icon: any }> = {
  2: { label: "$1", icon: Coins },
  4: { label: "$2", icon: Coins },
  8: { label: "$5", icon: Coins },
  16: { label: "$10", icon: Coins },
  32: { label: "$20", icon: Banknote },
  64: { label: "$50", icon: Banknote },
  128: { label: "$100", icon: Banknote },
  256: { label: "$200", icon: Banknote },
  512: { label: "$500", icon: Banknote },
  1024: { label: "$1k", icon: Landmark },
  2048: { label: "Lingote", icon: Sparkles },
};

const PigMerge = () => {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [nextId, setNextId] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number, y: number } | null>(null);

  const getEmptyPositions = (currentTiles: Tile[]) => {
    const occupied = new Set(currentTiles.map(t => `${t.x}-${t.y}`));
    const empty = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!occupied.has(`${x}-${y}`)) empty.push({ x, y });
      }
    }
    return empty;
  };

  const spawnTile = useCallback((currentTiles: Tile[], idCounter: number) => {
    const empty = getEmptyPositions(currentTiles);
    if (empty.length === 0) return { tiles: currentTiles, id: idCounter };
    const { x, y } = empty[Math.floor(Math.random() * empty.length)];
    const newTile: Tile = { id: idCounter, value: Math.random() < 0.9 ? 2 : 4, x, y, isNew: true };
    return { tiles: [...currentTiles, newTile], id: idCounter + 1 };
  }, []);

  const initGame = useCallback(() => {
    let res = spawnTile([], 0);
    res = spawnTile(res.tiles, res.id);
    setTiles(res.tiles);
    setNextId(res.id);
    setScore(0);
    setGameOver(false);
  }, [spawnTile]);

  useEffect(() => { initGame(); }, [initGame]);

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver) return;

    setTiles((prev) => {
      let currentTiles = prev.map(t => ({ ...t, isNew: false, isMerged: false }));
      let moved = false;
      let newScore = score;
      let currentId = nextId;

      const isVertical = direction === 'up' || direction === 'down';
      const isReverse = direction === 'right' || direction === 'down';

      for (let i = 0; i < GRID_SIZE; i++) {
        let line = currentTiles.filter(t => (isVertical ? t.x === i : t.y === i));
        line.sort((a, b) => {
          const valA = isVertical ? a.y : a.x;
          const valB = isVertical ? b.y : b.x;
          return isReverse ? valB - valA : valA - valB;
        });

        const mergedLine: Tile[] = [];
        for (let j = 0; j < line.length; j++) {
          const t = line[j];
          const next = line[j + 1];

          if (next && t.value === next.value) {
            const mergedValue = t.value * 2;
            mergedLine.push({ ...t, value: mergedValue, isMerged: true, id: currentId++ });
            newScore += mergedValue;
            j++;
            moved = true;
          } else {
            mergedLine.push(t);
          }
        }

        mergedLine.forEach((t, idx) => {
          const pos = isReverse ? GRID_SIZE - 1 - idx : idx;
          const oldX = t.x;
          const oldY = t.y;
          if (isVertical) t.y = pos; else t.x = pos;
          if (t.x !== oldX || t.y !== oldY) moved = true;
        });

        const otherTiles = currentTiles.filter(t => (isVertical ? t.x !== i : t.y !== i));
        currentTiles = [...otherTiles, ...mergedLine];
      }

      if (moved) {
        const res = spawnTile(currentTiles, currentId);
        setNextId(res.id);
        setScore(newScore);
        if (newScore > bestScore) setBestScore(newScore);
        
        // Simple Game Over check
        if (getEmptyPositions(res.tiles).length === 0) {
          // Check if merges are still possible
          setGameOver(true); 
        }
        return res.tiles;
      }
      return prev;
    });
  }, [gameOver, score, nextId, bestScore, spawnTile]);

  // Keyboard support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") move("up");
      if (e.key === "ArrowDown") move("down");
      if (e.key === "ArrowLeft") move("left");
      if (e.key === "ArrowRight") move("right");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [move]);

  // Swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) move(dx > 0 ? "right" : "left");
    } else {
      if (Math.abs(dy) > 30) move(dy > 0 ? "down" : "up");
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4 w-full max-w-md mx-auto select-none touch-none">
      <div className="w-full flex justify-between items-center px-2">
        <div className="flex flex-col">
          <h2 className="text-4xl font-black tracking-tighter text-[#776e65]">Pig Merge</h2>
          <p className="text-[10px] font-black uppercase text-white bg-[#bbada0] px-3 py-1 rounded-md w-fit mt-1">Denominaciones</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-[#bbada0] px-4 py-2 rounded-xl text-center min-w-[80px]">
            <p className="text-[10px] font-bold uppercase text-[#eee4da] opacity-80">Score</p>
            <p className="text-xl font-black text-white">{score}</p>
          </div>
          <div className="bg-[#bbada0] px-4 py-2 rounded-xl text-center min-w-[80px]">
            <p className="text-[10px] font-bold uppercase text-[#eee4da] opacity-80">Best</p>
            <p className="text-xl font-black text-white">{bestScore}</p>
          </div>
        </div>
      </div>

      <div 
        className="relative p-3 bg-[#bbada0] rounded-2xl shadow-lg w-full aspect-square"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background Grid */}
        <div className="grid grid-cols-4 grid-rows-4 gap-3 w-full h-full">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="bg-[#cdc1b4] rounded-lg w-full h-full" />
          ))}
        </div>

        {/* Foreground Tiles */}
        <div className="absolute inset-3 pointer-events-none">
          <AnimatePresence>
            {tiles.map((tile) => {
              const info = TILE_LABELS[tile.value] || TILE_LABELS[2048];
              const Icon = info.icon;
              return (
                <motion.div
                  key={tile.id}
                  initial={tile.isNew ? { scale: 0, opacity: 0 } : false}
                  animate={{ 
                    scale: 1, 
                    opacity: 1,
                    x: tile.x * 100 + '%',
                    y: tile.y * 100 + '%',
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 25, mass: 1 }}
                  className={cn(
                    "absolute w-[25%] h-[22%] p-1.5 flex items-center justify-center",
                  )}
                  style={{ top: '1.5%', left: '0%' }}
                >
                  <motion.div 
                    animate={tile.isMerged ? { scale: [1, 1.15, 1] } : {}}
                    className={cn(
                      "w-full h-full rounded-lg flex flex-col items-center justify-center font-black shadow-sm",
                      TILE_COLORS[tile.value] || TILE_COLORS[2048]
                    )}
                  >
                    <Icon className="h-6 w-6 mb-1 opacity-80" />
                    <span className="leading-none">{info.label}</span>
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 bg-[#eee4da]/80 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center p-6 rounded-2xl text-center"
            >
              <Trophy className="h-16 w-16 text-[#edc22e] mb-2 drop-shadow-md" />
              <h3 className="text-3xl font-black text-[#776e65]">¡Fin del Juego!</h3>
              <p className="text-[#776e65] font-bold mb-8">Has acumulado una buena fortuna.</p>
              <Button onClick={initGame} className="rounded-xl h-14 w-full font-black bg-[#8f7a66] hover:bg-[#7f6a56] text-white shadow-xl border-none text-lg">
                <RefreshCw className="mr-2 h-6 w-6" /> Reintentar
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 gap-4 w-full">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-inner">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Misión</p>
              <p className="text-sm font-black text-slate-700">Llegar al Lingote de Oro</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={initGame} className="rounded-full h-10 w-10 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex justify-center gap-6 opacity-30 pointer-events-none md:hidden">
          <ChevronLeft className="h-6 w-6" />
          <div className="flex flex-col gap-6">
            <ChevronUp className="h-6 w-6" />
            <ChevronDown className="h-6 w-6" />
          </div>
          <ChevronRight className="h-6 w-6" />
        </div>
      </div>

      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center mt-2">
        Desliza para mover las monedas 🐷
      </p>
    </div>
  );
};

export default PigMerge;
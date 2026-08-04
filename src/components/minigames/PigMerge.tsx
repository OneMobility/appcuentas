"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, RefreshCw, Coins, Banknote, Landmark, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Tile = {
  id: number;
  value: number;
  x: number;
  y: number;
  mergedFrom?: number[];
};

const GRID_SIZE = 4;

const TILE_DATA: Record<number, { label: string; color: string; icon: any }> = {
  2: { label: "$1", color: "bg-amber-100 text-amber-700", icon: Coins },
  4: { label: "$2", color: "bg-amber-200 text-amber-800", icon: Coins },
  8: { label: "$5", color: "bg-orange-200 text-orange-800", icon: Coins },
  16: { label: "$10", color: "bg-orange-300 text-orange-900", icon: Coins },
  32: { label: "$20", color: "bg-emerald-100 text-emerald-700", icon: Banknote },
  64: { label: "$50", color: "bg-emerald-200 text-emerald-800", icon: Banknote },
  128: { label: "$100", color: "bg-blue-100 text-blue-700", icon: Banknote },
  256: { label: "$200", color: "bg-blue-200 text-blue-800", icon: Banknote },
  512: { label: "$500", color: "bg-purple-200 text-purple-800", icon: Banknote },
  1024: { label: "$1k", color: "bg-indigo-600 text-white", icon: Landmark },
  2048: { label: "Lingote", color: "bg-yellow-400 text-yellow-900 shadow-[0_0_15px_rgba(250,204,21,0.5)]", icon: Sparkles },
};

const PigMerge = () => {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [nextId, setNextId] = useState(0);

  const getEmptyPositions = useCallback((currentTiles: Tile[]) => {
    const positions = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!currentTiles.find((t) => t.x === x && t.y === y)) {
          positions.push({ x, y });
        }
      }
    }
    return positions;
  }, []);

  const spawnTile = useCallback((currentTiles: Tile[], idCounter: number) => {
    const empty = getEmptyPositions(currentTiles);
    if (empty.length === 0) return { tiles: currentTiles, id: idCounter };
    
    const pos = empty[Math.floor(Math.random() * empty.length)];
    const newVal = Math.random() < 0.9 ? 2 : 4;
    const newTile: Tile = { id: idCounter, value: newVal, x: pos.x, y: pos.y };
    
    return { 
      tiles: [...currentTiles, newTile], 
      id: idCounter + 1 
    };
  }, [getEmptyPositions]);

  const initGame = useCallback(() => {
    let current = spawnTile([], 0);
    current = spawnTile(current.tiles, current.id);
    setTiles(current.tiles);
    setNextId(current.id);
    setScore(0);
    setGameOver(false);
  }, [spawnTile]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver) return;

    setTiles((prev) => {
      let currentTiles = [...prev];
      let moved = false;
      let newScore = score;
      let currentId = nextId;

      const isVertical = direction === 'up' || direction === 'down';
      const isForward = direction === 'right' || direction === 'down';

      for (let i = 0; i < GRID_SIZE; i++) {
        let line = currentTiles.filter((t) => (isVertical ? t.x === i : t.y === i));
        line.sort((a, b) => {
          const valA = isVertical ? a.y : a.x;
          const valB = isVertical ? b.y : b.x;
          return isForward ? valB - valA : valA - valB;
        });

        const newLine: Tile[] = [];
        for (let j = 0; j < line.length; j++) {
          const t = line[j];
          const next = line[j + 1];

          if (next && t.value === next.value) {
            const mergedValue = t.value * 2;
            newLine.push({
              id: currentId++,
              value: mergedValue,
              x: t.x,
              y: t.y, // placeholder
              mergedFrom: [t.id, next.id]
            });
            newScore += mergedValue;
            j++;
            moved = true;
          } else {
            newLine.push({ ...t });
          }
        }

        newLine.forEach((t, idx) => {
          const pos = isForward ? GRID_SIZE - 1 - idx : idx;
          const oldX = t.x;
          const oldY = t.y;
          if (isVertical) t.y = pos; else t.x = pos;
          if (t.x !== oldX || t.y !== oldY) moved = true;
        });

        // Update the main array
        currentTiles = currentTiles.filter((t) => (isVertical ? t.x !== i : t.y !== i)).concat(newLine);
      }

      if (moved) {
        const result = spawnTile(currentTiles, currentId);
        setNextId(result.id);
        setScore(newScore);
        if (newScore > bestScore) setBestScore(newScore);
        
        // Check game over
        if (getEmptyPositions(result.tiles).length === 0) {
          // Simple check for merges (could be improved)
          setGameOver(true);
        }
        
        return result.tiles;
      }

      return prev;
    });
  }, [gameOver, score, nextId, bestScore, spawnTile, getEmptyPositions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") move("up");
      if (e.key === "ArrowDown") move("down");
      if (e.key === "ArrowLeft") move("left");
      if (e.key === "ArrowRight") move("right");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  return (
    <div className="flex flex-col items-center gap-6 p-2 w-full max-w-md mx-auto">
      <div className="w-full flex justify-between items-end px-2">
        <div className="flex flex-col">
          <h2 className="text-3xl font-black tracking-tighter text-slate-900">Pig Merge</h2>
          <p className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full w-fit">2048 Edition</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-slate-100 px-4 py-2 rounded-2xl text-center min-w-[80px]">
            <p className="text-[8px] font-black uppercase text-slate-400">Score</p>
            <p className="text-lg font-black text-slate-700">{score}</p>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-2xl text-center min-w-[80px]">
            <p className="text-[8px] font-black uppercase text-slate-500">Best</p>
            <p className="text-lg font-black text-white">{bestScore}</p>
          </div>
        </div>
      </div>

      <div className="relative p-2 bg-slate-200 rounded-[2rem] shadow-inner w-full aspect-square grid grid-cols-4 grid-rows-4 gap-2">
        {/* Background cells */}
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="bg-slate-300/50 rounded-xl w-full h-full" />
        ))}

        {/* Tiles */}
        <AnimatePresence>
          {tiles.map((tile) => {
            const data = TILE_DATA[tile.value] || TILE_DATA[2048];
            const Icon = data.icon;
            return (
              <motion.div
                key={tile.id}
                layoutId={`tile-${tile.id}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: tile.x * (100 / GRID_SIZE) + '%',
                  y: tile.y * (100 / GRID_SIZE) + '%',
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                  "absolute p-1 w-[22%] h-[22%] rounded-xl flex flex-col items-center justify-center font-black transition-colors duration-200",
                  data.color
                )}
                style={{
                  left: '2%',
                  top: '2%',
                  zIndex: tile.value
                }}
              >
                <Icon className={cn("h-5 w-5 mb-0.5", tile.value >= 1024 ? "animate-pulse" : "")} />
                <span className={cn(
                  "text-xs leading-none",
                  tile.value >= 1024 ? "text-[10px]" : ""
                )}>
                  {data.label}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 rounded-[2rem] text-center"
            >
              <Trophy className="h-12 w-12 text-yellow-500 mb-2" />
              <h3 className="text-2xl font-black text-slate-900">¡Juego Terminado!</h3>
              <p className="text-sm font-medium text-slate-500 mb-6">Lograste juntar una buena fortuna.</p>
              <Button onClick={initGame} className="rounded-2xl h-14 w-full font-black bg-indigo-600 shadow-xl">
                <RefreshCw className="mr-2 h-5 w-5" /> Jugar de nuevo
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Coins className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-400">Objetivo</span>
            <span className="text-xs font-bold text-slate-700">Llegar al Lingote</span>
          </div>
        </div>
        <Button variant="outline" onClick={initGame} className="rounded-3xl h-full font-bold border-slate-200">
          <RefreshCw className="h-4 w-4 mr-2" /> Reiniciar
        </Button>
      </div>

      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
        Usa las flechas del teclado o desliza para mover las monedas
      </p>
    </div>
  );
};

export default PigMerge;
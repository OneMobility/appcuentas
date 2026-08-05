import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RefreshCw, Heart, AlertCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRandomTip, OinkashTip } from "@/utils/oinkash-tips";

/**
 * 🐷 COCHIDOKU — Versión con Vidas y Errores
 */

const pigMascot = "https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/ChatGPT%20Image%204%20ago%202026,%2003_44_08%20p.m..png";

const LEVEL_SIZES = [6, 7, 8, 9, 10];
const MAX_LIVES = 3;

type CellState = "empty" | "mark" | "pig";

interface Puzzle {
  n: number;
  regions: number[][]; 
  colors: string[]; 
}

// --- Utilidades de Generación ---
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateSolution(n: number): number[] {
  const solution: number[] = new Array(n).fill(-1);
  const used: boolean[] = new Array(n).fill(false);
  const allCols = Array.from({ length: n }, (_, i) => i);

  function backtrack(row: number): boolean {
    if (row === n) return true;
    const candidates = shuffle(allCols.filter((c) => !used[c]));
    for (const c of candidates) {
      // Regla de no contacto (adyacencia diagonal/ortogonal en fila anterior)
      if (row > 0 && Math.abs(solution[row - 1] - c) <= 1) continue;
      solution[row] = c;
      used[c] = true;
      if (backtrack(row + 1)) return true;
      used[c] = false;
      solution[row] = -1;
    }
    return false;
  }

  if (!backtrack(0)) return generateSolution(n); 
  return solution;
}

function generateRegions(n: number, solution: number[]): number[][] {
  const regions: number[][] = Array.from({ length: n }, () => new Array(n).fill(-1));
  const frontiers: [number, number][][] = Array.from({ length: n }, () => []);

  for (let r = 0; r < n; r++) {
    const c = solution[r];
    regions[r][c] = r;
    frontiers[r].push([r, c]);
  }

  let assigned = n;
  const total = n * n;
  const order = shuffle(Array.from({ length: n }, (_, i) => i));
  let idx = 0;
  let stuck = 0;

  while (assigned < total) {
    const region = order[idx % n];
    idx++;
    const frontier = shuffle(frontiers[region]);
    let expanded = false;

    for (const [fr, fc] of frontier) {
      const neighbors = shuffle([[fr - 1, fc], [fr + 1, fc], [fr, fc - 1], [fr, fc + 1]]);
      for (const [nr, nc] of neighbors) {
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] === -1) {
          regions[nr][nc] = region;
          frontiers[region].push([nr, nc]);
          assigned++;
          expanded = true;
          break;
        }
      }
      if (expanded) break;
    }

    if (!expanded) {
      stuck++;
      if (stuck > n * 10) {
        for (let rr = 0; rr < n; rr++) {
          for (let cc = 0; cc < n; cc++) {
            if (regions[rr][cc] === -1) {
              const nbrs = [[rr-1,cc],[rr+1,cc],[rr,cc-1],[rr,cc+1]];
              for(const [nr, nc] of nbrs) {
                if(nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] !== -1) {
                  regions[rr][cc] = regions[nr][nc];
                  assigned++;
                  break;
                }
              }
            }
          }
        }
        break;
      }
    } else stuck = 0;
  }
  return regions;
}

function generatePuzzle(n: number): Puzzle {
  const solution = generateSolution(n);
  const regions = generateRegions(n, solution);
  const colors = Array.from({ length: n }, (_, i) => {
    const hue = (140 + (360 / n) * i) % 360; 
    return `hsl(${hue}, 60%, 85%)`;
  });
  return { n, regions, colors };
}

export default function PigSudoku() {
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(MAX_LIVES);
  const [puzzle, setPuzzle] = useState<Puzzle>(() => generatePuzzle(LEVEL_SIZES[0]));
  const [grid, setGrid] = useState<CellState[][]>(() => Array.from({ length: puzzle.n }, () => Array(puzzle.n).fill("empty")));
  const [phase, setPhase] = useState<"playing" | "solved" | "over">("playing");
  const [seconds, setSeconds] = useState(0);
  const [best, setBest] = useState(() => parseInt(localStorage.getItem("oinkash_sudoku_best") || "0"));
  const [errorFlash, setErrorFlash] = useState(false);
  const [gameOverTip, setGameOverTip] = useState<OinkashTip | null>(null);

  const audioCoin = useRef<HTMLAudioElement | null>(null);
  const audioError = useRef<HTMLAudioElement | null>(null);
  const audioEnd = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    audioCoin.current = new Audio("/sounds/coin.wav");
    audioError.current = new Audio("/sounds/error.mp3");
    audioEnd.current = new Audio("/sounds/end-point.wav");
    startTimer();
    return () => stopTimer();
  }, []);

  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  const initLevel = (lvl: number) => {
    const n = LEVEL_SIZES[Math.min(lvl - 1, LEVEL_SIZES.length - 1)];
    const p = generatePuzzle(n);
    setPuzzle(p);
    setGrid(Array.from({ length: n }, () => Array(n).fill("empty")));
    setLives(MAX_LIVES);
    setPhase("playing");
    setSeconds(0);
    startTimer();
  };

  const playSound = (audio: HTMLAudioElement | null) => {
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
  };

  const checkConflict = (r: number, c: number, currentGrid: CellState[][]) => {
    const n = puzzle.n;
    const region = puzzle.regions[r][c];

    for (let i = 0; i < n; i++) {
      if (i !== c && currentGrid[r][i] === "pig") return true; 
      if (i !== r && currentGrid[i][c] === "pig") return true; 
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === r && j === c) continue;
        if (currentGrid[i][j] === "pig") {
          if (puzzle.regions[i][j] === region) return true; 
          if (Math.abs(i - r) <= 1 && Math.abs(j - c) <= 1) return true; 
        }
      }
    }
    return false;
  };

  const handleCellClick = (r: number, c: number) => {
    if (phase !== "playing") return;

    setGrid(prev => {
      const next = prev.map(row => [...row]);
      const current = next[r][c];

      if (current === "empty") {
        next[r][c] = "mark";
      } else if (current === "mark") {
        const hasConflict = checkConflict(r, c, next);
        if (hasConflict) {
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              setPhase("over");
              setGameOverTip(getRandomTip());
              playSound(audioEnd.current);
              stopTimer();
            } else {
              playSound(audioError.current);
              setErrorFlash(true);
              setTimeout(() => setErrorFlash(false), 400);
            }
            return newLives;
          });
          next[r][c] = "empty"; 
        } else {
          next[r][c] = "pig";
          const totalPigs = next.flat().filter(s => s === "pig").length;
          if (totalPigs === puzzle.n) {
            setPhase("solved");
            playSound(audioCoin.current);
            stopTimer();
            const newBest = level > best ? level : best;
            setBest(newBest);
            localStorage.setItem("oinkash_sudoku_best", newBest.toString());
          }
        }
      } else {
        next[r][c] = "empty";
      }
      return next;
    });
  };

  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");

  return (
    <div className={cn(
      "w-full h-full flex flex-col items-center justify-center p-4 transition-all duration-300",
      errorFlash ? "bg-rose-500/20" : "bg-slate-50"
    )}>
      
      <div className="w-full max-w-md flex justify-between items-end mb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tighter text-slate-900">COCHIDOKU 🐷</h2>
          <div className="flex gap-2">
            <div className="bg-indigo-600 text-white px-3 py-1 rounded-xl font-black text-[10px] uppercase tracking-widest">Nivel {level}</div>
            <div className="bg-slate-200 text-slate-600 px-3 py-1 rounded-xl font-black text-[10px] uppercase tracking-widest">{mm}:{ss}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <Heart 
                key={i} 
                className={cn("h-5 w-5 transition-all", i < lives ? "text-rose-500 fill-rose-500" : "text-slate-300")} 
              />
            ))}
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase">Encuentra {puzzle.n} cerditos</p>
        </div>
      </div>

      <motion.div 
        animate={errorFlash ? { x: [-10, 10, -10, 10, 0] } : {}}
        className="relative aspect-square w-full max-w-md bg-slate-900 p-2 rounded-[2rem] shadow-2xl border-4 border-slate-800"
      >
        <div 
          className="grid h-full w-full rounded-2xl overflow-hidden"
          style={{ 
            gridTemplateColumns: `repeat(${puzzle.n}, 1fr)`,
            gridTemplateRows: `repeat(${puzzle.n}, 1fr)` 
          }}
        >
          {grid.map((row, r) => row.map((state, c) => {
            const region = puzzle.regions[r][c];
            const n = puzzle.n;
            const bRight = c < n - 1 && puzzle.regions[r][c+1] !== region ? "2px solid #1e293b" : "1px solid rgba(30,41,59,0.1)";
            const bBottom = r < n - 1 && puzzle.regions[r+1][c] !== region ? "2px solid #1e293b" : "1px solid rgba(30,41,59,0.1)";
            
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                className="relative flex items-center justify-center transition-colors active:scale-95"
                style={{ 
                  backgroundColor: puzzle.colors[region],
                  borderRight: bRight,
                  borderBottom: bBottom
                }}
              >
                {state === "pig" && (
                  <motion.img 
                    initial={{ scale: 0 }} animate={{ scale: 0.8 }} 
                    src={pigMascot} 
                    className="w-full h-full object-contain"
                  />
                )}
                {state === "mark" && <span className="text-slate-400 font-black text-lg">✕</span>}
              </button>
            );
          }))}
        </div>

        <AnimatePresence>
          {phase === "solved" && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 z-40 bg-indigo-600/95 backdrop-blur-md rounded-[1.8rem] flex flex-col items-center justify-center p-8 text-white text-center">
              <Trophy className="h-20 w-20 text-yellow-400 mb-4 animate-bounce" />
              <h3 className="text-3xl font-black tracking-tighter mb-2">¡NIVEL SUPERADO!</h3>
              <p className="text-sm font-medium opacity-80 mb-8">Resolviste el puzzle en {mm}:{ss}</p>
              <Button onClick={() => { setLevel(l => l + 1); initLevel(level + 1); }} className="h-16 px-12 rounded-full bg-white text-indigo-900 font-black text-xl shadow-2xl">
                SIGUIENTE NIVEL 🚀
              </Button>
            </motion.div>
          )}

          {phase === "over" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-40 bg-rose-950/95 backdrop-blur-md rounded-[1.8rem] flex flex-col items-center justify-center p-6 text-white text-center">
              <AlertCircle className="h-16 w-16 text-rose-500 mb-4" />
              <h3 className="text-2xl font-black tracking-tighter mb-2">¡SIN VIDAS!</h3>
              <p className="text-xs font-bold text-rose-300 uppercase mb-6">El cochinito se cansó de los errores</p>
              
              {gameOverTip && (
                <div className="bg-white/10 p-4 rounded-2xl mb-8 border border-white/10 max-w-[260px]">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-yellow-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Consejo de Ahorro</span>
                  </div>
                  <p className="text-xs font-bold italic leading-tight">"{gameOverTip.text}"</p>
                </div>
              )}

              <Button onClick={() => initLevel(level)} className="h-14 px-10 rounded-full bg-white text-rose-900 font-black text-lg shadow-xl flex gap-3">
                <RefreshCw className="h-5 w-5" /> REINTENTAR
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-md">
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <span className="text-lg font-black text-slate-800">1</span>
          <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mt-1">Por Fila, Columna y Color</p>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <span className="text-lg font-black text-slate-800">0</span>
          <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mt-1">Cerditos tocándose</p>
        </div>
      </div>
      
      <p className="mt-6 text-[10px] font-black text-slate-300 uppercase tracking-widest">Toca una vez para marcar (✕), dos para el cerdito (🐷)</p>
    </div>
  );
}
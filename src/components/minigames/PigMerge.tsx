import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * PIG MERGE 🐷 — mini-juego estilo 2048 con temática de ahorro
 * Hecho para integrarse en Oinkash (app de control de gastos).
 *
 * Uso:
 *   import PigMerge from "./PigMerge";
 *   <PigMerge onBestScoreChange={(s) => saveToOinkashProfile(s)} initialBestScore={0} />
 *
 * No usa localStorage: el mejor puntaje se expone vía props/callback
 * para que la app anfitriona (Oinkash) lo persista donde prefiera
 * (backend, storage nativo, etc.).
 *
 * Responsive: el tablero usa unidades relativas (%, fr, aspect-ratio) y
 * clamp() para el texto, así que se adapta solo a pantallas de celular
 * sin necesitar media queries aparte. Los controles funcionan con
 * flechas de teclado y con swipe táctil.
 */

// ---------- Config de niveles de ahorro ----------
type Tier = {
  value: number;
  emoji: string;
  label: string;
  bg: string;
  fg: string;
};

const TIERS: Tier[] = [
  { value: 2, emoji: "🪙", label: "$1", bg: "#FFF1D6", fg: "#8A5A00" },
  { value: 4, emoji: "🪙🪙", label: "$2", bg: "#FFE3A8", fg: "#8A5A00" },
  { value: 8, emoji: "💵", label: "$5", bg: "#DFF5D8", fg: "#256029" },
  { value: 16, emoji: "💵💵", label: "$10", bg: "#C4EDBB", fg: "#1F5423" },
  { value: 32, emoji: "🐖", label: "$20", bg: "#FFD3E0", fg: "#96214F" },
  { value: 64, emoji: "🐷", label: "$50", bg: "#FFB4CC", fg: "#7A1B40" },
  { value: 128, emoji: "🐷💰", label: "$100", bg: "#FFC97A", fg: "#7A4300" },
  { value: 256, emoji: "💰", label: "$200", bg: "#FFB13D", fg: "#5C3300" },
  { value: 512, emoji: "💰💰", label: "$500", bg: "#FF9F1C", fg: "#452600" },
  { value: 1024, emoji: "🏦", label: "$1000", bg: "#7CD6C8", fg: "#0B3B34" },
  { value: 2048, emoji: "🏦🏦", label: "$2000", bg: "#4FBFAE", fg: "#08312B" },
  { value: 4096, emoji: "💎", label: "$5000", bg: "#7EA8FF", fg: "#0A1F52" },
  { value: 8192, emoji: "🎯", label: "¡META!", bg: "#4CAF83", fg: "#FFFFFF" },
];

const tierFor = (value: number): Tier =>
  TIERS.find((t) => t.value === value) ?? TIERS[TIERS.length - 1];

const GRID_SIZE = 6;
const WIN_VALUE = 8192;

// Hitos con su texto animado. Se muestran una sola vez por partida,
// la primera vez que aparece esa ficha en el tablero.
const MILESTONES: { value: number; text: string }[] = [
  { value: 1024, text: "¡Bien! 🏦" },
  { value: 4096, text: "¡Genial! 💎" },
  { value: 8192, text: "¡Excelente! 🎯" },
];

// ---------- Tipos ----------
type CellValue = number | null;
type Board = CellValue[][];

interface PigMergeProps {
  /** Mejor puntaje ya guardado por Oinkash (persistencia externa) */
  initialBestScore?: number;
  /** Se llama cada vez que el mejor puntaje mejora, para que Oinkash lo guarde */
  onBestScoreChange?: (best: number) => void;
  /** Se llama la primera vez que el jugador alcanza la ficha objetivo */
  onGoalReached?: () => void;
}

// ---------- Utilidades de tablero ----------
function emptyBoard(): Board {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function getEmptyCells(board: Board): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === null) cells.push([r, c]);
    }
  }
  return cells;
}

function addRandomTile(board: Board): Board {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return board;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const next = cloneBoard(board);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

/** Desliza y fusiona una fila hacia la izquierda. Devuelve la fila resultante y puntos ganados. */
function slideRowLeft(row: CellValue[]): { row: CellValue[]; gained: number; moved: boolean } {
  const original = [...row];
  const nums = row.filter((v): v is number => v !== null);
  const merged: number[] = [];
  let gained = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i < nums.length - 1 && nums[i] === nums[i + 1]) {
      const value = nums[i] * 2;
      merged.push(value);
      gained += value;
      i++;
    } else {
      merged.push(nums[i]);
    }
  }
  while (merged.length < GRID_SIZE) merged.push(null as unknown as number);
  const result: CellValue[] = merged.map((v) => (v === null ? null : v));
  const moved = original.some((v, idx) => v !== result[idx]);
  return { row: result, gained, moved };
}

function rotateBoardCW(board: Board): Board {
  const next = emptyBoard();
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      next[c][GRID_SIZE - 1 - r] = board[r][c];
    }
  }
  return next;
}

type Direction = "left" | "right" | "up" | "down";

function moveBoard(board: Board, direction: Direction): { board: Board; gained: number; moved: boolean } {
  // Normalizamos todo a "mover a la izquierda" rotando el tablero.
  let rotations = 0;
  if (direction === "up") rotations = 3;
  else if (direction === "right") rotations = 2;
  else if (direction === "down") rotations = 1;

  let working = board;
  for (let i = 0; i < rotations; i++) working = rotateBoardCW(working);

  let gained = 0;
  let moved = false;
  const resultRows = working.map((row) => {
    const { row: newRow, gained: g, moved: m } = slideRowLeft(row);
    gained += g;
    if (m) moved = true;
    return newRow;
  });

  let result: Board = resultRows;
  const remainingRotations = (4 - rotations) % 4;
  for (let i = 0; i < remainingRotations; i++) result = rotateBoardCW(result);

  return { board: result, gained, moved };
}

function boardHasMoves(board: Board): boolean {
  if (getEmptyCells(board).length > 0) return true;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = board[r][c];
      if (r + 1 < GRID_SIZE && board[r + 1][c] === v) return true;
      if (c + 1 < GRID_SIZE && board[r][c + 1] === v) return true;
    }
  }
  return false;
}

function boardMaxValue(board: Board): number {
  let max = 0;
  for (const row of board) for (const v of row) if (v && v > max) max = v;
  return max;
}

function initBoard(): Board {
  let b = emptyBoard();
  b = addRandomTile(b);
  b = addRandomTile(b);
  return b;
}

// ---------- Componente ----------
export default function PigMerge({
  initialBestScore = 0,
  onBestScoreChange,
  onGoalReached,
}: PigMergeProps) {
  const [board, setBoard] = useState<Board>(() => initBoard());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(initialBestScore);
  const [status, setStatus] = useState<"playing" | "lost">("playing");
  const [toast, setToast] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const shownMilestones = useRef<Set<number>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  const handleMove = useCallback(
    (direction: Direction) => {
      if (status === "lost") return;

      setBoard((prevBoard) => {
        const { board: moved, gained, moved: didMove } = moveBoard(prevBoard, direction);
        if (!didMove) return prevBoard;

        const withNewTile = addRandomTile(moved);

        setScore((prevScore) => {
          const nextScore = prevScore + gained;
          setBest((prevBest) => {
            if (nextScore > prevBest) {
              onBestScoreChange?.(nextScore);
              return nextScore;
            }
            return prevBest;
          });
          return nextScore;
        });

        const maxValue = boardMaxValue(withNewTile);
        for (const milestone of MILESTONES) {
          if (maxValue >= milestone.value && !shownMilestones.current.has(milestone.value)) {
            shownMilestones.current.add(milestone.value);
            showToast(milestone.text);
            if (milestone.value >= WIN_VALUE) onGoalReached?.();
          }
        }

        if (!boardHasMoves(withNewTile)) {
          setStatus("lost");
        }

        return withNewTile;
      });
    },
    [status, onBestScoreChange, onGoalReached, showToast]
  );

  // Controles de teclado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        a: "left",
        d: "right",
        w: "up",
        s: "down",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        handleMove(dir);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleMove]);

  // Controles táctiles (swipe) — móvil primero
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 20;
    if (Math.max(absX, absY) < threshold) return;
    if (absX > absY) {
      handleMove(dx > 0 ? "right" : "left");
    } else {
      handleMove(dy > 0 ? "down" : "up");
    }
    touchStart.current = null;
  };

  const restart = () => {
    setBoard(initBoard());
    setScore(0);
    setStatus("playing");
    setToast(null);
    shownMilestones.current = new Set();
  };

  return (
    <div style={styles.wrapper}>
      <style>{keyframesCss}</style>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🐷 PIG MERGE</h1>
          <p style={styles.subtitle}>Fusiona monedas y haz crecer tu alcancía — un juego de Oinkash</p>
        </div>
        <div style={styles.scoreRow}>
          <div style={styles.scoreBox}>
            <span style={styles.scoreLabel}>AHORRO</span>
            <span style={styles.scoreValue}>{score}</span>
          </div>
          <div style={styles.scoreBox}>
            <span style={styles.scoreLabel}>MEJOR</span>
            <span style={styles.scoreValue}>{best}</span>
          </div>
        </div>
      </div>

      <div style={styles.toolbar}>
        <button style={styles.newGameButton} onClick={restart}>
          Nuevo ahorro
        </button>
      </div>

      <div
        style={styles.boardOuter}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={styles.boardGrid}>
          {board.map((row, r) =>
            row.map((value, c) => {
              const tier = value ? tierFor(value) : null;
              return (
                <div key={`${r}-${c}`} style={styles.cellBg}>
                  {value !== null && (
                    <div
                      style={{
                        ...styles.tile,
                        background: tier!.bg,
                        color: tier!.fg,
                      }}
                    >
                      <span style={styles.tileEmoji}>{tier!.emoji}</span>
                      <span style={styles.tileLabel}>{tier!.label}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {toast && (
          <div style={styles.toast} key={toast}>
            {toast}
          </div>
        )}

        {status === "lost" && (
          <div style={styles.overlay}>
            <p style={styles.overlayTitle}>🐷 Alcancía llena</p>
            <p style={styles.overlaySubtitle}>No hay más movimientos. ¡Intenta de nuevo!</p>
            <button style={styles.overlayButton} onClick={restart}>
              Reiniciar
            </button>
          </div>
        )}
      </div>

      <p style={styles.hint}>
        Desliza (o usa las flechas) para juntar monedas iguales y hacerlas crecer: 🪙 → 💵 → 🐖
        → 🐷 → 💰 → 🏦 → 💎 → 🎯
      </p>
    </div>
  );
}

// ---------- Animaciones ----------
const keyframesCss = `
@keyframes pigMergeToastPop {
  0% { opacity: 0; transform: translate(-50%, -40%) scale(0.6); }
  15% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
  30% { transform: translate(-50%, -50%) scale(1); }
  80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -65%) scale(0.9); }
}
`;

// ---------- Estilos ----------
// Todas las medidas del tablero usan % / clamp() / aspect-ratio para
// verse bien tanto en pantallas de escritorio como en celulares.
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: "100%",
    maxWidth: 480,
    margin: "0 auto",
    padding: "clamp(10px, 3vw, 18px)",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    background: "#FDF6EC",
    borderRadius: 20,
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "clamp(20px, 5vw, 26px)",
    color: "#5C3300",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#8A5A00",
    maxWidth: 220,
  },
  scoreRow: {
    display: "flex",
    gap: 8,
  },
  scoreBox: {
    background: "#FFB13D",
    borderRadius: 10,
    padding: "6px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 60,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#5C3300",
  },
  scoreValue: {
    fontSize: 17,
    fontWeight: 800,
    color: "#3A2100",
  },
  toolbar: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  newGameButton: {
    background: "#4CAF83",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "8px 14px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  boardOuter: {
    position: "relative",
    width: "100%",
    background: "#E8C99A",
    borderRadius: 14,
    padding: "2.5%",
    boxSizing: "border-box",
    touchAction: "none",
    userSelect: "none",
  },
  boardGrid: {
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
    gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
    gap: "2.5%",
  },
  cellBg: {
    position: "relative",
    aspectRatio: "1 / 1",
    background: "#F3DCB4",
    borderRadius: "16%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tile: {
    position: "absolute",
    inset: 0,
    borderRadius: "16%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    transition: "all 0.1s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
  },
  tileEmoji: {
    fontSize: "clamp(18px, 6vw, 34px)",
    lineHeight: 1,
  },
  tileLabel: {
    fontSize: "clamp(9px, 2.6vw, 15px)",
    marginTop: "4%",
  },
  toast: {
    position: "absolute",
    left: "50%",
    top: "45%",
    transform: "translate(-50%, -50%)",
    background: "rgba(58, 33, 0, 0.92)",
    color: "#FFF6E5",
    fontWeight: 800,
    fontSize: "clamp(18px, 6vw, 30px)",
    padding: "10px 22px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    animation: "pigMergeToastPop 1.6s ease forwards",
    zIndex: 5,
  },
  overlay: {
    position: "absolute",
    inset: "2.5%",
    background: "rgba(253, 246, 236, 0.92)",
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 16,
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#3A2100",
    margin: 0,
  },
  overlaySubtitle: {
    fontSize: 13,
    color: "#8A5A00",
    margin: "6px 0 16px",
  },
  overlayButton: {
    background: "#4CAF83",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  hint: {
    fontSize: 11,
    color: "#8A5A00",
    textAlign: "center",
    marginTop: 10,
  },
};

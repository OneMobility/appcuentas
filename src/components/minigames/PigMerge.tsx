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

const GRID_SIZE = 8;
const WIN_VALUE = 8192;

// ---------- Tipos ----------
type CellValue = number | null;
type Board = CellValue[][];

interface PigMergeProps {
  /** Mejor puntaje ya guardado por Oinkash (persistencia externa) */
  initialBestScore?: number;
  /** Se llama cada vez que el mejor puntaje mejora, para que Oinkash lo guarde */
  onBestScoreChange?: (best: number) => void;
  /** Se llama cuando el jugador alcanza la meta de ahorro (tile 2048) */
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

function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
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

function boardHasWon(board: Board): boolean {
  return board.some((row) => row.some((v) => v !== null && v >= WIN_VALUE));
}

function initBoard(): Board {
  let b = emptyBoard();
  // En un tablero 8x8 arrancamos con más monedas para que se sienta lleno.
  const startingTiles = Math.max(2, Math.round((GRID_SIZE * GRID_SIZE) / 16));
  for (let i = 0; i < startingTiles; i++) b = addRandomTile(b);
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
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [keepPlayingAfterWin, setKeepPlayingAfterWin] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleMove = useCallback(
    (direction: Direction) => {
      if (status === "lost") return;
      if (status === "won" && !keepPlayingAfterWin) return;

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

        if (boardHasWon(withNewTile) && status !== "won") {
          setStatus("won");
          onGoalReached?.();
        } else if (!boardHasMoves(withNewTile)) {
          setStatus("lost");
        }

        return withNewTile;
      });
    },
    [status, keepPlayingAfterWin, onBestScoreChange, onGoalReached]
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

  // Controles táctiles (swipe)
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
    const threshold = 24;
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
    setKeepPlayingAfterWin(false);
  };

  // Tamaños de fuente adaptados a un tablero más denso (8x8).
  const emojiFontSize = GRID_SIZE >= 8 ? 13 : 20;
  const labelFontSize = GRID_SIZE >= 8 ? 8 : 12;

  return (
    <div style={styles.wrapper}>
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
                      <span style={{ ...styles.tileEmoji, fontSize: emojiFontSize }}>
                        {tier!.emoji}
                      </span>
                      <span style={{ ...styles.tileLabel, fontSize: labelFontSize }}>
                        {tier!.label}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {status !== "playing" && (
          <div style={styles.overlay}>
            {status === "won" && !keepPlayingAfterWin ? (
              <>
                <p style={styles.overlayTitle}>🎯 ¡Meta de ahorro alcanzada!</p>
                <p style={styles.overlaySubtitle}>Llegaste a la alcancía máxima.</p>
                <div style={styles.overlayButtons}>
                  <button style={styles.overlayButton} onClick={() => setKeepPlayingAfterWin(true)}>
                    Seguir ahorrando
                  </button>
                  <button style={styles.overlayButtonSecondary} onClick={restart}>
                    Reiniciar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={styles.overlayTitle}>🐷 Alcancía llena</p>
                <p style={styles.overlaySubtitle}>No hay más movimientos. ¡Intenta de nuevo!</p>
                <button style={styles.overlayButton} onClick={restart}>
                  Reiniciar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p style={styles.hint}>
        Usa las flechas del teclado (o desliza en móvil) para juntar monedas iguales y hacerlas
        crecer: 🪙 → 💵 → 🐖 → 🐷 → 💰 → 🏦 → 💎 → 🎯
      </p>
    </div>
  );
}

// ---------- Estilos ----------
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    maxWidth: 560,
    margin: "0 auto",
    padding: 16,
    fontFamily:
      "'Segoe UI', system-ui, -apple-system, sans-serif",
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
  },
  title: {
    margin: 0,
    fontSize: 24,
    color: "#5C3300",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#8A5A00",
    maxWidth: 200,
  },
  scoreRow: {
    display: "flex",
    gap: 8,
  },
  scoreBox: {
    background: "#FFB13D",
    borderRadius: 10,
    padding: "6px 10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 56,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#5C3300",
  },
  scoreValue: {
    fontSize: 16,
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
    background: "#E8C99A",
    borderRadius: 14,
    padding: 8,
    touchAction: "none",
  },
  boardGrid: {
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
    gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
    gap: 8,
  },
  cellBg: {
    position: "relative",
    aspectRatio: "1 / 1",
    background: "#F3DCB4",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tile: {
    position: "absolute",
    inset: 0,
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    transition: "all 0.1s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
  },
  tileEmoji: {
    fontSize: 20,
    lineHeight: 1,
  },
  tileLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  overlay: {
    position: "absolute",
    inset: 8,
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
  overlayButtons: {
    display: "flex",
    gap: 8,
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
  overlayButtonSecondary: {
    background: "#FFB13D",
    color: "#3A2100",
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

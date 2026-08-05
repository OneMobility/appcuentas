import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import pigMascot from "./pig-mascot.png";

/**
 * 🐷 SUDOKU DE COCHINITOS — puzzle de lógica por niveles
 * Hecho para Oinkash (app de control de gastos).
 *
 * Según lo que describiste, esto NO es un sudoku clásico de números:
 * es un puzzle de colocar N cochinitos escondidos en un tablero NxN tal
 * que:
 *   - Hay exactamente un cochinito por FILA
 *   - Hay exactamente un cochinito por COLUMNA
 *   - Hay exactamente un cochinito por REGIÓN DE COLOR (el tablero está
 *     pintado en N zonas de colores al azar, una zona por cochinito)
 *   - Dos cochinitos nunca quedan pegados (ni de lado ni en diagonal)
 * Este es el mecanismo del juego de lógica conocido como "Queens", aquí
 * con tema de cochinitos. Si en realidad querías otra mecánica, dímelo
 * y lo ajustamos.
 *
 * Niveles: el tamaño del tablero va variando solo — 6x6 → 8x8 → 10x10 —
 * y vuelve a empezar el ciclo con un tablero nuevo cada vez.
 *
 * Controles: toca una celda para ir alternando vacío → marca (✕) →
 * cochinito → vacío. Las marcas ayudan a descartar celdas mientras
 * razonas la solución, igual que en móvil o PC.
 *
 * Uso:
 *   import PigSudoku from "./PigSudoku";
 *   <PigSudoku onBestScoreChange={(s) => saveToOinkashProfile(s)} initialBestScore={0} />
 *
 * No usa localStorage: el progreso se expone vía props/callback para que
 * la app anfitriona lo persista donde prefiera.
 *
 * Nota: importa "./pig-mascot.png" (el mismo cochinito de los otros
 * minijuegos). Colócalo junto a este archivo o ajusta la ruta.
 */

// ---------- Config ----------
const LEVEL_SIZES = [6, 8, 10];

type CellState = "empty" | "mark" | "pig";

interface Puzzle {
  n: number;
  regions: number[][]; // regions[row][col] = id de región 0..n-1
  colors: string[]; // color por región
}

interface PigSudokuProps {
  /** Mejor cantidad de tableros resueltos ya guardada por Oinkash */
  initialBestScore?: number;
  /** Se llama cada vez que el total resuelto supera el mejor guardado */
  onBestScoreChange?: (best: number) => void;
  /** Se llama cada vez que se resuelve un tablero */
  onPuzzleSolved?: (level: number, seconds: number) => void;
}

// ---------- Utilidades ----------
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Genera una fila de columnas (una por fila) sin repetir columna y sin
 * que dos filas consecutivas queden en columnas adyacentes. */
function generateSolution(n: number): number[] {
  const solution: number[] = new Array(n).fill(-1);
  const used: boolean[] = new Array(n).fill(false);
  const allCols = Array.from({ length: n }, (_, i) => i);

  function backtrack(row: number): boolean {
    if (row === n) return true;
    const candidates = shuffle(allCols.filter((c) => !used[c]));
    for (const c of candidates) {
      if (row > 0 && Math.abs(solution[row - 1] - c) <= 1) continue;
      solution[row] = c;
      used[c] = true;
      if (backtrack(row + 1)) return true;
      used[c] = false;
      solution[row] = -1;
    }
    return false;
  }

  backtrack(0);
  return solution;
}

/** Hace crecer N regiones (una por cochinito solución) hasta cubrir todo el tablero. */
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
      const neighbors = shuffle([
        [fr - 1, fc],
        [fr + 1, fc],
        [fr, fc - 1],
        [fr, fc + 1],
      ]);
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
      if (stuck > n * 6) {
        // Salvavidas: asigna la primera celda libre a una región vecina.
        for (let rr = 0; rr < n && stuck > 0; rr++) {
          for (let cc = 0; cc < n; cc++) {
            if (regions[rr][cc] === -1) {
              let target = 0;
              const neigh = [
                [rr - 1, cc],
                [rr + 1, cc],
                [rr, cc - 1],
                [rr, cc + 1],
              ];
              for (const [nr, nc] of neigh) {
                if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] !== -1) {
                  target = regions[nr][nc];
                  break;
                }
              }
              regions[rr][cc] = target;
              frontiers[target].push([rr, cc]);
              assigned++;
              stuck = 0;
              rr = n;
              break;
            }
          }
        }
      }
    } else {
      stuck = 0;
    }
  }

  return regions;
}

function generateColors(n: number): string[] {
  const baseHue = Math.random() * 360;
  return Array.from({ length: n }, (_, i) => {
    const hue = (baseHue + (360 / n) * i) % 360;
    return `hsl(${hue.toFixed(0)}, 62%, 80%)`;
  });
}

function generatePuzzle(n: number): Puzzle {
  const solution = generateSolution(n);
  const regions = generateRegions(n, solution);
  const colors = generateColors(n);
  return { n, regions, colors };
}

function emptyGrid(n: number): CellState[][] {
  return Array.from({ length: n }, () => new Array(n).fill("empty" as CellState));
}

// ---------- Componente ----------
export default function PigSudoku({
  initialBestScore = 0,
  onBestScoreChange,
  onPuzzleSolved,
}: PigSudokuProps) {
  const [level, setLevel] = useState(1);
  const [puzzle, setPuzzle] = useState<Puzzle>(() => generatePuzzle(LEVEL_SIZES[0]));
  const [grid, setGrid] = useState<CellState[][]>(() => emptyGrid(puzzle.n));
  const [solved, setSolved] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [best, setBest] = useState(initialBestScore);
  const [seconds, setSeconds] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    startTimer();
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newPuzzleForLevel = useCallback(
    (lvl: number) => {
      const n = LEVEL_SIZES[(lvl - 1) % LEVEL_SIZES.length];
      const p = generatePuzzle(n);
      setPuzzle(p);
      setGrid(emptyGrid(n));
      setSolved(false);
      setSeconds(0);
      startTimer();
    },
    [startTimer]
  );

  const cycleCell = (r: number, c: number) => {
    if (solved) return;
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      const cur = next[r][c];
      next[r][c] = cur === "empty" ? "mark" : cur === "mark" ? "pig" : "empty";
      return next;
    });
  };

  // ---------- Detección de conflictos (para resaltar en vivo) ----------
  const { conflicts, pigCount } = useMemo(() => {
    const n = puzzle.n;
    const pigCells: [number, number][] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r]?.[c] === "pig") pigCells.push([r, c]);
      }
    }

    const rowCount = new Array(n).fill(0);
    const colCount = new Array(n).fill(0);
    const regionCount = new Array(n).fill(0);
    for (const [r, c] of pigCells) {
      rowCount[r]++;
      colCount[c]++;
      regionCount[puzzle.regions[r][c]]++;
    }

    const bad = new Set<string>();
    for (const [r, c] of pigCells) {
      if (rowCount[r] > 1 || colCount[c] > 1 || regionCount[puzzle.regions[r][c]] > 1) {
        bad.add(`${r},${c}`);
      }
    }
    // Adyacencia (incluye diagonales)
    for (let i = 0; i < pigCells.length; i++) {
      for (let j = i + 1; j < pigCells.length; j++) {
        const [r1, c1] = pigCells[i];
        const [r2, c2] = pigCells[j];
        if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) {
          bad.add(`${r1},${c1}`);
          bad.add(`${r2},${c2}`);
        }
      }
    }

    return { conflicts: bad, pigCount: pigCells.length };
  }, [grid, puzzle]);

  // ---------- Chequeo de victoria ----------
  useEffect(() => {
    if (solved) return;
    if (pigCount === puzzle.n && conflicts.size === 0) {
      setSolved(true);
      stopTimer();
      setSolvedCount((prevSolved) => {
        const nextSolved = prevSolved + 1;
        setBest((prevBest) => {
          if (nextSolved > prevBest) {
            onBestScoreChange?.(nextSolved);
            return nextSolved;
          }
          return prevBest;
        });
        return nextSolved;
      });
      onPuzzleSolved?.(level, seconds);
    }
  }, [pigCount, conflicts, puzzle.n, solved, stopTimer, onBestScoreChange, onPuzzleSolved, level, seconds]);

  const nextLevel = () => {
    const nextLvl = level + 1;
    setLevel(nextLvl);
    newPuzzleForLevel(nextLvl);
  };

  const shuffleBoard = () => {
    newPuzzleForLevel(level);
  };

  const clearMarks = () => {
    if (solved) return;
    setGrid(emptyGrid(puzzle.n));
  };

  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");

  const n = puzzle.n;

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🐷 Sudoku de Cochinitos</h1>
          <p style={styles.subtitle}>
            Un cochinito por fila, columna y color — sin que se toquen entre ellos
          </p>
        </div>
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>RESUELTOS</span>
            <span style={styles.statValue}>{solvedCount}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>MEJOR</span>
            <span style={styles.statValue}>{best}</span>
          </div>
        </div>
      </div>

      <div style={styles.hudRow}>
        <div style={styles.hudItem}>
          🚩 <strong style={styles.hudStrong}>Nivel {level}</strong> ({n}x{n})
        </div>
        <div style={styles.hudItem}>
          ⏱️ <strong style={styles.hudStrong}>{mm}:{ss}</strong>
        </div>
        <div style={styles.hudItem}>
          🐷 <strong style={styles.hudStrong}>{pigCount}/{n}</strong>
        </div>
      </div>

      <div style={styles.toolbar}>
        <button style={styles.secondaryButton} onClick={clearMarks}>
          Limpiar
        </button>
        <button style={styles.secondaryButton} onClick={shuffleBoard}>
          Nuevo tablero
        </button>
      </div>

      <div style={styles.boardOuter}>
        <div
          style={{
            ...styles.boardGrid,
            gridTemplateColumns: `repeat(${n}, 1fr)`,
            gridTemplateRows: `repeat(${n}, 1fr)`,
          }}
        >
          {grid.map((row, r) =>
            row.map((state, c) => {
              const region = puzzle.regions[r][c];
              const isConflict = conflicts.has(`${r},${c}`);
              const borderRight =
                c < n - 1 && puzzle.regions[r][c + 1] !== region ? "2px solid #5C3300" : "1px solid rgba(92,51,0,0.12)";
              const borderBottom =
                r < n - 1 && puzzle.regions[r + 1][c] !== region ? "2px solid #5C3300" : "1px solid rgba(92,51,0,0.12)";
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => cycleCell(r, c)}
                  style={{
                    ...styles.cell,
                    background: puzzle.colors[region],
                    borderRight,
                    borderBottom,
                    boxShadow: isConflict ? "inset 0 0 0 3px #E4572E" : "none",
                  }}
                  aria-label={`Celda fila ${r + 1}, columna ${c + 1}`}
                >
                  {state === "pig" && (
                    <img src={pigMascot} alt="" style={styles.pigIcon} />
                  )}
                  {state === "mark" && <span style={styles.markIcon}>✕</span>}
                </button>
              );
            })
          )}
        </div>

        {solved && (
          <div style={styles.overlay}>
            <img src={pigMascot} alt="" style={styles.overlayMascot} />
            <p style={styles.overlayTitle}>🎉 ¡Tablero resuelto!</p>
            <p style={styles.overlaySubtitle}>
              Nivel {level} ({n}x{n}) en {mm}:{ss}
            </p>
            <button style={styles.overlayButton} onClick={nextLevel}>
              Siguiente nivel
            </button>
          </div>
        )}
      </div>

      <p style={styles.hint}>
        Toca una celda: vacío → ✕ (marca) → 🐷 → vacío. Un cochinito por fila, por columna y por
        color, y nunca dos pegados (ni en diagonal).
      </p>
    </div>
  );
}

// ---------- Estilos ----------
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
    marginBottom: 8,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "clamp(18px, 4.6vw, 24px)",
    color: "#5C3300",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#8A5A00",
    maxWidth: 240,
  },
  statsRow: {
    display: "flex",
    gap: 8,
  },
  statBox: {
    background: "#FFB13D",
    borderRadius: 10,
    padding: "6px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 60,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#5C3300",
  },
  statValue: {
    fontSize: 17,
    fontWeight: 800,
    color: "#3A2100",
  },
  hudRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#F3DCB4",
    borderRadius: 10,
    padding: "6px 12px",
    marginBottom: 8,
    fontSize: 13,
    color: "#5C3300",
    gap: 8,
    flexWrap: "wrap",
  },
  hudItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap",
  },
  hudStrong: {
    color: "#3A2100",
  },
  toolbar: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 8,
  },
  secondaryButton: {
    background: "#5C3300",
    color: "#FFF6E5",
    border: "none",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  boardOuter: {
    position: "relative",
    width: "100%",
    background: "#5C3300",
    borderRadius: 14,
    padding: "1.5%",
    boxSizing: "border-box",
  },
  boardGrid: {
    display: "grid",
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 8,
    overflow: "hidden",
  },
  cell: {
    position: "relative",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
  },
  pigIcon: {
    width: "72%",
    height: "72%",
    objectFit: "contain",
    pointerEvents: "none",
  },
  markIcon: {
    fontSize: "clamp(12px, 3.6vw, 18px)",
    color: "rgba(58,33,0,0.55)",
    fontWeight: 800,
    pointerEvents: "none",
  },
  overlay: {
    position: "absolute",
    inset: "1.5%",
    background: "rgba(253, 246, 236, 0.95)",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 16,
  },
  overlayMascot: {
    width: 60,
    height: "auto",
    marginBottom: 6,
  },
  overlayTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: "#3A2100",
    margin: 0,
  },
  overlaySubtitle: {
    fontSize: 13,
    color: "#8A5A00",
    margin: "8px 0 16px",
  },
  overlayButton: {
    background: "#4CAF83",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 18px",
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

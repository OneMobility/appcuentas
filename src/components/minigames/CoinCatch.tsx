import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * 🪙 COIN CATCH — mini-juego arcade de atrapar monedas
 * Hecho para Oinkash (app de control de gastos).
 *
 * Género: Catch / Arcade
 * - Atrapa monedas y billetes, evita gastos, impuestos y facturas.
 * - Rachas de aciertos suben el multiplicador de puntos (x1 → x5).
 * - Partidas rápidas de 60 segundos, 3 vidas.
 *
 * Controles:
 *  - Móvil: arrastra el dedo sobre el área de juego para mover la canasta.
 *  - PC: flechas ← → (mantenidas para movimiento continuo) o arrastra con el mouse.
 *
 * Uso:
 *   import CoinCatch from "./CoinCatch";
 *   <CoinCatch onBestScoreChange={(s) => saveToOinkashProfile(s)} initialBestScore={0} />
 *
 * No usa localStorage: el mejor puntaje se expone vía props/callback para
 * que la app anfitriona persista el dato donde prefiera.
 */

// ---------- Config ----------
const GAME_SECONDS = 60;
const STARTING_LIVES = 3;
const CATCH_LINE = 86; // % vertical donde vive la canasta
const MISS_LINE = 101; // % vertical donde se considera "cayó al piso"
const BASKET_HALF_WIDTH = 9; // % de ancho medio de la canasta
const CATCH_TOLERANCE = 10; // % de tolerancia horizontal para atrapar
const STREAK_PER_MULT_LEVEL = 3; // aciertos seguidos para subir un nivel de multiplicador
const MAX_MULTIPLIER = 5;

type GoodKind = "coin" | "bill" | "bag";
type BadKind = "gasto" | "impuesto" | "factura";
type Kind = GoodKind | BadKind;

type ItemDef = {
  emoji: string;
  points: number;
  bad: boolean;
  weight: number; // probabilidad relativa dentro de su grupo (bueno/malo)
};

const ITEM_DEFS: Record<Kind, ItemDef> = {
  coin: { emoji: "🪙", points: 10, bad: false, weight: 5 },
  bill: { emoji: "💵", points: 25, bad: false, weight: 3 },
  bag: { emoji: "💰", points: 50, bad: false, weight: 1 },
  gasto: { emoji: "💸", points: 0, bad: true, weight: 4 },
  impuesto: { emoji: "🏛️", points: 0, bad: true, weight: 3 },
  factura: { emoji: "🧾", points: 0, bad: true, weight: 3 },
};

const GOOD_KINDS: GoodKind[] = ["coin", "bill", "bag"];
const BAD_KINDS: BadKind[] = ["gasto", "impuesto", "factura"];

function pickWeighted<K extends Kind>(kinds: K[]): K {
  const total = kinds.reduce((sum, k) => sum + ITEM_DEFS[k].weight, 0);
  let roll = Math.random() * total;
  for (const k of kinds) {
    roll -= ITEM_DEFS[k].weight;
    if (roll <= 0) return k;
  }
  return kinds[kinds.length - 1];
}

interface FallingItem {
  id: number;
  kind: Kind;
  x: number; // % horizontal, 0-100
  y: number; // % vertical, 0-100+
  speed: number; // %/segundo
  caught: boolean;
}

interface CoinCatchProps {
  /** Mejor puntaje ya guardado por Oinkash (persistencia externa) */
  initialBestScore?: number;
  /** Se llama cada vez que el mejor puntaje mejora, para que Oinkash lo guarde */
  onBestScoreChange?: (best: number) => void;
  /** Se llama al terminar una partida, con el puntaje final */
  onGameOver?: (score: number) => void;
}

type Phase = "idle" | "playing" | "over";

// ---------- Componente ----------
export default function CoinCatch({
  initialBestScore = 0,
  onBestScoreChange,
  onGameOver,
}: CoinCatchProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(initialBestScore);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [basketX, setBasketX] = useState(50);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);

  const fieldRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<FallingItem[]>([]);
  const basketXRef = useRef(50);
  const nextIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const spawnAccumulatorRef = useRef(0);
  const elapsedRef = useRef(0);
  const draggingRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streakRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const scoreRef = useRef(0);

  const showFlash = useCallback((kind: "good" | "bad") => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlash(kind);
    flashTimerRef.current = setTimeout(() => setFlash(null), 220);
  }, []);

  const endGame = useCallback(() => {
    setPhase("over");
    setBest((prevBest) => {
      if (scoreRef.current > prevBest) {
        onBestScoreChange?.(scoreRef.current);
        return scoreRef.current;
      }
      return prevBest;
    });
    onGameOver?.(scoreRef.current);
  }, [onBestScoreChange, onGameOver]);

  const startGame = useCallback(() => {
    itemsRef.current = [];
    nextIdRef.current = 0;
    spawnAccumulatorRef.current = 0;
    elapsedRef.current = 0;
    streakRef.current = 0;
    livesRef.current = STARTING_LIVES;
    scoreRef.current = 0;
    basketXRef.current = 50;

    setItems([]);
    setScore(0);
    setLives(STARTING_LIVES);
    setTimeLeft(GAME_SECONDS);
    setStreak(0);
    setMultiplier(1);
    setBasketX(50);
    setFlash(null);
    setPhase("playing");
  }, []);

  // ---------- Bucle principal del juego ----------
  useEffect(() => {
    if (phase !== "playing") return;

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      elapsedRef.current += dt;

      // Movimiento continuo con teclado
      const moveSpeed = 70; // %/seg
      if (keysRef.current.has("ArrowLeft")) {
        basketXRef.current = Math.max(BASKET_HALF_WIDTH, basketXRef.current - moveSpeed * dt);
      }
      if (keysRef.current.has("ArrowRight")) {
        basketXRef.current = Math.min(100 - BASKET_HALF_WIDTH, basketXRef.current + moveSpeed * dt);
      }

      // Dificultad: la partida se acelera durante los 60s
      const progress = Math.min(1, elapsedRef.current / GAME_SECONDS);
      const spawnInterval = 0.9 - 0.55 * progress; // de 0.9s a 0.35s
      const fallDuration = 3.2 - 1.6 * progress; // de 3.2s a 1.6s en cruzar la pantalla

      spawnAccumulatorRef.current += dt;
      if (spawnAccumulatorRef.current >= spawnInterval) {
        spawnAccumulatorRef.current = 0;
        const isBad = Math.random() < 0.32;
        const kind: Kind = isBad ? pickWeighted(BAD_KINDS) : pickWeighted(GOOD_KINDS);
        itemsRef.current.push({
          id: nextIdRef.current++,
          kind,
          x: 8 + Math.random() * 84,
          y: -8,
          speed: 100 / fallDuration,
          caught: false,
        });
      }

      // Actualiza posiciones y detecta colisiones / misses
      const remaining: FallingItem[] = [];
      for (const item of itemsRef.current) {
        const newY = item.y + item.speed * dt;

        if (!item.caught && newY >= CATCH_LINE && newY < MISS_LINE) {
          const dx = Math.abs(item.x - basketXRef.current);
          if (dx <= CATCH_TOLERANCE) {
            const def = ITEM_DEFS[item.kind];
            if (def.bad) {
              livesRef.current -= 1;
              streakRef.current = 0;
              setStreak(0);
              setMultiplier(1);
              setLives(livesRef.current);
              showFlash("bad");
            } else {
              streakRef.current += 1;
              const mult = Math.min(
                MAX_MULTIPLIER,
                1 + Math.floor(streakRef.current / STREAK_PER_MULT_LEVEL)
              );
              scoreRef.current += def.points * mult;
              setStreak(streakRef.current);
              setMultiplier(mult);
              setScore(scoreRef.current);
              showFlash("good");
            }
            continue; // el item se elimina al ser atrapado
          }
        }

        if (newY >= MISS_LINE) {
          const def = ITEM_DEFS[item.kind];
          if (!def.bad) {
            // se te escapó una moneda buena: se corta la racha
            streakRef.current = 0;
            setStreak(0);
            setMultiplier(1);
          }
          continue; // se elimina al salir de la pantalla
        }

        remaining.push({ ...item, y: newY });
      }
      itemsRef.current = remaining;

      setItems([...itemsRef.current]);
      setBasketX(basketXRef.current);

      if (livesRef.current <= 0) {
        endGame();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, endGame, showFlash]);

  // ---------- Cuenta regresiva ----------
  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) {
      endGame();
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timeLeft, endGame]);

  // ---------- Teclado ----------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        keysRef.current.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ---------- Arrastre táctil / mouse ----------
  const setBasketFromClientX = useCallback((clientX: number) => {
    const field = fieldRef.current;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    basketXRef.current = Math.max(BASKET_HALF_WIDTH, Math.min(100 - BASKET_HALF_WIDTH, pct));
    setBasketX(basketXRef.current);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== "playing") return;
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setBasketFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    setBasketFromClientX(e.clientX);
  };
  const stopDragging = () => {
    draggingRef.current = false;
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🪙 COIN CATCH</h1>
          <p style={styles.subtitle}>Atrapa el ahorro, esquiva los gastos — un juego de Oinkash</p>
        </div>
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>PUNTOS</span>
            <span style={styles.statValue}>{score}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>MEJOR</span>
            <span style={styles.statValue}>{best}</span>
          </div>
        </div>
      </div>

      <div style={styles.hudRow}>
        <div style={styles.hudItem}>
          ⏱️ <strong style={styles.hudStrong}>{timeLeft}s</strong>
        </div>
        <div style={styles.hudItem}>
          {Array.from({ length: STARTING_LIVES }).map((_, i) => (
            <span key={i} style={{ opacity: i < lives ? 1 : 0.25, marginLeft: i ? 2 : 0 }}>
              🐷
            </span>
          ))}
        </div>
        <div style={styles.hudItem}>
          🔥 <strong style={styles.hudStrong}>x{multiplier}</strong>
        </div>
      </div>

      <div
        ref={fieldRef}
        style={{
          ...styles.field,
          boxShadow:
            flash === "good"
              ? "inset 0 0 0 6px #4CAF83"
              : flash === "bad"
              ? "inset 0 0 0 6px #E4572E"
              : "inset 0 0 0 0px transparent",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
        onPointerCancel={stopDragging}
      >
        {items.map((item) => {
          const def = ITEM_DEFS[item.kind];
          return (
            <div
              key={item.id}
              style={{
                ...styles.item,
                left: `${item.x}%`,
                top: `${item.y}%`,
              }}
            >
              {def.emoji}
            </div>
          );
        })}

        <div
          style={{
            ...styles.basket,
            left: `${basketX}%`,
          }}
        >
          🐷
        </div>

        {phase === "idle" && (
          <div style={styles.overlay}>
            <p style={styles.overlayTitle}>🪙 Coin Catch</p>
            <p style={styles.overlaySubtitle}>
              Atrapa monedas y billetes. Evita gastos, impuestos y facturas.
              <br />
              Arrastra el dedo (o el mouse) o usa ← → para mover a tu cerdito.
              <br />
              Tienes 3 vidas y 60 segundos.
            </p>
            <button style={styles.overlayButton} onClick={startGame}>
              Jugar
            </button>
          </div>
        )}

        {phase === "over" && (
          <div style={styles.overlay}>
            <p style={styles.overlayTitle}>🐷 ¡Se acabó!</p>
            <p style={styles.overlaySubtitle}>
              Puntaje: <strong>{score}</strong>
              {score >= best && score > 0 ? " · ¡Nuevo mejor puntaje! 🎉" : ""}
            </p>
            <button style={styles.overlayButton} onClick={startGame}>
              Jugar de nuevo
            </button>
          </div>
        )}
      </div>

      <p style={styles.hint}>
        🪙 💵 💰 suman puntos y racha · 💸 🏛️ 🧾 te quitan una vida y reinician el multiplicador
      </p>
    </div>
  );
}

// ---------- Estilos ----------
// Medidas en % / clamp() para que el campo de juego se adapte a celulares.
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
    fontSize: "clamp(20px, 5vw, 26px)",
    color: "#5C3300",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#8A5A00",
    maxWidth: 220,
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
    fontSize: 14,
    color: "#5C3300",
  },
  hudItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  hudStrong: {
    color: "#3A2100",
  },
  field: {
    position: "relative",
    width: "100%",
    aspectRatio: "3 / 4",
    background: "linear-gradient(#FFF6E5, #F3DCB4)",
    borderRadius: 14,
    overflow: "hidden",
    touchAction: "none",
    userSelect: "none",
    transition: "box-shadow 0.1s ease",
  },
  item: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    fontSize: "clamp(20px, 6vw, 30px)",
    lineHeight: 1,
    pointerEvents: "none",
  },
  basket: {
    position: "absolute",
    top: "88%",
    transform: "translate(-50%, -50%)",
    fontSize: "clamp(28px, 8vw, 40px)",
    lineHeight: 1,
    pointerEvents: "none",
    filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.25))",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(253, 246, 236, 0.95)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 20,
  },
  overlayTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#3A2100",
    margin: 0,
  },
  overlaySubtitle: {
    fontSize: 13,
    color: "#8A5A00",
    margin: "10px 0 18px",
    lineHeight: 1.5,
  },
  overlayButton: {
    background: "#4CAF83",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 22px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  hint: {
    fontSize: 11,
    color: "#8A5A00",
    textAlign: "center",
    marginTop: 10,
  },
};

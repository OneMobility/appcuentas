import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 🪙 COIN CATCH — Versión Oinkash Master (Con Imágenes Personalizadas)
 */

const STARTING_LIVES = 3;
const CATCH_LINE = 86; 
const MISS_LINE = 101; 
const BASKET_HALF_WIDTH = 12; // Un poco más ancho para la imagen
const CATCH_TOLERANCE = 12; 
const STREAK_PER_MULT_LEVEL = 3; 
const MAX_MULTIPLIER = 5;
const BASE_MOVE_SPEED = 90; 
const SPEED_PENALTY_PER_LIFE = 20; 

type GoodKind = "coin" | "bill" | "bag";
type BadKind = "gasto" | "impuesto" | "factura";
type Kind = GoodKind | BadKind;

type ItemDef = {
  emoji?: string;
  image?: string;
  points: number;
  bad: boolean;
  weight: number; 
};

const ITEM_DEFS: Record<Kind, ItemDef> = {
  coin: { image: "/game-coin.png", points: 10, bad: false, weight: 5 },
  bill: { image: "/game-coin.png", points: 25, bad: false, weight: 3 },
  bag: { image: "/game-coin.png", points: 50, bad: false, weight: 1 },
  gasto: { emoji: "💸", points: 0, bad: true, weight: 4 },
  impuesto: { emoji: "🏛️", points: 0, bad: true, weight: 3 },
  factura: { emoji: "🧾", points: -20, bad: true, weight: 3 },
};

const GOOD_KINDS: GoodKind[] = ["coin", "bill", "bag"];
const BAD_KINDS: BadKind[] = ["gasto", "impuesto", "factura"];

const MILESTONES = [
  { score: 100, text: "¡BIEN!", emoji: "" },
  { score: 500, text: "¡EXCELENTE!", emoji: "" },
  { score: 1000, text: "¡GENIAL!", emoji: "" },
  { score: 2000, text: "¡ERES ÚNICO!", emoji: "" },
  { score: 5000, text: "¡EXCELENTE!", emoji: "" },
  { score: 10000, text: "¡DOMINAS!", emoji: "" },
  { score: 15000, text: "¡EL REY!", emoji: "💎" },
];

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
  x: number; 
  y: number; 
  speed: number; 
  caught: boolean;
}

interface CoinCatchProps {
  initialBestScore?: number;
  onBestScoreChange?: (best: number) => void;
  onGameOver?: (score: number) => void;
}

type Phase = "idle" | "playing" | "over";

export default function CoinCatch({
  initialBestScore = 0,
  onBestScoreChange,
  onGameOver,
}: CoinCatchProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(initialBestScore);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [basketX, setBasketX] = useState(50);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  
  const [milestone, setMilestone] = useState<{ text: string, emoji: string } | null>(null);
  const triggeredMilestones = useRef<Set<number>>(new Set());

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
    triggeredMilestones.current = new Set();

    setItems([]);
    setScore(0);
    setLives(STARTING_LIVES);
    setStreak(0);
    setMultiplier(1);
    setBasketX(50);
    setFlash(null);
    setMilestone(null);
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      elapsedRef.current += dt;

      const livesLost = STARTING_LIVES - livesRef.current;
      const currentMoveSpeed = Math.max(30, BASE_MOVE_SPEED - (livesLost * SPEED_PENALTY_PER_LIFE));

      if (keysRef.current.has("ArrowLeft")) {
        basketXRef.current = Math.max(BASKET_HALF_WIDTH, basketXRef.current - currentMoveSpeed * dt);
      }
      if (keysRef.current.has("ArrowRight")) {
        basketXRef.current = Math.min(100 - BASKET_HALF_WIDTH, basketXRef.current + currentMoveSpeed * dt);
      }

      const timeProgress = Math.min(1, elapsedRef.current / 120);
      const scoreSpeedMult = 1 + (Math.floor(scoreRef.current / 1000) * 0.1); 
      
      const spawnInterval = (1.0 - 0.65 * timeProgress) / (scoreSpeedMult * 0.8); 
      const fallDuration = (3.5 - 1.8 * timeProgress) / scoreSpeedMult; 

      spawnAccumulatorRef.current += dt;
      if (spawnAccumulatorRef.current >= spawnInterval) {
        spawnAccumulatorRef.current = 0;
        const isBad = Math.random() < 0.35;
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
              if (item.kind === "factura") {
                scoreRef.current = Math.max(0, scoreRef.current + def.points);
              }
              setStreak(0);
              setMultiplier(1);
              setLives(livesRef.current);
              setScore(scoreRef.current);
              showFlash("bad");
            } else {
              streakRef.current += 1;
              const mult = Math.min(MAX_MULTIPLIER, 1 + Math.floor(streakRef.current / STREAK_PER_MULT_LEVEL));
              scoreRef.current += def.points * mult;
              const currentScore = scoreRef.current;
              MILESTONES.forEach(m => {
                if (currentScore >= m.score && !triggeredMilestones.current.has(m.score)) {
                  setMilestone({ text: m.text, emoji: m.emoji });
                  triggeredMilestones.current.add(m.score);
                  setTimeout(() => setMilestone(null), 2500);
                }
              });
              setStreak(streakRef.current);
              setMultiplier(mult);
              setScore(scoreRef.current);
              showFlash("good");
            }
            continue; 
          }
        }

        if (newY >= MISS_LINE) {
          const def = ITEM_DEFS[item.kind];
          if (!def.bad) {
            streakRef.current = 0;
            setStreak(0);
            setMultiplier(1);
          }
          continue; 
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

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🪙 COIN CATCH</h1>
          <p style={styles.subtitle}>¡Cada 1000 pts aumenta el reto!</p>
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
          🕹️ <strong style={styles.hudStrong}>Survival</strong>
        </div>
        <div style={styles.hudItem}>
          {Array.from({ length: STARTING_LIVES }).map((_, i) => (
            <span key={i} style={{ opacity: i < lives ? 1 : 0.2, marginLeft: i ? 2 : 0, filter: i < lives ? 'none' : 'grayscale(1)' }}>
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
              ? "inset 0 0 0 10px rgba(76, 175, 131, 0.4)"
              : flash === "bad"
              ? "inset 0 0 0 10px rgba(228, 87, 46, 0.4)"
              : "inset 0 0 0 0px transparent",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (draggingRef.current = false)}
        onPointerLeave={() => (draggingRef.current = false)}
        onPointerCancel={() => (draggingRef.current = false)}
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
              {def.image ? (
                <img src={def.image} alt="coin" style={styles.itemImage} />
              ) : (
                def.emoji
              )}
            </div>
          );
        })}

        <div
          style={{
            ...styles.basket,
            left: `${basketX}%`,
            opacity: lives === 3 ? 1 : lives === 2 ? 0.9 : 0.8
          }}
        >
          <img src="/game-character.png" alt="pig" style={styles.characterImage} />
        </div>

        <AnimatePresence>
          {milestone && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1.2, opacity: 1, y: -80 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30"
            >
              {milestone.emoji && <span className="text-4xl mb-2">{milestone.emoji}</span>}
              <span className="text-4xl font-black text-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] italic text-center px-4">
                {milestone.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === "idle" && (
          <div style={styles.overlay}>
            <img src="/game-character.png" className="h-24 w-24 mb-4 object-contain" />
            <p style={styles.overlayTitle}>🪙 Coin Catch</p>
            <p style={styles.overlaySubtitle}>
              Atrapa las monedas para ganar puntos.
              <br />
              ¡Cuidado! Perder vidas te hará más lento.
              <br />
              Ojo: ¡Las 🧾 restan puntos!
            </p>
            <button style={styles.overlayButton} onClick={startGame}>
              ¡A Ahorrar!
            </button>
          </div>
        )}

        {phase === "over" && (
          <div style={styles.overlay}>
            <p style={styles.overlayTitle}>🐷 ¡Sin vidas!</p>
            <p style={styles.overlaySubtitle}>
              Lograste juntar: <strong>{score}</strong>
              {score >= best && score > 0 ? " · ¡Nuevo récord personal! 🎉" : ""}
            </p>
            <button style={styles.overlayButton} onClick={startGame}>
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>

      <p style={styles.hint}>
        Vidas: {lives} · Velocidad Cerdo: {lives === 3 ? '100%' : lives === 2 ? '75%' : '50%'}
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: "100%",
    maxWidth: 480,
    margin: "0 auto",
    padding: "16px",
    fontFamily: "'Quicksand', sans-serif",
    background: "#fff",
    borderRadius: 32,
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
    fontSize: 24,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.05em",
  },
  subtitle: {
    margin: "2px 0 0",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  statsRow: {
    display: "flex",
    gap: 8,
  },
  statBox: {
    background: "#f1f5f9",
    borderRadius: 16,
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 70,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: 800,
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  hudRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#0f172a",
    borderRadius: 16,
    padding: "8px 16px",
    marginBottom: 12,
    fontSize: 13,
    color: "#fff",
  },
  hudItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  hudStrong: {
    color: "#fff",
  },
  field: {
    position: "relative",
    width: "100%",
    aspectRatio: "3 / 4",
    borderRadius: 24,
    overflow: "hidden",
    touchAction: "none",
    userSelect: "none",
    transition: "box-shadow 0.2s ease",
    border: "4px solid #f1f5f9",
    backgroundColor: "#f8fafc",
  },
  item: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    fontSize: "clamp(24px, 7vw, 34px)",
    lineHeight: 1,
    pointerEvents: "none",
    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
  },
  itemImage: {
    width: "40px",
    height: "40px",
    objectFit: "contain",
  },
  basket: {
    position: "absolute",
    top: "88%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.2))",
    width: "80px",
    height: "80px",
  },
  characterImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(255, 255, 255, 0.95)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
    zIndex: 40,
    backdropBlur: "4px",
  },
  overlayTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: "#0f172a",
    margin: 0,
    letterSpacing: "-0.05em",
  },
  overlaySubtitle: {
    fontSize: 14,
    color: "#64748b",
    margin: "12px 0 24px",
    lineHeight: 1.6,
    fontWeight: 600,
  },
  overlayButton: {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 16,
    padding: "16px 32px",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)",
  },
  hint: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 12,
    fontWeight: 600,
  },
};
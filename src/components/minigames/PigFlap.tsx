import React, { useCallback, useEffect, useRef, useState } from "react";
import pigMascot from "./pig-mascot.png";

/**
 * 🐷 PIG FLAP — estilo Flappy Bird, por niveles, con jefe final
 * Hecho para Oinkash (app de control de gastos).
 *
 * - 3 niveles cortos de dificultad creciente (aletea para esquivar
 *   columnas de "gastos"/facturas).
 * - Al completar el nivel 3 aparece el Monstruo de las Deudas.
 * - Se destruye chocando N veces contra su punto débil (el hueco que
 *   se mueve): cada 2s que logras mantenerte dentro del hueco le
 *   quitas una vida al jefe. Tocar su cuerpo sólido = fin de la partida,
 *   igual que chocar una columna normal.
 * - Al destruirlo, explota en una lluvia de monedas y ganas la partida.
 *
 * Controles: un solo toque/clic (o barra espaciadora) para aletear —
 * funciona igual en móvil y PC.
 *
 * Uso:
 *   import PigFlap from "./PigFlap";
 *   <PigFlap onBestScoreChange={(s) => saveToOinkashProfile(s)} initialBestScore={0} />
 *
 * No usa localStorage: el mejor puntaje se expone vía props/callback para
 * que la app anfitriona persista el dato donde prefiera.
 *
 * Nota: importa "./pig-mascot.png" (el cochinito ya usado en Coin Catch).
 * Colócalo junto a este archivo o ajusta la ruta del import.
 */

// ---------- Config física ----------
const BIRD_X = 24; // % fijo horizontal del cerdito
const BIRD_SIZE = 9; // % ancho/alto visual del cerdito
const GRAVITY = 130; // %/s²
const FLAP_VELOCITY = -46; // %/s
const MAX_FALL_SPEED = 85; // %/s

// ---------- Config niveles ----------
const PIPES_PER_LEVEL = 6;
const LEVELS = [
  { speed: 34, gapHeight: 32, spacing: 46 }, // nivel 1
  { speed: 42, gapHeight: 28, spacing: 44 }, // nivel 2
  { speed: 50, gapHeight: 24, spacing: 42 }, // nivel 3
];
const PIPE_WIDTH = 12; // %

// ---------- Config jefe ----------
const BOSS_WIDTH = 18; // %
const BOSS_GAP_HEIGHT = 26; // %
const BOSS_MAX_HEALTH = 5;
const BOSS_HIT_INTERVAL = 2; // segundos dentro del hueco para restar 1 de vida
const BOSS_ENTER_SPEED = 60; // %/s al entrar en escena
const BOSS_REST_X = BIRD_X; // se detiene justo en la columna del cerdito
const BOSS_OSC_PERIOD = 3.4; // segundos por ciclo de su movimiento

type Phase = "idle" | "playing" | "transition" | "boss" | "win" | "gameover";

interface Pipe {
  id: number;
  x: number;
  gapY: number;
  gapHeight: number;
  passed: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  emoji: string;
}

interface PigFlapProps {
  /** Mejor puntaje ya guardado por Oinkash (persistencia externa) */
  initialBestScore?: number;
  /** Se llama cada vez que el mejor puntaje mejora, para que Oinkash lo guarde */
  onBestScoreChange?: (best: number) => void;
  /** Se llama al terminar una partida (por derrota), con el puntaje final */
  onGameOver?: (score: number) => void;
  /** Se llama al destruir al jefe y ganar la partida */
  onVictory?: (score: number) => void;
}

const PARTICLE_EMOJIS = ["🪙", "💰", "💵", "✨"];

export default function PigFlap({
  initialBestScore = 0,
  onBestScoreChange,
  onGameOver,
  onVictory,
}: PigFlapProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(initialBestScore);
  const [birdY, setBirdY] = useState(50);
  const [birdAngle, setBirdAngle] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [bossState, setBossState] = useState({
    x: 120,
    gapY: 50,
    health: BOSS_MAX_HEALTH,
    hitFlash: false,
  });
  const [particles, setParticles] = useState<Particle[]>([]);

  const fieldRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const birdYRef = useRef(50);
  const birdVelRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const nextPipeIdRef = useRef(0);
  const spawnAccRef = useRef(0);
  const pipesPassedRef = useRef(0);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");

  const bossXRef = useRef(120);
  const bossGapYRef = useRef(50);
  const bossHealthRef = useRef(BOSS_MAX_HEALTH);
  const bossTimeRef = useRef(0);
  const bossInsideTimerRef = useRef(0);
  const bossRestedRef = useRef(false);

  const particlesRef = useRef<Particle[]>([]);
  const nextParticleIdRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ---------- Helpers ----------
  const resetRun = useCallback(() => {
    birdYRef.current = 50;
    birdVelRef.current = 0;
    pipesRef.current = [];
    nextPipeIdRef.current = 0;
    spawnAccRef.current = 0;
    pipesPassedRef.current = 0;
    levelRef.current = 1;
    scoreRef.current = 0;
    bossXRef.current = 120;
    bossGapYRef.current = 50;
    bossHealthRef.current = BOSS_MAX_HEALTH;
    bossTimeRef.current = 0;
    bossInsideTimerRef.current = 0;
    bossRestedRef.current = false;
    particlesRef.current = [];

    setBirdY(50);
    setBirdAngle(0);
    setPipes([]);
    setScore(0);
    setLevel(1);
    setBossState({ x: 120, gapY: 50, health: BOSS_MAX_HEALTH, hitFlash: false });
    setParticles([]);
  }, []);

  const startGame = useCallback(() => {
    resetRun();
    setPhase("playing");
  }, [resetRun]);

  const die = useCallback(() => {
    setPhase("gameover");
    setBest((prevBest) => {
      if (scoreRef.current > prevBest) {
        onBestScoreChange?.(scoreRef.current);
        return scoreRef.current;
      }
      return prevBest;
    });
    onGameOver?.(scoreRef.current);
  }, [onBestScoreChange, onGameOver]);

  const flap = useCallback(() => {
    const p = phaseRef.current;
    if (p === "idle") {
      startGame();
      return;
    }
    if (p === "playing" || p === "boss") {
      birdVelRef.current = FLAP_VELOCITY;
    }
  }, [startGame]);

  const continueToNextLevel = useCallback(() => {
    pipesPassedRef.current = 0;
    pipesRef.current = [];
    spawnAccRef.current = 0;
    setPipes([]);
    birdVelRef.current = 0;

    if (levelRef.current >= 3) {
      bossXRef.current = 120;
      bossGapYRef.current = 50;
      bossHealthRef.current = BOSS_MAX_HEALTH;
      bossTimeRef.current = 0;
      bossInsideTimerRef.current = 0;
      bossRestedRef.current = false;
      setBossState({ x: 120, gapY: 50, health: BOSS_MAX_HEALTH, hitFlash: false });
      setPhase("boss");
    } else {
      levelRef.current += 1;
      setLevel(levelRef.current);
      setPhase("playing");
    }
  }, []);

  const spawnExplosion = useCallback((x: number, y: number) => {
    const created: Particle[] = [];
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 55;
      created.push({
        id: nextParticleIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 1,
        emoji: PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)],
      });
    }
    particlesRef.current = [...particlesRef.current, ...created];
    setParticles([...particlesRef.current]);
  }, []);

  // ---------- Bucle principal ----------
  useEffect(() => {
    if (phase !== "playing" && phase !== "boss") return;

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Física del cerdito
      birdVelRef.current = Math.min(MAX_FALL_SPEED, birdVelRef.current + GRAVITY * dt);
      birdYRef.current += birdVelRef.current * dt;

      const outOfBounds = birdYRef.current <= 0 || birdYRef.current >= 100;
      birdYRef.current = Math.max(0, Math.min(100, birdYRef.current));
      setBirdY(birdYRef.current);
      setBirdAngle(Math.max(-25, Math.min(70, birdVelRef.current * 0.6)));

      if (outOfBounds) {
        die();
        return;
      }

      if (phase === "playing") {
        const cfg = LEVELS[levelRef.current - 1];

        spawnAccRef.current += dt;
        const spawnInterval = cfg.spacing / cfg.speed;
        if (spawnAccRef.current >= spawnInterval) {
          spawnAccRef.current = 0;
          const margin = cfg.gapHeight / 2 + 8;
          pipesRef.current.push({
            id: nextPipeIdRef.current++,
            x: 110,
            gapY: margin + Math.random() * (100 - margin * 2),
            gapHeight: cfg.gapHeight,
            passed: false,
          });
        }

        let collided = false;
        const remaining: Pipe[] = [];
        for (const pipe of pipesRef.current) {
          const newX = pipe.x - cfg.speed * dt;
          if (newX < -PIPE_WIDTH - 2) continue; // fuera de pantalla

          const overlapsX =
            BIRD_X + BIRD_SIZE / 2 > newX - PIPE_WIDTH / 2 &&
            BIRD_X - BIRD_SIZE / 2 < newX + PIPE_WIDTH / 2;
          if (overlapsX) {
            const topGap = pipe.gapY - pipe.gapHeight / 2;
            const bottomGap = pipe.gapY + pipe.gapHeight / 2;
            const birdTop = birdYRef.current - BIRD_SIZE / 2;
            const birdBottom = birdYRef.current + BIRD_SIZE / 2;
            if (birdTop < topGap || birdBottom > bottomGap) {
              collided = true;
            }
          }

          let passed = pipe.passed;
          if (!passed && newX + PIPE_WIDTH / 2 < BIRD_X - BIRD_SIZE / 2) {
            passed = true;
            pipesPassedRef.current += 1;
            scoreRef.current += 5;
            setScore(scoreRef.current);
          }

          remaining.push({ ...pipe, x: newX, passed });
        }
        pipesRef.current = remaining;
        setPipes([...pipesRef.current]);

        if (collided) {
          die();
          return;
        }

        if (pipesPassedRef.current >= PIPES_PER_LEVEL) {
          setPhase("transition");
          return;
        }
      } else if (phase === "boss") {
        // Entrada del jefe
        if (!bossRestedRef.current) {
          bossXRef.current = Math.max(BOSS_REST_X, bossXRef.current - BOSS_ENTER_SPEED * dt);
          if (bossXRef.current <= BOSS_REST_X) {
            bossRestedRef.current = true;
          }
        } else {
          bossTimeRef.current += dt;
        }

        const amplitude = (100 - BOSS_GAP_HEIGHT) / 2 - 4;
        bossGapYRef.current =
          50 + Math.sin((bossTimeRef.current / BOSS_OSC_PERIOD) * Math.PI * 2) * amplitude;

        const overlapsX =
          BIRD_X + BIRD_SIZE / 2 > bossXRef.current - BOSS_WIDTH / 2 &&
          BIRD_X - BIRD_SIZE / 2 < bossXRef.current + BOSS_WIDTH / 2;

        let hitFlash = false;
        if (overlapsX) {
          const topGap = bossGapYRef.current - BOSS_GAP_HEIGHT / 2;
          const bottomGap = bossGapYRef.current + BOSS_GAP_HEIGHT / 2;
          const birdTop = birdYRef.current - BIRD_SIZE / 2;
          const birdBottom = birdYRef.current + BIRD_SIZE / 2;
          const insideGap = birdTop >= topGap && birdBottom <= bottomGap;

          if (insideGap && bossRestedRef.current) {
            bossInsideTimerRef.current += dt;
            if (bossInsideTimerRef.current >= BOSS_HIT_INTERVAL) {
              bossInsideTimerRef.current = 0;
              bossHealthRef.current -= 1;
              hitFlash = true;
              scoreRef.current += 40;
              setScore(scoreRef.current);
              spawnExplosion(bossXRef.current, bossGapYRef.current);

              if (bossHealthRef.current <= 0) {
                spawnExplosion(bossXRef.current, 30);
                spawnExplosion(bossXRef.current, 70);
                scoreRef.current += 500;
                setScore(scoreRef.current);
                setPhase("win");
                setBest((prevBest) => {
                  if (scoreRef.current > prevBest) {
                    onBestScoreChange?.(scoreRef.current);
                    return scoreRef.current;
                  }
                  return prevBest;
                });
                onVictory?.(scoreRef.current);
                return;
              }
            }
          } else if (!insideGap) {
            bossInsideTimerRef.current = 0;
            die();
            return;
          }
        } else {
          bossInsideTimerRef.current = 0;
        }

        setBossState({
          x: bossXRef.current,
          gapY: bossGapYRef.current,
          health: bossHealthRef.current,
          hitFlash,
        });
      }

      // Partículas (explosión de monedas)
      if (particlesRef.current.length > 0) {
        particlesRef.current = particlesRef.current
          .map((p) => ({
            ...p,
            x: p.x + p.vx * dt,
            y: p.y + p.vy * dt,
            vy: p.vy + 60 * dt,
            life: p.life - dt / 1.1,
          }))
          .filter((p) => p.life > 0);
        setParticles([...particlesRef.current]);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, die, spawnExplosion, onBestScoreChange, onVictory]);

  // ---------- Controles ----------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flap]);

  const onFieldPointerDown = () => {
    flap();
  };

  const bossHealthPct = (bossState.health / BOSS_MAX_HEALTH) * 100;

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🐷 PIG FLAP</h1>
          <p style={styles.subtitle}>Aletea, esquiva los gastos y vence al jefe de las deudas</p>
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
          🚩 <strong style={styles.hudStrong}>Nivel {phase === "boss" || phase === "win" ? "JEFE" : level} / 3</strong>
        </div>
        {phase === "boss" && (
          <div style={styles.bossHealthOuter}>
            <div style={{ ...styles.bossHealthInner, width: `${bossHealthPct}%` }} />
          </div>
        )}
      </div>

      <div
        ref={fieldRef}
        style={styles.field}
        onPointerDown={onFieldPointerDown}
      >
        {/* Tuberías / columnas de gastos */}
        {pipes.map((pipe) => {
          const topH = pipe.gapY - pipe.gapHeight / 2;
          const bottomStart = pipe.gapY + pipe.gapHeight / 2;
          return (
            <React.Fragment key={pipe.id}>
              <div
                style={{
                  ...styles.pipe,
                  left: `${pipe.x - PIPE_WIDTH / 2}%`,
                  width: `${PIPE_WIDTH}%`,
                  top: 0,
                  height: `${topH}%`,
                }}
              />
              <div
                style={{
                  ...styles.pipe,
                  left: `${pipe.x - PIPE_WIDTH / 2}%`,
                  width: `${PIPE_WIDTH}%`,
                  top: `${bottomStart}%`,
                  height: `${100 - bottomStart}%`,
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Jefe final */}
        {(phase === "boss" || phase === "win") && (
          <>
            <div
              style={{
                ...styles.bossPart,
                left: `${bossState.x - BOSS_WIDTH / 2}%`,
                width: `${BOSS_WIDTH}%`,
                top: 0,
                height: `${bossState.gapY - BOSS_GAP_HEIGHT / 2}%`,
                background: bossState.hitFlash ? "#FFD36E" : "#5C3300",
              }}
            />
            <div
              style={{
                ...styles.bossPart,
                left: `${bossState.x - BOSS_WIDTH / 2}%`,
                width: `${BOSS_WIDTH}%`,
                top: `${bossState.gapY + BOSS_GAP_HEIGHT / 2}%`,
                height: `${100 - (bossState.gapY + BOSS_GAP_HEIGHT / 2)}%`,
                background: bossState.hitFlash ? "#FFD36E" : "#5C3300",
              }}
            />
            {phase === "boss" && (
              <div
                style={{
                  ...styles.bossFace,
                  left: `${bossState.x}%`,
                  top: `${bossState.gapY <= 50 ? 90 : 10}%`,
                }}
              >
                👹
              </div>
            )}
          </>
        )}

        {/* Cerdito */}
        {phase !== "idle" && (
          <img
            src={pigMascot}
            alt="Cochinito Oinkash"
            style={{
              ...styles.bird,
              top: `${birdY}%`,
              transform: `translate(-50%, -50%) rotate(${birdAngle}deg)`,
            }}
          />
        )}

        {/* Partículas de monedas */}
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              ...styles.particle,
              left: `${p.x}%`,
              top: `${p.y}%`,
              opacity: Math.max(0, p.life),
            }}
          >
            {p.emoji}
          </div>
        ))}

        {phase === "idle" && (
          <div style={styles.overlay}>
            <img src={pigMascot} alt="" style={styles.overlayMascot} />
            <p style={styles.overlayTitle}>🐷 Pig Flap</p>
            <p style={styles.overlaySubtitle}>
              Toca la pantalla (o barra espaciadora) para aletear.
              <br />
              Cruza 3 niveles de gastos y vence al Monstruo de las Deudas.
            </p>
            <button style={styles.overlayButton} onClick={startGame}>
              Jugar
            </button>
          </div>
        )}

        {phase === "transition" && (
          <div style={styles.overlay}>
            <p style={styles.overlayTitle}>🎉 ¡Nivel {level} completado!</p>
            <p style={styles.overlaySubtitle}>
              {level >= 3 ? "Prepárate: viene el jefe final." : `Nivel ${level + 1} de 3 a continuación.`}
            </p>
            <button style={styles.overlayButton} onClick={continueToNextLevel}>
              Continuar
            </button>
          </div>
        )}

        {phase === "gameover" && (
          <div style={styles.overlay}>
            <p style={styles.overlayTitle}>🐷 ¡Ups!</p>
            <p style={styles.overlaySubtitle}>
              Puntaje: <strong>{score}</strong>
              {score >= best && score > 0 ? " · ¡Nuevo mejor puntaje! 🎉" : ""}
            </p>
            <button style={styles.overlayButton} onClick={startGame}>
              Jugar de nuevo
            </button>
          </div>
        )}

        {phase === "win" && (
          <div style={styles.overlay}>
            <p style={styles.overlayTitle}>🏆 ¡Venciste al Monstruo de las Deudas!</p>
            <p style={styles.overlaySubtitle}>
              Puntaje final: <strong>{score}</strong>
              {score >= best ? " · ¡Nuevo mejor puntaje! 🎉" : ""}
            </p>
            <button style={styles.overlayButton} onClick={startGame}>
              Jugar de nuevo
            </button>
          </div>
        )}
      </div>

      <p style={styles.hint}>
        Toca o presiona espacio para aletear · esquiva las columnas de gastos · en el jefe,
        mantente dentro del hueco que se mueve para dañarlo
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
    gap: 10,
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
  bossHealthOuter: {
    flex: 1,
    height: 10,
    background: "#E8C99A",
    borderRadius: 999,
    overflow: "hidden",
  },
  bossHealthInner: {
    height: "100%",
    background: "linear-gradient(90deg, #E4572E, #FF8A5B)",
    transition: "width 0.2s ease",
  },
  field: {
    position: "relative",
    width: "100%",
    aspectRatio: "3 / 4",
    background: "linear-gradient(#BEE7F2, #EAF7EE)",
    borderRadius: 14,
    overflow: "hidden",
    touchAction: "none",
    userSelect: "none",
    cursor: "pointer",
  },
  pipe: {
    position: "absolute",
    background: "#C4483A",
    borderLeft: "3px solid #8F2E23",
    borderRight: "3px solid #8F2E23",
    boxSizing: "border-box",
  },
  bossPart: {
    position: "absolute",
    boxSizing: "border-box",
    transition: "background 0.15s ease",
  },
  bossFace: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    fontSize: "clamp(24px, 8vw, 36px)",
    pointerEvents: "none",
  },
  bird: {
    position: "absolute",
    left: `${BIRD_X}%`,
    width: `${BIRD_SIZE}%`,
    height: "auto",
    pointerEvents: "none",
    filter: "drop-shadow(0 3px 3px rgba(0,0,0,0.25))",
    transition: "transform 0.05s linear",
  },
  particle: {
    position: "absolute",
    fontSize: "clamp(14px, 4vw, 20px)",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
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
  overlayMascot: {
    width: 72,
    height: "auto",
    marginBottom: 8,
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

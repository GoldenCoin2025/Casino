import React, { useRef, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/soundEffects';
import { ArrowLeft, Shield, RotateCcw, CheckCircle2, Sparkles, Clock, Coins } from 'lucide-react';
import { publishAsyncHostScore, submitOpponentScoreAndResolve, calculatePayout } from '../services/matchService';
import { useAuth } from '../context/AuthContext';
import { BetRecord } from '../types/casino';

interface BlockStackerGameProps {
  roomId?: string | null;
  wager: number;
  mode: 'live' | 'async' | 'challenge_accept';
  opponentNick?: string;
  opponentAvatar?: string;
  targetScoreToBeat?: number;
  userBalance: number;
  onMatchComplete: (record: BetRecord) => void;
  onBackToGrid: () => void;
  onPlayAgain?: (wager: number) => void;
}

// ---------------------------------------------------------------------------
// 1. PALETAS DE GEMAS 3D / CRISTAL (Cían Neón, Violeta Cristal, Esmeralda, Rubí)
// ---------------------------------------------------------------------------
interface GemTheme {
  name: string;
  highlight: string;
  mid: string;
  dark: string;
  deep: string;
  glow: string;
  bevelTop: string;
  bevelLeft: string;
  bevelRight: string;
  bevelBottom: string;
  innerStroke: string;
  sparkleColor: string;
}

const GEM_PALETTES: GemTheme[] = [
  // A. Cían Neón (Diamante Eléctrico)
  {
    name: 'Cían Neón',
    highlight: '#a5f3fc',
    mid: '#06b6d4',
    dark: '#0891b2',
    deep: '#083344',
    glow: '#00f5ff',
    bevelTop: 'rgba(255, 255, 255, 0.90)',
    bevelLeft: 'rgba(103, 232, 249, 0.70)',
    bevelRight: 'rgba(8, 145, 178, 0.75)',
    bevelBottom: 'rgba(4, 47, 62, 0.95)',
    innerStroke: 'rgba(165, 243, 252, 0.95)',
    sparkleColor: '#38bdf8',
  },
  // B. Violeta Cristal (Amatista Radiante)
  {
    name: 'Violeta Cristal',
    highlight: '#f5d0fe',
    mid: '#c084fc',
    dark: '#9333ea',
    deep: '#3b0764',
    glow: '#d946ef',
    bevelTop: 'rgba(255, 255, 255, 0.90)',
    bevelLeft: 'rgba(233, 213, 255, 0.70)',
    bevelRight: 'rgba(147, 51, 234, 0.75)',
    bevelBottom: 'rgba(59, 7, 100, 0.95)',
    innerStroke: 'rgba(245, 208, 254, 0.95)',
    sparkleColor: '#e879f9',
  },
  // C. Esmeralda Mística (Gema Verde Neón)
  {
    name: 'Esmeralda Mística',
    highlight: '#a7f3d0',
    mid: '#10b981',
    dark: '#047857',
    deep: '#022c22',
    glow: '#10b981',
    bevelTop: 'rgba(255, 255, 255, 0.90)',
    bevelLeft: 'rgba(167, 243, 208, 0.70)',
    bevelRight: 'rgba(5, 150, 105, 0.75)',
    bevelBottom: 'rgba(2, 44, 34, 0.95)',
    innerStroke: 'rgba(209, 250, 229, 0.95)',
    sparkleColor: '#34d399',
  },
  // D. Rubí Láser (Gema Roja Neón)
  {
    name: 'Rubí Láser',
    highlight: '#fecdd3',
    mid: '#f43f5e',
    dark: '#be123c',
    deep: '#4c0519',
    glow: '#ff0055',
    bevelTop: 'rgba(255, 255, 255, 0.90)',
    bevelLeft: 'rgba(254, 205, 211, 0.70)',
    bevelRight: 'rgba(190, 18, 60, 0.75)',
    bevelBottom: 'rgba(76, 5, 25, 0.95)',
    innerStroke: 'rgba(255, 228, 230, 0.95)',
    sparkleColor: '#fb7185',
  },
];

interface TowerBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  gemTheme: GemTheme;
}

interface DebrisSlice {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  gemTheme: GemTheme;
  opacity: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

interface Sparkle {
  x: number;
  y: number;
  size: number;
  maxSize: number;
  alpha: number;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  color: string;
}

interface StarBgParticle {
  x: number;
  y: number;
  size: number;
  vy: number;
  alpha: number;
  pulse: number;
}

const BLOCK_HEIGHT = 30;
const INITIAL_WIDTH = 220;
const INACTIVITY_TIMEOUT_SEC = 20; // Tiempo natural y pausado (20 segundos)
const TARGET_FRAME_MS = 1000 / 60; // 16.667ms estándar 60 FPS

export const BlockStackerGame: React.FC<BlockStackerGameProps> = ({
  roomId,
  wager,
  mode,
  opponentNick,
  targetScoreToBeat,
  userBalance,
  onMatchComplete,
  onBackToGrid,
  onPlayAgain,
}) => {
  const { user, profile, updateBalance } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Referencias directas al DOM para el HUD (EVITA COMPLETAMENTE RE-RENDERS DE REACT MIENTRAS SE JUEGA)
  const hudScoreRef = useRef<HTMLSpanElement | null>(null);
  const hudMultiplierRef = useRef<HTMLSpanElement | null>(null);
  const hudMatchTimeRef = useRef<HTMLSpanElement | null>(null);
  const urgencyBarRef = useRef<HTMLDivElement | null>(null);
  const instructionsBannerRef = useRef<HTMLDivElement | null>(null);

  // Estados de React solo para el Modal Persistente de Fin de Partida
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState<boolean>(false);
  const [finalScoreSummary, setFinalScoreSummary] = useState<number>(0);
  const [matchResult, setMatchResult] = useState<{
    isWinner: boolean;
    isTie: boolean;
    payout: number;
    opponentScore: number;
  } | null>(null);

  // Almacenar callbacks y props en un ref mutable para que el bucle de Canvas nunca se reinicie por cambios de props
  const callbacksRef = useRef({
    roomId,
    wager,
    mode,
    opponentNick,
    targetScoreToBeat,
    onMatchComplete,
    onBackToGrid,
    onPlayAgain,
    updateBalance,
    user,
    profile,
  });

  callbacksRef.current = {
    roomId,
    wager,
    mode,
    opponentNick,
    targetScoreToBeat,
    onMatchComplete,
    onBackToGrid,
    onPlayAgain,
    updateBalance,
    user,
    profile,
  };

  // ---------------------------------------------------------------------------
  // MOTOR CANVAS DESACOPLADO (0ms INPUT LAG & DELTA-TIME 60 FPS ESTABLE)
  // ---------------------------------------------------------------------------
  const engine = useRef({
    score: 0,
    combo: 0,
    multiplier: 1.0,
    isGameOver: false,
    hasStarted: false,
    speed: 2.0, // Movimiento pausado y suave para base firme
    inactivityTimeLeft: INACTIVITY_TIMEOUT_SEC,
    totalGameTimeSeconds: 0,
    lastFrameTime: performance.now(),
    lastDropTime: 0,
    cameraY: 0,
    targetCamY: 0,
    screenShake: 0,
    perfectFlashAlpha: 0,
    perfectBannerText: '',
    perfectBannerTimer: 0,
    animationFrameId: null as number | null,
  });

  const towerRef = useRef<TowerBlock[]>([]);
  const debrisRef = useRef<DebrisSlice[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const sparklesRef = useRef<Sparkle[]>([]);
  const bgStarsRef = useRef<StarBgParticle[]>([]);
  const activeBlockRef = useRef<{
    x: number;
    width: number;
    direction: number;
    speed: number;
    gemTheme: GemTheme;
  }>({
    x: 40,
    width: INITIAL_WIDTH,
    direction: 1,
    speed: 2.0,
    gemTheme: GEM_PALETTES[0],
  });

  const totalPot = wager * 2;
  const netPayout = calculatePayout(wager);

  const getGemTheme = (index: number): GemTheme => {
    return GEM_PALETTES[index % GEM_PALETTES.length];
  };

  // Generador de partículas de chispas
  const spawnExplosion = (x: number, y: number, color: string, count: number = 24) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6.0 + 1.8;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.8,
        size: Math.random() * 3.5 + 1.8,
        color,
        alpha: 1,
      });
    }
  };

  // Generador de destellos tipo estrella ('Sparkles')
  const spawnSparkles = (x: number, y: number, width: number, height: number, color: string, count: number = 6) => {
    for (let i = 0; i < count; i++) {
      sparklesRef.current.push({
        x: x + Math.random() * width,
        y: y + Math.random() * height,
        size: 0.5,
        maxSize: Math.random() * 4.5 + 3.5,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 30 + 25,
        vx: (Math.random() - 0.5) * 0.7,
        vy: -(Math.random() * 0.8 + 0.3),
        color,
      });
    }
  };

  /**
   * CURVA DE DIFICULTAD NATURAL Y EQUILIBRADA:
   * - Bloques 1 al 4: Movimiento pausado (2.0 px/frame) y base amplia.
   * - Bloques 5 al 12: Incremento suave del 5% por bloque (controlable).
   * - Bloques 13 en adelante: Aceleración arcade con tope máximo de 4.8 px/frame.
   */
  const calculateSpeedForLevel = (level: number): number => {
    if (level < 4) {
      return 2.0;
    } else if (level < 12) {
      return 2.0 * Math.pow(1.05, level - 3);
    } else {
      const baseHigh = 2.0 * Math.pow(1.05, 8); // ~2.95
      return Math.min(4.8, baseHigh + (level - 12) * 0.16);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDERIZADO DE GEMA 3D / CRISTAL (CANVAS ALTA FIDELIDAD)
  // ---------------------------------------------------------------------------
  const drawGemBlock = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    gem: GemTheme,
    isTop: boolean,
    isMoving: boolean
  ) => {
    if (w <= 0 || h <= 0) return;

    const bevel = Math.min(5.5, h * 0.22, w * 0.16);
    const innerW = w - 2 * bevel;
    const innerH = h - 2 * bevel;

    ctx.save();

    // d) Glow / Bloom Neón externo
    ctx.shadowColor = gem.glow;
    ctx.shadowBlur = isTop || isMoving ? 26 : 14;

    // a) Base con degradado radial brillante y saturado
    const cx = x + w * 0.38;
    const cy = y + h * 0.42;
    const r = Math.max(w * 0.65, h);
    const radial = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    radial.addColorStop(0, gem.highlight);
    radial.addColorStop(0.35, gem.mid);
    radial.addColorStop(0.75, gem.dark);
    radial.addColorStop(1, gem.deep);

    ctx.fillStyle = radial;
    ctx.fillRect(x, y, w, h);

    // b) Bordes biselados internos de 45 grados (Efecto 3D Real)
    // 1. Bisel Superior (Luz alta)
    ctx.fillStyle = gem.bevelTop;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - bevel, y + bevel);
    ctx.lineTo(x + bevel, y + bevel);
    ctx.closePath();
    ctx.fill();

    // 2. Bisel Izquierdo (Luz lateral)
    ctx.fillStyle = gem.bevelLeft;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + bevel, y + bevel);
    ctx.lineTo(x + bevel, y + h - bevel);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();

    // 3. Bisel Derecho (Sombra media)
    ctx.fillStyle = gem.bevelRight;
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w - bevel, y + bevel);
    ctx.lineTo(x + w - bevel, y + h - bevel);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();

    // 4. Bisel Inferior (Sombra profunda de 45°)
    ctx.fillStyle = gem.bevelBottom;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + bevel, y + h - bevel);
    ctx.lineTo(x + w - bevel, y + h - bevel);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();

    // Faceta central interna con reflejo de profundidad
    if (innerW > 0 && innerH > 0) {
      const innerGrad = ctx.createLinearGradient(x + bevel, y + bevel, x + bevel, y + h - bevel);
      innerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      innerGrad.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
      ctx.fillStyle = innerGrad;
      ctx.fillRect(x + bevel, y + bevel, innerW, innerH);

      // Trazo fino de talla de cristal interior
      ctx.strokeStyle = gem.innerStroke;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x + bevel, y + bevel, innerW, innerH);

      // c) Capa de Brillo de Cristal (Specular Highlight): Trazo diagonal blanco semitransparente
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + bevel, y + bevel, innerW, innerH);
      ctx.clip();

      const specW = Math.min(22, innerW * 0.35);
      ctx.beginPath();
      ctx.moveTo(x + bevel + 4, y + bevel);
      ctx.lineTo(x + bevel + 4 + specW, y + bevel);
      ctx.lineTo(x + bevel + 12, y + h - bevel);
      ctx.lineTo(x + bevel + 12 - specW * 0.45, y + h - bevel);
      ctx.closePath();

      const specGrad = ctx.createLinearGradient(x + bevel, y + bevel, x + bevel + specW, y + h - bevel);
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      specGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.35)');
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
      ctx.fillStyle = specGrad;
      ctx.fill();

      // Destello puntual en vértice superior izquierdo
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + bevel + 3.2, y + bevel + 3.2, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Contorno exterior neón fino
    ctx.strokeStyle = isMoving ? '#ffffff' : gem.glow;
    ctx.lineWidth = isMoving ? 1.4 : 0.9;
    ctx.strokeRect(x, y, w, h);

    ctx.restore();
  };

  // e) DIBUJO DE ESTRELLA DE DESTELLO ('SPARKLE' DE 4 PUNTAS)
  const drawStarSparkle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    alpha: number,
    color: string
  ) => {
    if (alpha <= 0 || size <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x, y, x + size, y);
    ctx.quadraticCurveTo(x, y, x, y + size);
    ctx.quadraticCurveTo(x, y, x - size, y);
    ctx.quadraticCurveTo(x, y, x, y - size);
    ctx.closePath();
    ctx.fill();

    // Núcleo blanco brillante
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // ---------------------------------------------------------------------------
  // RESOLUCIÓN DE FIN DE PARTIDA EN FIRESTORE Y BLOQUEO TOTAL
  // ---------------------------------------------------------------------------
  const handleEndGameAndPersist = async (finalScore: number) => {
    setFinalScoreSummary(finalScore);
    setIsGameOverModalOpen(true);

    const c = callbacksRef.current;

    if (c.mode === 'challenge_accept' && c.roomId && c.user && c.profile && c.targetScoreToBeat !== undefined) {
      try {
        const result = await submitOpponentScoreAndResolve(c.roomId, finalScore, {
          uid: c.user.uid,
          username: c.profile.username,
          avatar: c.profile.avatar,
          rating: c.profile.rating,
        });

        const isWin = result.isOpponentWinner;
        const isTie = result.isTie;
        const payout = isWin ? result.payout : isTie ? c.wager : 0;

        setMatchResult({
          isWinner: isWin,
          isTie,
          payout,
          opponentScore: c.targetScoreToBeat,
        });

        if (isWin) {
          sound.playJackpot();
          confetti({ particleCount: 100, spread: 75, origin: { y: 0.5 } });
          await c.updateBalance(c.profile.balance + payout);
        } else if (isTie) {
          sound.playChip();
          await c.updateBalance(c.profile.balance + payout);
        } else {
          sound.playLoss();
        }

        c.onMatchComplete({
          id: `room_${c.roomId}_result`,
          timestamp: Date.now(),
          gameTitle: 'Tower Clash PvP',
          opponentName: c.opponentNick || 'Rival en Reto',
          result: isWin ? 'win' : isTie ? 'tie' : 'loss',
          betAmount: c.wager,
          payout,
          netProfit: payout - c.wager,
          finalScore: `${finalScore} vs ${c.targetScoreToBeat}`,
        });
      } catch (err) {
        console.error('Error resolving challenge in Firestore:', err);
      }
    } else if (c.mode === 'async' && c.roomId) {
      // Registrar puntaje del anfitrión en la sala de 24 horas en Firestore
      try {
        await publishAsyncHostScore(c.roomId, finalScore, null);
      } catch (err) {
        console.error('Error auto-publishing score:', err);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // SOLTAR BLOQUE INMEDIATO (0ms INPUT LAG CON ACTUALIZACIÓN DIRECTA EN DOM)
  // ---------------------------------------------------------------------------
  const dropBlockImmediately = () => {
    if (engine.current.isGameOver) return;

    const now = performance.now();
    // Guard anti doble-tap (50ms) para móviles que disparan pointerdown y touchstart
    if (now - engine.current.lastDropTime < 50) return;
    engine.current.lastDropTime = now;

    // 1. Ocultar instrucciones automáticamente en el primer toque
    if (!engine.current.hasStarted) {
      engine.current.hasStarted = true;
      if (instructionsBannerRef.current) {
        instructionsBannerRef.current.style.opacity = '0';
        instructionsBannerRef.current.style.pointerEvents = 'none';
      }
    }

    // Resetear contador de inactividad
    engine.current.inactivityTimeLeft = INACTIVITY_TIMEOUT_SEC;

    const tower = towerRef.current;
    const active = activeBlockRef.current;
    const topBlock = tower[tower.length - 1];

    if (!topBlock) return;

    const minX = Math.max(active.x, topBlock.x);
    const maxX = Math.min(active.x + active.width, topBlock.x + topBlock.width);
    const overlapWidth = maxX - minX;

    const tolerance = 2.8; // Tolerancia milimétrica para Perfect Drop
    const diff = active.x - topBlock.x;
    const nextGemTheme = getGemTheme(tower.length);

    if (Math.abs(diff) <= tolerance) {
      // A. PERFECT DROP (Alineado al 100%)
      active.x = topBlock.x;
      engine.current.combo += 1;
      engine.current.multiplier = Number((1.0 + engine.current.combo * 0.20).toFixed(2));
      engine.current.perfectFlashAlpha = 0.45;
      engine.current.perfectBannerText = `¡PERFECT! ×${engine.current.multiplier.toFixed(1)}`;
      engine.current.perfectBannerTimer = 1.0;

      sound.playPerfectCombo(engine.current.combo);

      spawnExplosion(active.x + active.width / 2, topBlock.y - BLOCK_HEIGHT, active.gemTheme.glow, 32);
      spawnSparkles(active.x, topBlock.y - BLOCK_HEIGHT, active.width, BLOCK_HEIGHT, active.gemTheme.sparkleColor, 12);

      tower.push({
        x: active.x,
        y: topBlock.y - BLOCK_HEIGHT,
        width: active.width,
        height: BLOCK_HEIGHT,
        gemTheme: active.gemTheme,
      });

      engine.current.score += 1;

      // Actualizar DOM directamente para CERO latencia y CERO re-renders
      if (hudScoreRef.current) {
        hudScoreRef.current.innerText = String(engine.current.score);
      }
      if (hudMultiplierRef.current) {
        hudMultiplierRef.current.innerText = `(×${engine.current.multiplier.toFixed(1)})`;
      }

      const nextSpeed = calculateSpeedForLevel(engine.current.score);
      active.speed = nextSpeed;
      active.direction = Math.random() > 0.5 ? 1 : -1;
      active.x = active.direction === 1 ? -active.width + 10 : (canvasRef.current?.width || 400) - 10;
      active.gemTheme = nextGemTheme;
    } else if (overlapWidth > 0) {
      // B. CORTE DE EXTREMOS (Física de gravedad fluida y aceleración)
      sound.playSlice();
      engine.current.combo = 0;
      engine.current.multiplier = 1.0;
      engine.current.screenShake = 5;

      tower.push({
        x: minX,
        y: topBlock.y - BLOCK_HEIGHT,
        width: overlapWidth,
        height: BLOCK_HEIGHT,
        gemTheme: active.gemTheme,
      });

      // El fragmento sobrante de cristal cae con física gravitatoria y rotación
      if (active.x < topBlock.x) {
        // Extremo sobrante a la IZQUIERDA
        const cutWidth = topBlock.x - active.x;
        debrisRef.current.push({
          x: active.x,
          y: topBlock.y - BLOCK_HEIGHT,
          width: cutWidth,
          height: BLOCK_HEIGHT,
          vx: -3.5 - Math.random() * 1.5,
          vy: -1.2,
          rotation: 0,
          vRot: -0.09,
          gemTheme: active.gemTheme,
          opacity: 1,
        });
        spawnExplosion(topBlock.x, topBlock.y - BLOCK_HEIGHT, active.gemTheme.glow, 16);
      } else {
        // Extremo sobrante a la DERECHA
        const cutWidth = (active.x + active.width) - (topBlock.x + topBlock.width);
        debrisRef.current.push({
          x: topBlock.x + topBlock.width,
          y: topBlock.y - BLOCK_HEIGHT,
          width: cutWidth,
          height: BLOCK_HEIGHT,
          vx: 3.5 + Math.random() * 1.5,
          vy: -1.2,
          rotation: 0,
          vRot: 0.09,
          gemTheme: active.gemTheme,
          opacity: 1,
        });
        spawnExplosion(topBlock.x + topBlock.width, topBlock.y - BLOCK_HEIGHT, active.gemTheme.glow, 16);
      }

      spawnSparkles(minX, topBlock.y - BLOCK_HEIGHT, overlapWidth, BLOCK_HEIGHT, active.gemTheme.sparkleColor, 6);

      // Siguiente bloque estrechado al ancho exacto del solapamiento
      active.width = overlapWidth;
      engine.current.score += 1;

      // Actualizar DOM directamente
      if (hudScoreRef.current) {
        hudScoreRef.current.innerText = String(engine.current.score);
      }
      if (hudMultiplierRef.current) {
        hudMultiplierRef.current.innerText = `(×1.0)`;
      }

      const nextSpeed = calculateSpeedForLevel(engine.current.score);
      active.speed = nextSpeed;
      active.direction = active.direction === 1 ? -1 : 1;
      active.x = active.direction === 1 ? -overlapWidth + 10 : (canvasRef.current?.width || 400) - 10;
      active.gemTheme = nextGemTheme;

      sound.playBlockPlace(engine.current.score);
    } else {
      // C. CAÍDA TOTAL / MISS -> BLOQUEO TOTAL Y GAME OVER
      sound.playTowerCollapse();
      sound.playDebrisExplosion();
      engine.current.isGameOver = true;

      // DETENER EL BUCLE DE RENDERIZADO DE INMEDIATO (cancelAnimationFrame)
      if (engine.current.animationFrameId) {
        cancelAnimationFrame(engine.current.animationFrameId);
        engine.current.animationFrameId = null;
      }

      // Detener y desplegar modal persistente sin reinicios automáticos
      handleEndGameAndPersist(engine.current.score);
    }
  };

  // ---------------------------------------------------------------------------
  // MOTOR CANVAS PURO (INICIALIZADO 1 SOLA VEZ, 60 FPS DELTA-TIME, CERO LAG)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const baseWidth = Math.min(INITIAL_WIDTH, canvas.width * 0.65);
    const startX = (canvas.width - baseWidth) / 2;
    const startY = canvas.height - 110;

    towerRef.current = [
      {
        x: startX,
        y: startY,
        width: baseWidth,
        height: BLOCK_HEIGHT,
        gemTheme: GEM_PALETTES[0],
      },
    ];

    debrisRef.current = [];
    particlesRef.current = [];
    sparklesRef.current = [];

    // Partículas de fondo
    bgStarsRef.current = [];
    for (let i = 0; i < 35; i++) {
      bgStarsRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 1,
        vy: -(Math.random() * 0.35 + 0.12),
        alpha: Math.random() * 0.5 + 0.2,
        pulse: Math.random() * Math.PI,
      });
    }

    activeBlockRef.current = {
      x: 20,
      width: baseWidth,
      direction: 1,
      speed: 2.0,
      gemTheme: GEM_PALETTES[1],
    };

    engine.current.score = 0;
    engine.current.combo = 0;
    engine.current.multiplier = 1.0;
    engine.current.isGameOver = false;
    engine.current.hasStarted = false;
    engine.current.speed = 2.0;
    engine.current.inactivityTimeLeft = INACTIVITY_TIMEOUT_SEC;
    engine.current.totalGameTimeSeconds = 0;
    engine.current.lastFrameTime = performance.now();
    engine.current.lastDropTime = 0;
    engine.current.cameraY = 0;
    engine.current.targetCamY = 0;

    // Resetear HUD directamente en DOM
    if (hudScoreRef.current) hudScoreRef.current.innerText = '0';
    if (hudMultiplierRef.current) hudMultiplierRef.current.innerText = '(×1.0)';
    if (hudMatchTimeRef.current) hudMatchTimeRef.current.innerText = '00:00';
    if (urgencyBarRef.current) urgencyBarRef.current.style.width = '100%';
    if (instructionsBannerRef.current) {
      instructionsBannerRef.current.style.opacity = '1';
      instructionsBannerRef.current.style.pointerEvents = 'auto';
    }

    let isRunning = true;
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (!isRunning || engine.current.isGameOver) return;

      const elapsed = Math.min(60, Math.max(1, now - lastTime));
      lastTime = now;
      const dt = elapsed / 1000;
      const deltaFactor = elapsed / TARGET_FRAME_MS; // 1.0 a 60 FPS exactos

      // 1. Reloj de Tiempo de Juego Natural (segundo a segundo)
      if (engine.current.hasStarted && !engine.current.isGameOver) {
        engine.current.totalGameTimeSeconds += dt;
        if (hudMatchTimeRef.current) {
          const totalSec = Math.floor(engine.current.totalGameTimeSeconds);
          const mins = Math.floor(totalSec / 60);
          const secs = totalSec % 60;
          hudMatchTimeRef.current.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        // Temporizador de anti-inactividad pausado (20 segundos)
        engine.current.inactivityTimeLeft -= dt;

        if (urgencyBarRef.current) {
          const pct = Math.max(0, (engine.current.inactivityTimeLeft / INACTIVITY_TIMEOUT_SEC) * 100);
          urgencyBarRef.current.style.width = `${pct}%`;
          if (engine.current.inactivityTimeLeft < 4) {
            urgencyBarRef.current.style.backgroundColor = '#f43f5e';
          } else {
            urgencyBarRef.current.style.backgroundColor = '#00f5ff';
          }
        }

        if (engine.current.inactivityTimeLeft <= 0) {
          dropBlockImmediately();
        }
      }

      // 2. Fondo Arcade Neón / Cyberpunk
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bgGrad = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        40,
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.88
      );
      bgGrad.addColorStop(0, '#091438');
      bgGrad.addColorStop(0.65, '#040b22');
      bgGrad.addColorStop(1, '#020512');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Partículas flotantes de fondo
      bgStarsRef.current.forEach((star) => {
        star.y += star.vy * deltaFactor;
        star.pulse += 0.03 * deltaFactor;
        if (star.y < 0) {
          star.y = canvas.height;
          star.x = Math.random() * canvas.width;
        }
        const currentAlpha = Math.max(0.1, star.alpha + Math.sin(star.pulse) * 0.2);
        ctx.fillStyle = `rgba(56, 189, 248, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Suavizado de Cámara
      const topBlock = towerRef.current[towerRef.current.length - 1];
      engine.current.targetCamY = topBlock ? Math.max(0, canvas.height * 0.55 - topBlock.y) : 0;
      engine.current.cameraY += (engine.current.targetCamY - engine.current.cameraY) * 0.12 * deltaFactor;

      ctx.save();
      ctx.translate(0, engine.current.cameraY);

      // 4. Dibujar Torre de Gemas 3D con Bisel y Resplandor
      towerRef.current.forEach((block, idx) => {
        const isTop = idx === towerRef.current.length - 1;
        drawGemBlock(ctx, block.x, block.y, block.width, block.height, block.gemTheme, isTop, false);

        if (isTop && Math.random() < 0.07) {
          spawnSparkles(block.x, block.y, block.width, block.height, block.gemTheme.sparkleColor, 1);
        }
      });

      // 5. Dibujar Bloque Activo de Gema en Movimiento (Lineal y Fluido a 60 FPS delta)
      if (!engine.current.isGameOver && topBlock) {
        const active = activeBlockRef.current;
        active.x += active.speed * active.direction * deltaFactor;

        // Rebote en los bordes de la pantalla
        if (active.x + active.width > canvas.width) {
          active.direction = -1;
        } else if (active.x < 0) {
          active.direction = 1;
        }

        const activeY = topBlock.y - BLOCK_HEIGHT;
        drawGemBlock(ctx, active.x, activeY, active.width, BLOCK_HEIGHT, active.gemTheme, false, true);

        if (Math.random() < 0.20) {
          spawnSparkles(active.x, activeY, active.width, BLOCK_HEIGHT, active.gemTheme.sparkleColor, 1);
        }
      }

      // 6. FÍSICAS DE GRAVEDAD Y ACELERACIÓN DE FRAGMENTOS CORTADOS
      for (let i = debrisRef.current.length - 1; i >= 0; i--) {
        const d = debrisRef.current[i];
        d.x += d.vx * deltaFactor;
        d.y += d.vy * deltaFactor;
        d.vy += 0.42 * deltaFactor;
        d.rotation += d.vRot * deltaFactor;
        d.opacity -= 0.016 * deltaFactor;

        ctx.save();
        ctx.translate(d.x + d.width / 2, d.y + d.height / 2);
        ctx.rotate(d.rotation);
        ctx.globalAlpha = Math.max(0, d.opacity);
        drawGemBlock(ctx, -d.width / 2, -d.height / 2, d.width, d.height, d.gemTheme, false, false);
        ctx.restore();

        if (d.y > canvas.height - 45) {
          sound.playDebrisExplosion();
          spawnExplosion(d.x + d.width / 2, canvas.height - 45, d.gemTheme.glow, 16);
          debrisRef.current.splice(i, 1);
        } else if (d.opacity <= 0) {
          debrisRef.current.splice(i, 1);
        }
      }

      // 7. Partículas de Destellos ('Sparkles')
      for (let i = sparklesRef.current.length - 1; i >= 0; i--) {
        const sp = sparklesRef.current[i];
        sp.life += 1 * deltaFactor;
        sp.x += sp.vx * deltaFactor;
        sp.y += sp.vy * deltaFactor;

        const progress = sp.life / sp.maxLife;
        const currentSize = Math.sin(progress * Math.PI) * sp.maxSize;
        const currentAlpha = 1 - progress;

        drawStarSparkle(ctx, sp.x, sp.y, currentSize, currentAlpha, sp.color);

        if (sp.life >= sp.maxLife) {
          sparklesRef.current.splice(i, 1);
        }
      }

      // 8. Partículas de Chispas
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * deltaFactor;
        p.y += p.vy * deltaFactor;
        p.vy += 0.18 * deltaFactor;
        p.alpha -= 0.024 * deltaFactor;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
        }
      }

      ctx.restore();

      // 9. Efectos en Pantalla: Destello Neón y Cartel PERFECT!
      if (engine.current.perfectFlashAlpha > 0) {
        ctx.fillStyle = `rgba(0, 245, 255, ${engine.current.perfectFlashAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        engine.current.perfectFlashAlpha -= dt * 2.2;
      }

      if (engine.current.perfectBannerTimer > 0) {
        engine.current.perfectBannerTimer -= dt;
        ctx.save();
        ctx.font = '900 34px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 24;
        ctx.fillText(engine.current.perfectBannerText, canvas.width / 2, canvas.height * 0.28);
        ctx.restore();
      }

      engine.current.animationFrameId = requestAnimationFrame(loop);
    };

    engine.current.animationFrameId = requestAnimationFrame(loop);

    // -------------------------------------------------------------------------
    // LISTENERS DE ENTRADA CON LATENCIA 0ms (pointerdown, touchstart, keydown)
    // -------------------------------------------------------------------------
    const handleTap = (e: TouchEvent | PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('.no-game-tap')) return;

      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();
      dropBlockImmediately();
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        dropBlockImmediately();
      }
    };

    canvas.addEventListener('pointerdown', handleTap, { passive: false });
    canvas.addEventListener('touchstart', handleTap, { passive: false });
    window.addEventListener('keydown', handleKey);

    const handleResize = () => {
      if (canvasRef.current && !engine.current.isGameOver) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isRunning = false;
      if (engine.current.animationFrameId) {
        cancelAnimationFrame(engine.current.animationFrameId);
        engine.current.animationFrameId = null;
      }
      canvas.removeEventListener('pointerdown', handleTap);
      canvas.removeEventListener('touchstart', handleTap);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Dependencias vacías: NUNCA se reinicia durante el juego

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 bg-[#020512] flex flex-col justify-between overflow-hidden select-none"
    >
      {/* CANVAS EN PANTALLA COMPLETA */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-0 touch-none cursor-pointer"
      />

      {/* 1. HUD SUPERIOR FLOTANTE GLASSMORPHISM */}
      <header className="relative z-20 w-full max-w-5xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4 pointer-events-auto no-game-tap">
        {/* Barra neón de anti-inactividad (tiempo pausado y natural) */}
        <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden mb-2 border border-white/10">
          <div
            ref={urgencyBarRef}
            className="h-full bg-cyan-400 transition-all duration-75"
            style={{ width: '100%' }}
          />
        </div>

        <div className="backdrop-blur-xl bg-[#081333]/85 border-2 border-cyan-500/30 rounded-2xl p-3 sm:p-4 shadow-2xl shadow-black flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                sound.playChip();
                onBackToGrid();
              }}
              className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-blue-950/90 hover:bg-blue-900 border border-blue-500/40 text-cyan-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Lobby</span>
            </button>

            {/* Pozo, Altura y Tiempo */}
            <div className="flex items-center gap-2 sm:gap-4 text-center">
              <div>
                <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold block">
                  Pozo en Juego (2×)
                </span>
                <span className="text-sm sm:text-lg font-black text-amber-300 font-mono tabular-nums">
                  ${totalPot.toLocaleString('es-ES')} pesos
                </span>
              </div>

              <div className="h-7 w-px bg-white/10" />

              <div>
                <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold block">
                  Altura Torre
                </span>
                <span className="text-base sm:text-xl font-black text-cyan-300 font-mono tabular-nums">
                  <span ref={hudScoreRef}>0</span>{' '}
                  <span ref={hudMultiplierRef} className="text-[10px] text-amber-300 font-sans">
                    (×1.0)
                  </span>
                </span>
              </div>

              <div className="h-7 w-px bg-white/10 hidden sm:block" />

              <div className="hidden sm:block">
                <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold block">
                  Tiempo
                </span>
                <span ref={hudMatchTimeRef} className="text-xs sm:text-sm font-black text-slate-200 font-mono tabular-nums">
                  00:00
                </span>
              </div>
            </div>

            {/* Saldo de Usuario */}
            <div className="text-right">
              <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold block">
                Tu Saldo
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono tabular-nums">
                ${userBalance.toLocaleString('es-ES')} pesos
              </span>
            </div>
          </div>

          {/* Indicador de Escudo 24h */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between flex-wrap gap-2 text-[10px] sm:text-xs">
            <div className="flex items-center gap-1.5 text-cyan-200 font-bold">
              <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                Protegido por Escudo 24h: Si nadie acepta, recuperas tus ${wager} pesos al 100%.
              </span>
            </div>

            <div className="text-slate-400 font-medium hidden sm:block">
              {mode === 'challenge_accept'
                ? `Versus vs @${opponentNick} (${targetScoreToBeat} bloques)`
                : 'Duelo Asincrónico P2P'}
            </div>
          </div>
        </div>
      </header>

      {/* 2. INSTRUCCIÓN FLOTANTE (SE OCULTA DE INMEDIATO EN EL PRIMER TOQUE) */}
      <footer className="relative z-20 w-full max-w-lg mx-auto px-4 pb-6 flex flex-col items-center gap-3 no-game-tap">
        <div
          ref={instructionsBannerRef}
          className="px-5 py-2 rounded-full bg-black/75 border border-cyan-400/40 text-xs font-bold text-cyan-200 backdrop-blur-md text-center transition-opacity duration-200 animate-pulse"
        >
          Toca la pantalla o presiona [Espacio] para soltar el bloque
        </div>
      </footer>

      {/* 3. MODAL PERSISTENTE DE GAME OVER (DETENCIÓN TOTAL Y REVANCHA GARANTIZADA) */}
      {isGameOverModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#081233] border-2 border-cyan-400/60 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl shadow-cyan-950">
            {mode === 'challenge_accept' && matchResult ? (
              /* RESULTADO CUANDO SE ACEPTA UN RETO EXISTENTE */
              <>
                <div
                  className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl border-2 ${
                    matchResult.isWinner
                      ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                      : matchResult.isTie
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-rose-500/20 border-rose-400 text-rose-300'
                  }`}
                >
                  {matchResult.isWinner ? '🏆' : matchResult.isTie ? '🤝' : '💀'}
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white font-display">
                  {matchResult.isWinner
                    ? '¡VICTORIA EN EL RETO!'
                    : matchResult.isTie
                    ? '¡EMPATE TÉCNICO!'
                    : '¡Partida Finalizada!'}
                </h3>

                <div className="p-4 rounded-2xl bg-blue-950/80 border border-blue-500/30 space-y-1">
                  <span className="text-xs text-slate-300 block">
                    Tu puntaje: <strong className="text-cyan-300 font-mono text-base">{finalScoreSummary}</strong> vs{' '}
                    <strong className="text-rose-400 font-mono text-base">{targetScoreToBeat}</strong> de @{opponentNick}
                  </span>
                  <span
                    className={`text-xl font-black font-mono block ${
                      matchResult.isWinner
                        ? 'text-emerald-400'
                        : matchResult.isTie
                        ? 'text-cyan-300'
                        : 'text-rose-400'
                    }`}
                  >
                    {matchResult.isWinner
                      ? `+$${matchResult.payout.toLocaleString('es-ES')} pesos ganados`
                      : matchResult.isTie
                      ? `Apuesta devuelta: $${wager} pesos`
                      : `-$${wager} pesos`}
                  </span>
                </div>
              </>
            ) : (
              /* MODO ASINCRÓNICO HOST: CONFIRMACIÓN DE SALA 24 HORAS */
              <>
                <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/30">
                  <Sparkles className="w-8 h-8 text-cyan-300 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-2xl sm:text-3xl font-black text-white font-display">
                    ¡Partida Finalizada!
                  </h3>
                  <div className="text-3xl font-black text-cyan-300 font-mono tabular-nums">
                    {finalScoreSummary} Bloques de Cristal
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#040a20] border border-cyan-500/30 text-left space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Tu puntuación se guardó en la sala de 24 horas.</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Pozo disputado: <strong>${totalPot.toLocaleString('es-ES')} pesos</strong> (Neto ganador: <strong>${netPayout} pesos</strong>). Protegido por el Escudo 24h: si nadie acepta tu reto en 24h, recuperas tus <strong>${wager} pesos</strong> al 100%.
                  </p>
                </div>
              </>
            )}

            {/* BOTONES PRINCIPALES DE ACCIÓN */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  sound.playBet();
                  if (onPlayAgain) {
                    onPlayAgain(Math.max(25, wager));
                  }
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-950/60 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>JUGAR REVANCHA / APOSTAR NUEVAMENTE (Desde $25)</span>
              </button>

              <button
                onClick={() => {
                  sound.playChip();
                  onBackToGrid();
                }}
                className="w-full py-3 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 text-slate-200 font-bold text-xs uppercase tracking-wider cursor-pointer transition-all"
              >
                VOLVER AL LOBBY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

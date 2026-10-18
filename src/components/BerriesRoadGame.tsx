import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BetRecord, MIN_PVP_BET } from '../types/casino';
import { sound } from '../utils/soundEffects';
import confetti from 'canvas-confetti';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Trophy,
  Coins,
  Shield,
  Bot,
  Swords,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  createGameRoom,
  publishAsyncHostScore,
  submitOpponentScoreAndResolve
} from '../services/matchService';

interface BerriesRoadGameProps {
  initialWager?: number;
  userBalance: number;
  roomId?: string | null;
  mode?: 'live' | 'async' | 'challenge_accept';
  opponentNick?: string;
  opponentAvatar?: string;
  targetScoreToBeat?: number;
  roadSeed?: number;
  onMatchComplete?: (record: BetRecord) => void;
  onBackToGrid: () => void;
}

// Deterministic Mulberry32 PRNG
function createPRNG(seed: number) {
  let s = (seed >>> 0) || 123456789;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type LaneType = 'grass' | 'road' | 'river' | 'rail';

interface MovingItem {
  x: number;
  width: number;
  speed: number;
  type: 'sedan' | 'truck' | 'sport' | 'taxi' | 'log' | 'lily' | 'train';
  color: string;
}

interface LaneData {
  z: number;
  type: LaneType;
  speed: number;
  direction: 1 | -1;
  items: MovingItem[];
  trees: number[]; // x coords of trees
  coins: { x: number; collected: boolean }[];
  warningActive?: boolean;
  trainTimer?: number;
}

interface Particle2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export const BerriesRoadGame: React.FC<BerriesRoadGameProps> = ({
  initialWager = 50,
  userBalance,
  roomId = null,
  mode = 'async',
  opponentNick,
  opponentAvatar,
  targetScoreToBeat,
  roadSeed,
  onMatchComplete,
  onBackToGrid,
}) => {
  const { user, profile, updateBalance } = useAuth();

  // Wager & Game Stage
  const [wager, setWager] = useState<number>(initialWager || 50);
  const [playMode, setPlayMode] = useState<'pvp_create' | 'pvp_accept' | 'bot_instant'>(
    mode === 'challenge_accept' ? 'pvp_accept' : 'pvp_create'
  );
  const [gameStage, setGameStage] = useState<'lobby' | 'playing' | 'game_over'>(
    mode === 'challenge_accept' ? 'playing' : 'lobby'
  );

  // HUD & Score
  const [activeRoomId, setActiveRoomId] = useState<string | null>(roomId);
  const [currentSeed, setCurrentSeed] = useState<number>(roadSeed || Math.floor(Math.random() * 1000000));
  const [score, setScore] = useState<number>(0);
  const [coinsCount, setCoinsCount] = useState<number>(0);
  const [deathReason, setDeathReason] = useState<string>('');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(sound.getMuted());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Rivals
  const [rivalNick, setRivalNick] = useState<string>(opponentNick || 'Rival Esperando');
  const [rivalAvatar, setRivalAvatar] = useState<string>(opponentAvatar || '👤');
  const [rivalScore, setRivalScore] = useState<number | null>(
    typeof targetScoreToBeat === 'number' ? targetScoreToBeat : null
  );
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Payout calculation (6% casino rake)
  const totalPot = wager * 2;
  const netPrize = Math.round(totalPot * 0.94);

  // Canvas & Game Loop Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Chicken state
  const chickenGrid = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const chickenTarget = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const chickenHopProgress = useRef<number>(1);
  const chickenFacing = useRef<0 | 1 | 2 | 3>(0); // 0: north (+z), 1: east (+x), 2: south (-z), 3: west (-x)
  const isDead = useRef<boolean>(false);
  const deathType = useRef<'crash' | 'drown'>('crash');
  const highestStep = useRef<number>(0);
  const totalCoinsRef = useRef<number>(0);

  // Camera tracking
  const camPos = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  // Map & lanes
  const lanesMap = useRef<Map<number, LaneData>>(new Map());
  const prngRef = useRef<() => number>(() => 0);
  const particles = useRef<Particle2D[]>([]);

  // Touch Swipe & Tap
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);

  // Fullscreen support
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  // -------------------------------------------------------------
  // ISOMETRIC COORDINATE MATH & DRAWING HELPERS
  // -------------------------------------------------------------
  const TILE_W = 56;
  const TILE_H = 28;
  const BLOCK_H = 22;

  // Converts grid (x, z) with elevation y to screen (sx, sy) relative to camera
  const toScreen = (gx: number, gz: number, gy: number, cw: number, ch: number) => {
    const relX = gx - camPos.current.x;
    const relZ = gz - camPos.current.z;
    const sx = (relX - relZ) * (TILE_W / 2) + cw / 2;
    const sy = (relX + relZ) * (TILE_H / 2) + ch * 0.62 - gy;
    return { x: sx, y: sy };
  };

  // Draw 3D Isometric Voxel Cube
  const drawVoxelBlock = (
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    w: number,
    h: number,
    depthH: number,
    topCol: string,
    leftCol: string,
    rightCol: string
  ) => {
    const hw = w / 2;
    const hh = h / 2;

    // 1. Top face (Rhombus)
    ctx.fillStyle = topCol;
    ctx.beginPath();
    ctx.moveTo(sx, sy - depthH);
    ctx.lineTo(sx + hw, sy - depthH + hh);
    ctx.lineTo(sx, sy - depthH + h);
    ctx.lineTo(sx - hw, sy - depthH + hh);
    ctx.closePath();
    ctx.fill();

    // 2. Left face
    ctx.fillStyle = leftCol;
    ctx.beginPath();
    ctx.moveTo(sx - hw, sy - depthH + hh);
    ctx.lineTo(sx, sy - depthH + h);
    ctx.lineTo(sx, sy + h);
    ctx.lineTo(sx - hw, sy + hh);
    ctx.closePath();
    ctx.fill();

    // 3. Right face
    ctx.fillStyle = rightCol;
    ctx.beginPath();
    ctx.moveTo(sx, sy - depthH + h);
    ctx.lineTo(sx + hw, sy - depthH + hh);
    ctx.lineTo(sx + hw, sy + hh);
    ctx.lineTo(sx, sy + h);
    ctx.closePath();
    ctx.fill();
  };

  // -------------------------------------------------------------
  // LANE GENERATION & PROCEDURAL INFINITY
  // -------------------------------------------------------------
  const generateLane = (z: number, type: LaneType, prng: () => number): LaneData => {
    const direction: 1 | -1 = prng() > 0.5 ? 1 : -1;
    const items: MovingItem[] = [];
    const trees: number[] = [];
    const coins: LaneData['coins'] = [];

    // Starting safe rows
    if (z <= 2) {
      [-7, -6, 6, 7].forEach((x) => trees.push(x));
      return { z, type: 'grass', speed: 0, direction: 1, items, trees, coins };
    }

    if (type === 'grass') {
      const obstacleCount = Math.floor(prng() * 3) + 2;
      const taken = new Set<number>();
      for (let i = 0; i < obstacleCount; i++) {
        const tx = Math.floor(prng() * 11) - 5;
        if (!taken.has(tx) && (tx !== 0 || prng() > 0.6)) {
          taken.add(tx);
          trees.push(tx);
        }
      }
      [-7, -6, 6, 7].forEach((x) => trees.push(x));

      // Coin spawn
      if (prng() < 0.35) {
        const cx = Math.floor(prng() * 9) - 4;
        if (!taken.has(cx)) {
          coins.push({ x: cx, collected: false });
        }
      }
      return { z, type: 'grass', speed: 0, direction: 1, items, trees, coins };
    }

    if (type === 'road') {
      const speed = (prng() * 2.8 + 2.5) * direction;
      const carCount = Math.floor(prng() * 2) + 2;
      const carColors = ['#ef4444', '#3b82f6', '#facc15', '#ec4899', '#10b981', '#8b5cf6', '#f97316'];

      for (let i = 0; i < carCount; i++) {
        const col = carColors[Math.floor(prng() * carColors.length)];
        const vType = prng() < 0.25 ? 'taxi' : prng() < 0.5 ? 'truck' : prng() < 0.75 ? 'sport' : 'sedan';
        const w = vType === 'truck' ? 2.8 : vType === 'sport' ? 1.8 : 2.1;
        const initX = i * (24 / carCount) - 12 + (prng() * 2 - 1);
        items.push({ x: initX, width: w, speed, type: vType, color: col });
      }
      return { z, type: 'road', speed, direction, items, trees, coins };
    }

    if (type === 'river') {
      const speed = (prng() * 1.8 + 1.6) * direction;
      const count = Math.floor(prng() * 2) + 2;

      for (let i = 0; i < count; i++) {
        const isLily = prng() < 0.25;
        const w = isLily ? 1.2 : prng() < 0.5 ? 2.5 : 3.4;
        const initX = i * (22 / count) - 11 + (prng() * 2 - 1);
        items.push({
          x: initX,
          width: w,
          speed,
          type: isLily ? 'lily' : 'log',
          color: isLily ? '#15803d' : '#854d0e'
        });
      }
      return { z, type: 'river', speed, direction, items, trees, coins };
    }

    // Railway
    const trainSpeed = (prng() * 5.0 + 16.0) * direction;
    const startX = direction > 0 ? -30 : 30;
    items.push({
      x: startX,
      width: 14.0,
      speed: trainSpeed,
      type: 'train',
      color: '#f8fafc'
    });

    return {
      z,
      type: 'rail',
      speed: trainSpeed,
      direction,
      items,
      trees,
      coins,
      warningActive: false,
      trainTimer: prng() * 3.5 + 3.0
    };
  };

  const generateLaneChunk = (fromZ: number, count: number, prng: () => number) => {
    let curZ = fromZ;
    const endZ = fromZ + count;

    while (curZ < endZ) {
      if (curZ <= 3) {
        lanesMap.current.set(curZ, generateLane(curZ, 'grass', prng));
        curZ++;
        continue;
      }

      const roll = prng();
      if (roll < 0.28) {
        // Meadows (1-2 rows)
        const rows = Math.floor(prng() * 2) + 1;
        for (let r = 0; r < rows && curZ < endZ; r++, curZ++) {
          lanesMap.current.set(curZ, generateLane(curZ, 'grass', prng));
        }
      } else if (roll < 0.65) {
        // Highways (2-4 lanes)
        const highwayLanes = Math.floor(prng() * 3) + 2;
        for (let h = 0; h < highwayLanes && curZ < endZ; h++, curZ++) {
          lanesMap.current.set(curZ, generateLane(curZ, 'road', prng));
        }
      } else if (roll < 0.88) {
        // Rivers (1-3 rows)
        const riverLanes = Math.floor(prng() * 2) + 1;
        for (let rv = 0; rv < riverLanes && curZ < endZ; rv++, curZ++) {
          lanesMap.current.set(curZ, generateLane(curZ, 'river', prng));
        }
      } else {
        // Express Rail (1 row)
        lanesMap.current.set(curZ, generateLane(curZ, 'rail', prng));
        curZ++;
      }
    }
  };

  // -------------------------------------------------------------
  // CONTROLS & HOPPING LOGIC
  // -------------------------------------------------------------
  const attemptHop = (dx: number, dz: number) => {
    if (isDead.current || chickenHopProgress.current < 1 || gameStage !== 'playing') return;

    const nextX = Math.round(chickenGrid.current.x + dx);
    const nextZ = Math.round(chickenGrid.current.z + dz);

    if (nextX < -6 || nextX > 6) return;
    if (nextZ < 0) return;

    // Check tree obstacles
    const lane = lanesMap.current.get(nextZ);
    if (lane && lane.trees) {
      if (lane.trees.includes(nextX)) {
        sound.playTileClick();
        return;
      }
    }

    // Set facing
    if (dz > 0) chickenFacing.current = 0;
    else if (dx > 0) chickenFacing.current = 1;
    else if (dz < 0) chickenFacing.current = 2;
    else if (dx < 0) chickenFacing.current = 3;

    sound.playJumpHop();
    chickenTarget.current = { x: nextX, z: nextZ };
    chickenHopProgress.current = 0;
  };

  // Global Tap or Click: 1 step forward
  const handleGlobalClick = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.no-hop')) return;
    attemptHop(0, 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.no-hop')) return;
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartPos.current.x;
    const dy = t.clientY - touchStartPos.current.y;
    const duration = Date.now() - touchStartPos.current.time;
    touchStartPos.current = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 20 && absDy < 20 && duration < 320) {
      attemptHop(0, 1);
      return;
    }

    if (absDx > absDy) {
      if (dx > 35) attemptHop(1, 0); // Right
      else if (dx < -35) attemptHop(-1, 0); // Left
    } else {
      if (dy < -35) attemptHop(0, 1); // Up
      else if (dy > 35) attemptHop(0, -1); // Down
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStage !== 'playing') return;
      if (e.key === 'ArrowUp' || e.key === 'KeyW' || e.key === 'Space') {
        e.preventDefault();
        attemptHop(0, 1);
      } else if (e.key === 'ArrowDown' || e.key === 'KeyS') {
        e.preventDefault();
        attemptHop(0, -1);
      } else if (e.key === 'ArrowLeft' || e.key === 'KeyA') {
        e.preventDefault();
        attemptHop(-1, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'KeyD') {
        e.preventDefault();
        attemptHop(1, 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStage]);

  // -------------------------------------------------------------
  // GAME OVER & RESOLUTION
  // -------------------------------------------------------------
  const handleDeath = async (reason: string, type: 'crash' | 'drown') => {
    if (isDead.current) return;
    isDead.current = true;
    deathType.current = type;
    setDeathReason(reason);

    // Spawn 2D particles
    const pCol = type === 'crash' ? '#f8fafc' : '#38bdf8';
    if (type === 'crash') sound.playRoadCrash();
    else sound.playWaterSplash();

    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 5 + 2;
      particles.current.push({
        x: chickenGrid.current.x,
        y: chickenGrid.current.z,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 3,
        color: pCol,
        size: Math.random() * 5 + 3,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 0.4 + 0.3
      });
    }

    const finalScore = highestStep.current + totalCoinsRef.current * 10;

    setTimeout(() => {
      setGameStage('game_over');
    }, 500);

    // Bot instant resolution
    if (playMode === 'bot_instant') {
      const botScore = Math.floor(Math.random() * 45) + 32;
      setRivalScore(botScore);

      if (finalScore > botScore) {
        sound.playWin();
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        const curBal = profile ? profile.balance : userBalance;
        await updateBalance(curBal + netPrize);
      } else {
        sound.playLoss();
      }

      if (onMatchComplete) {
        onMatchComplete({
          id: `match_road_${Date.now()}`,
          timestamp: Date.now(),
          gameTitle: 'Berries Road 2D',
          opponentName: 'BerryBot 3D',
          result: finalScore > botScore ? 'win' : 'loss',
          betAmount: wager,
          payout: finalScore > botScore ? netPrize : 0,
          netProfit: (finalScore > botScore ? netPrize : 0) - wager,
          finalScore: `${finalScore} pts vs ${botScore} pts`
        });
      }
      return;
    }

    // PvP Acceptor resolution
    if (playMode === 'pvp_accept' && activeRoomId) {
      const curBal = profile ? profile.balance : userBalance;
      try {
        const res = await submitOpponentScoreAndResolve(activeRoomId, finalScore, {
          uid: user?.uid || 'guest_user',
          username: profile?.username || 'Rival Voxel',
          avatar: profile?.avatar || '🐥',
          rating: profile?.rating || 1000
        });

        if (res.isOpponentWinner) {
          sound.playWin();
          confetti({ particleCount: 130, spread: 80, origin: { y: 0.6 } });
          await updateBalance(curBal + netPrize);
        } else if (res.isTie) {
          await updateBalance(curBal + wager);
        } else {
          sound.playLoss();
        }

        if (onMatchComplete) {
          onMatchComplete({
            id: activeRoomId,
            timestamp: Date.now(),
            gameTitle: 'Berries Road 2D',
            opponentName: rivalNick,
            result: res.isOpponentWinner ? 'win' : res.isTie ? 'tie' : 'loss',
            betAmount: wager,
            payout: res.isOpponentWinner ? netPrize : res.isTie ? wager : 0,
            netProfit: (res.isOpponentWinner ? netPrize : res.isTie ? wager : 0) - wager,
            finalScore: `${finalScore} pts`
          });
        }
      } catch (err) {
        console.error('Error resolving Berries Road:', err);
      }
      return;
    }

    // PvP Creator host score
    if (playMode === 'pvp_create' && activeRoomId) {
      try {
        await publishAsyncHostScore(activeRoomId, finalScore);
      } catch (err) {
        console.error('Error publishing score in Berries Road:', err);
      }
    }
  };

  // -------------------------------------------------------------
  // START NEW ROUND
  // -------------------------------------------------------------
  const startMatch = async (selectedMode: 'pvp_create' | 'bot_instant') => {
    const curBal = profile ? profile.balance : userBalance;
    if (curBal < wager) {
      sound.playLoss();
      setBalanceError(`Saldo insuficiente (${curBal} BerryCoins). Necesitas ${wager} para disputar esta sala.`);
      return;
    }
    setBalanceError(null);

    sound.playChip();
    await updateBalance(curBal - wager);

    const newSeed = Math.floor(Math.random() * 1000000);
    setCurrentSeed(newSeed);
    setPlayMode(selectedMode);
    setScore(0);
    setCoinsCount(0);
    setDeathReason('');
    isDead.current = false;
    chickenGrid.current = { x: 0, z: 0 };
    chickenTarget.current = { x: 0, z: 0 };
    chickenHopProgress.current = 1;
    highestStep.current = 0;
    totalCoinsRef.current = 0;
    particles.current = [];

    if (selectedMode === 'bot_instant') {
      setRivalNick('BerryBot 3D');
      setRivalAvatar('🤖');
      setActiveRoomId(null);
    } else {
      setRivalNick('Rival Esperando');
      setRivalAvatar('👤');
      try {
        const id = await createGameRoom({
          gameId: 'berriesroad',
          gameTitle: 'Berries Road 2D',
          wager,
          userId: user?.uid || 'guest_host',
          username: profile?.username || 'Jugador',
          avatar: profile?.avatar || '🐣',
          rating: profile?.rating || 1000,
          roadSeed: newSeed
        });
        setActiveRoomId(id);
      } catch (err) {
        console.error('Error creating Berries Road room:', err);
      }
    }

    setGameStage('playing');
  };

  // -------------------------------------------------------------
  // CANVAS 2D RENDER LOOP (60 FPS PURE 2D ISOMETRIC)
  // -------------------------------------------------------------
  useEffect(() => {
    if (gameStage !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset PRNG and generate initial 45 lanes
    const prng = createPRNG(currentSeed);
    prngRef.current = prng;
    lanesMap.current.clear();
    generateLaneChunk(0, 45, prng);

    let lastTime = performance.now();

    const loop = (time: number) => {
      animFrameId.current = requestAnimationFrame(loop);
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Resize canvas to match display window
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = rect.width * dpr;
      const ch = rect.height * dpr;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const viewW = rect.width;
      const viewH = rect.height;

      // 1. Sky Background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, viewH);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.6, '#7dd3fc');
      skyGrad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, viewW, viewH);

      // 2. Update Chicken Hop Animation
      let chickenElevY = 0;
      let curChickenX = chickenGrid.current.x;
      let curChickenZ = chickenGrid.current.z;

      if (chickenHopProgress.current < 1) {
        chickenHopProgress.current += dt * 6.8;
        const t = Math.min(chickenHopProgress.current, 1);
        curChickenX = THREE.MathUtils.lerp(chickenGrid.current.x, chickenTarget.current.x, t);
        curChickenZ = THREE.MathUtils.lerp(chickenGrid.current.z, chickenTarget.current.z, t);
        chickenElevY = Math.sin(t * Math.PI) * 22; // Hop arc

        if (t >= 1) {
          chickenGrid.current = { ...chickenTarget.current };
          curChickenX = chickenGrid.current.x;
          curChickenZ = chickenGrid.current.z;

          // Check coin collection
          const lane = lanesMap.current.get(chickenGrid.current.z);
          if (lane && lane.coins) {
            lane.coins.forEach((c) => {
              if (!c.collected && Math.abs(c.x - chickenGrid.current.x) < 0.6) {
                c.collected = true;
                totalCoinsRef.current += 1;
                setCoinsCount(totalCoinsRef.current);
                sound.playCoinCollect();
              }
            });
          }

          // Advance score
          if (chickenGrid.current.z > highestStep.current) {
            highestStep.current = chickenGrid.current.z;
            setScore(highestStep.current);

            // Infinite procedural expansion
            if (highestStep.current + 25 > lanesMap.current.size) {
              const startZ = lanesMap.current.size;
              generateLaneChunk(startZ, 25, prngRef.current);
            }
          }
        }
      }

      // Smooth Camera follow
      camPos.current.x = THREE.MathUtils.damp(camPos.current.x, curChickenX, 8, dt);
      camPos.current.z = THREE.MathUtils.damp(camPos.current.z, curChickenZ, 8, dt);

      // 3. Update Moving Lane Items (Cars, Logs, Trains)
      lanesMap.current.forEach((lane) => {
        // Cars & Logs
        if (lane.type === 'road' || lane.type === 'river') {
          lane.items.forEach((item) => {
            item.x += item.speed * dt;
            if (item.speed > 0 && item.x > 18) item.x = -18;
            else if (item.speed < 0 && item.x < -18) item.x = 18;
          });
        }

        // Trains
        if (lane.type === 'rail' && lane.trainTimer !== undefined) {
          lane.trainTimer -= dt;
          if (lane.trainTimer <= 1.5 && lane.trainTimer > 0) {
            if (!lane.warningActive) {
              lane.warningActive = true;
              sound.playTrainWarning();
            }
          } else if (lane.trainTimer <= 0) {
            const train = lane.items[0];
            train.x += train.speed * dt;
            if (train.speed > 0 ? train.x > 35 : train.x < -35) {
              lane.trainTimer = Math.random() * 4.5 + 3.5;
              lane.warningActive = false;
              train.x = lane.direction > 0 ? -35 : 35;
            }
          }
        }
      });

      // 4. Floating on River logs
      if (!isDead.current && chickenHopProgress.current >= 1) {
        const curLane = lanesMap.current.get(chickenGrid.current.z);
        if (curLane && curLane.type === 'river') {
          let onLog = false;
          for (const item of curLane.items) {
            const halfW = item.width / 2 + 0.35;
            if (chickenGrid.current.x >= item.x - halfW && chickenGrid.current.x <= item.x + halfW) {
              onLog = true;
              chickenGrid.current.x += item.speed * dt;
              chickenTarget.current.x = chickenGrid.current.x;
              curChickenX = chickenGrid.current.x;

              if (chickenGrid.current.x < -7 || chickenGrid.current.x > 7) {
                handleDeath('¡La corriente te sacó de la pista!', 'drown');
              }
              break;
            }
          }
          if (!onLog) {
            handleDeath('¡Caíste al agua y te hundiste!', 'drown');
          }
        }
      }

      // 5. Collision with Cars & Trains
      if (!isDead.current) {
        const curLane = lanesMap.current.get(Math.round(curChickenZ));
        if (curLane) {
          if (curLane.type === 'road') {
            for (const car of curLane.items) {
              if (Math.abs(curChickenX - car.x) < car.width / 2 + 0.35 && Math.abs(curChickenZ - curLane.z) < 0.6) {
                handleDeath('¡Atropellado por un auto en la autopista!', 'crash');
                break;
              }
            }
          } else if (curLane.type === 'rail') {
            const train = curLane.items[0];
            if (Math.abs(curChickenX - train.x) < train.width / 2 + 0.4 && Math.abs(curChickenZ - curLane.z) < 0.65) {
              handleDeath('¡El Tren Express te pasó por encima!', 'crash');
            }
          }
        }
      }

      // 6. Draw Sorted Isometric Ground & Obstacles
      const minZ = Math.max(0, Math.floor(camPos.current.z - 8));
      const maxZ = Math.floor(camPos.current.z + 24);

      for (let z = minZ; z <= maxZ; z++) {
        const lane = lanesMap.current.get(z);
        if (!lane) continue;

        // Draw Row Ground Tiles (x from -8 to 8)
        for (let x = -8; x <= 8; x++) {
          const pt = toScreen(x, z, 0, viewW, viewH);

          if (lane.type === 'grass') {
            const isDark = (x + z) % 2 === 0;
            drawVoxelBlock(
              ctx,
              pt.x,
              pt.y,
              TILE_W,
              TILE_H,
              BLOCK_H,
              isDark ? '#22c55e' : '#16a34a',
              isDark ? '#15803d' : '#166534',
              isDark ? '#166534' : '#14532d'
            );
          } else if (lane.type === 'road') {
            drawVoxelBlock(
              ctx,
              pt.x,
              pt.y,
              TILE_W,
              TILE_H,
              BLOCK_H,
              '#334155',
              '#1e293b',
              '#0f172a'
            );
            // Road dash marking
            if (x % 3 === 0) {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.ellipse(pt.x, pt.y - BLOCK_H + TILE_H / 2, 5, 2, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (lane.type === 'river') {
            drawVoxelBlock(
              ctx,
              pt.x,
              pt.y + 4,
              TILE_W,
              TILE_H,
              BLOCK_H - 4,
              '#0284c7',
              '#0369a1',
              '#075985'
            );
          } else if (lane.type === 'rail') {
            drawVoxelBlock(
              ctx,
              pt.x,
              pt.y,
              TILE_W,
              TILE_H,
              BLOCK_H,
              '#475569',
              '#334155',
              '#1e293b'
            );
            // Metal Rails
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(pt.x - 12, pt.y - BLOCK_H + 4, 24, 2);
          }
        }

        // Draw River Logs / Lily Pads on this lane
        if (lane.type === 'river') {
          lane.items.forEach((item) => {
            const pt = toScreen(item.x, z, 4, viewW, viewH);
            if (item.type === 'lily') {
              ctx.fillStyle = '#15803d';
              ctx.beginPath();
              ctx.ellipse(pt.x, pt.y - BLOCK_H + 8, item.width * 14, 10, 0, 0, Math.PI * 2);
              ctx.fill();
              // Pink flower
              ctx.fillStyle = '#f43f5e';
              ctx.beginPath();
              ctx.arc(pt.x, pt.y - BLOCK_H + 7, 3, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Wood Log
              drawVoxelBlock(
                ctx,
                pt.x,
                pt.y,
                item.width * 20,
                14,
                10,
                '#854d0e',
                '#713f12',
                '#502c0b'
              );
            }
          });
        }

        // Draw Road Cars on this lane
        if (lane.type === 'road') {
          lane.items.forEach((car) => {
            const pt = toScreen(car.x, z, 2, viewW, viewH);
            // Car chassis
            drawVoxelBlock(
              ctx,
              pt.x,
              pt.y,
              car.width * 18,
              16,
              14,
              car.color,
              '#1e293b',
              '#0f172a'
            );
            // Cabin glass
            drawVoxelBlock(
              ctx,
              pt.x,
              pt.y - 12,
              car.width * 11,
              12,
              8,
              '#93c5fd',
              '#60a5fa',
              '#2563eb'
            );
          });
        }

        // Draw Train on this lane
        if (lane.type === 'rail') {
          const train = lane.items[0];
          const pt = toScreen(train.x, z, 2, viewW, viewH);
          drawVoxelBlock(
            ctx,
            pt.x,
            pt.y,
            train.width * 20,
            18,
            20,
            '#f8fafc',
            '#cbd5e1',
            '#94a3b8'
          );
          // Red stripe
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(pt.x - train.width * 9, pt.y - 16, train.width * 18, 4);

          // Signal Warning Post
          const sigPt = toScreen(-7, z, 0, viewW, viewH);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(sigPt.x - 3, sigPt.y - BLOCK_H - 18, 6, 20);
          const blink = lane.warningActive && Math.sin(time / 80) > 0;
          ctx.fillStyle = blink ? '#ef4444' : '#450a0a';
          ctx.beginPath();
          ctx.arc(sigPt.x, sigPt.y - BLOCK_H - 18, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Trees on this lane
        if (lane.trees) {
          lane.trees.forEach((tx) => {
            const pt = toScreen(tx, z, 0, viewW, viewH);
            // Trunk
            drawVoxelBlock(ctx, pt.x, pt.y, 8, 6, 12, '#5c3a21', '#451a03', '#2d1102');
            // Foliage tiers
            drawVoxelBlock(ctx, pt.x, pt.y - 12, 26, 16, 14, '#16a34a', '#15803d', '#166534');
            drawVoxelBlock(ctx, pt.x, pt.y - 24, 18, 12, 12, '#22c55e', '#16a34a', '#15803d');
          });
        }

        // Draw Coins on this lane
        if (lane.coins) {
          lane.coins.forEach((c) => {
            if (!c.collected) {
              const pt = toScreen(c.x, z, 8 + Math.sin(time / 180) * 3, viewW, viewH);
              ctx.fillStyle = '#facc15';
              ctx.beginPath();
              ctx.arc(pt.x, pt.y - BLOCK_H, 7, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#e11d48';
              ctx.beginPath();
              ctx.arc(pt.x, pt.y - BLOCK_H, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        }

        // Draw Chicken at its depth
        if (Math.round(curChickenZ) === z) {
          const chPt = toScreen(curChickenX, curChickenZ, chickenElevY, viewW, viewH);

          // Chicken shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(chPt.x, chPt.y - BLOCK_H + TILE_H / 2 + chickenElevY * 0.7, 12, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          if (isDead.current && deathType.current === 'crash') {
            // Flattened pancake
            drawVoxelBlock(ctx, chPt.x, chPt.y + 14, 24, 12, 4, '#ffffff', '#e2e8f0', '#cbd5e1');
            ctx.fillStyle = '#f97316';
            ctx.fillRect(chPt.x - 3, chPt.y + 12, 6, 3);
          } else if (isDead.current && deathType.current === 'drown') {
            // Sunk in water
            drawVoxelBlock(ctx, chPt.x, chPt.y + 16, 12, 8, 6, '#ffffff', '#e2e8f0', '#cbd5e1');
          } else {
            // Healthy Voxel Chicken Body
            const bodyH = chickenHopProgress.current < 0.5 ? 20 : 16;
            drawVoxelBlock(ctx, chPt.x, chPt.y, 16, 12, bodyH, '#ffffff', '#e2e8f0', '#cbd5e1');
            // Red Comb
            drawVoxelBlock(ctx, chPt.x, chPt.y - bodyH, 6, 6, 6, '#ef4444', '#dc2626', '#b91c1c');
            // Beak
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(chPt.x + 4, chPt.y - bodyH + 8, 3.5, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(chPt.x + 2, chPt.y - bodyH + 4, 2, 3);
            ctx.fillRect(chPt.x - 3, chPt.y - bodyH + 4, 2, 3);
          }
        }
      }

      // 7. Draw 2D Splash / Crash Particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 12 * dt; // gravity

        const pt = toScreen(p.x, p.y, 0, viewW, viewH);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y - BLOCK_H, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        if (p.life >= p.maxLife) {
          particles.current.splice(i, 1);
        }
      }

      ctx.restore();
    };

    animFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [gameStage, currentSeed]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 w-screen h-screen bg-slate-950 text-slate-100 font-sans select-none overflow-hidden"
    >
      {/* ======================================================== */}
      {/* 1. LOBBY & WAGER SELECTION                               */}
      {/* ======================================================== */}
      {gameStage === 'lobby' && (
        <div className="w-full h-full flex items-center justify-center p-4 bg-radial from-slate-900 via-slate-950 to-black">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-emerald-500/30 backdrop-blur-2xl shadow-2xl shadow-emerald-950/60 flex flex-col items-center">
            {/* Header Icon */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl animate-bounce">🐣</span>
              <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent uppercase tracking-wider font-display">
                  BERRIES ROAD 2D
                </h2>
                <p className="text-xs text-emerald-400/80 font-mono tracking-widest uppercase">
                  Voxel Isometric PvP Asíncrono
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 text-center max-w-sm mt-2 mb-4 leading-relaxed">
              Esquiva bólidos, salta sobre troncos en el río y cruza vías de tren bala en un motor isométrico ultra-rápido. ¡Compite bajo la <strong>misma semilla procedural</strong>!
            </p>

            {balanceError && (
              <div className="w-full mb-4 p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs text-center flex items-center justify-center gap-2 animate-shake">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{balanceError}</span>
              </div>
            )}

            {/* Wager Selector ($25, $50, $100) */}
            <div className="w-full mb-6">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
                Seleccionar Créditos de Entrada:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[25, 50, 100].map((amount) => {
                  const isSelected = wager === amount;
                  return (
                    <button
                      key={amount}
                      onClick={() => {
                        setWager(amount);
                        sound.playChip();
                      }}
                      className={`py-3 px-4 rounded-2xl font-black text-sm md:text-base transition-all duration-200 border flex flex-col items-center justify-center cursor-pointer shadow-lg ${
                        isSelected
                          ? 'bg-gradient-to-b from-emerald-500 to-teal-700 text-white border-emerald-300 ring-2 ring-emerald-400/50 scale-105 shadow-emerald-500/30'
                          : 'bg-slate-800/80 text-slate-300 border-white/10 hover:border-emerald-500/50 hover:bg-slate-800'
                      }`}
                    >
                      <span>${amount}</span>
                      <span className="text-[10px] font-normal text-slate-200 opacity-80">BerryCoins</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pot Breakdown Box */}
            <div className="w-full bg-slate-950/70 rounded-2xl p-4 border border-emerald-500/20 mb-6 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center text-slate-300">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Coins className="w-4 h-4 text-amber-400" /> Pozo Total:
                </span>
                <span className="font-bold text-white">${totalPot} BerryCoins</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" /> Comisión Casino (6%):
                </span>
                <span className="text-rose-400">-${totalPot - netPrize} BerryCoins</span>
              </div>
              <div className="pt-2 border-t border-white/5 flex justify-between items-center text-sm">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" /> Premio Neto al Ganador:
                </span>
                <span className="font-black text-amber-300 text-base">${netPrize} BerryCoins</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-3">
              <button
                onClick={() => startMatch('pvp_create')}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-base transition-all duration-200 shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Swords className="w-5 h-5" />
                <span>CREAR SALA PVP (${wager})</span>
              </button>

              <button
                onClick={() => startMatch('bot_instant')}
                className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700/90 text-white font-bold text-sm transition-all duration-200 border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Bot className="w-5 h-5 text-cyan-400" />
                <span>JUGAR CONTRA BERRYBOT (PRÁCTICA)</span>
              </button>

              <button
                onClick={onBackToGrid}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors text-center cursor-pointer"
              >
                Volver al Catálogo del Casino
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PLAYING STAGE: ULTRA-MINIMAL HUD & ONE-TOUCH          */}
      {/* ======================================================== */}
      {gameStage === 'playing' && (
        <div
          className="relative w-full h-full cursor-pointer"
          onClick={handleGlobalClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* HTML5 Canvas 2D Engine */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

          {/* ULTRA-MINIMAL HUD: Giant Floating Modern Score */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center">
            <div className="text-5xl sm:text-7xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] tracking-tight font-display leading-none">
              {score}
            </div>
            {coinsCount > 0 && (
              <div className="mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/60 backdrop-blur-md border border-amber-400/30 text-amber-300 font-bold text-xs shadow-lg">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>+{coinsCount * 10} pts</span>
              </div>
            )}
          </div>

          {/* Top subtle controls (Mute, Fullscreen, Exit) */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 no-hop">
            <button
              onClick={(e) => {
                e.stopPropagation();
                sound.toggleMute();
                setIsAudioMuted(sound.getMuted());
              }}
              className="p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 cursor-pointer backdrop-blur-md shadow-md transition-colors"
              title="Sonido"
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 cursor-pointer backdrop-blur-md shadow-md transition-colors"
              title="Pantalla Completa"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onBackToGrid();
              }}
              className="p-2.5 rounded-full bg-slate-900/70 hover:bg-rose-950/80 text-slate-300 hover:text-rose-400 border border-white/10 cursor-pointer backdrop-blur-md shadow-md transition-colors"
              title="Salir al Casino"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* One-touch prompt indicator */}
          {score === 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center px-4 py-2 rounded-full bg-slate-900/75 backdrop-blur-md border border-white/10 text-xs font-semibold text-slate-200 animate-pulse shadow-lg">
              👆 Toca en cualquier parte para avanzar • Desliza a los lados para esquivar
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. GAME OVER MODAL (GLASSMORPHISM)                       */}
      {/* ======================================================== */}
      {gameStage === 'game_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200 select-none">
          <div className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl shadow-emerald-950/60 flex flex-col items-center text-center">
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-3xl shadow-xl shadow-emerald-500/30 mb-3 animate-bounce">
              🐣
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-wide uppercase font-display">
              ¡Partida Finalizada!
            </h3>
            <p className="text-xs text-rose-400 font-bold mt-1 mb-5 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {deathReason || 'Fin del recorrido'}
            </p>

            {/* Score & Coins Summary Card */}
            <div className="w-full bg-slate-950/70 rounded-2xl p-4 border border-white/10 mb-5 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Distancia</div>
                <div className="text-2xl font-black text-emerald-400 font-display">{score}</div>
              </div>
              <div className="border-x border-white/5">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Monedas</div>
                <div className="text-2xl font-black text-amber-300 font-display">+{coinsCount * 10}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Puntaje Total</div>
                <div className="text-2xl font-black text-white font-display">{score + coinsCount * 10}</div>
              </div>
            </div>

            {/* Outcome description */}
            <div className="w-full p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 mb-6 text-xs text-slate-300 leading-relaxed text-left">
              {playMode === 'pvp_create' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Desafío Guardado en Firestore</span>
                  </div>
                  <p>
                    Tu récord de <strong>{score + coinsCount * 10} puntos</strong> y la <strong>semilla ({currentSeed})</strong> han sido publicados en el catálogo. Cuando un rival acepte, jugará exactamente sobre este mismo mapa para definir quién se lleva el pozo de <strong>${netPrize} BerryCoins</strong>.
                  </p>
                </div>
              )}

              {playMode === 'bot_instant' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    {(score + coinsCount * 10) > (rivalScore || 0) ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-400" /> ¡Victoria contra BerryBot 3D!
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Derrota contra BerryBot 3D
                      </span>
                    )}
                  </div>
                  <p>
                    Tu puntuación: <strong>{score + coinsCount * 10}</strong> vs BerryBot: <strong>{rivalScore}</strong>.
                    {(score + coinsCount * 10) > (rivalScore || 0)
                      ? ` ¡Se acreditaron +${netPrize} BerryCoins a tu cuenta!`
                      : ' ¡Mejora tus reflejos y vuelve a intentarlo!'}
                  </p>
                </div>
              )}

              {playMode === 'pvp_accept' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    {(score + coinsCount * 10) > (rivalScore || 0) ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-400" /> ¡VICTORIA ÉPICA EN BERRIES ROAD!
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Derrota ante {rivalNick}
                      </span>
                    )}
                  </div>
                  <p>
                    Tu puntuación: <strong>{score + coinsCount * 10}</strong> vs {rivalNick}: <strong>{rivalScore}</strong>.
                    {(score + coinsCount * 10) > (rivalScore || 0)
                      ? ` ¡Has ganado el duelo y se te acreditaron +${netPrize} BerryCoins!`
                      : ` ${rivalNick} se lleva el pozo en esta ocasión.`}
                  </p>
                </div>
              )}
            </div>

            {/* Giant Neon Green Button: JUGAR DE NUEVO */}
            <div className="w-full space-y-3">
              <button
                onClick={() => setGameStage('lobby')}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 hover:from-emerald-300 hover:to-green-300 text-slate-950 font-black text-base uppercase tracking-wider transition-all shadow-xl shadow-emerald-500/40 flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <RotateCcw className="w-5 h-5 stroke-[2.5]" />
                <span>JUGAR DE NUEVO</span>
              </button>

              <button
                onClick={onBackToGrid}
                className="w-full py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>VOLVER AL CASINO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

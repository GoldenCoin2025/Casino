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
  Minimize2,
  Sparkles
} from 'lucide-react';
import {
  createGameRoom,
  publishAsyncHostScore,
  submitOpponentScoreAndResolve
} from '../services/matchService';

interface KnifeClashGameProps {
  initialWager?: number;
  userBalance: number;
  roomId?: string | null;
  mode?: 'live' | 'async' | 'challenge_accept';
  opponentNick?: string;
  opponentAvatar?: string;
  targetScoreToBeat?: number;
  knifeSeed?: number;
  onMatchComplete?: (record: BetRecord) => void;
  onBackToGrid: () => void;
}

// Deterministic Mulberry32 PRNG
function createPRNG(seed: number) {
  let s = (seed >>> 0) || 987654321;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface StuckKnife {
  angle: number; // Angle on log in radians
}

interface TargetBerry {
  angle: number;
  sliced: boolean;
}

interface WoodShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  size: number;
  color: string;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
}

export const KnifeClashGame: React.FC<KnifeClashGameProps> = ({
  initialWager = 50,
  userBalance,
  roomId = null,
  mode = 'async',
  opponentNick,
  opponentAvatar,
  targetScoreToBeat,
  knifeSeed,
  onMatchComplete,
  onBackToGrid,
}) => {
  const { user, profile, updateBalance } = useAuth();

  // Settings & Stages
  const [wager, setWager] = useState<number>(initialWager || 50);
  const [playMode, setPlayMode] = useState<'pvp_create' | 'pvp_accept' | 'bot_instant'>(
    mode === 'challenge_accept' ? 'pvp_accept' : 'pvp_create'
  );
  const [gameStage, setGameStage] = useState<'lobby' | 'playing' | 'game_over'>(
    mode === 'challenge_accept' ? 'playing' : 'lobby'
  );

  // Match State
  const [activeRoomId, setActiveRoomId] = useState<string | null>(roomId);
  const [currentSeed, setCurrentSeed] = useState<number>(knifeSeed || Math.floor(Math.random() * 1000000));
  const [score, setScore] = useState<number>(0);
  const [stageNum, setStageNum] = useState<number>(1);
  const [applesCount, setApplesCount] = useState<number>(0);
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

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Gameplay Refs
  const prngRef = useRef<() => number>(() => 0);
  const logAngle = useRef<number>(0);
  const logSpeed = useRef<number>(1.8);
  const logShake = useRef<number>(0);
  const stuckKnives = useRef<StuckKnife[]>([]);
  const berriesOnLog = useRef<TargetBerry[]>([]);
  const knivesRemaining = useRef<number>(7);
  const totalStageKnives = useRef<number>(7);

  // Fired knife state
  const flyingKnife = useRef<{
    active: boolean;
    y: number;
    vy: number;
    failed: boolean;
    failVx: number;
    failVy: number;
    failRot: number;
  }>({
    active: false,
    y: 0,
    vy: 0,
    failed: false,
    failVx: 0,
    failVy: 0,
    failRot: 0,
  });

  // Shatter & Sparks
  const shards = useRef<WoodShard[]>([]);
  const sparks = useRef<SparkParticle[]>([]);
  const isDead = useRef<boolean>(false);
  const scoreRef = useRef<number>(0);
  const applesRef = useRef<number>(0);
  const stageRef = useRef<number>(1);

  // Setup current stage target
  const setupStage = (stage: number, prng: () => number) => {
    stageRef.current = stage;
    setStageNum(stage);
    const requiredKnives = Math.min(6 + stage, 12);
    knivesRemaining.current = requiredKnives;
    totalStageKnives.current = requiredKnives;
    stuckKnives.current = [];
    berriesOnLog.current = [];

    // Pre-stuck obstacle knives based on stage
    const obstacles = stage === 1 ? 1 : Math.min(Math.floor(stage * 0.8) + 1, 4);
    for (let i = 0; i < obstacles; i++) {
      const obstacleAngle = (Math.PI * 2 * i) / obstacles + prng() * 0.5;
      stuckKnives.current.push({ angle: obstacleAngle });
    }

    // Apples / Berries on log
    if (prng() < 0.75) {
      const berryAngle = prng() * Math.PI * 2;
      berriesOnLog.current.push({ angle: berryAngle, sliced: false });
    }

    // Dynamic rotation pattern parameters
    logSpeed.current = (prng() * 1.5 + 1.8) * (prng() > 0.5 ? 1 : -1);
  };

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
  // THROW KNIFE (ONE-TOUCH)
  // -------------------------------------------------------------
  const throwKnife = () => {
    if (isDead.current || gameStage !== 'playing' || flyingKnife.current.active) return;
    if (knivesRemaining.current <= 0) return;

    sound.playKnifeThrow();
    flyingKnife.current = {
      active: true,
      y: 0, // from bottom
      vy: 1850, // pixels/sec
      failed: false,
      failVx: 0,
      failVy: 0,
      failRot: 0,
    };
  };

  const handleGlobalClick = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.no-throw')) return;
    throwKnife();
  };

  // Keyboard Space/Enter/ArrowUp on PC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStage !== 'playing') return;
      if (e.key === 'Space' || e.key === 'Enter' || e.key === 'ArrowUp') {
        e.preventDefault();
        throwKnife();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStage]);

  // -------------------------------------------------------------
  // GAME OVER & RESOLUTION
  // -------------------------------------------------------------
  const handleGameOver = async (reason: string) => {
    if (isDead.current) return;
    isDead.current = true;
    setDeathReason(reason);

    const finalScore = scoreRef.current + applesRef.current * 10;

    setTimeout(() => {
      setGameStage('game_over');
    }, 600);

    // Bot instant resolution
    if (playMode === 'bot_instant') {
      const botScore = Math.floor(Math.random() * 22) + 14;
      setRivalScore(botScore);

      if (finalScore > botScore) {
        sound.playWin();
        confetti({ particleCount: 110, spread: 75, origin: { y: 0.6 } });
        const curBal = profile ? profile.balance : userBalance;
        await updateBalance(curBal + netPrize);
      } else {
        sound.playLoss();
      }

      if (onMatchComplete) {
        onMatchComplete({
          id: `match_knife_${Date.now()}`,
          timestamp: Date.now(),
          gameTitle: 'Berries Blade (Knife Clash)',
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
          avatar: profile?.avatar || '🗡️',
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
            gameTitle: 'Berries Blade (Knife Clash)',
            opponentName: rivalNick,
            result: res.isOpponentWinner ? 'win' : res.isTie ? 'tie' : 'loss',
            betAmount: wager,
            payout: res.isOpponentWinner ? netPrize : res.isTie ? wager : 0,
            netProfit: (res.isOpponentWinner ? netPrize : res.isTie ? wager : 0) - wager,
            finalScore: `${finalScore} pts`
          });
        }
      } catch (err) {
        console.error('Error resolving Knife Clash:', err);
      }
      return;
    }

    // PvP Creator host score
    if (playMode === 'pvp_create' && activeRoomId) {
      try {
        await publishAsyncHostScore(activeRoomId, finalScore);
      } catch (err) {
        console.error('Error publishing host score in Knife Clash:', err);
      }
    }
  };

  // -------------------------------------------------------------
  // START MATCH
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
    setApplesCount(0);
    setDeathReason('');
    stageRef.current = 1;
    scoreRef.current = 0;
    applesRef.current = 0;
    isDead.current = false;
    shards.current = [];
    sparks.current = [];

    if (selectedMode === 'bot_instant') {
      setRivalNick('BerryBot 3D');
      setRivalAvatar('🤖');
      setActiveRoomId(null);
    } else {
      setRivalNick('Rival Esperando');
      setRivalAvatar('👤');
      try {
        const id = await createGameRoom({
          gameId: 'knifeclash',
          gameTitle: 'Berries Blade (Knife Clash)',
          wager,
          userId: user?.uid || 'guest_host',
          username: profile?.username || 'Jugador',
          avatar: profile?.avatar || '🗡️',
          rating: profile?.rating || 1000,
          knifeSeed: newSeed
        });
        setActiveRoomId(id);
      } catch (err) {
        console.error('Error creating Knife Clash room:', err);
      }
    }

    setGameStage('playing');
  };

  // -------------------------------------------------------------
  // DRAWING HELPERS (KNIFE, LOG, BERRIES)
  // -------------------------------------------------------------
  const drawKnifeShape = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    scale: number = 1
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    // Blade
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(0, -42); // Blade tip
    ctx.lineTo(8, -12);
    ctx.lineTo(7, 0);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-8, -12);
    ctx.closePath();
    ctx.fill();

    // Blade shine reflection
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(4, -12);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // Guard (Crossbar)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(-14, 0, 28, 6, 3);
    ctx.fill();

    // Handle (Hilt)
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.roundRect(-5, 6, 10, 22, 2);
    ctx.fill();

    // Pommel (End ring)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(0, 30, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawBerryShape = (ctx: CanvasRenderingContext2D, x: number, y: number, sliced: boolean) => {
    if (sliced) return;
    ctx.save();
    ctx.translate(x, y);

    // Red Berry / Apple body
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    // Highlights
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(-3, -3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Green leaf
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(3, -11, 4, 2, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // -------------------------------------------------------------
  // MAIN GAME LOOP (CANVAS 2D)
  // -------------------------------------------------------------
  useEffect(() => {
    if (gameStage !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prng = createPRNG(currentSeed);
    prngRef.current = prng;
    setupStage(1, prng);

    let lastTime = performance.now();

    const loop = (time: number) => {
      animFrameId.current = requestAnimationFrame(loop);
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

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

      // 1. Dark Neon Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, viewH);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#090d16');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, viewW, viewH);

      // Subtle vertical ambient speed lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
      ctx.lineWidth = 1.5;
      for (let x = 30; x < viewW; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, viewH);
        ctx.stroke();
      }

      // Log parameters
      const logCenterX = viewW / 2 + (logShake.current > 0 ? (Math.random() - 0.5) * logShake.current : 0);
      const logCenterY = viewH * 0.35 + (logShake.current > 0 ? (Math.random() - 0.5) * logShake.current : 0);
      const logRadius = Math.min(viewW * 0.28, 95);

      if (logShake.current > 0) {
        logShake.current = Math.max(0, logShake.current - dt * 25);
      }

      // 2. Rotate Wooden Log
      if (!isDead.current) {
        // Variable spin behavior (acceleration & pauses)
        const wave = Math.sin(time / 650);
        logAngle.current += (logSpeed.current + wave * 0.8) * dt;
      }

      // 3. Draw Wooden Target Log
      if (shards.current.length === 0) {
        ctx.save();
        ctx.translate(logCenterX, logCenterY);
        ctx.rotate(logAngle.current);

        // Bark outer ring
        ctx.fillStyle = '#5c2c06';
        ctx.beginPath();
        ctx.arc(0, 0, logRadius + 6, 0, Math.PI * 2);
        ctx.fill();

        // Wooden concentric rings
        const woodColors = ['#854d0e', '#a16207', '#ca8a04', '#eab308', '#d97706'];
        for (let r = logRadius; r > 10; r -= 18) {
          ctx.fillStyle = woodColors[Math.floor(r / 18) % woodColors.length];
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Inner heartwood
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(0, 0, logRadius * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Radial wood cracks
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.5;
        [0.4, 2.1, 4.2].forEach((crackAngle) => {
          ctx.beginPath();
          ctx.moveTo(Math.cos(crackAngle) * 15, Math.sin(crackAngle) * 15);
          ctx.lineTo(Math.cos(crackAngle) * (logRadius - 4), Math.sin(crackAngle) * (logRadius - 4));
          ctx.stroke();
        });

        // Draw Berries attached to log
        berriesOnLog.current.forEach((b) => {
          const bx = Math.cos(b.angle) * (logRadius + 4);
          const by = Math.sin(b.angle) * (logRadius + 4);
          drawBerryShape(ctx, bx, by, b.sliced);
        });

        // Draw Stuck Knives rotating with log
        stuckKnives.current.forEach((knife) => {
          const kx = Math.cos(knife.angle) * logRadius;
          const ky = Math.sin(knife.angle) * logRadius;
          // Knife points inward towards center of log
          drawKnifeShape(ctx, kx, ky, knife.angle - Math.PI / 2, 0.9);
        });

        ctx.restore();
      }

      // 4. Update & Draw Flying Knife
      const knifeBottomY = viewH * 0.85;

      if (flyingKnife.current.active) {
        if (!flyingKnife.current.failed) {
          flyingKnife.current.y += flyingKnife.current.vy * dt;
          const currentKnifeTipY = knifeBottomY - flyingKnife.current.y - 42;

          // Check Collision with Log Surface
          if (currentKnifeTipY <= logCenterY + logRadius) {
            // Impact point on the log (bottom: angle is PI/2 in screen space)
            const logCurrentRot = ((logAngle.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            // Impact angle relative to log's local coordinate system:
            const impactAngleOnLog = (Math.PI / 2 - logCurrentRot + Math.PI * 4) % (Math.PI * 2);

            // Collision check against already stuck knives
            let hitKnife = false;
            for (const sk of stuckKnives.current) {
              const normalAngle = ((sk.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
              let diff = Math.abs(impactAngleOnLog - normalAngle);
              if (diff > Math.PI) diff = Math.PI * 2 - diff;

              // Knife collision threshold (~14 degrees)
              if (diff < 0.24) {
                hitKnife = true;
                break;
              }
            }

            if (hitKnife) {
              // FAIL: Knife hit knife!
              sound.playKnifeHitKnife();
              flyingKnife.current.failed = true;
              flyingKnife.current.failVx = (Math.random() - 0.5) * 450;
              flyingKnife.current.failVy = -400;
              flyingKnife.current.failRot = (Math.random() - 0.5) * 15;

              // Sparks burst
              for (let i = 0; i < 20; i++) {
                const spAngle = Math.random() * Math.PI * 2;
                const spSpeed = Math.random() * 320 + 80;
                sparks.current.push({
                  x: logCenterX,
                  y: logCenterY + logRadius,
                  vx: Math.cos(spAngle) * spSpeed,
                  vy: Math.sin(spAngle) * spSpeed,
                  color: '#facc15',
                  life: 0,
                  maxLife: Math.random() * 0.4 + 0.2
                });
              }

              handleGameOver('¡Chocaste contra otro cuchillo!');
            } else {
              // SUCCESS: Knife embedded into log!
              sound.playKnifeHitWood();
              logShake.current = 6;
              stuckKnives.current.push({ angle: impactAngleOnLog });
              knivesRemaining.current = Math.max(0, knivesRemaining.current - 1);
              scoreRef.current += 1;
              setScore(scoreRef.current);

              // Check if any berry was sliced at this impact
              berriesOnLog.current.forEach((b) => {
                if (!b.sliced) {
                  let bDiff = Math.abs(impactAngleOnLog - b.angle);
                  if (bDiff > Math.PI) bDiff = Math.PI * 2 - bDiff;
                  if (bDiff < 0.26) {
                    b.sliced = true;
                    applesRef.current += 1;
                    setApplesCount(applesRef.current);
                    sound.playAppleSlash();

                    // Berry juice sparks
                    for (let i = 0; i < 16; i++) {
                      const jAngle = Math.random() * Math.PI * 2;
                      const jSpeed = Math.random() * 250 + 60;
                      sparks.current.push({
                        x: logCenterX,
                        y: logCenterY + logRadius,
                        vx: Math.cos(jAngle) * jSpeed,
                        vy: Math.sin(jAngle) * jSpeed,
                        color: '#ef4444',
                        life: 0,
                        maxLife: Math.random() * 0.4 + 0.2
                      });
                    }
                  }
                }
              });

              // Reset flying knife
              flyingKnife.current.active = false;

              // Check if stage is complete!
              if (knivesRemaining.current <= 0) {
                // Shatter log into flying shards!
                sound.playLogShatter();
                confetti({ particleCount: 60, spread: 60, origin: { y: 0.35 } });

                for (let i = 0; i < 14; i++) {
                  const sAngle = Math.random() * Math.PI * 2;
                  const sSpd = Math.random() * 450 + 150;
                  shards.current.push({
                    x: logCenterX,
                    y: logCenterY,
                    vx: Math.cos(sAngle) * sSpd,
                    vy: Math.sin(sAngle) * sSpd - 120,
                    rot: Math.random() * Math.PI * 2,
                    vRot: (Math.random() - 0.5) * 12,
                    size: Math.random() * 24 + 16,
                    color: i % 2 === 0 ? '#854d0e' : '#a16207'
                  });
                }

                // Advance to next stage after slight pause
                setTimeout(() => {
                  shards.current = [];
                  setupStage(stageRef.current + 1, prngRef.current);
                }, 750);
              }
            }
          }
        } else {
          // Failed knife physics (tumbling down)
          flyingKnife.current.failVy += 1600 * dt; // Gravity
          const kx = viewW / 2 + flyingKnife.current.failVx * dt;
          const ky = knifeBottomY - flyingKnife.current.y + flyingKnife.current.failVy * dt;
          flyingKnife.current.y -= flyingKnife.current.failVy * dt;
          drawKnifeShape(ctx, kx, ky, flyingKnife.current.failRot, 0.9);
        }

        if (!flyingKnife.current.failed) {
          drawKnifeShape(ctx, viewW / 2, knifeBottomY - flyingKnife.current.y, 0, 1.05);
        }
      } else {
        // Ready Knife at bottom center
        drawKnifeShape(ctx, viewW / 2, knifeBottomY, 0, 1.05);
      }

      // 5. Update & Draw Wood Shards (When Stage Clears)
      for (let i = shards.current.length - 1; i >= 0; i--) {
        const s = shards.current[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 1200 * dt; // gravity
        s.rot += s.vRot * dt;

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = s.color;
        ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size * 0.8);
        ctx.restore();

        if (s.y > viewH + 60) {
          shards.current.splice(i, 1);
        }
      }

      // 6. Update & Draw Sparks
      for (let i = sparks.current.length - 1; i >= 0; i--) {
        const sp = sparks.current[i];
        sp.life += dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 600 * dt;

        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (sp.life >= sp.maxLife) {
          sparks.current.splice(i, 1);
        }
      }

      // 7. Draw HUD: Knives Remaining on Left Stack
      const stackStartY = viewH * 0.58;
      for (let k = 0; k < totalStageKnives.current; k++) {
        const ky = stackStartY + k * 18;
        const isRemaining = k < knivesRemaining.current;
        ctx.fillStyle = isRemaining ? '#38bdf8' : '#334155';
        ctx.save();
        ctx.translate(28, ky);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-2, -10, 4, 20);
        ctx.restore();
      }

      // 8. Draw Top Stage Dots
      const dotsCenterX = viewW / 2;
      const dotY = 48;
      for (let d = 0; d < 4; d++) {
        const isCurrent = d === (stageNum - 1) % 4;
        const isPast = d < (stageNum - 1) % 4;
        ctx.fillStyle = isCurrent ? '#38bdf8' : isPast ? '#0284c7' : '#334155';
        ctx.beginPath();
        ctx.arc(dotsCenterX - 30 + d * 20, dotY, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    animFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [gameStage, currentSeed, stageNum]);

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
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-cyan-500/30 backdrop-blur-2xl shadow-2xl shadow-cyan-950/60 flex flex-col items-center">
            {/* Header Banner */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl animate-bounce">🗡️</span>
              <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent uppercase tracking-wider font-display">
                  BERRIES BLADE: KNIFE CLASH
                </h2>
                <p className="text-xs text-cyan-400/80 font-mono tracking-widest uppercase">
                  Lanzamiento de Cuchillos PvP Asíncrono
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 text-center max-w-sm mt-2 mb-4 leading-relaxed">
              Lanza dagas con precisión milimétrica al tronco giratorio. ¡Corta bayas y evita chocar tus cuchillos para dominar el pozo bajo la <strong>misma semilla procedural</strong>!
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
                          ? 'bg-gradient-to-b from-cyan-500 to-blue-700 text-white border-cyan-300 ring-2 ring-cyan-400/50 scale-105 shadow-cyan-500/30'
                          : 'bg-slate-800/80 text-slate-300 border-white/10 hover:border-cyan-500/50 hover:bg-slate-800'
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
            <div className="w-full bg-slate-950/70 rounded-2xl p-4 border border-cyan-500/20 mb-6 space-y-2 text-xs font-mono">
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
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" /> Premio Neto al Ganador:
                </span>
                <span className="font-black text-amber-300 text-base">${netPrize} BerryCoins</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-3">
              <button
                onClick={() => startMatch('pvp_create')}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-base transition-all duration-200 shadow-xl shadow-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
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
        >
          {/* HTML5 Canvas 2D Engine */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

          {/* Top Score (Left) */}
          <div className="absolute top-6 left-6 z-20 pointer-events-none">
            <div className="text-4xl sm:text-5xl font-black text-amber-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-display">
              {score}
            </div>
            <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Cuchillos</div>
          </div>

          {/* Center Stage Banner */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
            <div className="text-lg sm:text-xl font-black text-white uppercase tracking-widest font-display">
              STAGE {stageNum}
            </div>
          </div>

          {/* Top Right Berries Counter */}
          <div className="absolute top-6 right-20 z-20 pointer-events-none flex items-center gap-2">
            <div className="text-2xl font-black text-rose-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-display">
              {applesCount}
            </div>
            <span className="text-2xl">🍎</span>
          </div>

          {/* Top Right Controls (Mute, Fullscreen, Exit) */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 no-throw">
            <button
              onClick={(e) => {
                e.stopPropagation();
                sound.toggleMute();
                setIsAudioMuted(sound.getMuted());
              }}
              className="p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 cursor-pointer backdrop-blur-md shadow-md transition-colors"
              title="Sonido"
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
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
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center px-4 py-2 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-xs font-semibold text-slate-200 animate-pulse shadow-lg">
              👆 Toca en cualquier parte para lanzar la daga
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. GAME OVER MODAL (GLASSMORPHISM)                       */}
      {/* ======================================================== */}
      {gameStage === 'game_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200 select-none">
          <div className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl shadow-cyan-950/60 flex flex-col items-center text-center">
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-3xl shadow-xl shadow-cyan-500/30 mb-3 animate-bounce">
              🗡️
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-wide uppercase font-display">
              ¡Partida Finalizada!
            </h3>
            <p className="text-xs text-rose-400 font-bold mt-1 mb-5 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {deathReason || 'Cuchillo bloqueado'}
            </p>

            {/* Score & Coins Summary Card */}
            <div className="w-full bg-slate-950/70 rounded-2xl p-4 border border-white/10 mb-5 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Cuchillos</div>
                <div className="text-2xl font-black text-cyan-400 font-display">{score}</div>
              </div>
              <div className="border-x border-white/5">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Bayas</div>
                <div className="text-2xl font-black text-rose-400 font-display">+{applesCount * 10}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Puntaje Total</div>
                <div className="text-2xl font-black text-white font-display">{score + applesCount * 10}</div>
              </div>
            </div>

            {/* Outcome description */}
            <div className="w-full p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 mb-6 text-xs text-slate-300 leading-relaxed text-left">
              {playMode === 'pvp_create' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-cyan-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Desafío Guardado en Firestore</span>
                  </div>
                  <p>
                    Tu récord de <strong>{score + applesCount * 10} puntos</strong> y la <strong>semilla ({currentSeed})</strong> han sido publicados en el catálogo. Cuando un rival acepte, competirá sobre la misma rotación de troncos para definir quién gana el pozo de <strong>${netPrize} BerryCoins</strong>.
                  </p>
                </div>
              )}

              {playMode === 'bot_instant' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    {(score + applesCount * 10) > (rivalScore || 0) ? (
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
                    Tu puntuación: <strong>{score + applesCount * 10}</strong> vs BerryBot: <strong>{rivalScore}</strong>.
                    {(score + applesCount * 10) > (rivalScore || 0)
                      ? ` ¡Se acreditaron +${netPrize} BerryCoins a tu cuenta!`
                      : ' ¡Mejora tu puntería y vuelve a intentarlo!'}
                  </p>
                </div>
              )}

              {playMode === 'pvp_accept' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    {(score + applesCount * 10) > (rivalScore || 0) ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-400" /> ¡VICTORIA ÉPICA EN KNIFE CLASH!
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Derrota ante {rivalNick}
                      </span>
                    )}
                  </div>
                  <p>
                    Tu puntuación: <strong>{score + applesCount * 10}</strong> vs {rivalNick}: <strong>{rivalScore}</strong>.
                    {(score + applesCount * 10) > (rivalScore || 0)
                      ? ` ¡Has ganado el duelo y se te acreditaron +${netPrize} BerryCoins!`
                      : ` ${rivalNick} se lleva el pozo en esta ocasión.`}
                  </p>
                </div>
              )}
            </div>

            {/* Giant Neon Button: JUGAR DE NUEVO */}
            <div className="w-full space-y-3">
              <button
                onClick={() => setGameStage('lobby')}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-base uppercase tracking-wider transition-all shadow-xl shadow-cyan-500/40 flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
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

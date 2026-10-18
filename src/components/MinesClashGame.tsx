import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BetRecord, MIN_PVP_BET, RoomDocument } from '../types/casino';
import { sound } from '../utils/soundEffects';
import confetti from 'canvas-confetti';
import {
  Bomb,
  Diamond,
  X,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Trophy,
  Coins,
  Shield,
  Zap,
  Bot,
  Swords,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Flame,
  Clock,
  Sparkles
} from 'lucide-react';
import {
  createGameRoom,
  publishAsyncHostScore,
  submitOpponentScoreAndResolve
} from '../services/matchService';

interface MinesClashGameProps {
  initialWager?: number;
  userBalance: number;
  roomId?: string | null;
  mode?: 'live' | 'async' | 'challenge_accept';
  opponentNick?: string;
  opponentAvatar?: string;
  targetScoreToBeat?: number;
  mineIndicesSeed?: number[];
  onMatchComplete?: (record: BetRecord) => void;
  onBackToGrid: () => void;
}

const TOTAL_TILES = 25;
const TOTAL_MINES = 3;
const TOTAL_DIAMONDS = TOTAL_TILES - TOTAL_MINES; // 22

// Multiplier table based on diamonds found with 3 mines in 25 tiles
const MULTIPLIERS = [
  1.0, 1.12, 1.28, 1.48, 1.72, 2.02, 2.40, 2.88, 3.52, 4.38, 5.56,
  7.22, 9.60, 13.1, 18.4, 26.8, 40.8, 66.0, 114.0, 218.0, 480.0, 1200.0, 3500.0
];

export const MinesClashGame: React.FC<MinesClashGameProps> = ({
  initialWager = 50,
  userBalance,
  roomId = null,
  mode = 'async',
  opponentNick,
  opponentAvatar,
  targetScoreToBeat,
  mineIndicesSeed,
  onMatchComplete,
  onBackToGrid,
}) => {
  const { user, profile, updateBalance } = useAuth();

  // Wager & Game setup
  const [wager, setWager] = useState<number>(initialWager || 50);
  const [playMode, setPlayMode] = useState<'pvp_create' | 'pvp_accept' | 'bot_instant'>(
    mode === 'challenge_accept' ? 'pvp_accept' : 'pvp_create'
  );
  const [gameStage, setGameStage] = useState<'lobby' | 'playing' | 'game_over'>(
    mode === 'challenge_accept' ? 'playing' : 'lobby'
  );

  // Board state
  const [mineLocations, setMineLocations] = useState<number[]>([]);
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
  const [explodedMineIndex, setExplodedMineIndex] = useState<number | null>(null);
  const [isBusted, setIsBusted] = useState<boolean>(false);
  const [hasCashedOut, setHasCashedOut] = useState<boolean>(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(roomId);

  // Opponent & Bot state
  const [rivalNick, setRivalNick] = useState<string>(opponentNick || 'Rival Esperando');
  const [rivalAvatar, setRivalAvatar] = useState<string>(opponentAvatar || '👤');
  const [rivalScore, setRivalScore] = useState<number | null>(
    typeof targetScoreToBeat === 'number' ? targetScoreToBeat : null
  );

  // Financial & sound state
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(sound.getMuted());
  const [screenShake, setScreenShake] = useState<boolean>(false);

  // Calculated values
  const diamondsFound = isBusted ? 0 : revealedIndices.filter((idx) => !mineLocations.includes(idx)).length;
  const currentMultiplier = MULTIPLIERS[Math.min(diamondsFound, MULTIPLIERS.length - 1)];
  const totalPot = wager * 2;
  const netPrize = Math.round(totalPot * 0.94); // 6% casino commission

  // Generate 3 unique random mine positions
  const generateRandomMines = (): number[] => {
    const indices: number[] = [];
    while (indices.length < TOTAL_MINES) {
      const rand = Math.floor(Math.random() * TOTAL_TILES);
      if (!indices.includes(rand)) {
        indices.push(rand);
      }
    }
    return indices;
  };

  // Initialize board for a match
  const startMatch = async (selectedMode: 'pvp_create' | 'bot_instant') => {
    const curBal = profile ? profile.balance : userBalance;
    if (curBal < wager) {
      sound.playLoss();
      alert(`Saldo insuficiente ($${curBal} pesos). Necesitas $${wager} para apostar.`);
      return;
    }

    // Deduct wager
    sound.playBet();
    await updateBalance(curBal - wager);

    // Generate new mines or use seed
    const newMines = generateRandomMines();
    setMineLocations(newMines);
    setRevealedIndices([]);
    setExplodedMineIndex(null);
    setIsBusted(false);
    setHasCashedOut(false);
    setPlayMode(selectedMode);

    if (selectedMode === 'bot_instant') {
      const botNames = ['CyberBot 3000', 'GoldDigger AI', 'LuckyMiner', 'ViperBot'];
      const botAvatars = ['🤖', '🦾', '👾', '🦊'];
      const randIdx = Math.floor(Math.random() * botNames.length);
      setRivalNick(botNames[randIdx]);
      setRivalAvatar(botAvatars[randIdx]);

      // Bot simulated score: realistic weighted diamonds (between 2 and 10, or bust 0)
      const botBust = Math.random() < 0.22;
      const botDiamonds = botBust ? 0 : Math.floor(Math.random() * 9) + 2;
      setRivalScore(botDiamonds);
      setActiveRoomId(null);
    } else {
      // PvP Challenge: create room in Firestore
      setRivalNick('Rival Asíncrono');
      setRivalAvatar('⏳');
      setRivalScore(null);

      if (user && profile) {
        try {
          const rId = await createGameRoom({
            gameId: 'mines',
            gameTitle: 'MINES CLASH 1v1',
            wager,
            userId: user.uid,
            username: profile.username || 'Minero',
            avatar: profile.avatar || '💎',
            rating: profile.rating || 1200,
            mineIndices: newMines,
          });
          setActiveRoomId(rId);
        } catch (err) {
          console.error('Error creating mines room:', err);
        }
      }
    }

    setGameStage('playing');
  };

  // If accepting an existing challenge from P1
  useEffect(() => {
    if (mode === 'challenge_accept' && mineIndicesSeed && mineIndicesSeed.length === TOTAL_MINES) {
      setMineLocations(mineIndicesSeed);
      setRevealedIndices([]);
      setExplodedMineIndex(null);
      setIsBusted(false);
      setHasCashedOut(false);
      setGameStage('playing');
      setPlayMode('pvp_accept');
    }
  }, [mode, mineIndicesSeed]);

  // Click on a tile
  const handleTileClick = (index: number) => {
    if (gameStage !== 'playing') return;
    if (revealedIndices.includes(index)) return;
    if (isBusted || hasCashedOut) return;

    sound.playTileClick();
    const nextRevealed = [...revealedIndices, index];
    setRevealedIndices(nextRevealed);

    // Check if clicked tile is a Mine
    if (mineLocations.includes(index)) {
      // BOOM!
      sound.playMineExplosion();
      setExplodedMineIndex(index);
      setIsBusted(true);
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 500);

      // Reveal all mines and finish
      const allMinesRevealed = Array.from(new Set([...nextRevealed, ...mineLocations]));
      setRevealedIndices(allMinesRevealed);

      setTimeout(() => {
        finalizeRound(0, true);
      }, 1200);
    } else {
      // DIAMOND FOUND!
      const currentDiamonds = nextRevealed.filter((i) => !mineLocations.includes(i)).length;
      sound.playDiamondReveal(currentDiamonds);

      // Check if all diamonds found
      if (currentDiamonds === TOTAL_DIAMONDS) {
        handleCashOut(currentDiamonds);
      }
    }
  };

  // Cash out and secure current diamonds
  const handleCashOut = (overrideDiamonds?: number) => {
    if (gameStage !== 'playing' || isBusted || hasCashedOut) return;
    const finalScore = typeof overrideDiamonds === 'number' ? overrideDiamonds : diamondsFound;
    if (finalScore <= 0) return;

    sound.playCashOut();
    setHasCashedOut(true);

    // Reveal rest of the board
    setRevealedIndices(Array.from({ length: TOTAL_TILES }, (_, i) => i));

    setTimeout(() => {
      finalizeRound(finalScore, false);
    }, 1000);
  };

  // Finalize round settlement
  const finalizeRound = async (myDiamonds: number, isBust: boolean) => {
    setGameStage('game_over');

    // 1. PVP HOST: Publish score to Firestore room for rival
    if (playMode === 'pvp_create' && activeRoomId) {
      await publishAsyncHostScore(activeRoomId, myDiamonds, null, mineLocations);
      onMatchComplete?.({
        id: `bet_mines_${Date.now()}`,
        timestamp: Date.now(),
        gameTitle: 'MINES CLASH 1v1',
        opponentName: 'Esperando Rival Asíncrono',
        result: 'win',
        betAmount: wager,
        payout: 0,
        netProfit: 0,
        finalScore: `${myDiamonds} Diamantes ${isBust ? '(Explotó)' : '(Asegurados)'}`,
      });
      return;
    }

    // 2. PVP CHALLENGE ACCEPT: Compare vs Host score with exact same seed
    if (playMode === 'pvp_accept' && activeRoomId && user && profile) {
      try {
        const resolution = await submitOpponentScoreAndResolve(activeRoomId, myDiamonds, {
          uid: user.uid,
          username: profile.username || 'Minero P2',
          avatar: profile.avatar || '💎',
          rating: profile.rating || 1200,
        });

        if (resolution.isOpponentWinner) {
          sound.playWin();
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
          const newBal = (profile ? profile.balance : userBalance) + resolution.payout;
          await updateBalance(newBal);

          onMatchComplete?.({
            id: `bet_mines_${Date.now()}`,
            timestamp: Date.now(),
            gameTitle: 'MINES CLASH 1v1',
            opponentName: rivalNick,
            result: 'win',
            betAmount: wager,
            payout: resolution.payout,
            netProfit: resolution.payout - wager,
            finalScore: `${myDiamonds} vs ${rivalScore} Diamantes - ¡Victoria!`,
          });
        } else if (resolution.isTie) {
          // Refund
          const newBal = (profile ? profile.balance : userBalance) + wager;
          await updateBalance(newBal);

          onMatchComplete?.({
            id: `bet_mines_${Date.now()}`,
            timestamp: Date.now(),
            gameTitle: 'MINES CLASH 1v1',
            opponentName: rivalNick,
            result: 'tie',
            betAmount: wager,
            payout: wager,
            netProfit: 0,
            finalScore: `${myDiamonds} vs ${rivalScore} Diamantes - Empate`,
          });
        } else {
          sound.playLoss();
          onMatchComplete?.({
            id: `bet_mines_${Date.now()}`,
            timestamp: Date.now(),
            gameTitle: 'MINES CLASH 1v1',
            opponentName: rivalNick,
            result: 'loss',
            betAmount: wager,
            payout: 0,
            netProfit: -wager,
            finalScore: `${myDiamonds} vs ${rivalScore} Diamantes - Derrota`,
          });
        }
      } catch (err) {
        console.error('Error resolving mines challenge:', err);
      }
      return;
    }

    // 3. BOT INSTANT MATCH
    if (playMode === 'bot_instant') {
      const bScore = rivalScore !== null ? rivalScore : 4;
      if (myDiamonds > bScore) {
        // Player wins
        sound.playWin();
        confetti({ particleCount: 140, spread: 85, origin: { y: 0.5 } });
        const newBal = (profile ? profile.balance : userBalance) + netPrize;
        await updateBalance(newBal);

        onMatchComplete?.({
          id: `bet_mines_${Date.now()}`,
          timestamp: Date.now(),
          gameTitle: 'MINES CLASH 1v1',
          opponentName: `${rivalNick} (Bot)`,
          result: 'win',
          betAmount: wager,
          payout: netPrize,
          netProfit: netPrize - wager,
          finalScore: `${myDiamonds} vs ${bScore} Diamantes - ¡Victoria!`,
        });
      } else if (myDiamonds === bScore) {
        // Tie: refund wager
        sound.playWin();
        const newBal = (profile ? profile.balance : userBalance) + wager;
        await updateBalance(newBal);

        onMatchComplete?.({
          id: `bet_mines_${Date.now()}`,
          timestamp: Date.now(),
          gameTitle: 'MINES CLASH 1v1',
          opponentName: `${rivalNick} (Bot)`,
          result: 'tie',
          betAmount: wager,
          payout: wager,
          netProfit: 0,
          finalScore: `${myDiamonds} vs ${bScore} Diamantes - Empate`,
        });
      } else {
        // Bot wins
        sound.playLoss();
        onMatchComplete?.({
          id: `bet_mines_${Date.now()}`,
          timestamp: Date.now(),
          gameTitle: 'MINES CLASH 1v1',
          opponentName: `${rivalNick} (Bot)`,
          result: 'loss',
          betAmount: wager,
          payout: 0,
          netProfit: -wager,
          finalScore: `${myDiamonds} vs ${bScore} Diamantes - Derrota`,
        });
      }
    }
  };

  const toggleSound = () => {
    const next = sound.toggleMute();
    setIsAudioMuted(next);
  };

  return (
    <div
      className={`fixed inset-0 z-50 w-full h-[100dvh] bg-[#0c101c] text-white select-none flex flex-col justify-between overflow-hidden font-sans ${
        screenShake ? 'animate-shake' : ''
      }`}
    >
      {/* 1. TOP HEADER (VERTICAL IMMERSIVE BAR) */}
      <div className="w-full max-w-md mx-auto px-4 pt-3 pb-2 flex items-center justify-between border-b border-blue-900/40 bg-[#080d1a]/95 backdrop-blur-md">
        {/* Exit / Return to casino */}
        <button
          onClick={() => {
            sound.playChip();
            onBackToGrid();
          }}
          className="p-2 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-600/40 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 shadow-sm text-xs font-bold"
          title="Salir al Catálogo"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Lobby</span>
        </button>

        {/* Center: Pot & Stakes */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-amber-400 uppercase font-black tracking-widest flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            MINES CLASH 1v1
          </span>
          <div className="px-3 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-mono font-black flex items-center gap-1 mt-0.5 shadow-sm">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Pozo: ${totalPot} pesos</span>
          </div>
        </div>

        {/* Balance & Audio */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-xl bg-blue-950/90 border border-amber-500/40 text-xs font-mono font-black text-amber-300 flex items-center gap-1">
            <span>${(profile ? profile.balance : userBalance).toLocaleString('es-ES')}</span>
          </div>
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-700/40 text-slate-300 cursor-pointer"
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </div>

      {/* 2. COMPETITORS VS BAR */}
      <div className="w-full max-w-md mx-auto px-4 py-2 flex items-center justify-between">
        {/* Player 1 (You) */}
        <div className="flex items-center gap-2 bg-[#10182f] border border-cyan-400/40 rounded-2xl p-2 px-3 shadow-md">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-lg shadow-sm border border-white/20">
            {profile?.avatar || '😎'}
          </div>
          <div className="text-left">
            <span className="text-xs font-black text-white block max-w-[90px] truncate leading-tight">
              {profile?.username || 'Tú'}
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1">
              <Diamond className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>{diamondsFound} 💎</span>
            </span>
          </div>
        </div>

        {/* VS Badge */}
        <div className="flex flex-col items-center px-1">
          <span className="text-xs font-black text-rose-400 italic font-display tracking-wider">
            VS
          </span>
          <span className="text-[9px] text-slate-400 font-mono">Misma Semilla</span>
        </div>

        {/* Player 2 / Bot */}
        <div className="flex items-center gap-2 bg-[#10182f] border border-blue-600/40 rounded-2xl p-2 px-3 shadow-md">
          <div className="text-right">
            <span className="text-xs font-black text-slate-200 block max-w-[90px] truncate leading-tight">
              {rivalNick}
            </span>
            <span className="text-[10px] font-mono font-bold text-cyan-300 flex items-center justify-end gap-1">
              <Diamond className="w-3 h-3 text-cyan-400 fill-cyan-400" />
              <span>{rivalScore !== null ? `${rivalScore} 💎` : '¿?'}</span>
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center text-lg shadow-sm border border-white/20">
            {rivalAvatar}
          </div>
        </div>
      </div>

      {/* 3. LOBBY ENTRY SELECTOR (BEFORE MATCH STARTS) */}
      {gameStage === 'lobby' && (
        <div className="w-full max-w-md mx-auto px-4 flex-1 flex flex-col justify-center my-auto animate-in fade-in">
          <div className="bg-gradient-to-b from-[#131d3d] via-[#0e1733] to-[#090f24] border-2 border-cyan-400/40 rounded-3xl p-6 sm:p-7 text-center shadow-2xl space-y-5">
            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                <Bomb className="w-3 h-3 text-rose-400" />
                <span>BUSCAMINAS PVP ASÍNCRONO</span>
              </span>
              <h2 className="text-3xl font-black text-white font-display tracking-tight">
                MINES CLASH <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400">1v1</span>
              </h2>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Tablero 5x5 con <span className="text-rose-400 font-bold">3 Minas</span> y <span className="text-amber-300 font-bold">22 Diamantes</span>. Quien asegure más diamantes en la MISMA distribución gana el pozo acumulado.
              </p>
            </div>

            {/* Wager Options */}
            <div className="p-4 rounded-2xl bg-[#080e22] border border-blue-600/40 space-y-2 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black uppercase text-cyan-300 tracking-wide">Selecciona tu Apuesta:</span>
                <span className="text-slate-400 font-mono">Mínimo $25</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      sound.playChip();
                      setWager(amt);
                    }}
                    className={`py-2.5 rounded-xl text-xs font-mono font-black border transition-all cursor-pointer ${
                      wager === amt
                        ? 'bg-amber-400 text-slate-950 border-white shadow-md scale-105'
                        : 'bg-blue-950/80 text-cyan-200 border-blue-600/40 hover:bg-blue-900'
                    }`}
                  >
                    ${amt} pesos
                  </button>
                ))}
              </div>

              {/* Pot calculations */}
              <div className="mt-3 p-3 rounded-xl bg-blue-950/40 border border-white/5 space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Pozo Total en Disputa:</span>
                  <span className="text-amber-300 font-black text-sm">${wager * 2} pesos</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-400 pt-0.5 border-t border-white/5 font-bold">
                  <span>Premio Ganador (94%):</span>
                  <span className="text-sm font-black">${Math.round(wager * 2 * 0.94)} pesos</span>
                </div>
              </div>
            </div>

            {/* Match Launch Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => startMatch('pvp_create')}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-orange-950/60 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Swords className="w-4 h-4 fill-slate-950" />
                <span>CREAR SALA DESAFÍO ($ {wager} PESOS)</span>
              </button>

              <button
                onClick={() => startMatch('bot_instant')}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-600 hover:from-blue-600 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border border-cyan-400/30"
              >
                <Bot className="w-4 h-4" />
                <span>JUGAR CONTRA BOT (INSTANTÁNEO)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ACTIVE 5x5 MINES BOARD */}
      {gameStage === 'playing' && (
        <div className="w-full max-w-md mx-auto px-4 flex-1 flex flex-col justify-center items-center my-auto">
          {/* Top Board Metrics bar */}
          <div className="w-full flex items-center justify-between text-xs font-mono font-bold text-slate-300 px-2 mb-2">
            <div className="flex items-center gap-1.5 text-amber-300">
              <Diamond className="w-3.5 h-3.5 fill-amber-400" />
              <span>Diamantes: {diamondsFound} / 22</span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-400">
              <Bomb className="w-3.5 h-3.5" />
              <span>3 Minas Ocultas</span>
            </div>
          </div>

          {/* 5x5 GRID (MATCHING THE REFERENCE SCREENSHOT unnamed (2).webp) */}
          <div className="w-full aspect-square max-w-[340px] sm:max-w-[370px] bg-[#090e1f] p-3 rounded-3xl border-2 border-[#1c284d] shadow-[0_10px_40px_rgba(0,0,0,0.8)] grid grid-cols-5 gap-2 select-none">
            {Array.from({ length: TOTAL_TILES }).map((_, index) => {
              const isRevealed = revealedIndices.includes(index);
              const isMine = mineLocations.includes(index);
              const isDetonated = index === explodedMineIndex;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleTileClick(index)}
                  disabled={isRevealed || isBusted || hasCashedOut}
                  className={`relative rounded-xl flex items-center justify-center transition-all duration-150 select-none cursor-pointer ${
                    !isRevealed
                      ? 'bg-gradient-to-br from-[#1a2544] via-[#141d36] to-[#0e1529] border border-[#2b3a6b]/50 hover:border-cyan-400 hover:scale-[1.03] active:scale-95 shadow-inner'
                      : isMine
                      ? isDetonated
                        ? 'bg-gradient-to-br from-rose-600 via-red-600 to-rose-950 border-2 border-red-300 shadow-[0_0_20px_rgba(244,63,94,0.8)] scale-105'
                        : 'bg-rose-950/60 border border-rose-500/40 opacity-70'
                      : 'bg-gradient-to-br from-[#172b52] via-[#0d1e3d] to-[#081329] border border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                  }`}
                >
                  {/* Revealed Diamond */}
                  {isRevealed && !isMine && (
                    <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-200">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/50 transform rotate-45 border border-white/60">
                        <Diamond className="w-4 h-4 text-slate-950 fill-white transform -rotate-45" />
                      </div>
                    </div>
                  )}

                  {/* Revealed Mine / Bomb */}
                  {isRevealed && isMine && (
                    <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-200">
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg ${
                          isDetonated
                            ? 'bg-gradient-to-br from-slate-950 via-zinc-900 to-neutral-950 border-2 border-rose-400 animate-pulse'
                            : 'bg-zinc-900 border border-rose-500/50'
                        }`}
                      >
                        <Bomb className={`w-4 h-4 ${isDetonated ? 'text-rose-400 animate-bounce' : 'text-slate-400'}`} />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Current Win Info stats (like in screenshot) */}
          <div className="w-full max-w-[340px] sm:max-w-[370px] mt-3 p-2.5 rounded-2xl bg-[#090e1f] border border-blue-900/40 flex items-center justify-between text-xs font-mono">
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block">Diamantes Encontrados</span>
              <span className="font-black text-amber-300 text-sm">{diamondsFound} 💎</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Multiplicador Actual</span>
              <span className="font-black text-cyan-300 text-sm">{currentMultiplier.toFixed(2)}x</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. BOTTOM CASH OUT BUTTON (PLANTARSE) */}
      {gameStage === 'playing' && (
        <div className="w-full max-w-md mx-auto p-4 pt-1 bg-[#080d1a]/95 border-t border-blue-900/40">
          <button
            type="button"
            onClick={() => handleCashOut()}
            disabled={diamondsFound === 0 || isBusted || hasCashedOut}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-200 shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
              diamondsFound > 0 && !isBusted && !hasCashedOut
                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-950/60 scale-[1.01] active:scale-95 animate-pulse'
                : 'bg-slate-800 text-slate-500 border border-white/5 opacity-60 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>
              PLANTARSE / CASH OUT ({diamondsFound} 💎)
            </span>
          </button>
        </div>
      )}

      {/* 6. GAME OVER MODAL (GLASSMORPHISM WITH RESULTS) */}
      {gameStage === 'game_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in select-none">
          <div className="relative w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#131d3d]/95 via-[#0d1633]/95 to-[#080e22]/95 border-2 border-cyan-400/60 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-cyan-950/90 space-y-5 animate-in zoom-in-95">
            <div className="space-y-1">
              <span className="px-3.5 py-1 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>MINES CLASH 1v1</span>
              </span>

              {/* Title based on outcome */}
              <h3 className="text-3xl font-black text-white font-display tracking-tight">
                {playMode === 'pvp_create'
                  ? '¡Sala Creada con Éxito!'
                  : isBusted && (rivalScore || 0) > 0
                  ? '¡Pisaste una Mina! 💥'
                  : diamondsFound > (rivalScore || 0)
                  ? '¡Victoria Épica! 🏆'
                  : diamondsFound === (rivalScore || 0)
                  ? '¡Empate Técnico! ⚖️'
                  : '¡Derrota por Puntos!'}
              </h3>

              <p className="text-xs text-slate-300">
                {playMode === 'pvp_create'
                  ? `Lograste asegurar ${diamondsFound} diamantes. Tu desafío de $${wager} pesos ya está activo en el lobby para que cualquier rival lo dispute.`
                  : playMode === 'bot_instant'
                  ? diamondsFound > (rivalScore || 0)
                    ? `Superaste a ${rivalNick} (${diamondsFound} vs ${rivalScore} diamantes) y te llevas el pozo de $${netPrize} pesos.`
                    : diamondsFound === (rivalScore || 0)
                    ? `Empataron a ${diamondsFound} diamantes. Tu entrada de $${wager} pesos ha sido reembolsada íntegramente.`
                    : `${rivalNick} logró ${rivalScore} diamantes mientras que tú obtuviste ${diamondsFound}.`
                  : diamondsFound > (rivalScore || 0)
                  ? `Superaste a ${rivalNick} en la misma semilla (${diamondsFound} vs ${rivalScore}) y ganaste $${netPrize} pesos.`
                  : `${rivalNick} ganó el duelo (${rivalScore} vs ${diamondsFound}).`}
              </p>
            </div>

            {/* Scorecard comparison */}
            <div className="p-4 rounded-2xl bg-[#070d22]/90 border-2 border-blue-600/40 space-y-2 text-left font-mono">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-white/10">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Jugador</span>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Diamantes Logrados</span>
              </div>

              {/* Player 1 (You) */}
              <div className="flex items-center justify-between text-xs text-cyan-200 font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{profile?.avatar || '😎'}</span>
                  <span>{profile?.username || 'Tú'} (Tú)</span>
                </div>
                <span className="text-amber-300 text-sm font-black">
                  {diamondsFound} 💎 {isBusted && <span className="text-rose-400 text-xs">(💥)</span>}
                </span>
              </div>

              {/* Player 2 */}
              <div className="flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{rivalAvatar}</span>
                  <span>{rivalNick}</span>
                </div>
                <span className="text-cyan-300 text-sm font-black">
                  {rivalScore !== null ? `${rivalScore} 💎` : 'Pendiente ⏳'}
                </span>
              </div>
            </div>

            {/* Financial Result */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/90 to-cyan-950/90 border border-amber-500/40 text-left space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span>Entrada Apostada:</span>
                <span className="font-bold text-slate-200">${wager} pesos</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-1 text-slate-300">
                <span>Premio Obtenido:</span>
                <span className="font-black text-amber-300 text-sm">
                  ${playMode === 'pvp_create'
                    ? 0
                    : diamondsFound > (rivalScore || 0)
                    ? netPrize
                    : diamondsFound === (rivalScore || 0)
                    ? wager
                    : 0}{' '}
                  pesos
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  sound.playChip();
                  setGameStage('lobby');
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-orange-950/60 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>CREAR OTRA MESA / REVANCHA</span>
              </button>

              <button
                onClick={() => {
                  sound.playChip();
                  onBackToGrid();
                }}
                className="w-full py-3 rounded-2xl bg-blue-950/80 hover:bg-blue-900 border border-blue-600/40 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                SALIR AL LOBBY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

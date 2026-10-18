import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RPSMove, MOVES_CONFIG, RoundRecord, BetRecord, MIN_PVP_BET } from '../types/casino';
import { sound } from '../utils/soundEffects';
import { Swords, Trophy, Users, ArrowLeft, RefreshCw, AlertTriangle, ShieldCheck, Flame } from 'lucide-react';

interface RPSGameTableProps {
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  initialBet?: number;
  initialOpponent?: string;
  onMatchComplete: (record: BetRecord) => void;
  onBackToGrid: () => void;
  onOpenRules: () => void;
}

const PVP_OPPONENTS = [
  { name: 'ShadowBerry_99', rating: 1940, avatar: '🥷', winRate: 64, title: 'Maestro de la Piedra' },
  { name: 'CyberValkyrie', rating: 2150, avatar: '⚡', winRate: 72, title: 'Especialista en Tijeras' },
  { name: 'GoldenGamer_X', rating: 2280, avatar: '💎', winRate: 78, title: 'Gran Campeón PvP' },
  { name: 'NeonStriker', rating: 1820, avatar: '🐺', winRate: 58, title: 'Veterano de la Arena' },
  { name: 'RubyQueen', rating: 2010, avatar: '👑', winRate: 69, title: 'Estratega Astral' },
];

export const RPSGameTable: React.FC<RPSGameTableProps> = ({
  balance,
  setBalance,
  initialBet = 750,
  initialOpponent,
  onMatchComplete,
  onBackToGrid,
  onOpenRules,
}) => {
  // Manual bet state (minimum 25 pesos)
  const [betInput, setBetInput] = useState<string>(
    initialBet >= MIN_PVP_BET ? initialBet.toString() : '50'
  );
  const [matchState, setMatchState] = useState<
    'lobby' | 'countdown' | 'clash' | 'round_result' | 'match_over'
  >('lobby');

  // Opponent details
  const [opponent, setOpponent] = useState(() => {
    if (initialOpponent) {
      return (
        PVP_OPPONENTS.find((o) => o.name === initialOpponent) || {
          name: initialOpponent,
          rating: 1900,
          avatar: '🎮',
          winRate: 62,
          title: 'Retador de Arena',
        }
      );
    }
    return PVP_OPPONENTS[0];
  });

  // Best of 3 Match State
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundHistory, setRoundHistory] = useState<RoundRecord[]>([]);

  // Moves for the active round
  const [selectedMove, setSelectedMove] = useState<RPSMove>('piedra');
  const [lockedMove, setLockedMove] = useState<RPSMove | null>(null);
  const [opponentMove, setOpponentMove] = useState<RPSMove | null>(null);
  const [opponentThinking, setOpponentThinking] = useState<boolean>(false);
  const [countdownText, setCountdownText] = useState<string>('');
  const [roundOutcomeText, setRoundOutcomeText] = useState<string>('');
  const [activeEmote, setActiveEmote] = useState<{ sender: 'player' | 'opponent'; emoji: string } | null>(null);

  const parsedBet = Number(betInput) || 0;
  const isBetValid = parsedBet >= MIN_PVP_BET && parsedBet <= balance;

  // Emote reaction handler
  const sendEmote = (emoji: string) => {
    sound.playEmote();
    setActiveEmote({ sender: 'player', emoji });
    setTimeout(() => {
      setActiveEmote(null);
    }, 2000);

    // Opponent sometimes responds with an emote
    if (Math.random() > 0.4) {
      setTimeout(() => {
        const opponentEmojis = ['🔥', '👏', '😱', '👑', '😈'];
        const randomEmoji = opponentEmojis[Math.floor(Math.random() * opponentEmojis.length)];
        sound.playEmote();
        setActiveEmote({ sender: 'opponent', emoji: randomEmoji });
        setTimeout(() => setActiveEmote(null), 2000);
      }, 1000);
    }
  };

  const handleStartMatch = () => {
    if (!isBetValid) return;

    sound.playBet();
    setBalance((prev) => prev - parsedBet);
    setPlayerScore(0);
    setOpponentScore(0);
    setCurrentRound(1);
    setRoundHistory([]);
    setLockedMove(null);
    setOpponentMove(null);
    setMatchState('lobby');
    startRoundSequence();
  };

  const startRoundSequence = () => {
    setLockedMove(null);
    setOpponentMove(null);
    setRoundOutcomeText('');
    setOpponentThinking(true);
    setMatchState('lobby');

    // Simulate opponent locking card after 1.5s
    setTimeout(() => {
      setOpponentThinking(false);
    }, 1200);
  };

  const handleLockInMove = () => {
    if (matchState !== 'lobby') return;
    sound.playChip();
    setLockedMove(selectedMove);
    setMatchState('countdown');

    // AI/Simulated Opponent choice
    const moves: RPSMove[] = ['piedra', 'papel', 'tijera'];
    const chosenOpponentMove = moves[Math.floor(Math.random() * moves.length)];

    // 3-2-1 Clash sequence
    setCountdownText('¡3...!');
    sound.playCountdown(0);

    setTimeout(() => {
      setCountdownText('¡2...!');
      sound.playCountdown(1);
    }, 600);

    setTimeout(() => {
      setCountdownText('¡1...!');
      sound.playCountdown(2);
    }, 1200);

    setTimeout(() => {
      setCountdownText('¡CHOQUE!');
      sound.playCountdown(3);
      sound.playClash();
      setOpponentMove(chosenOpponentMove);
      setMatchState('clash');

      // Evaluate this single round
      let roundWinner: 'player' | 'opponent' | 'tie' = 'tie';
      if (selectedMove === chosenOpponentMove) {
        roundWinner = 'tie';
        setRoundOutcomeText('¡EMPATE EN ESTA RONDA! (Se repite)');
        sound.playTie();
      } else if (
        (selectedMove === 'piedra' && chosenOpponentMove === 'tijera') ||
        (selectedMove === 'papel' && chosenOpponentMove === 'piedra') ||
        (selectedMove === 'tijera' && chosenOpponentMove === 'papel')
      ) {
        roundWinner = 'player';
        setPlayerScore((prev) => prev + 1);
        setRoundOutcomeText('¡PUNTO PARA TI! 🟢');
        sound.playPointScored();
      } else {
        roundWinner = 'opponent';
        setOpponentScore((prev) => prev + 1);
        setRoundOutcomeText(`¡PUNTO PARA ${opponent.name}! 🔴`);
        sound.playLoss();
      }

      const newRecord: RoundRecord = {
        round: currentRound,
        playerMove: selectedMove,
        opponentMove: chosenOpponentMove,
        winner: roundWinner,
      };

      setRoundHistory((prev) => [...prev, newRecord]);

      // Check if match is won (Best of 3 -> first to 2)
      setTimeout(() => {
        setPlayerScore((pScore) => {
          setOpponentScore((oScore) => {
            if (pScore >= 2) {
              // Match Victory!
              sound.playJackpot();
              confetti({
                particleCount: 120,
                spread: 80,
                origin: { y: 0.5 },
                colors: ['#38bdf8', '#3b82f6', '#fbbf24', '#f43f5e'],
              });
              const totalPot = parsedBet * 2;
              setBalance((prev) => prev + totalPot);

              const betRecord: BetRecord = {
                id: `match_${Date.now()}`,
                timestamp: Date.now(),
                gameTitle: 'Piedra, Papel o Tijera PvP (Mejor de 3)',
                opponentName: opponent.name,
                result: 'win',
                betAmount: parsedBet,
                payout: totalPot,
                netProfit: totalPot - parsedBet,
                finalScore: `${pScore} - ${oScore}`,
              };
              onMatchComplete(betRecord);
              setMatchState('match_over');
            } else if (oScore >= 2) {
              // Match Defeat
              sound.playLoss();
              const betRecord: BetRecord = {
                id: `match_${Date.now()}`,
                timestamp: Date.now(),
                gameTitle: 'Piedra, Papel o Tijera PvP (Mejor de 3)',
                opponentName: opponent.name,
                result: 'loss',
                betAmount: parsedBet,
                payout: 0,
                netProfit: -parsedBet,
                finalScore: `${pScore} - ${oScore}`,
              };
              onMatchComplete(betRecord);
              setMatchState('match_over');
            } else {
              // Proceed to next round
              if (roundWinner !== 'tie') {
                setCurrentRound((r) => r + 1);
              }
              setMatchState('round_result');
            }
            return oScore;
          });
          return pScore;
        });
      }, 1600);
    }, 1800);
  };

  const handleNextRound = () => {
    sound.playChip();
    startRoundSequence();
  };

  const handleRematch = () => {
    sound.playChip();
    setLockedMove(null);
    setOpponentMove(null);
    setPlayerScore(0);
    setOpponentScore(0);
    setCurrentRound(1);
    setRoundHistory([]);
    setMatchState('lobby');
  };

  return (
    <div className="w-full space-y-6 select-none">
      {/* Top Navigation Bar with Back Button */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => {
            sound.playChip();
            onBackToGrid();
          }}
          className="px-4 py-2 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 text-cyan-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Catálogo de Juegos</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenRules}
            className="text-xs text-slate-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Reglas PvP Mejor de 3</span>
          </button>
        </div>
      </div>

      {/* MAIN BATTLE ARENA */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-blue-500/50 bg-gradient-to-b from-[#0a1538] via-[#08102a] to-[#040817] shadow-2xl shadow-blue-950/90 p-5 sm:p-8">
        {/* Glow ambient spots */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />

        {/* HEADER: BEST OF 3 SCOREBOARD & POT */}
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-blue-900/50">
          {/* Player Side Card */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 border-2 border-white flex items-center justify-center text-2xl shadow-lg shadow-cyan-600/40">
              😎
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white font-display">TÚ (JUGADOR)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  RANGO VIP
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs text-slate-400">Puntos:</span>
                <div className="flex items-center gap-1">
                  <span
                    className={`w-3.5 h-3.5 rounded-full border-2 border-cyan-400 transition-colors ${
                      playerScore >= 1 ? 'bg-cyan-400 shadow-md shadow-cyan-400' : 'bg-transparent'
                    }`}
                  />
                  <span
                    className={`w-3.5 h-3.5 rounded-full border-2 border-cyan-400 transition-colors ${
                      playerScore >= 2 ? 'bg-cyan-400 shadow-md shadow-cyan-400' : 'bg-transparent'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Center Match Info: Pot & Best of 3 Badge */}
          <div className="flex flex-col items-center text-center">
            <div className="px-3.5 py-1 rounded-full bg-blue-900/60 border border-blue-400/40 text-[11px] font-extrabold uppercase tracking-widest text-cyan-300 mb-1 flex items-center gap-1.5 shadow-md">
              <Swords className="w-3.5 h-3.5 text-rose-400" />
              <span>DUELO AL MEJOR DE 3 · RONDA {currentRound}</span>
            </div>
            <div className="text-xs text-slate-400 font-semibold uppercase">
              POZO TOTAL EN JUEGO
            </div>
            <div className="text-3xl sm:text-4xl font-black text-amber-300 font-mono tabular-nums tracking-tight animate-pulse">
              {(parsedBet * 2).toLocaleString('es-ES')}{' '}
              <span className="text-xs text-amber-400 uppercase font-sans">BC</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {parsedBet.toLocaleString('es-ES')} BC tuyos vs {parsedBet.toLocaleString('es-ES')} BC rival
            </span>
          </div>

          {/* Opponent Side Card */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  ★{opponent.rating}
                </span>
                <span className="text-sm font-black text-white font-display">{opponent.name}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-1">
                <div className="flex items-center gap-1">
                  <span
                    className={`w-3.5 h-3.5 rounded-full border-2 border-rose-400 transition-colors ${
                      opponentScore >= 1 ? 'bg-rose-500 shadow-md shadow-rose-500' : 'bg-transparent'
                    }`}
                  />
                  <span
                    className={`w-3.5 h-3.5 rounded-full border-2 border-rose-400 transition-colors ${
                      opponentScore >= 2 ? 'bg-rose-500 shadow-md shadow-rose-500' : 'bg-transparent'
                    }`}
                  />
                </div>
                <span className="text-xs text-slate-400">:Puntos</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 border-2 border-white flex items-center justify-center text-2xl shadow-lg shadow-rose-600/40">
              {opponent.avatar}
            </div>
          </div>
        </div>

        {/* Emote Reaction Bubble Overlay */}
        {activeEmote && (
          <div
            className={`absolute top-28 z-30 px-4 py-2 rounded-2xl bg-blue-950/90 border-2 border-cyan-400 text-3xl shadow-2xl animate-bounce ${
              activeEmote.sender === 'player' ? 'left-8' : 'right-8'
            }`}
          >
            {activeEmote.emoji}
          </div>
        )}

        {/* THE SHOWDOWN ARENA */}
        <div className="relative py-8 my-4 flex items-center justify-around">
          {/* Player Hand Presentation */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2">
              Tu Selección
            </span>
            <div
              className={`relative w-32 h-44 sm:w-40 sm:h-56 rounded-2xl border-4 flex flex-col items-center justify-center transition-all duration-300 shadow-2xl ${
                MOVES_CONFIG[selectedMove].borderColor
              } ${MOVES_CONFIG[selectedMove].glowColor} bg-gradient-to-b from-[#12245c] to-[#071030]`}
            >
              <span className="text-5xl sm:text-6xl mb-2 drop-shadow-lg">
                {MOVES_CONFIG[selectedMove].icon}
              </span>
              <span className="text-sm sm:text-base font-black text-white font-display text-center px-2">
                {MOVES_CONFIG[selectedMove].name}
              </span>
              <span className="text-[10px] text-amber-300 font-bold mt-1">
                {MOVES_CONFIG[selectedMove].beatsText}
              </span>
            </div>
          </div>

          {/* VS Center Indicator / Countdown */}
          <div className="flex flex-col items-center justify-center">
            {matchState === 'countdown' ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center font-black font-display text-white text-2xl sm:text-3xl shadow-2xl shadow-rose-600/50 animate-ping">
                {countdownText}
              </div>
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center font-black font-display text-white text-lg sm:text-xl shadow-xl shadow-blue-600/60">
                VS
              </div>
            )}

            {roundOutcomeText && (
              <div className="mt-3 px-4 py-1.5 rounded-full bg-blue-950 border border-cyan-400 text-xs sm:text-sm font-extrabold text-white text-center shadow-lg">
                {roundOutcomeText}
              </div>
            )}
          </div>

          {/* Opponent Hand Presentation */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-2">
              Mano de {opponent.name}
            </span>
            <div className="relative w-32 h-44 sm:w-40 sm:h-56 rounded-2xl border-4 border-rose-500/50 bg-gradient-to-b from-[#2b0e2b] to-[#120617] flex flex-col items-center justify-center shadow-2xl">
              {matchState === 'clash' && opponentMove ? (
                <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-300">
                  <span className="text-5xl sm:text-6xl mb-2 drop-shadow-lg">
                    {MOVES_CONFIG[opponentMove].icon}
                  </span>
                  <span className="text-sm sm:text-base font-black text-white font-display text-center px-2">
                    {MOVES_CONFIG[opponentMove].name}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {MOVES_CONFIG[opponentMove].subtitle}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-rose-500/40 bg-rose-950/40 flex items-center justify-center mb-2 animate-pulse">
                    <span className="text-xl">⚔️</span>
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                    {opponentThinking ? 'Eligiendo...' : 'Oculta'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MATCH OVER BANNER (First to 2 Points) */}
        {matchState === 'match_over' ? (
          <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-blue-950 via-[#0e1d4d] to-blue-950 border-2 border-cyan-400 text-center space-y-4 animate-in zoom-in-95">
            {playerScore >= 2 ? (
              <>
                <div className="inline-flex p-3 rounded-full bg-amber-400/20 text-amber-300 border-2 border-amber-400">
                  <Trophy className="w-10 h-10 animate-bounce" />
                </div>
                <h3 className="text-3xl sm:text-4xl font-black text-white font-display">
                  ¡VICTORIA DEL DUELO AL MEJOR DE 3!
                </h3>
                <p className="text-base text-amber-300 font-bold">
                  Has derrotado a {opponent.name} con un marcador de {playerScore} - {opponentScore}.
                </p>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  +{(parsedBet * 2).toLocaleString('es-ES')} BerryCoins ganadas
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex p-3 rounded-full bg-rose-500/20 text-rose-300 border-2 border-rose-400">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <h3 className="text-3xl sm:text-4xl font-black text-white font-display">
                  DERROTA EN EL DUELO
                </h3>
                <p className="text-base text-slate-300 font-bold">
                  {opponent.name} se ha llevado la victoria por {opponentScore} - {playerScore}.
                </p>
                <div className="text-xl font-bold text-rose-400 font-mono">
                  -{parsedBet.toLocaleString('es-ES')} BerryCoins
                </div>
              </>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={handleRematch}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-sm uppercase tracking-wider cursor-pointer shadow-xl shadow-cyan-950/60"
              >
                Revancha con Nueva Apuesta
              </button>
              <button
                onClick={onBackToGrid}
                className="px-6 py-3.5 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-500/40 text-white font-bold text-sm uppercase tracking-wider cursor-pointer"
              >
                Volver al Lobby de Juegos
              </button>
            </div>
          </div>
        ) : matchState === 'round_result' ? (
          /* Next Round Transition Button */
          <div className="mt-6 flex flex-col items-center">
            <button
              onClick={handleNextRound}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-yellow-300 hover:to-amber-300 text-slate-950 font-black text-base uppercase tracking-wider font-display shadow-xl shadow-amber-950/50 cursor-pointer flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              <span>SIGUIENTE RONDA ({playerScore} - {opponentScore})</span>
            </button>
          </div>
        ) : (
          /* INTERACTIVE CHOICE CARDS & BETTING CONTROLS */
          <div className="space-y-6 mt-4">
            {/* 3D CHOICE CARDS */}
            <div>
              <div className="text-xs uppercase tracking-wider text-cyan-300 font-black mb-3 text-center flex items-center justify-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>SELECCIONA TU CARTA ELEMENTAL PARA ESTA RONDA</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(Object.keys(MOVES_CONFIG) as RPSMove[]).map((moveKey) => {
                  const item = MOVES_CONFIG[moveKey];
                  const isSelected = selectedMove === moveKey;
                  return (
                    <button
                      key={moveKey}
                      type="button"
                      disabled={matchState !== 'lobby'}
                      onClick={() => {
                        sound.playChip();
                        setSelectedMove(moveKey);
                      }}
                      className={`relative p-5 rounded-2xl border-2 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-between group ${
                        isSelected
                          ? `bg-gradient-to-b from-[#183177] to-[#0c1a40] border-cyan-400 shadow-xl shadow-cyan-600/40 scale-105 ${item.glowColor}`
                          : 'bg-[#09153a]/80 border-blue-900/60 hover:border-blue-400 hover:bg-[#112359]'
                      } ${matchState !== 'lobby' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSelected && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black uppercase tracking-widest shadow-md">
                          ACTIVA
                        </span>
                      )}
                      <span className="text-5xl my-2 transform group-hover:scale-110 transition-transform">
                        {item.icon}
                      </span>
                      <span className="text-base font-black text-white font-display block mt-1">
                        {item.name}
                      </span>
                      <span className="text-xs text-amber-300 font-bold block mt-1">
                        {item.beatsText}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {item.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MANUAL BET AMOUNT SELECTOR (MINIMUM 25 PESOS) */}
            <div className="p-5 rounded-2xl bg-[#091538] border-2 border-blue-600/40 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <label className="text-xs uppercase tracking-wider text-cyan-300 font-extrabold block mb-1">
                    Monto de Apuesta Manual (Mínimo 25 pesos)
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="number"
                        min="25"
                        step="5"
                        value={betInput}
                        onChange={(e) => setBetInput(e.target.value)}
                        placeholder="Mínimo $25"
                        className={`w-44 sm:w-56 px-4 py-2.5 rounded-xl bg-blue-950 border-2 font-mono font-black text-lg sm:text-xl text-amber-300 focus:outline-none transition-colors ${
                          !isBetValid
                            ? 'border-rose-500 focus:border-rose-400'
                            : 'border-blue-500 focus:border-cyan-400'
                        }`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        PESOS
                      </span>
                    </div>

                    <div className="text-left">
                      <span className="text-[11px] text-slate-400 font-medium block">
                        Pozo Total PvP:
                      </span>
                      <span className="text-base sm:text-lg font-black text-cyan-300 font-mono tabular-nums">
                        ${(parsedBet * 2).toLocaleString('es-ES')} pesos
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Add Buttons */}
                <div className="flex items-center flex-wrap gap-1.5 self-stretch sm:self-auto">
                  {[25, 50, 100, 250, 500].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => {
                        sound.playChip();
                        setBetInput((prev) => (Math.max(25, (Number(prev) || 0) + inc)).toString());
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 border border-blue-500/40 text-xs font-extrabold text-cyan-200 cursor-pointer transition-all"
                    >
                      +${inc}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      sound.playBet();
                      setBetInput(balance.toString());
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs font-black text-amber-300 cursor-pointer transition-all"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Strict validation message */}
              {parsedBet < MIN_PVP_BET && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    La apuesta mínima permitida en todos los juegos es de <strong>25 pesos</strong>.
                  </span>
                </div>
              )}

              {parsedBet > balance && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Saldo insuficiente. Tienes ${balance.toLocaleString('es-ES')} pesos pero necesitas ${parsedBet.toLocaleString('es-ES')}.</span>
                </div>
              )}
            </div>

            {/* ACTION BUTTON (Lock in and Duel) */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                type="button"
                disabled={!isBetValid || matchState !== 'lobby'}
                onClick={handleLockInMove}
                className="flex-1 w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-base sm:text-xl font-display uppercase tracking-wider shadow-2xl shadow-cyan-900/60 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Swords className="w-6 h-6" />
                <span>BLOQUEAR CARTA Y LANZAR RONDA {currentRound}</span>
              </button>

              {/* Live Emote Bar */}
              <div className="flex items-center gap-1.5 p-2 rounded-2xl bg-blue-950/60 border border-blue-500/30">
                {['🔥', '👏', '😱', '👑', '😈'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => sendEmote(em)}
                    className="w-10 h-10 rounded-xl hover:bg-blue-800/60 text-xl flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
                    title={`Enviar reacción ${em}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Opponent Selector & Arena Lobby */}
      <div className="p-5 rounded-2xl bg-[#091538] border border-blue-600/30">
        <h4 className="text-sm font-black text-white font-display uppercase tracking-wide mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <span>Cambiar de Rival en la Arena PvP</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {PVP_OPPONENTS.map((opp) => (
            <button
              key={opp.name}
              type="button"
              disabled={matchState !== 'lobby'}
              onClick={() => {
                sound.playChip();
                setOpponent(opp);
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                opponent.name === opp.name
                  ? 'bg-blue-600/30 border-cyan-400 shadow-md shadow-blue-600/30'
                  : 'bg-blue-950/40 border-blue-900/40 hover:border-blue-500 hover:bg-blue-900/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">{opp.avatar}</span>
                <span className="text-[10px] text-cyan-300 font-mono font-bold">
                  ★{opp.rating}
                </span>
              </div>
              <div className="text-xs font-bold text-white truncate">{opp.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{opp.title}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

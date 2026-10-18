import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sound } from '../utils/soundEffects';
import { MIN_PVP_BET } from '../types/casino';
import { X, Swords, AlertTriangle, Users, Clock, ShieldCheck, Radio, Coins, Sparkles, UserPlus } from 'lucide-react';
import { findOpenWaitingRoom, createGameRoom, joinGameRoom, calculatePayout } from '../services/matchService';

interface WagerMatchmakingModalProps {
  isOpen: boolean;
  gameId: 'stacker' | 'rps' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad' | 'knifeclash';
  gameTitle: string;
  userBalance: number;
  onClose: () => void;
  onAddFaucet: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onStartGame: (params: {
    roomId: string;
    wager: number;
    mode: 'live' | 'async';
    opponentNick?: string;
    opponentAvatar?: string;
    opponentRating?: number;
  }) => void;
}

export const WagerMatchmakingModal: React.FC<WagerMatchmakingModalProps> = ({
  isOpen,
  gameId,
  gameTitle,
  userBalance,
  onClose,
  onAddFaucet,
  onOpenAuth,
  onStartGame,
}) => {
  const { user, profile, updateBalance } = useAuth();
  const [step, setStep] = useState<'wager' | 'matchmaking'>('wager');
  const [wagerInput, setWagerInput] = useState<string>('50');
  const [countdown, setCountdown] = useState<number>(5);
  const [searchingStatus, setSearchingStatus] = useState<string>('Buscando sala abierta en Firestore...');
  const [matchedRoom, setMatchedRoom] = useState<{
    id: string;
    opponentNick: string;
    opponentAvatar: string;
    opponentRating: number;
  } | null>(null);

  const parsedWager = Number(wagerInput) || 0;
  const isWagerValid = parsedWager >= MIN_PVP_BET && parsedWager <= userBalance;

  const playerNick = profile ? profile.username : 'Jugador';
  const playerAvatar = profile ? profile.avatar : '😎';

  useEffect(() => {
    if (isOpen) {
      setStep('wager');
      setCountdown(12);
      setMatchedRoom(null);
      setSearchingStatus('Iniciando radar de emparejamiento en Firestore...');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Real 12-second Matchmaking Search in Firestore
  const handleConfirmBetAndSearch = async () => {
    if (!isWagerValid) return;
    if (!user || !profile) {
      onOpenAuth('login');
      return;
    }

    sound.playBet();

    // 1. Deduct wager immediately from Firestore users collection
    const newBalance = profile.balance - parsedWager;
    await updateBalance(newBalance);

    setStep('matchmaking');
    setCountdown(12);
    setSearchingStatus('Buscando rival en línea...');

    // 2. Search for existing waiting room in Firestore
    try {
      const existingRoom = await findOpenWaitingRoom(gameId, parsedWager, user.uid);

      if (existingRoom) {
        // RIVAL FOUND IN FIRESTORE!
        setSearchingStatus(`¡Rival encontrado en Firestore: @${existingRoom.hostNick}!`);
        await joinGameRoom(existingRoom.id, {
          uid: user.uid,
          username: profile.username,
          avatar: profile.avatar,
          rating: profile.rating,
        });

        setMatchedRoom({
          id: existingRoom.id,
          opponentNick: existingRoom.hostNick,
          opponentAvatar: existingRoom.hostAvatar,
          opponentRating: existingRoom.hostRating || 1500,
        });

        sound.playPointScored();

        setTimeout(() => {
          onStartGame({
            roomId: existingRoom.id,
            wager: parsedWager,
            mode: 'live',
            opponentNick: existingRoom.hostNick,
            opponentAvatar: existingRoom.hostAvatar,
            opponentRating: existingRoom.hostRating || 1500,
          });
          onClose();
        }, 1500);
        return;
      }
    } catch (err) {
      console.error('Error querying Firestore for open rooms:', err);
    }

    // 3. If no rival immediately, run the 12-second countdown ticker with radar
    let timeLeft = 12;
    const interval = setInterval(async () => {
      timeLeft -= 1;
      setCountdown(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(interval);
        setSearchingStatus('Sin rival en línea tras 12s. Iniciando Modo Asincrónico...');

        // Create new room in Firestore with status 'waiting'
        try {
          const newRoomId = await createGameRoom({
            gameId,
            gameTitle,
            wager: parsedWager,
            userId: user.uid,
            username: profile.username,
            avatar: profile.avatar,
            rating: profile.rating,
          });

          setTimeout(() => {
            onStartGame({
              roomId: newRoomId,
              wager: parsedWager,
              mode: 'async',
            });
            onClose();
          }, 1200);
        } catch (err) {
          console.error('Error creating Firestore room:', err);
        }
      }
    }, 1000);
  };

  const totalPot = parsedWager * 2;
  const netPayout = calculatePayout(parsedWager);
  const searchProgressPercent = Math.min(100, Math.round(((12 - countdown) / 12) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-lg bg-[#091538] border-2 border-blue-500/50 rounded-3xl p-6 sm:p-8 text-left shadow-2xl shadow-blue-950">
        {/* Close button */}
        <button
          onClick={() => {
            sound.playChip();
            onClose();
          }}
          className="absolute top-5 right-5 p-2 rounded-full bg-blue-950 text-slate-400 hover:text-white hover:bg-blue-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'wager' ? (
          /* STEP 1: WAGER INPUT & BALANCE VALIDATION */
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                <Swords className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 block">
                  APUESTA PREVIA AL DUELO P2P REAL
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white font-display">
                  {gameTitle}
                </h3>
              </div>
            </div>

            {/* User Login Warning if Guest */}
            {!user && (
              <div className="p-4 rounded-2xl bg-blue-950 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>Inicia sesión o regístrate en Firebase para apostar con saldo real en la plataforma.</span>
                </div>
                <button
                  onClick={() => onOpenAuth('login')}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-black shrink-0 uppercase tracking-wider"
                >
                  Entrar
                </button>
              </div>
            )}

            <div className="p-5 rounded-2xl bg-blue-950/80 border-2 border-blue-600/40 space-y-4">
              <div>
                <label className="text-xs uppercase font-extrabold text-cyan-300 block mb-1.5">
                  Digita el Monto de tu Apuesta (Mínimo $25 pesos)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={MIN_PVP_BET}
                    step="5"
                    value={wagerInput}
                    onChange={(e) => setWagerInput(e.target.value)}
                    placeholder="Mínimo 25 pesos"
                    className={`w-full px-4 py-3 rounded-xl bg-blue-900/60 border-2 font-mono font-black text-2xl text-amber-300 focus:outline-none transition-colors ${
                      !isWagerValid ? 'border-rose-500' : 'border-blue-500 focus:border-cyan-400'
                    }`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                    Pesos
                  </span>
                </div>
              </div>

              {/* Quick increment chips */}
              <div className="flex items-center flex-wrap gap-2 pt-1">
                {[25, 50, 100, 250, 500].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => {
                      sound.playChip();
                      setWagerInput(amount.toString());
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 border border-blue-500/40 text-xs font-bold text-cyan-300 transition-all cursor-pointer"
                  >
                    ${amount}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    sound.playBet();
                    setWagerInput(userBalance.toString());
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs font-black text-amber-300 transition-all cursor-pointer"
                >
                  ALL-IN
                </button>
              </div>

              {/* Pot and Commission breakdown */}
              <div className="p-3.5 rounded-xl bg-[#060e26] border border-blue-900/60 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Pozo Total en Juego (2×):</span>
                  <span className="text-base font-black text-amber-300 font-mono tabular-nums">
                    ${totalPot.toLocaleString('es-ES')} pesos
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-1">
                  <span>Comisión de Plataforma BERRYS (6%):</span>
                  <span className="text-slate-300 font-mono">-${Math.round(totalPot * 0.06)} pesos</span>
                </div>
                <div className="flex items-center justify-between font-bold text-cyan-300 pt-0.5">
                  <span>Premio Neto Ganador:</span>
                  <span className="text-sm font-black font-mono">${netPayout.toLocaleString('es-ES')} pesos</span>
                </div>
              </div>

              {/* Low Balance Validation Block */}
              {userBalance < MIN_PVP_BET && (
                <div className="p-3 rounded-xl bg-rose-950/70 border-2 border-rose-500/50 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-rose-300 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>Tu saldo es menor a $25 pesos (${userBalance} pesos). Recarga para poder jugar.</span>
                  </div>
                  <button
                    type="button"
                    onClick={onAddFaucet}
                    className="w-full py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Coins className="w-4 h-4" />
                    <span>Recargar +$1,000 Pesos de Saldo Gratis</span>
                  </button>
                </div>
              )}

              {userBalance >= MIN_PVP_BET && parsedWager > userBalance && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    Saldo insuficiente para esta apuesta. Dispones de ${userBalance.toLocaleString('es-ES')} pesos.
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!isWagerValid || !user}
              onClick={handleConfirmBetAndSearch}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-base font-display uppercase tracking-wider shadow-2xl shadow-cyan-950/60 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              CONFIRMAR APUESTA (${parsedWager} PESOS) Y BUSCAR RIVAL (12S)
            </button>
          </div>
        ) : (
          /* STEP 2: REAL 12-SECOND RADAR MATCHMAKING SCREEN */
          <div className="space-y-6 text-center">
            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>RADAR MATCHMAKING 12S · POZO ${totalPot.toLocaleString('es-ES')}</span>
              </span>
              <h3 className="text-2xl font-black text-white font-display">
                {matchedRoom ? '¡Rival Real Emparejado!' : searchingStatus}
              </h3>
            </div>

            {/* Radar Animation Area */}
            {!matchedRoom && (
              <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                {/* Concentric rings */}
                <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping [animation-duration:3s]" />
                <div className="absolute inset-2 rounded-full border border-blue-500/40" />
                <div className="absolute inset-6 rounded-full border border-cyan-400/50" />
                <div className="absolute inset-10 rounded-full border border-blue-400/60" />
                {/* Sweeping sonar beam */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/20 via-transparent to-transparent animate-spin [animation-duration:2s]" />
                {/* Center countdown */}
                <div className="relative z-10 w-14 h-14 rounded-full bg-[#060e28] border-2 border-cyan-400 flex flex-col items-center justify-center shadow-lg shadow-cyan-950">
                  <span className="text-lg font-black font-mono text-amber-300 tabular-nums">
                    {countdown}s
                  </span>
                </div>
              </div>
            )}

            {/* Animated progress bar: "Buscando rival en línea..." */}
            {!matchedRoom && (
              <div className="space-y-1.5 max-w-sm mx-auto">
                <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Buscando rival en línea...
                  </span>
                  <span className="font-mono text-amber-300">{countdown}s restantes</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-blue-950 border border-blue-600/40 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-amber-400 transition-all duration-1000 ease-linear shadow-sm shadow-cyan-400"
                    style={{ width: `${searchProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Duelists Cards: Real Player vs Real Opponent or Async Mode */}
            <div className="grid grid-cols-2 gap-4 py-2">
              {/* Player Side */}
              <div className="p-4 rounded-2xl bg-blue-950/80 border-2 border-cyan-400 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 border-2 border-white flex items-center justify-center text-3xl shadow-lg mb-2">
                  {playerAvatar}
                </div>
                <span className="text-xs font-black text-white font-display truncate max-w-[120px]">
                  {playerNick}
                </span>
                <span className="text-[10px] text-cyan-300 font-bold uppercase mt-0.5">
                  Tú (Listo)
                </span>
              </div>

              {/* Opponent Side */}
              <div className="p-4 rounded-2xl bg-blue-950/80 border-2 border-rose-500/60 flex flex-col items-center">
                {matchedRoom ? (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 border-2 border-white flex items-center justify-center text-3xl shadow-lg mb-2 animate-in zoom-in-75">
                      {matchedRoom.opponentAvatar}
                    </div>
                    <span className="text-xs font-black text-white font-display truncate max-w-[120px]">
                      {matchedRoom.opponentNick}
                    </span>
                    <span className="text-[10px] text-amber-300 font-bold uppercase mt-0.5">
                      ★{matchedRoom.opponentRating} ELO
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-black/40 border-2 border-dashed border-cyan-500/40 flex items-center justify-center text-2xl font-black text-amber-300 mb-2">
                      <Clock className="w-8 h-8 text-cyan-400 animate-spin [animation-duration:4s]" />
                    </div>
                    <span className="text-xs font-black text-slate-300 uppercase font-mono">
                      {countdown > 0 ? 'Radar Activo' : 'Modo Asincrónico'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {countdown > 0 ? 'Consultando Firestore' : 'Reloj de 24 horas'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Asynchronous Explanation Notice */}
            {!matchedRoom && (
              <div className="p-4 rounded-2xl bg-[#060e26] border border-blue-900/60 text-xs text-slate-300 text-left flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Si no hay otro usuario en línea en 12 segundos, jugarás tu partida de inmediato y tu puntuación se publicará con un <strong>reloj de 24 horas</strong>. Si ningún rival acepta el versus en 24h, ¡tus ${parsedWager} pesos se devuelven al 100%!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

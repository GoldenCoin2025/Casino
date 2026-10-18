import React, { useState, useEffect } from 'react';
import { RoomDocument } from '../types/casino';
import { sound } from '../utils/soundEffects';
import { X, Clock, Trophy, RotateCcw, AlertCircle, CheckCircle2, ShieldCheck, Flame, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';
import { refundExpiredRoom, claimHostWinnerPayout } from '../services/matchService';
import { useAuth } from '../context/AuthContext';

interface PendingMatchesModalProps {
  isOpen: boolean;
  rooms: RoomDocument[];
  onClose: () => void;
  onRefresh?: () => void;
}

export const PendingMatchesModal: React.FC<PendingMatchesModalProps> = ({
  isOpen,
  rooms,
  onClose,
  onRefresh,
}) => {
  const { user, profile, updateBalance } = useAuth();
  const [, setTick] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Live countdown clock ticker every second
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const formatRemainingTime = (expiresAt: number) => {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return '00h 00m 00s (24h Expiradas - Reembolso habilitado)';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  // Reclamar reembolso de $25+ pesos en Firestore si pasaron 24h
  const handleClaimRefund = async (room: RoomDocument) => {
    if (!user || !profile || processingId) return;
    setProcessingId(room.id);
    try {
      const refundedAmount = await refundExpiredRoom(room.id);
      sound.playJackpot();
      await updateBalance(profile.balance + refundedAmount);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error claiming refund:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // Cobrar premio de victoria si un rival aceptó y perdió
  const handleClaimWinnerPot = async (room: RoomDocument) => {
    if (!user || !profile || processingId) return;
    setProcessingId(room.id);
    try {
      const payoutAmount = await claimHostWinnerPayout(room.id);
      sound.playJackpot();
      await updateBalance(profile.balance + payoutAmount);
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.5 } });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error claiming winner payout:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-[#091538] border-2 border-blue-500/50 rounded-3xl p-6 sm:p-8 text-left shadow-2xl shadow-blue-950 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => {
            sound.playChip();
            onClose();
          }}
          className="absolute top-5 right-5 p-2 rounded-full bg-blue-950 text-slate-400 hover:text-white hover:bg-blue-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white font-display">
              PARTIDAS PENDIENTES (24 HORAS)
            </h2>
            <p className="text-xs text-cyan-300 font-medium">
              Gestión P2P 100% real de tus desafíos asincrónicos publicados en Firestore
            </p>
          </div>
        </div>

        {/* Rule Reminder */}
        <div className="my-4 p-3.5 rounded-xl bg-blue-950/80 border border-blue-500/30 text-xs text-slate-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Cada partida tiene un reloj de <strong>24 horas exactas</strong>. Si otro usuario real acepta tu reto, se comparan las puntuaciones y el premio se acredita al ganador (menos el 6% de comisión). Si transcurren 24h sin rival, ¡puedes reclamar el reembolso de tu apuesta intacta!
          </p>
        </div>

        {/* Matches List */}
        {rooms.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center border-2 border-dashed border-blue-800 rounded-2xl bg-blue-950/20">
            <Clock className="w-10 h-10 text-cyan-400 mb-2 opacity-50" />
            <h3 className="text-base font-bold text-white mb-1">
              No tienes partidas pendientes en este momento
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              Juega una partida de Apilar Bloques o Piedra Papel Tijera en modo asincrónico para que quede publicada en la plataforma con reloj de 24 horas.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {rooms.map((room) => {
              const isExpired = Date.now() >= room.expiresAt;
              const remaining = formatRemainingTime(room.expiresAt);
              const isHostWinner = room.winnerId === room.hostId;
              const isOpponentWinner = room.winnerId === room.opponentId;
              const isTie = room.winnerId === 'tie';

              return (
                <div
                  key={room.id}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    room.status === 'completed'
                      ? isHostWinner
                        ? 'bg-emerald-950/40 border-emerald-500/60'
                        : isTie
                        ? 'bg-cyan-950/40 border-cyan-500/50'
                        : 'bg-rose-950/30 border-rose-500/40'
                      : room.status === 'expired' || room.isRefunded
                      ? 'bg-slate-900/60 border-slate-700 opacity-75'
                      : 'bg-blue-950/60 border-blue-600/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">
                        {room.gameId === 'berriesroad'
                          ? '🐣'
                          : room.gameId === 'mines'
                          ? '💣'
                          : room.gameId === 'colorclash'
                          ? '🃏'
                          : room.gameId === 'blockblast'
                          ? '🧩'
                          : room.gameId === 'stacker'
                          ? '🧱'
                          : '✂️'}
                      </span>
                      <div>
                        <span className="text-sm font-black text-white font-display block">
                          {room.gameTitle}
                        </span>
                        <span className="text-xs text-cyan-300 font-bold">
                          Tu récord: <strong className="text-white">{room.hostScore} puntos</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Pozo Total (2×)
                      </span>
                      <span className="text-base font-black text-amber-300 font-mono">
                        ${room.totalPot.toLocaleString('es-ES')} pesos
                        <span className="text-[10px] text-slate-400 block font-sans">
                          Neto ganador: ${room.payout}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* 24-Hour Countdown Clock & Real Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-300 font-mono font-bold">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {room.status === 'waiting_opponent'
                          ? remaining
                          : room.status === 'completed'
                          ? 'Desafío completado'
                          : 'Sala archivada'}
                      </span>
                    </div>

                    {/* Actions and Status resolution */}
                    <div className="flex items-center gap-2">
                      {/* Active waiting within 24 hours */}
                      {room.status === 'waiting_opponent' && !isExpired && (
                        <span className="text-cyan-300 text-[11px] font-bold flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          <span>Publicada en feed · Esperando rival real</span>
                        </span>
                      )}

                      {/* Expired after 24 hours without rival -> Refund button enabled */}
                      {room.status === 'waiting_opponent' && isExpired && !room.isRefunded && (
                        <button
                          type="button"
                          disabled={processingId === room.id}
                          onClick={() => handleClaimRefund(room)}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] uppercase tracking-wider cursor-pointer shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reclamar / Reembolsar (+${room.wager} Pesos)</span>
                        </button>
                      )}

                      {/* Completed: Host Won */}
                      {room.status === 'completed' && isHostWinner && (
                        room.claimedByWinner ? (
                          <span className="text-emerald-400 font-black flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>¡Ganaste vs @{room.opponentNick}! Premio cobrado (${room.payout} pesos)</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={processingId === room.id}
                            onClick={() => handleClaimWinnerPot(room)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-[11px] uppercase tracking-wider cursor-pointer shadow-md flex items-center gap-1.5 transition-all animate-bounce"
                          >
                            <Trophy className="w-3.5 h-3.5" />
                            <span>¡Ganaste! Cobrar Pozo (+${room.payout} Pesos)</span>
                          </button>
                        )
                      )}

                      {/* Completed: Opponent Won */}
                      {room.status === 'completed' && isOpponentWinner && (
                        <span className="text-rose-400 font-bold text-[11px]">
                          Rival @{room.opponentNick} superó tu récord ({room.opponentScore} vs {room.hostScore})
                        </span>
                      )}

                      {/* Completed: Tie */}
                      {room.status === 'completed' && isTie && (
                        <span className="text-cyan-300 font-bold text-[11px]">
                          Empate con @{room.opponentNick} ({room.hostScore} vs {room.opponentScore})
                        </span>
                      )}

                      {/* Refunded */}
                      {(room.status === 'expired' || room.isRefunded) && (
                        <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Reembolso acreditado (${room.wager} pesos devueltos)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

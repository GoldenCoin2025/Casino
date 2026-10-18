import React from 'react';
import { VIP_TIERS, PlayerStats } from '../types/casino';
import { Crown, Sparkles, TrendingUp, Trophy, Zap, Gift } from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface VipSectionProps {
  stats: PlayerStats;
  balance: number;
  onClaimEmergency: () => void;
  onOpenWheel: () => void;
}

export const VipSection: React.FC<VipSectionProps> = ({
  stats,
  balance,
  onClaimEmergency,
  onOpenWheel,
}) => {
  // Determine current VIP tier
  const currentTier = [...VIP_TIERS]
    .reverse()
    .find((tier) => stats.totalWagered >= tier.minWager) || VIP_TIERS[0];

  const nextTier = VIP_TIERS.find((tier) => tier.minWager > stats.totalWagered);
  const progressToNext = nextTier
    ? Math.min(100, Math.round((stats.totalWagered / nextTier.minWager) * 100))
    : 100;

  const winRate = stats.totalRounds > 0
    ? Math.round((stats.wins / stats.totalRounds) * 100)
    : 0;

  return (
    <div className="w-full space-y-6">
      {/* VIP Status Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1d0a33] via-[#290d45] to-[#160829] border border-amber-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-inner">
              <Crown className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">
                  Nivel de Membresía VIP
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
                {currentTier.name}
              </h2>
              <p className="text-xs text-rose-300/80 mt-1">
                Beneficio activo: <strong>{currentTier.perk}</strong>
              </p>
            </div>
          </div>

          {/* Quick Bonus actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                sound.playChip();
                onOpenWheel();
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-950/50 cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Girar Ruleta</span>
            </button>
            {balance < 100 && (
              <button
                onClick={() => {
                  sound.playJackpot();
                  onClaimEmergency();
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-950/50 cursor-pointer flex items-center gap-1.5 animate-pulse"
              >
                <Gift className="w-4 h-4" />
                <span>Rescate (+500 BC)</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress bar to next tier */}
        {nextTier && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-2 font-mono">
              <span>
                Progreso hacia <strong>{nextTier.name}</strong>
              </span>
              <span className="text-amber-400 font-bold tabular-nums">
                {stats.totalWagered.toLocaleString('es-ES')} / {nextTier.minWager.toLocaleString('es-ES')} BC ({progressToNext}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-black/40 border border-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
                style={{ width: `${progressToNext}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#120621] border border-white/10 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Tasa de Acierto
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            {winRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats.wins} victorias · {stats.losses} derrotas
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#120621] border border-white/10 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Mayor Ganancia
            </span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono tabular-nums">
            {stats.highestWin.toLocaleString('es-ES')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            BerryCoins en un solo golpe
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#120621] border border-white/10 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Racha Máxima
            </span>
            <Zap className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono tabular-nums">
            {stats.highestStreak}x
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Victorias consecutivas
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#120621] border border-white/10 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Volumen Total
            </span>
            <Crown className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono tabular-nums">
            {stats.totalWagered.toLocaleString('es-ES')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            BerryCoins apostadas
          </div>
        </div>
      </div>

      {/* VIP Tiers Overview Table */}
      <div className="rounded-3xl bg-[#120621] border border-white/10 p-6 shadow-xl">
        <h3 className="text-base font-bold text-white mb-4 font-display">
          Rangos & Beneficios de Lealtad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {VIP_TIERS.map((tier) => {
            const isCurrent = currentTier.name === tier.name;
            return (
              <div
                key={tier.name}
                className={`p-4 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-amber-500/10 border-amber-500/40 shadow-md'
                    : 'bg-black/20 border-white/5 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white font-display">
                    {tier.name}
                  </span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400 text-slate-950 uppercase">
                      Actual
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-amber-400 font-semibold mb-2">
                  Min: {tier.minWager.toLocaleString('es-ES')} BC
                </div>
                <div className="text-xs text-slate-400 leading-snug">
                  {tier.perk}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

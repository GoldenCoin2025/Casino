import React from 'react';
import { CHIP_DENOMINATIONS } from '../types/casino';
import { sound } from '../utils/soundEffects';

interface ChipSelectorProps {
  currentBet: number;
  setBet: React.Dispatch<React.SetStateAction<number>>;
  balance: number;
  disabled?: boolean;
}

const CHIP_STYLES: Record<number, { bg: string; border: string; text: string; label: string }> = {
  10: { bg: 'bg-slate-800', border: 'border-slate-400', text: 'text-slate-100', label: '10' },
  25: { bg: 'bg-emerald-900', border: 'border-emerald-400', text: 'text-emerald-200', label: '25' },
  50: { bg: 'bg-sky-900', border: 'border-sky-400', text: 'text-sky-200', label: '50' },
  100: { bg: 'bg-rose-900', border: 'border-rose-400', text: 'text-rose-200', label: '100' },
  250: { bg: 'bg-purple-900', border: 'border-purple-400', text: 'text-purple-200', label: '250' },
  500: { bg: 'bg-amber-900', border: 'border-amber-400', text: 'text-amber-200', label: '500' },
  1000: { bg: 'bg-gradient-to-br from-yellow-700 via-amber-900 to-black', border: 'border-yellow-300', text: 'text-yellow-100', label: '1K' },
};

export const ChipSelector: React.FC<ChipSelectorProps> = ({
  currentBet,
  setBet,
  balance,
  disabled = false,
}) => {
  const handleAddChip = (amount: number) => {
    if (disabled) return;
    sound.playChip();
    setBet((prev) => Math.min(balance, prev + amount));
  };

  const handleSetBet = (amount: number) => {
    if (disabled) return;
    sound.playBet();
    setBet(Math.max(10, Math.min(balance, amount)));
  };

  const handleDouble = () => {
    if (disabled) return;
    sound.playBet();
    setBet((prev) => Math.min(balance, prev * 2));
  };

  const handleHalf = () => {
    if (disabled) return;
    sound.playChip();
    setBet((prev) => Math.max(10, Math.floor(prev / 2)));
  };

  const handleMax = () => {
    if (disabled) return;
    sound.playBet();
    setBet(Math.max(10, balance));
  };

  const handleClear = () => {
    if (disabled) return;
    sound.playChip();
    setBet(10);
  };

  return (
    <div className="w-full bg-[#12071f]/80 backdrop-blur-md rounded-2xl border border-white/10 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-rose-300/80 font-semibold block mb-0.5">
            Monto de Apuesta
          </span>
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono tabular-nums">
              {currentBet.toLocaleString('es-ES')}
            </span>
            <span className="text-xs text-slate-400 font-semibold uppercase">
              BerryCoins
            </span>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center flex-wrap gap-1.5 self-stretch sm:self-auto">
          <button
            type="button"
            disabled={disabled || currentBet <= 10}
            onClick={handleHalf}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-[#1f0e34] hover:bg-[#2e154e] border border-white/10 text-xs font-semibold text-slate-300 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ½
          </button>
          <button
            type="button"
            disabled={disabled || currentBet * 2 > balance}
            onClick={handleDouble}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-[#1f0e34] hover:bg-[#2e154e] border border-white/10 text-xs font-semibold text-slate-300 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            2×
          </button>
          <button
            type="button"
            disabled={disabled || currentBet >= balance}
            onClick={handleMax}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-bold text-amber-300 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ALL-IN
          </button>
          <button
            type="button"
            disabled={disabled || currentBet === 10}
            onClick={handleClear}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-[#1f0e34] hover:bg-[#2e154e] border border-white/10 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Mín (10)
          </button>
        </div>
      </div>

      {/* Chip Rack */}
      <div className="pt-2 border-t border-white/5">
        <div className="text-[11px] text-slate-400 mb-2 font-medium tracking-wide">
          Añadir fichas a la mesa:
        </div>
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 select-none">
          {CHIP_DENOMINATIONS.map((val) => {
            const style = CHIP_STYLES[val];
            const canAfford = currentBet + val <= balance;
            return (
              <button
                key={val}
                type="button"
                disabled={disabled || !canAfford}
                onClick={() => handleAddChip(val)}
                className={`relative group shrink-0 w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center border-2 border-dashed ${style.border} ${style.bg} shadow-md transition-all duration-200 cursor-pointer ${
                  canAfford && !disabled
                    ? 'hover:-translate-y-1 hover:shadow-lg hover:shadow-rose-950/50 active:translate-y-0.5'
                    : 'opacity-40 cursor-not-allowed'
                }`}
                title={`Añadir +${val} BerryCoins`}
              >
                {/* Chip Inner Pattern Ring */}
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-white/30 flex items-center justify-center bg-black/20">
                  <span className={`text-xs sm:text-sm font-black font-mono tabular-nums ${style.text}`}>
                    {style.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

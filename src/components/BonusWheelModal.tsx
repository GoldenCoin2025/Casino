import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { X, Sparkles } from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface BonusWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReward: (amount: number) => void;
}

const SEGMENTS = [
  { label: '100 BC', amount: 100, color: '#e11d48' },
  { label: '250 BC', amount: 250, color: '#7c3aed' },
  { label: '50 BC', amount: 50, color: '#475569' },
  { label: '500 BC', amount: 500, color: '#f59e0b' },
  { label: '200 BC', amount: 200, color: '#2563eb' },
  { label: '1,000 BC', amount: 1000, color: '#ec4899', isJackpot: true },
  { label: '150 BC', amount: 150, color: '#059669' },
  { label: '300 BC', amount: 300, color: '#9333ea' },
];

export const BonusWheelModal: React.FC<BonusWheelModalProps> = ({
  isOpen,
  onClose,
  onReward,
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSpin = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setWonPrize(null);

    // Pick random winning segment
    const segmentCount = SEGMENTS.length;
    const segmentDegree = 360 / segmentCount;
    const winningIndex = Math.floor(Math.random() * segmentCount);
    const winningSegment = SEGMENTS[winningIndex];

    // Calculate rotation: 5 full turns + target slice angle
    // Note: arrow points at 0/360 degrees (top)
    const extraSpins = 360 * 5;
    // Calculate angle that puts winning segment at top
    const targetAngle = 360 - (winningIndex * segmentDegree + segmentDegree / 2);
    const finalAngle = rotation + extraSpins + (targetAngle - (rotation % 360));

    setRotation(finalAngle);

    // Audio ticks during spin
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      sound.playWheelTick();
      tickCount++;
      if (tickCount > 25) {
        clearInterval(tickInterval);
      }
    }, 120);

    setTimeout(() => {
      setIsSpinning(false);
      setWonPrize(winningSegment.amount);
      onReward(winningSegment.amount);

      if (winningSegment.amount >= 500) {
        sound.playJackpot();
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.5 },
        });
      } else {
        sound.playWin();
      }
    }, 3800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#130722] border border-rose-500/30 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-rose-950/80">
        {/* Close Button */}
        <button
          onClick={() => {
            if (!isSpinning) {
              sound.playChip();
              onClose();
            }
          }}
          disabled={isSpinning}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl sm:text-2xl font-black text-white font-display">
            RULETA DE BONO BERRIES
          </h2>
        </div>
        <p className="text-xs text-rose-300/80 mb-6 font-medium">
          ¡Gira gratis y consigue BerryCoins adicionales para seguir jugando!
        </p>

        {/* The Wheel Visual Container */}
        <div className="relative w-64 h-64 mx-auto mb-6 flex items-center justify-center select-none">
          {/* Top Indicator Arrow */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-amber-400 drop-shadow-md" />

          {/* Wheel Frame */}
          <div
            className="w-full h-full rounded-full border-4 border-amber-400/80 shadow-2xl relative overflow-hidden transition-transform ease-out"
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: isSpinning ? '3.8s' : '0s',
              transitionTimingFunction: 'cubic-bezier(0.15, 0.9, 0.2, 1)',
            }}
          >
            {/* SVG Segments */}
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              {SEGMENTS.map((seg, i) => {
                const sliceAngle = 360 / SEGMENTS.length;
                const startAngle = i * sliceAngle;
                const endAngle = (i + 1) * sliceAngle;

                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;

                const x1 = 50 + 50 * Math.cos(startRad);
                const y1 = 50 + 50 * Math.sin(startRad);
                const x2 = 50 + 50 * Math.cos(endRad);
                const y2 = 50 + 50 * Math.sin(endRad);

                const d = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;

                // Midpoint for label positioning
                const midRad = ((startAngle + sliceAngle / 2) * Math.PI) / 180;
                const textX = 50 + 34 * Math.cos(midRad);
                const textY = 50 + 34 * Math.sin(midRad);
                const textAngle = startAngle + sliceAngle / 2 + 90;

                return (
                  <g key={i}>
                    <path d={d} fill={seg.color} stroke="#1e0c33" strokeWidth="1" />
                    <text
                      x={textX}
                      y={textY}
                      fill="#ffffff"
                      fontSize="5"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${textAngle}, ${textX}, ${textY})`}
                    >
                      {seg.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Center Hub */}
          <div className="absolute z-10 w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 border-2 border-white flex items-center justify-center shadow-lg">
            <span className="text-xl">🍓</span>
          </div>
        </div>

        {/* Prize Notification */}
        {wonPrize !== null && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold animate-in zoom-in-95">
            ¡Felicidades! Has ganado +{wonPrize.toLocaleString('es-ES')} BerryCoins
          </div>
        )}

        {/* Spin Button */}
        <button
          type="button"
          onClick={handleSpin}
          disabled={isSpinning}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm tracking-wider uppercase font-display shadow-lg shadow-amber-900/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSpinning ? 'GIRANDO LA RULETA...' : 'GIRAR RULETA GRATIS'}
        </button>
      </div>
    </div>
  );
};

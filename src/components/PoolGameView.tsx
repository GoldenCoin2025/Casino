import React, { useRef } from 'react';
import { ArrowLeft, Maximize2, RotateCcw, Sparkles } from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface PoolGameViewProps {
  onBackToCasino: () => void;
}

export const PoolGameView: React.FC<PoolGameViewProps> = ({ onBackToCasino }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleReload = () => {
    sound.playChip();
    if (iframeRef.current) {
      iframeRef.current.src = '/poolgame.html?t=' + Date.now();
    }
  };

  const handleOpenFullscreen = () => {
    sound.playChip();
    window.open('/poolgame.html', '_blank');
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#091333] border-2 border-cyan-500/40 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playChip();
              onBackToCasino();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs sm:text-sm border border-cyan-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Casino</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-2xl">🎱</span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white font-display uppercase tracking-tight flex items-center gap-2">
                <span>BILLAR 8-BALL MASTER</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                  ¡NUEVO!
                </span>
              </h2>
              <p className="text-xs text-slate-400 hidden sm:block">
                Física realista de choque elástico, bandas, efecto y troneras
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-500/40 text-cyan-300 font-bold text-xs transition-all cursor-pointer active:scale-95"
            title="Reiniciar mesa"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reiniciar</span>
          </button>

          <button
            onClick={handleOpenFullscreen}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer"
            title="Abrir en pestaña nueva"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Pantalla Completa</span>
          </button>
        </div>
      </div>

      {/* Embedded Iframe Game */}
      <div className="w-full relative rounded-2xl overflow-hidden border-2 border-cyan-500/30 shadow-2xl bg-[#050b14] h-[640px] sm:h-[720px]">
        <iframe
          ref={iframeRef}
          src="/poolgame.html"
          title="Juego de Billar 8-Ball Pool"
          className="w-full h-full border-0 block"
          allow="autoplay"
        />
      </div>

      {/* Guide & Controls Hint */}
      <div className="p-4 rounded-xl bg-[#080f2b] border border-blue-900/60 text-xs text-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Controles:</strong> Mueve el puntero sobre la mesa para apuntar. Ajusta la barra de potencia inferior y pulsa <em>"Golpear Bola"</em> para efectuar el tiro.
          </span>
        </div>
        <a
          href="/poolgame.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:underline font-bold text-xs whitespace-nowrap"
        >
          Enlace directo: /poolgame.html &rarr;
        </a>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import emblemImg from '../assets/images/berries_casino_emblem_1792116087941.jpg';
import { sound } from '../utils/soundEffects';

interface LoadingScreenProps {
  onComplete: () => void;
}

const LOADING_STEPS = [
  'Iniciando sistema de seguridad Berries...',
  'Sincronizando billetera de BerryCoins...',
  'Barajando cartas de la Casa...',
  'Verificando algoritmo Provably Fair...',
  'Salón VIP listo para apostar.',
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsReady(true);
          return 100;
        }
        const increment = Math.floor(Math.random() * 15) + 8;
        const next = Math.min(100, prev + increment);
        const stepIdx = Math.min(
          LOADING_STEPS.length - 1,
          Math.floor((next / 100) * LOADING_STEPS.length)
        );
        setCurrentStepIndex(stepIdx);
        return next;
      });
    }, 120);

    return () => clearInterval(interval);
  }, []);

  const handleEnter = () => {
    sound.playChip();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07030c] text-white overflow-hidden select-none">
      {/* Background radial ambient lights */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Decorative subtle casino pattern lines */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center">
        {/* Animated Emblem Container */}
        <div className="relative mb-8 group">
          {/* Glowing rotating ring */}
          <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-rose-600 via-amber-400 to-indigo-600 opacity-60 blur-md animate-spin [animation-duration:8s]" />
          
          {/* Inner metallic border */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full p-1 bg-gradient-to-b from-amber-300 via-rose-500 to-indigo-900 shadow-2xl shadow-rose-950/80">
            <div className="w-full h-full rounded-full overflow-hidden bg-black flex items-center justify-center border-2 border-[#1a0a2a]">
              <img
                src={emblemImg}
                alt="Berries Casino Royal Crest"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
              />
            </div>
          </div>

          {/* Floating berry sparkle badge */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#170a24] border border-amber-400/40 text-[10px] tracking-widest uppercase font-semibold text-amber-300 shadow-lg">
            Royal Casino
          </div>
        </div>

        {/* Title & Tagline */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display mb-1 text-white">
          BERRIES
        </h1>
        <p className="text-xs sm:text-sm text-rose-300/80 font-medium tracking-wider uppercase mb-8">
          Casino & High Stakes Gaming
        </p>

        {/* Progress Bar & Status */}
        <div className="w-full mb-6">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-2 font-mono">
            <span className="truncate pr-2 text-slate-300">{LOADING_STEPS[currentStepIndex]}</span>
            <span className="text-amber-400 font-bold tabular-nums">{progress}%</span>
          </div>

          <div className="w-full h-2 rounded-full bg-[#1a0d2a] border border-white/5 p-0.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-rose-400 transition-all duration-150 ease-out shadow-sm shadow-rose-500/50"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Enter Casino Button */}
        <div className="h-12 flex items-center justify-center">
          {isReady ? (
            <button
              onClick={handleEnter}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-bold text-sm tracking-wide shadow-xl shadow-rose-900/40 hover:shadow-rose-600/50 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer animate-bounce"
            >
              ENTRAR AL CASINO
            </button>
          ) : (
            <div className="text-xs text-slate-500 tracking-widest uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              Cargando mesa de juego...
            </div>
          )}
        </div>
      </div>

      {/* Footer subtle attribution */}
      <div className="absolute bottom-6 text-[11px] text-slate-600 tracking-widest uppercase">
        Berries Provably Fair Entertainment · Monedas Virtuales
      </div>
    </div>
  );
};

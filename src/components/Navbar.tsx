import React from 'react';
import emblemImg from '../assets/images/berries_casino_emblem_1792116087941.jpg';
import { Volume2, VolumeX, Sparkles, Coins, Swords, Trophy, History, Layers, Clock, Bell, LogIn, UserPlus } from 'lucide-react';
import { sound } from '../utils/soundEffects';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  balance: number;
  activeView: 'catalog' | 'stacker' | 'rps' | 'pool' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad' | 'knifeclash' | 'history' | 'leaderboard';
  setActiveView: (view: 'catalog' | 'stacker' | 'rps' | 'pool' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad' | 'knifeclash' | 'history' | 'leaderboard') => void;
  pendingCount: number;
  unreadNotificationCount: number;
  onOpenPendingMatches: () => void;
  onOpenNotifications: () => void;
  onOpenWheel: () => void;
  onOpenRules: () => void;
  onAddFaucet: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenProfile: () => void;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Navbar: React.FC<NavbarProps> = ({
  balance,
  activeView,
  setActiveView,
  pendingCount,
  unreadNotificationCount,
  onOpenPendingMatches,
  onOpenNotifications,
  onOpenWheel,
  onOpenRules,
  onAddFaucet,
  onOpenAuth,
  onOpenProfile,
  isMuted,
  setIsMuted,
}) => {
  const { user, profile } = useAuth();

  const toggleAudio = () => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      sound.playChip();
    }
  };

  const displayBalance = profile ? profile.balance : balance;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-blue-900/60 bg-[#070e28]/95 backdrop-blur-xl select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 sm:gap-6 px-4 sm:px-6 py-3">
        {/* Zone 1: CrazyGames-style Punchy Brand */}
        <div
          onClick={() => {
            sound.playChip();
            setActiveView('catalog');
          }}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="relative w-10 h-10 rounded-2xl overflow-hidden border-2 border-cyan-400 shadow-md shadow-blue-600/40 group-hover:scale-105 transition-transform">
            <img
              src={emblemImg}
              alt="Berries Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl sm:text-3xl font-black tracking-tight font-display text-white group-hover:text-cyan-300 transition-colors">
              BERRIES<span className="text-blue-500">.BET</span>
            </span>
            <span className="text-[10px] tracking-widest font-extrabold uppercase text-cyan-400/90 -mt-1 hidden sm:block">
              ARENA PVP · APUESTAS DESDE $25 PESOS
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-4 text-xs font-bold text-slate-300">
          <button
            onClick={() => {
              setActiveView('catalog');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'catalog'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'hover:text-white'
            }`}
          >
            <span>🎮 Catálogo</span>
          </button>

          {/* Berries Road 2D Navbar Button */}
          <button
            onClick={() => {
              setActiveView('berriesroad');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'berriesroad'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-black'
                : 'hover:text-emerald-300'
            }`}
          >
            <span>🐣</span>
            <span>Berries Road</span>
            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 text-[9px] font-black shadow-sm">2D VOXEL</span>
          </button>

          {/* Berries Blade: Knife Clash Navbar Button */}
          <button
            onClick={() => {
              setActiveView('knifeclash');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'knifeclash'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-black'
                : 'hover:text-cyan-300'
            }`}
          >
            <span>🗡️</span>
            <span>Berries Blade</span>
            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-slate-950 text-[9px] font-black shadow-sm">NUEVO</span>
          </button>

          {/* Mines Clash 1v1 Navbar Button */}
          <button
            onClick={() => {
              setActiveView('mines');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'mines'
                ? 'text-amber-400 border-b-2 border-amber-400 font-black'
                : 'hover:text-amber-300'
            }`}
          >
            <span>💣</span>
            <span>Mines Clash 1v1</span>
            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 text-[9px] font-black shadow-sm">NUEVO</span>
          </button>

          {/* Color Clash 4 (UNO) Navbar Button */}
          <button
            onClick={() => {
              setActiveView('colorclash');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'colorclash'
                ? 'text-rose-400 border-b-2 border-rose-400 font-black'
                : 'hover:text-rose-300'
            }`}
          >
            <span>🃏</span>
            <span>Color Clash 4</span>
            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500 text-slate-950 text-[9px] font-black shadow-sm">NUEVO</span>
          </button>

          {/* Block Blast Pro Navbar Button */}
          <button
            onClick={() => {
              setActiveView('blockblast');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'blockblast'
                ? 'text-amber-300 border-b-2 border-amber-400 font-black'
                : 'hover:text-amber-300'
            }`}
          >
            <span>🧩</span>
            <span>Block Blast Pro</span>
            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[9px] font-black shadow-sm">NUEVO</span>
          </button>

          <button
            onClick={() => {
              setActiveView('stacker');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'stacker'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Apilar Bloques PvP</span>
          </button>

          <button
            onClick={() => {
              setActiveView('rps');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'rps'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'hover:text-white'
            }`}
          >
            <Swords className="w-3.5 h-3.5 text-rose-400" />
            <span>Piedra Papel Tijera</span>
          </button>

          <button
            onClick={() => {
              setActiveView('pool');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'pool'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-black'
                : 'hover:text-emerald-300'
            }`}
          >
            <span>🎱</span>
            <span>Billar 8-Ball</span>
          </button>

          <button
            onClick={() => {
              setActiveView('leaderboard');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'leaderboard'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Ranking</span>
          </button>

          <button
            onClick={() => {
              setActiveView('history');
              sound.playChip();
            }}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer flex items-center gap-1.5 ${
              activeView === 'history'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 text-blue-400" />
            <span>Historial</span>
          </button>
        </nav>

        {/* Zone 3: Partidas Pendientes (24h) + Notificaciones + Balance + Auth */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Partidas Pendientes Menu (24h) */}
          <button
            onClick={() => {
              sound.playChip();
              onOpenPendingMatches();
            }}
            className="relative px-3 py-1.5 rounded-xl bg-blue-900/60 hover:bg-blue-800 border border-blue-500/50 text-cyan-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
            title="Ver partidas asincrónicas pendientes (24h)"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Pendientes</span>
            {pendingCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          {/* Notificaciones Button */}
          <button
            onClick={() => {
              sound.playChip();
              onOpenNotifications();
            }}
            className="relative p-2 rounded-xl bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/40 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Notificaciones de versus"
          >
            <Bell className="w-4 h-4 text-cyan-400" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {/* Balance Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/80 border-2 border-blue-500/50 text-white shadow-md shadow-blue-900/50">
            <Coins className="w-4 h-4 text-amber-400 animate-spin [animation-duration:6s]" />
            <span className="font-mono font-black text-xs sm:text-sm tabular-nums text-amber-300">
              ${displayBalance.toLocaleString('es-ES')}
            </span>
          </div>

          {/* Quick Faucet Refill */}
          <button
            onClick={onAddFaucet}
            title="Recargar +$1,000 pesos gratis para apostar"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-300 rounded-xl hover:from-yellow-300 hover:to-amber-300 transition-all shadow-md shadow-amber-950/40 cursor-pointer whitespace-nowrap shrink-0 uppercase tracking-wide hover:scale-105 active:scale-95"
          >
            +$1K
          </button>

          {/* Firebase Authentication State */}
          {user && profile ? (
            <button
              onClick={() => {
                sound.playChip();
                onOpenProfile();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-900/60 hover:bg-blue-800/80 border border-cyan-400/50 text-white transition-all cursor-pointer"
            >
              <span className="text-base">{profile.avatar || '😎'}</span>
              <span className="text-xs font-bold truncate max-w-[80px] hidden md:inline">
                {profile.username}
              </span>
              <span className="text-sm">{profile.countryFlag}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  sound.playChip();
                  onOpenAuth('login');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-600/40 text-xs font-bold text-slate-200 transition-all cursor-pointer hidden sm:flex items-center gap-1"
              >
                <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ingresar</span>
              </button>
              <button
                onClick={() => {
                  sound.playChip();
                  onOpenAuth('register');
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-cyan-950/50"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Registro</span>
              </button>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleAudio}
            title={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
            className="p-2 rounded-xl bg-blue-900/40 border border-blue-500/40 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

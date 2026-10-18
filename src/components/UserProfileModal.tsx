import React from 'react';
import { useAuth } from '../context/AuthContext';
import { sound } from '../utils/soundEffects';
import { X, LogOut, ShieldCheck, Trophy, Swords, Coins, Globe, FileText, Mail } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, logout } = useAuth();

  if (!isOpen || !profile) return null;

  const totalMatches = profile.wins + profile.losses;
  const winRate = totalMatches > 0 ? Math.round((profile.wins / totalMatches) * 100) : 0;

  // Mask document number for safety
  const maskedDoc = profile.documentNumber.length > 4
    ? `••••${profile.documentNumber.slice(-4)}`
    : profile.documentNumber;

  const handleLogout = async () => {
    sound.playChip();
    await logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md bg-[#0a1435] border-2 border-blue-500/50 rounded-3xl p-6 sm:p-8 text-left shadow-2xl shadow-blue-950">
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

        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 border-2 border-white flex items-center justify-center text-3xl shadow-xl shadow-cyan-600/40">
            {profile.avatar || '😎'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white font-display">
                {profile.username}
              </h2>
              <span className="text-lg" title={profile.country}>
                {profile.countryFlag || '🌐'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-cyan-300 font-bold mt-0.5">
              <span>{profile.country}</span>
              <span>·</span>
              <span className="text-amber-400 font-mono">Rating: ★{profile.rating}</span>
            </div>
          </div>
        </div>

        {/* Player Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-blue-950/80 border border-blue-600/30">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Saldo BerryCoins</span>
              <Coins className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-black text-amber-300 font-mono tabular-nums">
              {profile.balance.toLocaleString('es-ES')} BC
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-950/80 border border-blue-600/30">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Efectividad PvP</span>
              <Trophy className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-lg font-black text-emerald-400 font-mono tabular-nums">
              {winRate}%
            </div>
            <div className="text-[10px] text-slate-400">
              {profile.wins}V - {profile.losses}D ({totalMatches} partidas)
            </div>
          </div>
        </div>

        {/* Verified Document & Account Info */}
        <div className="p-4 rounded-xl bg-[#070e28] border border-blue-900/60 space-y-2.5 text-xs mb-6">
          <div className="text-[11px] font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Identidad Internacional Verificada</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Mail className="w-3.5 h-3.5" />
              <span>Correo:</span>
            </span>
            <span className="font-mono text-white truncate max-w-[180px]">{profile.email}</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <FileText className="w-3.5 h-3.5" />
              <span>Documento ({profile.documentType.toUpperCase()}):</span>
            </span>
            <span className="font-mono text-amber-300 font-bold">{maskedDoc}</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Globe className="w-3.5 h-3.5" />
              <span>Nacionalidad:</span>
            </span>
            <span className="text-white font-medium">{profile.countryFlag} {profile.country}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
};

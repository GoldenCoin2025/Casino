import React from 'react';
import { AppNotification } from '../types/casino';
import { sound } from '../utils/soundEffects';
import { X, Bell, Trophy, RotateCcw, Swords, Check } from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  notifications,
  onClose,
  onMarkAllAsRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-lg bg-[#091538] border-2 border-blue-500/50 rounded-3xl p-6 sm:p-8 text-left shadow-2xl shadow-blue-950 max-h-[85vh] overflow-y-auto">
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-display">
                NOTIFICACIONES DE VERSUS
              </h2>
              <p className="text-xs text-cyan-300 font-medium">
                Resultados de tus partidas asincrónicas y retos
              </p>
            </div>
          </div>

          {notifications.some((n) => !n.read) && (
            <button
              onClick={() => {
                sound.playChip();
                onMarkAllAsRead();
              }}
              className="text-xs text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Marcar leídas</span>
            </button>
          )}
        </div>

        {/* Notifications list */}
        {notifications.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center border-2 border-dashed border-blue-800 rounded-2xl bg-blue-950/20">
            <Bell className="w-8 h-8 text-slate-500 mb-2" />
            <p className="text-xs text-slate-400">
              No tienes notificaciones pendientes en este momento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const timeStr = new Date(n.timestamp).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    !n.read
                      ? 'bg-blue-950 border-cyan-400 shadow-md shadow-cyan-950/50'
                      : 'bg-blue-950/40 border-blue-900/60 opacity-80'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 shrink-0 mt-0.5">
                      {n.type === 'win' ? (
                        <Trophy className="w-4 h-4 text-amber-400" />
                      ) : n.type === 'refund' ? (
                        <RotateCcw className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Swords className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-white font-display">
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {timeStr}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {n.message}
                      </p>
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

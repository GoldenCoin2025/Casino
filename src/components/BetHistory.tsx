import React from 'react';
import { BetRecord } from '../types/casino';
import { History, ArrowUpRight, ArrowDownRight, Minus, Swords } from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface BetHistoryProps {
  history: BetRecord[];
  onPlayClick: () => void;
}

export const BetHistory: React.FC<BetHistoryProps> = ({ history, onPlayClick }) => {
  return (
    <div className="w-full bg-[#0a1435] border-2 border-blue-600/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 select-none">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            <History className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
              HISTORIAL DE DUELOS PVP
            </h2>
            <p className="text-xs text-cyan-300">
              Registro auditado de todas tus partidas contra otros jugadores en Berries.bet
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-400 tabular-nums">
          {history.length} {history.length === 1 ? 'duelo registrado' : 'duelos registrados'}
        </span>
      </div>

      {history.length === 0 ? (
        <div className="py-16 text-center flex flex-col items-center justify-center border-2 border-dashed border-blue-800 rounded-2xl bg-blue-950/20">
          <Swords className="w-12 h-12 text-cyan-400 mb-3" />
          <h3 className="text-lg font-bold text-white mb-1 font-display">
            Aún no has jugado ningún duelo PvP
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6">
            Entra a la cuadrícula de juegos, selecciona Piedra Papel Tijera al mejor de 3 o reta a otro jugador.
          </p>
          <button
            onClick={() => {
              sound.playChip();
              onPlayClick();
            }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-950/50 transition-all"
          >
            Ir a la Arena de Juegos
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0e1d4d] text-slate-300 border-b border-blue-800 uppercase tracking-wider text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">Hora</th>
                <th className="py-3 px-4">Juego</th>
                <th className="py-3 px-4">Rival</th>
                <th className="py-3 px-4 text-center">Marcador</th>
                <th className="py-3 px-4">Resultado</th>
                <th className="py-3 px-4 text-right">Apuesta</th>
                <th className="py-3 px-4 text-right">Ganancia Neta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-900/40 font-mono tabular-nums">
              {history.map((item) => {
                const date = new Date(item.timestamp);
                const timeStr = date.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <tr key={item.id} className="hover:bg-blue-900/20 transition-colors">
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {timeStr}
                    </td>
                    <td className="py-3.5 px-4 font-sans font-bold text-white whitespace-nowrap">
                      {item.gameTitle}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-cyan-300 font-semibold whitespace-nowrap">
                      {item.opponentName}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-200">
                      {item.finalScore || '—'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.result === 'win' && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-sans font-bold">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Victoria (+Pozo)
                        </span>
                      )}
                      {item.result === 'tie' && (
                        <span className="inline-flex items-center gap-1 text-amber-300 font-sans font-bold">
                          <Minus className="w-3.5 h-3.5" />
                          Empate
                        </span>
                      )}
                      {item.result === 'loss' && (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-sans font-medium">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          Derrota
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-300">
                      {item.betAmount.toLocaleString('es-ES')} BC
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold">
                      {item.netProfit > 0 && (
                        <span className="text-emerald-400">
                          +{item.netProfit.toLocaleString('es-ES')} BC
                        </span>
                      )}
                      {item.netProfit === 0 && (
                        <span className="text-slate-400">0 BC</span>
                      )}
                      {item.netProfit < 0 && (
                        <span className="text-rose-400">
                          {item.netProfit.toLocaleString('es-ES')} BC
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

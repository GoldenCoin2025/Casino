import React, { useState, useEffect } from 'react';
import { Trophy, Users, ArrowUpRight, Flame, Sparkles } from 'lucide-react';
import { sound } from '../utils/soundEffects';
import { collection, query, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';

interface LeaderboardProps {
  onChallengePlayer: (username: string) => void;
}

interface LeaderboardPlayer {
  id: string;
  username: string;
  avatar: string;
  rating: number;
  wins: number;
  totalWagered: number;
  countryFlag?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ onChallengePlayer }) => {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const q = query(
      collection(db, 'leaderboard'),
      limit(25)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: LeaderboardPlayer[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as LeaderboardPlayer);
        });
        // Sort descending by rating, then wins
        list.sort((a, b) => (b.rating || 1500) - (a.rating || 1500) || (b.wins || 0) - (a.wins || 0));
        setPlayers(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'leaderboard');
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full bg-[#0a1435] border-2 border-blue-600/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 select-none">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
              RANKING ARENA PVP BERRIES (100% REAL)
            </h2>
            <p className="text-xs text-cyan-300 font-medium">
              Clasificación oficial de jugadores reales registrados en la plataforma
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-950 border border-blue-500/40 text-xs font-bold text-slate-300">
          <Users className="w-4 h-4 text-cyan-400" />
          <span>Temporada 1 en Vivo</span>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span>Cargando clasificación real desde Firestore...</span>
        </div>
      ) : players.length === 0 ? (
        <div className="py-12 px-4 text-center border-2 border-dashed border-blue-800 rounded-2xl bg-blue-950/20 flex flex-col items-center justify-center space-y-3">
          <Trophy className="w-10 h-10 text-cyan-400 opacity-60" />
          <h4 className="text-base font-bold text-white">
            Aún no hay duelistas clasificados en esta temporada
          </h4>
          <p className="text-xs text-slate-400 max-w-sm">
            ¡Regístrate, juega una partida en la Arena y sé el primer campeón en la tabla de clasificación!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0e1d4d] text-slate-300 border-b border-blue-800 uppercase tracking-wider text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">Puesto</th>
                <th className="py-3 px-4">Jugador</th>
                <th className="py-3 px-4">Rating ELO</th>
                <th className="py-3 px-4">Victorias</th>
                <th className="py-3 px-4 text-right">Total Apostado</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-900/40 font-mono tabular-nums">
              {players.map((p, idx) => {
                const rank = idx + 1;
                return (
                  <tr key={p.id} className="hover:bg-blue-900/20 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-sm">
                      {rank === 1 && <span className="text-amber-400 text-lg">🥇 1</span>}
                      {rank === 2 && <span className="text-slate-300 text-lg">🥈 2</span>}
                      {rank === 3 && <span className="text-amber-600 text-lg">🥉 3</span>}
                      {rank > 3 && <span className="text-slate-400">#{rank}</span>}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{p.avatar || '😎'}</span>
                        <div>
                          <span className="font-bold text-white block">
                            @{p.username} {p.countryFlag || ''}
                          </span>
                          <span className="text-[10px] text-cyan-400 font-medium block">
                            Duelista Berries
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-amber-300 font-bold">
                      ★{p.rating || 1500}
                    </td>
                    <td className="py-3.5 px-4 text-emerald-400 font-bold">
                      {p.wins || 0}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-amber-300">
                      ${(p.totalWagered || 0).toLocaleString('es-ES')} pesos
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans">
                      <button
                        onClick={() => {
                          sound.playBet();
                          onChallengePlayer(p.username);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1 mx-auto"
                      >
                        <span>Retar</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
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

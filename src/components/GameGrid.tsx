import React, { useState, useEffect } from 'react';
import stackThumb from '../assets/images/thumb_stack_pvp_1792127485629.jpg';
import rpsThumb from '../assets/images/thumb_rps_pvp_1792119771304.jpg';
import poolThumb from '../assets/images/thumb_pool_game_1792163476304.jpg';
import blockBlastThumb from '../assets/images/block_blast_thumb_1792199749242.jpg';
import colorClashThumb from '../assets/images/color_clash_thumb_1792293562292.jpg';
import minesThumb from '../assets/images/mines_clash_thumb_1792307608375.jpg';
import berriesRoadThumb from '../assets/images/berries_road_voxel_1792308372785.jpg';
import berriesBladeThumb from '../assets/images/berries_blade_thumb_1792340798764.jpg';
import { CatalogGame, MIN_PVP_BET, RoomDocument } from '../types/casino';
import { Swords, Users, Sparkles, Flame, Play, ShieldAlert, ArrowRight, Layers, Clock, AlertCircle, Bomb } from 'lucide-react';
import { sound } from '../utils/soundEffects';
import { subscribeToOpenChallenges } from '../services/matchService';
import { useAuth } from '../context/AuthContext';

interface GameGridProps {
  onTriggerGameWager: (gameId: 'stacker' | 'rps' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad' | 'knifeclash', defaultWager?: number) => void;
  onAcceptOpenRoom: (room: RoomDocument) => void;
  onOpenWheel: () => void;
  onPlayPool: () => void;
  onPlayBlockBlast: () => void;
  onPlayColorClash: () => void;
  onPlayMines: () => void;
  onPlayBerriesRoad: () => void;
  onPlayKnifeClash: () => void;
}

const GAMES_CATALOG: CatalogGame[] = [
  {
    id: 'berriesroad',
    title: 'BERRIES ROAD (Voxel 2D PvP)',
    category: 'pvp',
    badge: '¡NUEVO 2D ESTRELLA!',
    minBet: MIN_PVP_BET,
    activePlayers: 2,
    image: berriesRoadThumb,
    description: 'Cruza autopistas de bólidos, ríos con troncos y vías de tren bala en Canvas 2D isométrico puro bajo la MISMA semilla procedural PvP asíncrono.',
    isPlayable: true,
    featured: true,
  },
  {
    id: 'knifeclash',
    title: 'BERRIES BLADE: KNIFE CLASH',
    category: 'pvp',
    badge: '¡NUEVO 1v1 ESTRELLA!',
    minBet: MIN_PVP_BET,
    activePlayers: 2,
    image: berriesBladeThumb,
    description: 'Lanza dagas con precisión milimétrica al tronco giratorio con aceleraciones, frenadas y cambios de sentido bajo la MISMA semilla procedural PvP.',
    isPlayable: true,
    featured: true,
  },
  {
    id: 'mines',
    title: 'MINES CLASH 1v1 (Buscaminas)',
    category: 'pvp',
    badge: '¡NUEVO PVP!',
    minBet: MIN_PVP_BET,
    activePlayers: 2,
    image: minesThumb,
    description: 'Duelo de Buscaminas vertical en tablero 5x5 con 3 minas y 22 diamantes bajo la MISMA semilla. Planta tus diamantes a tiempo o vuela por los aires.',
    isPlayable: true,
    featured: true,
  },
  {
    id: 'colorclash',
    title: 'Color Clash 4 (Cartas UNO)',
    category: 'popular',
    badge: '¡NUEVO JUEGO!',
    minBet: MIN_PVP_BET,
    activePlayers: 4,
    image: colorClashThumb,
    description: 'Mesa redonda 2.5D tipo UNO para 2 o 4 jugadores. Salteos, reversas, +2, +4, comodines y botón "¡CARTA!" para ganar el pozo.',
    isPlayable: true,
    featured: true,
  },
  {
    id: 'blockblast',
    title: 'Block Blast Arena Pro',
    category: 'popular',
    badge: 'POPULAR',
    minBet: MIN_PVP_BET,
    activePlayers: 1,
    image: blockBlastThumb,
    description: 'Tablero 8x8 con bloques 3D biselados. Destruye filas y columnas, encadena combos multiplicadores y gana créditos en partidas de 3 minutos.',
    isPlayable: true,
    featured: false,
  },
  {
    id: 'stacker',
    title: 'Apilar Bloques PvP (Tower Clash)',
    category: 'pvp',
    badge: 'FÍSICA DE CORTE REAL',
    minBet: MIN_PVP_BET,
    activePlayers: 1,
    image: stackThumb,
    description: 'Apila bloques móviles con precisión milimétrica. Los extremos mal alineados se cortan físicamente y caen al vacío con estallidos de partículas.',
    isPlayable: true,
    featured: false,
  },
  {
    id: 'rps',
    title: 'Piedra, Papel o Tijera PvP Pro',
    category: 'pvp',
    badge: 'AL MEJOR DE 3',
    minBet: MIN_PVP_BET,
    activePlayers: 1,
    image: rpsThumb,
    description: 'Duelo de estrategia pura al mejor de 3 rondas. Animaciones de choque de naipes y pozo disputado entre jugadores reales.',
    isPlayable: true,
    featured: false,
  },
  {
    id: 'pool',
    title: 'Billar Americano 8-Ball Master',
    category: 'pvp',
    badge: 'POPULAR',
    minBet: MIN_PVP_BET,
    activePlayers: 1,
    image: poolThumb,
    description: 'Mesa clásica de billar con física realista de bolas y bandas, control de taco, troneras y modo bola en mano.',
    isPlayable: true,
    featured: false,
  },
];

export const GameGrid: React.FC<GameGridProps> = ({
  onTriggerGameWager,
  onAcceptOpenRoom,
  onOpenWheel,
  onPlayPool,
  onPlayBlockBlast,
  onPlayColorClash,
  onPlayMines,
  onPlayBerriesRoad,
}) => {
  const { user } = useAuth();
  const [openRooms, setOpenRooms] = useState<RoomDocument[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);

  // Subscribe to real-time open challenges in Firestore (100% real P2P, ZERO mock data)
  useEffect(() => {
    const unsubscribe = subscribeToOpenChallenges((rooms) => {
      setOpenRooms(rooms);
      setLoadingRooms(false);
    });
    return () => unsubscribe();
  }, []);

  const formatRemainingTime = (expiresAt: number) => {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return 'Expirado';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="w-full space-y-8 select-none">
      {/* CRAZYGAMES HERO BANNER: FEATURING MINES CLASH 1v1, COLOR CLASH 4 & BLOCK BLAST */}
      <div className="relative w-full rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-gradient-to-r from-[#1a0e36] via-[#0d1c47] to-[#08102b] p-6 sm:p-10 shadow-2xl shadow-blue-950/80">
        <div className="absolute top-0 right-0 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-amber-500/15 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Hero Pitch */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1.5">
                <Bomb className="w-3.5 h-3.5 fill-slate-950" />
                <span>¡NUEVO: MINES CLASH 1v1!</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                Misma Semilla PvP
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white font-display tracking-tight leading-tight">
              MINES CLASH 1v1 &{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400">
                BUSCAMINAS PVP
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl font-medium leading-relaxed">
              Duelos de Buscaminas vertical en pantalla completa. Tablero 5x5 con 3 minas ocultas y 22 diamantes. Asegura tus diamantes antes de pisar una mina y vence a tu rival en la MISMA semilla.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  sound.playChip();
                  onPlayBerriesRoad();
                }}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-sm sm:text-base font-display uppercase tracking-wider shadow-xl shadow-emerald-950/60 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>🐣</span>
                <span>BERRIES ROAD 3D (VOXEL PVP)</span>
              </button>

              <button
                onClick={() => {
                  sound.playChip();
                  onPlayMines();
                }}
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>💣</span>
                <span>MINES CLASH 1v1</span>
              </button>

              <button
                onClick={() => {
                  sound.playChip();
                  onPlayColorClash();
                }}
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 via-fuchsia-600 to-purple-600 hover:from-rose-500 hover:to-fuchsia-500 text-white font-black text-sm uppercase tracking-wide transition-all cursor-pointer flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95"
              >
                <span>🃏</span>
                <span>COLOR CLASH 4</span>
              </button>

              <button
                onClick={() => {
                  sound.playChip();
                  onPlayBlockBlast();
                }}
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm uppercase tracking-wide transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-cyan-950/60 hover:scale-105 active:scale-95"
              >
                <span>🧩</span>
                <span>BLOCK BLAST</span>
              </button>

              <button
                onClick={() => {
                  sound.playChip();
                  onPlayPool();
                }}
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm uppercase tracking-wide transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/60 hover:scale-105 active:scale-95 border border-emerald-400/40"
              >
                <span className="text-base">🎱</span>
                <span>BILLAR 8-BALL</span>
              </button>
            </div>
          </div>

          {/* Right Hero Image Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div
              onClick={() => {
                sound.playChip();
                onTriggerGameWager('stacker', 50);
              }}
              className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border-2 border-cyan-400/60 shadow-2xl shadow-blue-600/50 cursor-pointer group"
            >
              <img
                src={stackThumb}
                alt="Apilar Bloques PvP"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex items-end p-4">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">APUESTA MANUAL</span>
                    <span className="text-sm font-black text-white font-display">Mínimo 25 Pesos</span>
                  </div>
                  <span className="px-3.5 py-1.5 rounded-xl bg-cyan-400 text-slate-950 font-black text-xs uppercase group-hover:bg-cyan-300 shadow-md">
                    Entrar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 100% REAL LIVE RETOS EN VIVO FEED (FROM FIRESTORE) */}
      <div className="rounded-3xl bg-[#091333] border-2 border-blue-600/30 p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-amber-400 animate-bounce" />
            <h3 className="text-base sm:text-lg font-black text-white font-display uppercase tracking-wide">
              RETOS EN VIVO ESPERANDO RIVAL (FIRESTORE)
            </h3>
          </div>
          <span className="text-xs text-cyan-300 font-bold bg-blue-950 px-3 py-1 rounded-lg border border-blue-500/30">
            Comisión BERRYS: 6% sobre el pozo
          </span>
        </div>

        {loadingRooms ? (
          <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Consultando desafíos reales en Firestore...</span>
          </div>
        ) : openRooms.length === 0 ? (
          /* MANDATORY ELEGANT EMPTY STATE: NO BOTS! */
          <div className="py-10 px-4 text-center border-2 border-dashed border-blue-800/80 rounded-2xl bg-blue-950/20 flex flex-col items-center justify-center space-y-3">
            <div className="p-3.5 rounded-full bg-blue-900/40 text-cyan-400 border border-blue-500/30">
              <Swords className="w-8 h-8 opacity-80" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-black text-white font-display">
                No hay desafíos activos en este momento. ¡Crea el primero!
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Al jugar una partida en modo asincrónico, tu puntuación quedará publicada aquí durante 24 horas para que otros usuarios reales compitan contra ti.
              </p>
            </div>
            <button
              onClick={() => {
                sound.playChip();
                onTriggerGameWager('stacker', 50);
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
            >
              Crear Nuevo Desafío (Apilar Bloques)
            </button>
          </div>
        ) : (
          /* REAL OPEN CHALLENGES LISTED FROM FIRESTORE */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {openRooms.map((room) => {
              const isOwnRoom = user?.uid === room.hostId;
              const remaining = formatRemainingTime(room.expiresAt);

              return (
                <div
                  key={room.id}
                  className="p-4 rounded-2xl bg-blue-950/80 hover:bg-blue-900/70 border-2 border-blue-500/40 hover:border-cyan-400 transition-all flex flex-col justify-between space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{room.hostAvatar || '😎'}</span>
                      <div>
                        <span className="text-xs font-black text-white font-display block truncate max-w-[100px]">
                          @{room.hostNick}
                        </span>
                        <span className="text-[10px] text-cyan-300 font-bold block">
                          {room.gameId === 'stacker' ? '🧱 Apilar Bloques' : '✂️ Piedra Papel Tijera'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                      {remaining}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#060c22] border border-blue-900/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block">
                        Récord a vencer
                      </span>
                      <span className="text-sm font-black text-white font-mono">
                        {room.hostScore} Bloques
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block">
                        Pozo Total
                      </span>
                      <span className="text-sm font-black text-amber-300 font-mono">
                        ${room.totalPot.toLocaleString('es-ES')} pesos
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                    <span className="text-[10px] text-slate-400 font-bold">
                      Apuesta: ${room.wager}
                    </span>
                    {isOwnRoom ? (
                      <span className="px-3 py-1.5 rounded-lg bg-blue-900/60 text-cyan-300 font-bold text-[10px] uppercase">
                        Tu Sala
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          sound.playBet();
                          onAcceptOpenRoom(room);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-[11px] uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center gap-1"
                      >
                        <Swords className="w-3 h-3" />
                        <span>Aceptar Reto</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* GAMES GRID */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-black text-white font-display uppercase tracking-wide flex items-center gap-2">
            <Layers className="w-6 h-6 text-cyan-400" />
            <span>Juegos de Apuestas Disponibles</span>
          </h2>
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            <span>Apuesta mínima siempre: $25 pesos</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {GAMES_CATALOG.map((game) => (
            <div
              key={game.id}
              onClick={() => {
                sound.playChip();
                if (game.id === 'berriesroad') {
                  onPlayBerriesRoad();
                } else if (game.id === 'mines') {
                  onPlayMines();
                } else if (game.id === 'colorclash') {
                  onPlayColorClash();
                } else if (game.id === 'blockblast') {
                  onPlayBlockBlast();
                } else if (game.id === 'pool') {
                  onPlayPool();
                } else {
                  onTriggerGameWager(game.id as 'stacker' | 'rps', 50);
                }
              }}
              className="crazy-card group relative rounded-2xl overflow-hidden border-2 border-blue-900/60 hover:border-cyan-400 bg-[#091333] cursor-pointer flex flex-col justify-between"
            >
              {/* Thumbnail Box */}
              <div className="relative aspect-video w-full overflow-hidden bg-black">
                <img
                  src={game.image}
                  alt={game.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300"
                />

                {/* Tag Badges */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-white font-black text-[10px] tracking-wider uppercase shadow-md ${
                      game.id === 'berriesroad'
                        ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 text-slate-950'
                        : game.id === 'mines'
                        ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-600'
                        : game.id === 'colorclash'
                        ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600'
                        : game.id === 'blockblast'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                        : game.id === 'pool'
                        ? 'bg-emerald-600'
                        : 'bg-blue-600'
                    }`}
                  >
                    {game.badge}
                  </span>
                </div>

                {/* Hover Overlay Button */}
                <div className="absolute inset-0 bg-blue-950/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                  <span
                    className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider shadow-xl transform scale-95 group-hover:scale-100 transition-transform ${
                      game.id === 'berriesroad'
                        ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 font-display'
                        : game.id === 'mines'
                        ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 font-display'
                        : game.id === 'colorclash'
                        ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500 text-slate-950 font-display'
                        : game.id === 'blockblast'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950'
                        : game.id === 'pool'
                        ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950'
                        : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950'
                    }`}
                  >
                    {game.id === 'berriesroad'
                      ? '🐣 JUGAR BERRIES ROAD 3D'
                      : game.id === 'mines'
                      ? '💣 JUGAR MINES CLASH'
                      : game.id === 'colorclash'
                      ? '🃏 ENTRAR A LA MESA'
                      : game.id === 'blockblast'
                      ? '🧩 JUGAR BLOCK BLAST'
                      : game.id === 'pool'
                      ? '🎱 JUGAR BILLAR'
                      : 'APOSTAR & JUGAR'}
                  </span>
                </div>
              </div>

              {/* Content Details */}
              <div className="p-5 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-cyan-300 transition-colors font-display leading-snug mb-1">
                    {game.title}
                  </h3>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-3">
                    {game.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Modalidad
                    </span>
                    <span className="text-amber-400 font-black font-mono tabular-nums text-sm">
                      {game.id === 'blockblast' ? 'Desafío 3 Min' : game.id === 'pool' ? 'Física 2D Real' : 'Desde $25 pesos'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-cyan-400 font-black group-hover:translate-x-1 transition-transform">
                    <span>
                      {game.id === 'blockblast'
                        ? 'ENTRAR AL TABLERO'
                        : game.id === 'pool'
                        ? 'ENTRAR A LA MESA'
                        : 'DIGITAR APUESTA'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

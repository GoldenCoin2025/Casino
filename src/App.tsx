/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';
import { Navbar } from './components/Navbar';
import { GameGrid } from './components/GameGrid';
import { BlockStackerGame } from './components/BlockStackerGame';
import { RPSGameTable } from './components/RPSGameTable';
import { PoolGameView } from './components/PoolGameView';
import { BlockBlastGame } from './components/BlockBlastGame';
import { ColorClashGame } from './components/ColorClashGame';
import { MinesClashGame } from './components/MinesClashGame';
import { BerriesRoadGame } from './components/BerriesRoadGame';
import { Leaderboard } from './components/Leaderboard';
import { BetHistory } from './components/BetHistory';
import { WagerMatchmakingModal } from './components/WagerMatchmakingModal';
import { PendingMatchesModal } from './components/PendingMatchesModal';
import { NotificationsModal } from './components/NotificationsModal';
import { BonusWheelModal } from './components/BonusWheelModal';
import { RulesModal } from './components/RulesModal';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { BetRecord, MIN_PVP_BET, AppNotification, RoomDocument } from './types/casino';
import { sound } from './utils/soundEffects';
import { AlertCircle, Coins, Sparkles, UserCheck, Shield } from 'lucide-react';
import confetti from 'canvas-confetti';
import { subscribeToUserRooms } from './services/matchService';

const STORAGE_KEY_BALANCE = 'berries_bet_balance';
const STORAGE_KEY_HISTORY = 'berries_bet_history';
const STORAGE_KEY_NOTIFS = 'berries_notifications';

function MainCasinoApp() {
  const { user, profile, updateBalance, recordMatch } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Local balance fallback for guests before logging in
  const [localBalance, setLocalBalance] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BALANCE);
    return saved !== null ? Math.max(0, Number(saved)) : 5000;
  });

  const effectiveBalance = profile ? profile.balance : localBalance;

  const setEffectiveBalance: React.Dispatch<React.SetStateAction<number>> = (action) => {
    if (typeof action === 'function') {
      const next = action(effectiveBalance);
      if (profile) {
        updateBalance(next);
      } else {
        setLocalBalance(next);
      }
    } else {
      if (profile) {
        updateBalance(action);
      } else {
        setLocalBalance(action);
      }
    }
  };

  // Match history
  const [history, setHistory] = useState<BetRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Real user rooms from Firestore (Pending matches with 24h timer)
  const [userRooms, setUserRooms] = useState<RoomDocument[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NOTIFS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Views: 'catalog' | 'stacker' | 'rps' | 'pool' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad' | 'history' | 'leaderboard'
  const [activeView, setActiveView] = useState<
    'catalog' | 'stacker' | 'rps' | 'pool' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad' | 'history' | 'leaderboard'
  >('catalog');

  // Wager & Matchmaking Modal State
  const [wagerModal, setWagerModal] = useState<{
    isOpen: boolean;
    gameId: 'stacker' | 'rps' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad';
    gameTitle: string;
  }>({
    isOpen: false,
    gameId: 'stacker',
    gameTitle: 'Apilar Bloques PvP (Tower Clash)',
  });

  // Active game params
  const [activeGameParams, setActiveGameParams] = useState<{
    roomId: string | null;
    wager: number;
    mode: 'live' | 'async' | 'challenge_accept';
    opponentNick?: string;
    opponentAvatar?: string;
    targetScoreToBeat?: number;
    mineIndicesSeed?: number[];
    roadSeed?: number;
  }>({
    roomId: null,
    wager: 50,
    mode: 'async',
  });

  // Modals
  const [isPendingModalOpen, setIsPendingModalOpen] = useState<boolean>(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState<boolean>(false);
  const [isWheelOpen, setIsWheelOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [authModalState, setAuthModalState] = useState<{ isOpen: boolean; mode: 'login' | 'register' }>({
    isOpen: false,
    mode: 'login',
  });
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());

  // Subscribe to real Firestore rooms for the authenticated user
  useEffect(() => {
    if (!user) {
      setUserRooms([]);
      return;
    }
    const unsubscribe = subscribeToUserRooms(user.uid, (rooms) => {
      setUserRooms(rooms);

      // Check for freshly resolved rooms to notify host
      rooms.forEach((r) => {
        if (r.status === 'completed' && !r.claimedByWinner && r.winnerId === user.uid) {
          // Add notification if not already present
          setNotifications((prev) => {
            const notifId = `win_${r.id}`;
            if (prev.some((n) => n.id === notifId)) return prev;
            return [
              {
                id: notifId,
                title: `¡Victoria en Versus Asincrónico! 🏆`,
                message: `@${r.opponentNick} aceptó tu reto de ${r.gameTitle} y anotó ${r.opponentScore} vs tus ${r.hostScore}. ¡Ganaste $${r.payout} pesos! Reclama tu premio en Partidas Pendientes.`,
                timestamp: Date.now(),
                read: false,
                type: 'win',
              },
              ...prev,
            ];
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  // Local storage persistence for history and notifications
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BALANCE, effectiveBalance.toString());
  }, [effectiveBalance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 50)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifications));
  }, [notifications]);

  // Trigger Pre-game Wager Pop-up
  const handleTriggerGameWager = (
    gameId: 'stacker' | 'rps' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad',
    defaultWager: number = 50
  ) => {
    let title = 'Apilar Bloques PvP (Tower Clash)';
    if (gameId === 'rps') title = 'Piedra, Papel o Tijera PvP Pro';
    if (gameId === 'blockblast') title = 'Block Blast Arena Pro';
    if (gameId === 'colorclash') title = 'Color Clash 4 (Cartas UNO)';
    if (gameId === 'mines') title = 'MINES CLASH 1v1 (Buscaminas PvP)';
    if (gameId === 'berriesroad') title = 'Berries Road (Voxel 3D PvP)';
    setWagerModal({
      isOpen: true,
      gameId,
      gameTitle: title,
    });
  };

  // Launch game after real matchmaking or async room creation
  const handleLaunchGame = (params: {
    roomId: string;
    wager: number;
    mode: 'live' | 'async';
    opponentNick?: string;
    opponentAvatar?: string;
    opponentRating?: number;
  }) => {
    setActiveGameParams({
      roomId: params.roomId,
      wager: params.wager,
      mode: params.mode,
      opponentNick: params.opponentNick,
      opponentAvatar: params.opponentAvatar,
    });

    if (wagerModal.gameId === 'mines') {
      setActiveView('mines');
    } else if (wagerModal.gameId === 'colorclash') {
      setActiveView('colorclash');
    } else if (wagerModal.gameId === 'blockblast') {
      setActiveView('blockblast');
    } else if (wagerModal.gameId === 'stacker') {
      setActiveView('stacker');
    } else {
      setActiveView('rps');
    }
  };

  // Accept a real open challenge from another player in the Firestore feed
  const handleAcceptOpenRoom = async (room: RoomDocument) => {
    if (!user || !profile) {
      setAuthModalState({ isOpen: true, mode: 'login' });
      return;
    }

    if (profile.balance < room.wager) {
      sound.playLoss();
      alert(`Saldo insuficiente. Necesitas $${room.wager} pesos para aceptar este desafío.`);
      return;
    }

    // Deduct wager immediately from accepting player's Firestore balance
    await updateBalance(profile.balance - room.wager);

    setActiveGameParams({
      roomId: room.id,
      wager: room.wager,
      mode: 'challenge_accept',
      opponentNick: room.hostNick,
      opponentAvatar: room.hostAvatar,
      targetScoreToBeat: room.hostScore,
      mineIndicesSeed: room.mineIndices,
      roadSeed: room.roadSeed,
    });

    if (room.gameId === 'berriesroad') {
      setActiveView('berriesroad');
    } else if (room.gameId === 'mines') {
      setActiveView('mines');
    } else if (room.gameId === 'colorclash') {
      setActiveView('colorclash');
    } else if (room.gameId === 'blockblast') {
      setActiveView('blockblast');
    } else if (room.gameId === 'stacker') {
      setActiveView('stacker');
    } else {
      setActiveView('rps');
    }
  };

  const handleMatchComplete = (record: BetRecord) => {
    setHistory((prev) => [record, ...prev]);
    if (user && profile) {
      recordMatch(record).catch(console.error);
    }
  };

  const handleAddFaucet = () => {
    sound.playJackpot();
    setEffectiveBalance((prev) => prev + 1000);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#38bdf8', '#fbbf24', '#3b82f6'],
    });
  };

  const handleRewardWheel = (amount: number) => {
    setEffectiveBalance((prev) => prev + amount);
  };

  const pendingActiveCount = userRooms.filter((r) => r.status === 'waiting_opponent').length;
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}

      <div className="min-h-screen bg-[#060c20] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
        {/* Top Navbar with Partidas Pendientes (24h) & Notifications */}
        <Navbar
          balance={effectiveBalance}
          activeView={activeView}
          setActiveView={setActiveView}
          pendingCount={pendingActiveCount}
          unreadNotificationCount={unreadNotifCount}
          onOpenPendingMatches={() => setIsPendingModalOpen(true)}
          onOpenNotifications={() => setIsNotificationsModalOpen(true)}
          onOpenWheel={() => setIsWheelOpen(true)}
          onOpenRules={() => setIsRulesOpen(true)}
          onAddFaucet={handleAddFaucet}
          onOpenAuth={(mode) => setAuthModalState({ isOpen: true, mode })}
          onOpenProfile={() => setIsProfileOpen(true)}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
        />

        {/* International Firebase Registration Callout if not logged in */}
        {!user && (
          <div className="bg-gradient-to-r from-blue-950 via-[#0d2259] to-blue-950 border-b border-cyan-500/30 px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-cyan-200 font-medium">
                <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  <strong>Registro P2P con Firebase:</strong> Regístrate con tu número de documento y correo para apostar en tiempo real contra otros jugadores y guardar tus duelos de 24h.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    sound.playChip();
                    setAuthModalState({ isOpen: true, mode: 'register' });
                  }}
                  className="px-3.5 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black tracking-wide uppercase transition-all cursor-pointer shadow-md shadow-cyan-950/60 flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Crear Cuenta Gratis (+5,000 Pesos)</span>
                </button>
                <button
                  onClick={() => {
                    sound.playChip();
                    setAuthModalState({ isOpen: true, mode: 'login' });
                  }}
                  className="px-3 py-1 rounded-lg bg-blue-900/60 hover:bg-blue-800 border border-blue-500/40 text-slate-200 font-bold transition-all cursor-pointer"
                >
                  Iniciar Sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Low Balance Alert Banner if coins are < 25 pesos */}
        {effectiveBalance < MIN_PVP_BET && (
          <div className="bg-gradient-to-r from-blue-950 via-rose-950/80 to-blue-950 border-b-2 border-rose-500 px-4 py-3">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
                <span>
                  Saldo insuficiente (${effectiveBalance} pesos). La apuesta mínima en todos los juegos es de $25 pesos.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddFaucet}
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md uppercase tracking-wider text-xs"
                >
                  <Coins className="w-4 h-4" />
                  <span>Recargar +$1,000 Pesos Gratis</span>
                </button>
                <button
                  onClick={() => setIsWheelOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold transition-all cursor-pointer flex items-center gap-1 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ruleta</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Default: CrazyGames Game Grid with Real Firestore Feed */}
          {activeView === 'catalog' && (
            <GameGrid
              onTriggerGameWager={handleTriggerGameWager}
              onAcceptOpenRoom={handleAcceptOpenRoom}
              onOpenWheel={() => setIsWheelOpen(true)}
              onPlayPool={() => setActiveView('pool')}
              onPlayBlockBlast={() => setActiveView('blockblast')}
              onPlayColorClash={() => setActiveView('colorclash')}
              onPlayMines={() => setActiveView('mines')}
              onPlayBerriesRoad={() => setActiveView('berriesroad')}
            />
          )}

          {/* NEW STAR MINIGAME: BERRIES ROAD (Voxel 3D Isometric PvP Three.js) */}
          {activeView === 'berriesroad' && (
            <BerriesRoadGame
              initialWager={activeGameParams.wager || 50}
              userBalance={effectiveBalance}
              roomId={activeGameParams.roomId}
              mode={activeGameParams.mode}
              opponentNick={activeGameParams.opponentNick}
              opponentAvatar={activeGameParams.opponentAvatar}
              targetScoreToBeat={activeGameParams.targetScoreToBeat}
              roadSeed={activeGameParams.roadSeed}
              onMatchComplete={handleMatchComplete}
              onBackToGrid={() => setActiveView('catalog')}
            />
          )}

          {/* NEW MINIGAME: MINES CLASH 1v1 (Buscaminas PvP Asíncrono) */}
          {activeView === 'mines' && (
            <MinesClashGame
              initialWager={activeGameParams.wager || 50}
              userBalance={effectiveBalance}
              roomId={activeGameParams.roomId}
              mode={activeGameParams.mode}
              opponentNick={activeGameParams.opponentNick}
              opponentAvatar={activeGameParams.opponentAvatar}
              targetScoreToBeat={activeGameParams.targetScoreToBeat}
              mineIndicesSeed={activeGameParams.mineIndicesSeed}
              onMatchComplete={handleMatchComplete}
              onBackToGrid={() => setActiveView('catalog')}
            />
          )}

          {/* NEW MINIGAME: Color Clash 4 Casino Table (UNO-style 2.5D round table) */}
          {activeView === 'colorclash' && (
            <ColorClashGame
              userBalance={effectiveBalance}
              onMatchComplete={handleMatchComplete}
              onBackToGrid={() => setActiveView('catalog')}
            />
          )}

          {/* NEW INDEPENDENT MINIGAME: Block Blast Arena Pro */}
          {activeView === 'blockblast' && (
            <BlockBlastGame
              initialWager={activeGameParams.wager || 50}
              userBalance={effectiveBalance}
              onMatchComplete={handleMatchComplete}
              onBackToGrid={() => setActiveView('catalog')}
              onPlayAgain={(wagerAmt) => {
                setActiveGameParams((p) => ({ ...p, wager: wagerAmt }));
              }}
            />
          )}

          {/* 8-Ball Pool Game View */}
          {activeView === 'pool' && (
            <PoolGameView
              onBackToCasino={() => setActiveView('catalog')}
            />
          )}

          {/* Flagship Game: Apilar Bloques PvP (Tower Stacker with Real Physics) */}
          {activeView === 'stacker' && (
            <BlockStackerGame
              key={activeGameParams.roomId || 'stacker_fresh'}
              roomId={activeGameParams.roomId}
              wager={activeGameParams.wager}
              mode={activeGameParams.mode}
              opponentNick={activeGameParams.opponentNick}
              opponentAvatar={activeGameParams.opponentAvatar}
              targetScoreToBeat={activeGameParams.targetScoreToBeat}
              userBalance={effectiveBalance}
              onMatchComplete={handleMatchComplete}
              onBackToGrid={() => setActiveView('catalog')}
              onPlayAgain={(wagerAmt) => {
                setActiveView('catalog');
                handleTriggerGameWager('stacker', Math.max(25, wagerAmt || 25));
              }}
            />
          )}

          {/* Flagship Game: Piedra Papel Tijera PvP (Mejor de 3) */}
          {activeView === 'rps' && (
            <RPSGameTable
              balance={effectiveBalance}
              setBalance={setEffectiveBalance}
              initialBet={activeGameParams.wager}
              initialOpponent={activeGameParams.opponentNick || 'Rival en Línea'}
              onMatchComplete={handleMatchComplete}
              onBackToGrid={() => setActiveView('catalog')}
              onOpenRules={() => setIsRulesOpen(true)}
            />
          )}

          {/* Leaderboard View: 100% Real Registered Players */}
          {activeView === 'leaderboard' && (
            <Leaderboard
              onChallengePlayer={(player) => {
                setActiveGameParams((p) => ({ ...p, opponentNick: player }));
                handleTriggerGameWager('stacker', 50);
              }}
            />
          )}

          {/* Bet History View */}
          {activeView === 'history' && (
            <BetHistory
              history={history}
              onPlayClick={() => setActiveView('catalog')}
            />
          )}
        </main>

        {/* CrazyGames Footer */}
        <footer className="border-t border-blue-900/60 bg-[#040817] py-8 px-4 sm:px-6 mt-12 text-xs text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="text-base font-black text-white font-display">
                  BERRIES<span className="text-cyan-400">.BET</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-cyan-300 font-bold uppercase text-[11px]">
                  ARENA DE APUESTAS P2P
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Duelos en vivo y asincrónicos con reloj de 24 horas. Apuesta mínima desde $25 pesos. Comisión 6%.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-slate-300">
              <button
                onClick={() => {
                  sound.playChip();
                  setActiveView('catalog');
                }}
                className="hover:text-cyan-400 transition-colors cursor-pointer"
              >
                🎮 Cuadrícula de Juegos
              </button>
              <button
                onClick={() => {
                  sound.playChip();
                  setActiveView('mines');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-amber-300 font-bold"
              >
                💣 Mines Clash 1v1
              </button>
              <button
                onClick={() => {
                  sound.playChip();
                  setActiveView('colorclash');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-rose-400 transition-colors cursor-pointer text-rose-300 font-bold"
              >
                🃏 Color Clash 4
              </button>
              <button
                onClick={() => {
                  sound.playChip();
                  setActiveView('blockblast');
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-amber-300 font-bold"
              >
                🧩 Block Blast Pro
              </button>
              <button
                onClick={() => {
                  sound.playChip();
                  handleTriggerGameWager('stacker', 50);
                }}
                className="hover:text-cyan-400 transition-colors cursor-pointer"
              >
                🧱 Apilar Bloques
              </button>
              <button
                onClick={() => {
                  sound.playChip();
                  handleTriggerGameWager('rps', 50);
                }}
                className="hover:text-cyan-400 transition-colors cursor-pointer"
              >
                ✂️ Piedra Papel Tijera
              </button>
              <button
                onClick={() => {
                  sound.playChip();
                  setActiveView('pool');
                }}
                className="hover:text-emerald-400 transition-colors cursor-pointer text-emerald-300"
              >
                🎱 Billar 8-Ball
              </button>
              <button
                onClick={() => {
                  sound.playChip();
                  setIsPendingModalOpen(true);
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-amber-300"
              >
                ⏳ Partidas Pendientes (24h)
              </button>
            </div>

            <div className="text-[11px] text-slate-500 text-center md:text-right">
              Pesos virtuales y BerryCoins recreativas. P2P sin bots ni simulaciones.
            </div>
          </div>
        </footer>

        {/* Pre-Game Wager & Real Firestore Matchmaking Modal */}
        <WagerMatchmakingModal
          isOpen={wagerModal.isOpen}
          gameId={wagerModal.gameId}
          gameTitle={wagerModal.gameTitle}
          userBalance={effectiveBalance}
          onClose={() => setWagerModal((w) => ({ ...w, isOpen: false }))}
          onAddFaucet={handleAddFaucet}
          onOpenAuth={(mode) => setAuthModalState({ isOpen: true, mode })}
          onStartGame={handleLaunchGame}
        />

        {/* 24-Hour Real Pending Matches Queue Modal */}
        <PendingMatchesModal
          isOpen={isPendingModalOpen}
          rooms={userRooms}
          onClose={() => setIsPendingModalOpen(false)}
        />

        {/* Notifications Modal */}
        <NotificationsModal
          isOpen={isNotificationsModalOpen}
          notifications={notifications}
          onClose={() => setIsNotificationsModalOpen(false)}
          onMarkAllAsRead={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
          }
        />

        {/* Modals */}
        <BonusWheelModal
          isOpen={isWheelOpen}
          onClose={() => setIsWheelOpen(false)}
          onReward={handleRewardWheel}
        />

        <RulesModal
          isOpen={isRulesOpen}
          onClose={() => setIsRulesOpen(false)}
        />

        <AuthModal
          isOpen={authModalState.isOpen}
          initialMode={authModalState.mode}
          onClose={() => setAuthModalState({ isOpen: false, mode: 'login' })}
        />

        <UserProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainCasinoApp />
    </AuthProvider>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BetRecord, MIN_PVP_BET } from '../types/casino';
import { sound } from '../utils/soundEffects';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  RotateCcw,
  Trophy,
  Coins,
  Flame,
  CheckCircle2,
  Play,
  RotateCw,
  Sparkles,
  AlertTriangle,
  Zap,
  Users,
  Shield,
  Layers,
  HelpCircle,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';

export type CardColor = 'red' | 'green' | 'blue' | 'yellow' | 'wild';
export type CardValue =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wild4';

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
  label: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isAi: boolean;
  cards: Card[];
  hasCalledCarta: boolean;
  penaltyAlert?: boolean;
}

const COLOR_CONFIG: Record<
  CardColor,
  {
    name: string;
    bg: string;
    border: string;
    glow: string;
    text: string;
    badgeBg: string;
    accentHex: string;
  }
> = {
  red: {
    name: 'Rojo',
    bg: 'bg-gradient-to-br from-[#ef4444] via-[#dc2626] to-[#991b1b]',
    border: 'border-[#fca5a5]',
    glow: 'rgba(239, 68, 68, 0.7)',
    text: 'text-rose-400',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    accentHex: '#ef4444',
  },
  green: {
    name: 'Verde',
    bg: 'bg-gradient-to-br from-[#22c55e] via-[#16a34a] to-[#14532d]',
    border: 'border-[#86efac]',
    glow: 'rgba(34, 197, 94, 0.7)',
    text: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    accentHex: '#22c55e',
  },
  blue: {
    name: 'Azul',
    bg: 'bg-gradient-to-br from-[#3b82f6] via-[#2563eb] to-[#1e3a8a]',
    border: 'border-[#93c5fd]',
    glow: 'rgba(59, 130, 246, 0.7)',
    text: 'text-blue-400',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    accentHex: '#3b82f6',
  },
  yellow: {
    name: 'Amarillo',
    bg: 'bg-gradient-to-br from-[#eab308] via-[#ca8a04] to-[#713f12]',
    border: 'border-[#fde047]',
    glow: 'rgba(234, 179, 8, 0.7)',
    text: 'text-amber-400',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    accentHex: '#eab308',
  },
  wild: {
    name: 'Comodín',
    bg: 'bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#020617]',
    border: 'border-fuchsia-400',
    glow: 'rgba(217, 70, 239, 0.8)',
    text: 'text-fuchsia-400',
    badgeBg: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
    accentHex: '#d946ef',
  },
};

// Generate standard deck of 108 Uno-style cards
function generateDeck(): Card[] {
  const deck: Card[] = [];
  const colors: CardColor[] = ['red', 'green', 'blue', 'yellow'];

  colors.forEach((color) => {
    // 1x 0
    deck.push({ id: `c_${color}_0`, color, value: '0', label: '0' });

    // 2x 1-9
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: `c_${color}_${i}_a`, color, value: i.toString() as CardValue, label: i.toString() });
      deck.push({ id: `c_${color}_${i}_b`, color, value: i.toString() as CardValue, label: i.toString() });
    }

    // 2x Skip, Reverse, Draw2
    deck.push({ id: `c_${color}_skip_a`, color, value: 'skip', label: '⊘' });
    deck.push({ id: `c_${color}_skip_b`, color, value: 'skip', label: '⊘' });
    deck.push({ id: `c_${color}_rev_a`, color, value: 'reverse', label: '⇄' });
    deck.push({ id: `c_${color}_rev_b`, color, value: 'reverse', label: '⇄' });
    deck.push({ id: `c_${color}_d2_a`, color, value: 'draw2', label: '+2' });
    deck.push({ id: `c_${color}_d2_b`, color, value: 'draw2', label: '+2' });
  });

  // 4x Wild & 4x Wild Draw 4
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c_wild_${i}`, color: 'wild', value: 'wild', label: '🌈' });
    deck.push({ id: `c_wild4_${i}`, color: 'wild', value: 'wild4', label: '+4' });
  }

  // Shuffle deck
  return deck.sort(() => Math.random() - 0.5);
}

interface ColorClashGameProps {
  userBalance: number;
  onMatchComplete?: (record: BetRecord) => void;
  onBackToGrid: () => void;
}

export const ColorClashGame: React.FC<ColorClashGameProps> = ({
  userBalance,
  onMatchComplete,
  onBackToGrid,
}) => {
  const { profile, updateBalance } = useAuth();

  // Settings & Lobby States
  const [gameMode, setGameMode] = useState<'betting' | 'playing' | 'game_over'>('betting');
  const [playerCount, setPlayerCount] = useState<2 | 4>(4);
  const [wager, setWager] = useState<number>(50);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(sound.getMuted());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Game Engine States
  const [deck, setDeck] = useState<Card[]>([]);
  const [discardPile, setDiscardPile] = useState<Card[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [direction, setDirection] = useState<1 | -1>(1); // 1 = clockwise, -1 = counter-clockwise
  const [activeColor, setActiveColor] = useState<CardColor>('red');
  const [activeValue, setActiveValue] = useState<CardValue>('0');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);
  const [pendingWildCard, setPendingWildCard] = useState<Card | null>(null);
  const [statusBanner, setStatusBanner] = useState<string>('');
  const [rankings, setRankings] = useState<{ player: Player; rank: number; score: number }[]>([]);
  const [humanCalledCarta, setHumanCalledCarta] = useState<boolean>(false);

  const totalPot = wager * playerCount;
  // 1v1: winner takes 94% (6% commission)
  // 4 Players: 1st place takes 70% of total pot ($140 for $50 entry), 2nd place recovers 24% ($48)
  const firstPrize = playerCount === 2 ? Math.round(totalPot * 0.94) : Math.round(totalPot * 0.70);
  const secondPrize = playerCount === 4 ? Math.round(totalPot * 0.24) : 0;
  const netPrize = firstPrize;

  // Toggle Fullscreen / Immersive mode
  const toggleFullscreen = () => {
    sound.playChip();
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {
        // Fallback CSS fullscreen
        setIsFullscreen((prev) => !prev);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Audio mute toggle
  const toggleSound = () => {
    const next = sound.toggleMute();
    setIsAudioMuted(next);
  };

  // Start new game setup
  const handleStartGame = async () => {
    const curBal = profile ? profile.balance : userBalance;
    if (curBal < wager) {
      sound.playLoss();
      alert(`Saldo insuficiente ($${curBal} créditos). Necesitas $${wager} para ingresar.`);
      return;
    }

    sound.playBet();
    await updateBalance(curBal - wager);

    // Build fresh shuffled deck
    const newDeck = generateDeck();

    // Define participants
    const humanName = profile?.username || 'Tú';
    const humanAvatar = profile?.avatar || '😎';

    const pList: Player[] = [
      { id: 'human', name: humanName, avatar: humanAvatar, isAi: false, cards: [], hasCalledCarta: false },
      { id: 'ai_1', name: 'Dusty Bot', avatar: '🤖', isAi: true, cards: [], hasCalledCarta: false },
    ];

    if (playerCount === 4) {
      pList.push(
        { id: 'ai_2', name: 'Pudding AI', avatar: '👾', isAi: true, cards: [], hasCalledCarta: false },
        { id: 'ai_3', name: 'Luna Bot', avatar: '🦊', isAi: true, cards: [], hasCalledCarta: false }
      );
    }

    // Deal 7 cards to each player
    pList.forEach((p) => {
      p.cards = newDeck.splice(0, 7);
    });

    // Draw initial discard card (must not be wild4)
    let firstCard = newDeck.pop()!;
    while (firstCard.value === 'wild4') {
      newDeck.unshift(firstCard);
      firstCard = newDeck.pop()!;
    }

    const initialColor = firstCard.color === 'wild' ? 'red' : firstCard.color;

    setDeck(newDeck);
    setDiscardPile([firstCard]);
    setPlayers(pList);
    setCurrentTurn(0);
    setDirection(1);
    setActiveColor(initialColor);
    setActiveValue(firstCard.value);
    setHumanCalledCarta(false);
    setStatusBanner('¡Partida iniciada! Es tu turno.');
    setGameMode('playing');
  };

  // Check if a card can be placed over current active color/value
  const isCardPlayable = (card: Card) => {
    if (card.color === 'wild') return true;
    if (card.color === activeColor) return true;
    if (card.value === activeValue) return true;
    return false;
  };

  // Advance turn to next player
  const advanceTurn = (skipCount: number = 1) => {
    setCurrentTurn((prev) => {
      const total = players.length;
      const next = (prev + direction * skipCount + total * 10) % total;
      return next;
    });
  };

  // Check victory / finish condition
  const checkVictory = (currentPlayers: Player[]) => {
    const winnerIndex = currentPlayers.findIndex((p) => p.cards.length === 0);
    if (winnerIndex !== -1) {
      const winner = currentPlayers[winnerIndex];

      // Build rankings sorted by card count
      const sorted = [...currentPlayers].sort((a, b) => a.cards.length - b.cards.length);
      const ranked = sorted.map((p, idx) => ({
        player: p,
        rank: idx + 1,
        score: p.cards.reduce((acc, c) => acc + (c.color === 'wild' ? 50 : 10), 0),
      }));

      setRankings(ranked);
      setGameMode('game_over');

      const humanRankObj = ranked.find((r) => r.player.id === 'human');
      const humanRank = humanRankObj?.rank || 4;

      if (humanRank === 1) {
        sound.playWin();
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        const wonAmt = firstPrize;
        const nextBal = (profile ? profile.balance : userBalance) + wonAmt;
        updateBalance(nextBal).catch(console.error);

        onMatchComplete?.({
          id: `bet_uno_${Date.now()}`,
          timestamp: Date.now(),
          gameTitle: `Color Clash 4 (${playerCount}J)`,
          opponentName: playerCount === 2 ? 'Dusty Bot (1v1)' : 'Mesa 4 Jugadores',
          result: 'win',
          betAmount: wager,
          payout: wonAmt,
          netProfit: wonAmt - wager,
          finalScore: '1° Lugar - Ganador del Pozo Mayor',
        });
      } else if (playerCount === 4 && humanRank === 2) {
        // 2nd place in 4-players recovers entry
        sound.playWin();
        const wonAmt = secondPrize;
        const nextBal = (profile ? profile.balance : userBalance) + wonAmt;
        updateBalance(nextBal).catch(console.error);

        onMatchComplete?.({
          id: `bet_uno_${Date.now()}`,
          timestamp: Date.now(),
          gameTitle: `Color Clash 4 (${playerCount}J)`,
          opponentName: 'Mesa 4 Jugadores',
          result: 'win',
          betAmount: wager,
          payout: wonAmt,
          netProfit: wonAmt - wager,
          finalScore: '2° Lugar - Reembolso Parcial',
        });
      } else {
        sound.playLoss();
        onMatchComplete?.({
          id: `bet_uno_${Date.now()}`,
          timestamp: Date.now(),
          gameTitle: `Color Clash 4 (${playerCount}J)`,
          opponentName: playerCount === 2 ? 'Dusty Bot (1v1)' : 'Mesa 4 Jugadores',
          result: 'loss',
          betAmount: wager,
          payout: 0,
          netProfit: -wager,
          finalScore: `${humanRank}° Lugar`,
        });
      }
      return true;
    }
    return false;
  };

  // Human plays card
  const handleHumanPlayCard = (card: Card) => {
    if (currentTurn !== 0) return;
    if (!isCardPlayable(card)) {
      sound.playLoss();
      return;
    }

    // Check "¡CARTA!" (Uno) rule: if human will be left with 1 card and hasn't called CARTA
    if (players[0].cards.length === 2 && !humanCalledCarta) {
      sound.playUnoCall();
      alert('¡PENALIZACIÓN! No cantaste "¡CARTA!" antes de tirar tu penúltima carta. Robas +2 cartas automáticas.');
      // Penalty: Draw 2 cards and keep the played card
      drawCardsForPlayer(0, 2);
      return;
    }

    if (card.color === 'wild') {
      setPendingWildCard(card);
      setIsColorPickerOpen(true);
      return;
    }

    executePlayCard(0, card, card.color);
  };

  // Execute card play (human or AI)
  const executePlayCard = (playerIdx: number, card: Card, chosenColor: CardColor) => {
    sound.playCardPlay();

    // 1. Remove card from player hand
    const nextPlayers = players.map((p, idx) => {
      if (idx !== playerIdx) return p;
      return {
        ...p,
        cards: p.cards.filter((c) => c.id !== card.id),
      };
    });

    // 2. Add to discard pile
    setDiscardPile((prev) => [card, ...prev]);
    setActiveColor(chosenColor);
    setActiveValue(card.value);
    setPlayers(nextPlayers);

    // Check if player won
    if (checkVictory(nextPlayers)) return;

    // Reset human called carta if played
    if (playerIdx === 0) setHumanCalledCarta(false);

    // 3. Handle Special Action Cards
    let skipCount = 1;

    if (card.value === 'skip') {
      sound.playReverseSkip();
      setStatusBanner(`¡${players[playerIdx].name} usó Salteo! El siguiente jugador pierde el turno.`);
      skipCount = 2;
    } else if (card.value === 'reverse') {
      sound.playReverseSkip();
      if (players.length === 2) {
        setStatusBanner(`¡${players[playerIdx].name} usó Reversa en 1v1! Vuelve a ser su turno.`);
        skipCount = 2; // in 2p acts like skip
      } else {
        setDirection((d) => (d === 1 ? -1 : 1));
        setStatusBanner(`¡${players[playerIdx].name} cambió el sentido de la mesa!`);
      }
    } else if (card.value === 'draw2') {
      sound.playCardDraw();
      const victimIdx = (playerIdx + direction + players.length) % players.length;
      setStatusBanner(`¡${players[playerIdx].name} tiró +2! ${players[victimIdx].name} roba 2 cartas.`);
      drawCardsForPlayer(victimIdx, 2);
      skipCount = 2;
    } else if (card.value === 'wild4') {
      sound.playWildCard();
      const victimIdx = (playerIdx + direction + players.length) % players.length;
      setStatusBanner(`¡${players[playerIdx].name} tiró +4 y cambió a ${COLOR_CONFIG[chosenColor].name}! ${players[victimIdx].name} roba 4 cartas.`);
      drawCardsForPlayer(victimIdx, 4);
      skipCount = 2;
    } else if (card.value === 'wild') {
      sound.playWildCard();
      setStatusBanner(`¡${players[playerIdx].name} cambió de color a ${COLOR_CONFIG[chosenColor].name}!`);
    }

    advanceTurn(skipCount);
  };

  // Draw cards from draw pile for a specific player
  const drawCardsForPlayer = (playerIdx: number, count: number) => {
    let currentDeck = [...deck];
    let currentDiscard = [...discardPile];

    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      if (currentDeck.length === 0) {
        // Reshuffle discard pile into deck except top card
        const topCard = currentDiscard.shift()!;
        currentDeck = currentDiscard.sort(() => Math.random() - 0.5);
        currentDiscard = [topCard];
      }
      if (currentDeck.length > 0) {
        drawn.push(currentDeck.pop()!);
      }
    }

    setDeck(currentDeck);
    setDiscardPile(currentDiscard);

    setPlayers((prev) =>
      prev.map((p, idx) => (idx === playerIdx ? { ...p, cards: [...p.cards, ...drawn] } : p))
    );
  };

  // Human draws 1 card manually from pile
  const handleHumanDraw = () => {
    if (currentTurn !== 0) return;
    sound.playCardDraw();
    drawCardsForPlayer(0, 1);
    setStatusBanner('Robaste 1 carta. Pasando turno...');
    advanceTurn(1);
  };

  // Button "¡CARTA!" (UNO!) trigger
  const handleCallCarta = () => {
    sound.playUnoCall();
    setHumanCalledCarta(true);
    setStatusBanner('¡Cantaste "¡CARTA!" a tiempo!');
  };

  // Color picker selection confirmation
  const handleChooseColor = (color: CardColor) => {
    if (!pendingWildCard) return;
    setIsColorPickerOpen(false);
    executePlayCard(0, pendingWildCard, color);
    setPendingWildCard(null);
  };

  // AI Turn Logic Loop
  useEffect(() => {
    if (gameMode !== 'playing') return;
    if (currentTurn === 0) return; // Human turn

    const activeAi = players[currentTurn];
    if (!activeAi || !activeAi.isAi) return;

    // AI takes a natural thinking delay (1500ms to 2200ms) for casino poker/cards suspense
    const aiDelay = Math.floor(Math.random() * 700) + 1500;
    const aiTimer = setTimeout(() => {
      // 1. Check if AI should call CARTA if having 2 cards
      if (activeAi.cards.length === 2 && Math.random() < 0.9) {
        sound.playUnoCall();
        setStatusBanner(`¡${activeAi.name} cantó "¡CARTA!"! Le queda 1 sola carta.`);
      }

      // 2. Find playable cards
      const playable = activeAi.cards.filter((c) => isCardPlayable(c));

      if (playable.length > 0) {
        // AI Strategy: prioritize matching action cards or frequent color
        const cardToPlay = playable[Math.floor(Math.random() * playable.length)];

        // If wild, pick the color AI has the most of
        let chosenColor: CardColor = 'red';
        if (cardToPlay.color === 'wild') {
          const colorCounts: Record<string, number> = { red: 0, green: 0, blue: 0, yellow: 0 };
          activeAi.cards.forEach((c) => {
            if (c.color !== 'wild') colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
          });
          const bestColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0][0] as CardColor;
          chosenColor = bestColor || 'blue';
        } else {
          chosenColor = cardToPlay.color;
        }

        executePlayCard(currentTurn, cardToPlay, chosenColor);
      } else {
        // AI has no playable card -> draws 1
        sound.playCardDraw();
        drawCardsForPlayer(currentTurn, 1);
        setStatusBanner(`${activeAi.name} no tenía cartas válidas y robó del mazo.`);
        advanceTurn(1);
      }
    }, aiDelay);

    return () => clearTimeout(aiTimer);
  }, [currentTurn, gameMode, players, activeColor, activeValue]);

  // Card component helper
  const renderCardVisual = (card: Card, isPlayable: boolean, onClick?: () => void) => {
    const cfg = COLOR_CONFIG[card.color];
    return (
      <div
        key={card.id}
        onClick={onClick}
        className={`relative w-20 h-28 sm:w-24 sm:h-36 rounded-2xl ${cfg.bg} border-2 ${cfg.border} shadow-xl flex flex-col justify-between p-2 select-none transition-all duration-200 ${
          onClick ? 'cursor-pointer hover:-translate-y-4 hover:scale-105 active:scale-95' : ''
        } ${
          isPlayable
            ? 'ring-4 ring-white/80 shadow-cyan-500/50 -translate-y-1'
            : 'opacity-70 grayscale-30'
        }`}
        style={{ boxShadow: isPlayable ? `0 10px 25px ${cfg.glow}` : undefined }}
      >
        {/* Top left mini-value */}
        <span className="text-xs sm:text-sm font-black font-mono text-white leading-none">
          {card.label}
        </span>

        {/* Center Oval with Big Value */}
        <div className="w-12 h-16 sm:w-16 sm:h-20 mx-auto rounded-full bg-white/95 border-2 border-black/10 flex items-center justify-center shadow-inner transform -rotate-12">
          <span
            className={`text-2xl sm:text-3xl font-black font-display drop-shadow-md ${
              card.color === 'wild' ? 'text-fuchsia-600' : cfg.text
            }`}
          >
            {card.label}
          </span>
        </div>

        {/* Bottom right mini-value rotated */}
        <span className="text-xs sm:text-sm font-black font-mono text-white leading-none self-end rotate-180">
          {card.label}
        </span>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-5xl mx-auto flex flex-col items-center select-none text-slate-100 font-sans min-h-[640px] transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 max-w-none bg-[#030717] p-2 sm:p-4 justify-between overflow-y-auto' : ''
      }`}
    >
      {/* TOP HEADER CONTROLS */}
      <div className="w-full flex items-center justify-between gap-3 mb-3 p-3 rounded-2xl bg-[#081230]/90 border border-blue-500/30 backdrop-blur-md shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sound.playChip();
              if (isFullscreen && document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              }
              onBackToGrid();
            }}
            className="px-3 py-1.5 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-600/40 text-xs font-bold text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>Volver al Casino</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Color Badge */}
          {gameMode === 'playing' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#060c22] border border-white/20">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Color Activo:</span>
              <span className={`w-3.5 h-3.5 rounded-full ${COLOR_CONFIG[activeColor].bg} shadow-md`} />
              <span className={`text-xs font-black ${COLOR_CONFIG[activeColor].text}`}>
                {COLOR_CONFIG[activeColor].name}
              </span>
            </div>
          )}

          {/* User balance */}
          <div className="px-3 py-1 rounded-xl bg-blue-950/80 border border-amber-500/40 flex items-center gap-1.5 text-xs font-mono font-black text-amber-300">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>${(profile ? profile.balance : userBalance).toLocaleString('es-ES')}</span>
          </div>

          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-600/40 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isAudioMuted ? 'Activar sonido' : 'Silenciar sonido'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-600/40 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa inmersiva'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </div>

      {/* LOBBY / PRE-GAME WAGER & PLAYERS SELECTOR */}
      {gameMode === 'betting' && (
        <div className="w-full max-w-md bg-gradient-to-b from-[#0e1d4d] via-[#091436] to-[#050d26] border-2 border-cyan-400/50 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-cyan-950/80 space-y-5 my-4 animate-in fade-in">
          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>NUEVO JUEGO DE CARTAS EN MESA REDONDA</span>
            </span>
            <h2 className="text-3xl font-black text-white font-display uppercase tracking-tight">
              COLOR CLASH <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">4 CASINO</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
              Duelos de cartas tipo UNO con mesa redonda 2.5D. Salteos, reversas, +2, +4 y botón de aviso "¡CARTA!".
            </p>
          </div>

          {/* Mode Selector: 2 Players vs 4 Players */}
          <div className="p-4 rounded-2xl bg-[#060e28] border border-blue-600/40 space-y-2 text-left">
            <label className="text-xs font-black uppercase text-cyan-300 tracking-wide block">
              Modalidad de Mesa:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  sound.playChip();
                  setPlayerCount(2);
                }}
                className={`py-3 px-3 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  playerCount === 2
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 border-cyan-300 text-slate-950 shadow-md'
                    : 'bg-blue-950/60 border-blue-600/40 text-slate-300 hover:bg-blue-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>1v1 (2 Jugadores)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playChip();
                  setPlayerCount(4);
                }}
                className={`py-3 px-3 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  playerCount === 4
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 border-cyan-300 text-slate-950 shadow-md'
                    : 'bg-blue-950/60 border-blue-600/40 text-slate-300 hover:bg-blue-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Mesa 4 Jugadores</span>
              </button>
            </div>
          </div>

          {/* Wager Selector */}
          <div className="p-4 rounded-2xl bg-[#060e28] border border-blue-600/40 space-y-2 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black uppercase text-cyan-300 tracking-wide">Valor de Entrada:</span>
              <span className="text-slate-400 font-mono">Mínimo $25</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    sound.playChip();
                    setWager(amt);
                  }}
                  className={`py-2 rounded-xl text-xs font-mono font-black border transition-all cursor-pointer ${
                    wager === amt
                      ? 'bg-amber-400 text-slate-950 border-white shadow-md scale-105'
                      : 'bg-blue-950/80 text-cyan-200 border-blue-600/40 hover:bg-blue-900'
                  }`}
                >
                  ${amt} pesos
                </button>
              ))}
            </div>

            {/* Pot Calculation Breakdown */}
            <div className="mt-3 p-3 rounded-xl bg-blue-950/40 border border-white/5 space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span>Pozo Acumulado ({playerCount}×):</span>
                <span className="text-amber-300 font-black text-sm">${totalPot} pesos</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-emerald-400 pt-1 border-t border-white/5 font-bold">
                <span>1° Lugar (Ganador {playerCount === 2 ? '94%' : '70%'}):</span>
                <span className="text-sm font-black text-emerald-300">${firstPrize} pesos</span>
              </div>
              {playerCount === 4 && (
                <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold">
                  <span>2° Lugar (Recupera 24%):</span>
                  <span className="font-mono text-cyan-200 font-black">${secondPrize} pesos</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleStartGame}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-orange-950/60 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>APOSTAR & ENTRAR A LA MESA (${wager} PESOS)</span>
          </button>
        </div>
      )}

      {/* 2.5D ROUND CASINO TABLE VIEW (MATCHING USER SCREENSHOT) */}
      {gameMode === 'playing' && (
        <div className="relative w-full max-w-4xl h-[580px] sm:h-[620px] rounded-3xl overflow-hidden border-4 border-[#243566] bg-gradient-to-b from-[#050b1f] via-[#09153a] to-[#040817] shadow-2xl flex flex-col justify-between p-4 my-2">
          {/* Status Alert Banner */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-blue-950/90 border border-cyan-400/50 shadow-md text-xs font-black text-cyan-200 tracking-wide flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{statusBanner}</span>
          </div>

          {/* 2.5D PERSPECTIVE OVAL CASINO TABLE FELT */}
          <div
            className="absolute inset-x-8 sm:inset-x-16 top-16 bottom-24 rounded-[120px] border-4 border-amber-500/40 shadow-[0_0_80px_rgba(234,179,8,0.25)] flex items-center justify-center transition-colors duration-500 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at center, ${COLOR_CONFIG[activeColor].accentHex}25 0%, #071536 70%, #030818 100%)`,
            }}
          >
            {/* Animated Direction Arrows Indicator */}
            <div className="relative w-48 h-48 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center animate-spin [animation-duration:25s]">
              <RotateCw className="w-12 h-12 text-white/20" />
            </div>
          </div>

          {/* OPPONENT PLAYERS AROUND THE TABLE */}
          {/* Top Opponent (AI 1 or Dusty) */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`p-2 rounded-2xl flex items-center gap-2 transition-all ${
                currentTurn === (playerCount === 2 ? 1 : 2)
                  ? 'bg-amber-400/20 border-2 border-amber-400 shadow-lg shadow-amber-400/40 scale-105 animate-pulse'
                  : 'bg-blue-950/80 border border-blue-500/30'
              }`}
            >
              <span className="text-2xl">{players[playerCount === 2 ? 1 : 2]?.avatar}</span>
              <div className="text-left">
                <span className="text-xs font-black text-white block">
                  {players[playerCount === 2 ? 1 : 2]?.name}
                </span>
                <span className="text-[10px] text-cyan-300 font-mono font-bold block">
                  {players[playerCount === 2 ? 1 : 2]?.cards.length} cartas
                </span>
              </div>
            </div>

            {/* Fanned Back-Cards of Top Opponent */}
            <div className="flex items-center -space-x-4 mt-1">
              {players[playerCount === 2 ? 1 : 2]?.cards.slice(0, 7).map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-14 rounded-lg bg-gradient-to-br from-red-600 via-rose-700 to-red-950 border-2 border-white/70 shadow-md transform rotate-[-4deg]"
                />
              ))}
            </div>
          </div>

          {/* 4-PLAYER MODE: LEFT AND RIGHT OPPONENTS */}
          {playerCount === 4 && (
            <div className="relative z-10 w-full flex items-center justify-between px-2">
              {/* Left Opponent (AI 1 - Dusty) */}
              <div
                className={`p-2 rounded-2xl flex items-center gap-2 transition-all ${
                  currentTurn === 1
                    ? 'bg-amber-400/20 border-2 border-amber-400 shadow-lg shadow-amber-400/40 scale-105 animate-pulse'
                    : 'bg-blue-950/80 border border-blue-500/30'
                }`}
              >
                <span className="text-2xl">{players[1]?.avatar}</span>
                <div className="text-left">
                  <span className="text-xs font-black text-white block">{players[1]?.name}</span>
                  <span className="text-[10px] text-cyan-300 font-mono font-bold block">
                    {players[1]?.cards.length} cartas
                  </span>
                </div>
              </div>

              {/* Right Opponent (AI 3 - Luna) */}
              <div
                className={`p-2 rounded-2xl flex items-center gap-2 transition-all ${
                  currentTurn === 3
                    ? 'bg-amber-400/20 border-2 border-amber-400 shadow-lg shadow-amber-400/40 scale-105 animate-pulse'
                    : 'bg-blue-950/80 border border-blue-500/30'
                }`}
              >
                <div className="text-right">
                  <span className="text-xs font-black text-white block">{players[3]?.name}</span>
                  <span className="text-[10px] text-cyan-300 font-mono font-bold block">
                    {players[3]?.cards.length} cartas
                  </span>
                </div>
                <span className="text-2xl">{players[3]?.avatar}</span>
              </div>
            </div>
          )}

          {/* CENTER TABLE: DRAW PILE & ACTIVE DISCARD PILE */}
          <div className="relative z-10 flex items-center justify-center gap-6 my-auto">
            {/* Draw Pile with 3D Stack Volume */}
            <div
              onClick={handleHumanDraw}
              className={`relative group cursor-pointer transition-transform ${
                currentTurn === 0 ? 'hover:scale-105 active:scale-95' : 'opacity-80 pointer-events-none'
              }`}
              title="Toca para robar una carta del mazo"
            >
              {/* Stack effect */}
              <div className="absolute -top-1 -left-1 w-20 h-28 sm:w-24 sm:h-36 rounded-2xl bg-red-900 border border-white/20" />
              <div className="absolute -top-2 -left-2 w-20 h-28 sm:w-24 sm:h-36 rounded-2xl bg-red-800 border border-white/30" />
              <div className="relative w-20 h-28 sm:w-24 sm:h-36 rounded-2xl bg-gradient-to-br from-red-600 via-rose-700 to-red-950 border-2 border-white shadow-2xl flex flex-col items-center justify-center p-2">
                <span className="text-xs font-black text-white uppercase tracking-wider mb-1">Mazo</span>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
                  🎴
                </div>
                <span className="text-[10px] font-mono text-amber-300 font-bold mt-1">
                  Robar ({deck.length})
                </span>
              </div>
            </div>

            {/* Active Discard Pile */}
            <div className="relative">
              {discardPile[0] ? (
                renderCardVisual(discardPile[0], true)
              ) : (
                <div className="w-20 h-28 rounded-2xl border-2 border-dashed border-white/30" />
              )}
            </div>
          </div>

          {/* HUMAN PLAYER'S HAND & CONTROLS (BOTTOM AREA) */}
          <div className="relative z-10 w-full flex flex-col items-center">
            {/* Turn & Player Badge */}
            <div className="flex items-center justify-between w-full max-w-xl mb-1 px-2">
              <div
                className={`px-3 py-1 rounded-full flex items-center gap-2 transition-all ${
                  currentTurn === 0
                    ? 'bg-amber-400/20 border-2 border-amber-400 shadow-md animate-pulse'
                    : 'bg-blue-950/60 border border-blue-500/30'
                }`}
              >
                <span className="text-lg">{players[0]?.avatar}</span>
                <span className="text-xs font-black text-white">
                  {currentTurn === 0 ? '👉 ¡TU TURNO DE TIRAR!' : 'Esperando a los rivales...'}
                </span>
              </div>

              {/* Botón "¡CARTA!" (Uno!) */}
              <button
                onClick={handleCallCarta}
                className={`px-4 py-1.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center gap-1.5 ${
                  humanCalledCarta
                    ? 'bg-emerald-500 text-slate-950 border-2 border-white shadow-emerald-500/50 scale-105'
                    : players[0]?.cards.length <= 2
                    ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 border-2 border-white animate-bounce'
                    : 'bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 text-slate-300'
                }`}
              >
                <Flame className="w-4 h-4 text-amber-300" />
                <span>{humanCalledCarta ? '¡CARTA CANTADA! ✓' : '¡CANTAR CARTA!'}</span>
              </button>
            </div>

            {/* Fanned Interactive Card Hand */}
            <div className="w-full overflow-x-auto py-3 px-4 flex items-end justify-center -space-x-5 sm:-space-x-8 scrollbar-none">
              {players[0]?.cards.map((card) => {
                const playable = currentTurn === 0 && isCardPlayable(card);
                return (
                  <div key={card.id} className="transition-transform duration-200">
                    {renderCardVisual(card, playable, () => handleHumanPlayCard(card))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* COLOR PICKER MODAL (FOR WILD CARDS) */}
      {isColorPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
          <div className="w-full max-w-sm bg-gradient-to-b from-[#0e1d4d] via-[#091436] to-[#050d26] border-2 border-fuchsia-400/60 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <span className="text-xs font-black uppercase text-fuchsia-300 tracking-wider">
              COMODÍN ESPECIAL
            </span>
            <h3 className="text-xl font-black text-white font-display">
              Elige el Nuevo Color Activo:
            </h3>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {(['red', 'green', 'blue', 'yellow'] as CardColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleChooseColor(c)}
                  className={`py-4 rounded-2xl font-black text-sm uppercase tracking-wide border-2 transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95 ${COLOR_CONFIG[c].bg} ${COLOR_CONFIG[c].border} text-white`}
                >
                  {COLOR_CONFIG[c].name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL (GLASSMORPHISM WITH ACCURATE RESULTS) */}
      {gameMode === 'game_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in select-none">
          <div className="relative w-full max-w-md bg-gradient-to-b from-[#0e1d4d]/95 via-[#091436]/95 to-[#050d26]/95 border-2 border-cyan-400/60 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-cyan-950/90 space-y-5 animate-in zoom-in-95">
            <div className="space-y-1">
              <span className="px-3.5 py-1 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>COLOR CLASH CASINO</span>
              </span>
              <h3 className="text-3xl font-black text-white font-display tracking-tight">
                {rankings[0]?.player.id === 'human' ? '¡Victoria Épica! 🏆' : '¡Partida Finalizada!'}
              </h3>
              <p className="text-xs text-slate-400">
                {rankings[0]?.player.id === 'human'
                  ? `¡Te quedaste sin cartas primero y ganaste el Pozo Acumulado de $${netPrize} pesos!`
                  : `${rankings[0]?.player.name} se quedó sin cartas primero.`}
              </p>
            </div>

            {/* Table Standings (1°, 2°, 3°, 4°) */}
            <div className="p-4 rounded-2xl bg-[#060e28]/90 border-2 border-blue-600/40 space-y-2 text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-mono">
                Tabla de Posiciones de la Mesa:
              </span>
              <div className="space-y-1.5">
                {rankings.map((r) => (
                  <div
                    key={r.player.id}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono ${
                      r.player.id === 'human'
                        ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-bold'
                        : 'bg-blue-950/40 border border-white/5 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-black text-amber-400 w-4">{r.rank}°</span>
                      <span className="text-base">{r.player.avatar}</span>
                      <span>{r.player.name}</span>
                    </div>
                    <span>{r.player.cards.length} cartas restantes</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Result */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/90 to-cyan-950/90 border border-amber-500/40 text-left space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Entrada Apostada:</span>
                <span className="font-bold text-slate-200">${wager} pesos</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-1">
                <span className="text-slate-300">Premio Obtenido:</span>
                <span className="font-black text-amber-300 text-sm">
                  ${rankings.find((r) => r.player.id === 'human')?.rank === 1
                    ? firstPrize
                    : playerCount === 4 && rankings.find((r) => r.player.id === 'human')?.rank === 2
                    ? secondPrize
                    : 0}{' '}
                  pesos
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => setGameMode('betting')}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-orange-950/60 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>JUGAR NUEVA PARTIDA / REVANCHA</span>
              </button>

              <button
                onClick={() => {
                  sound.playChip();
                  onBackToGrid();
                }}
                className="w-full py-3 rounded-2xl bg-blue-950/80 hover:bg-blue-900 border border-blue-600/40 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                VOLVER AL CASINO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

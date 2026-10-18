export type RPSMove = 'piedra' | 'papel' | 'tijera';

export type GameResult = 'win' | 'loss' | 'tie';

export interface MoveConfig {
  id: RPSMove;
  name: string;
  subtitle: string;
  beats: RPSMove;
  beatsText: string;
  icon: string;
  glowColor: string;
  borderColor: string;
  badgeBg: string;
  elementEffect: string;
}

export const MOVES_CONFIG: Record<RPSMove, MoveConfig> = {
  piedra: {
    id: 'piedra',
    name: 'Piedra Titánica',
    subtitle: 'Impacto Sísmico',
    beats: 'tijera',
    beatsText: 'Aplasta Tijeras Láser',
    icon: '💎',
    glowColor: 'shadow-amber-500/50',
    borderColor: 'border-amber-400 group-hover:border-amber-300',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    elementEffect: 'from-amber-600/30 via-orange-600/20 to-transparent',
  },
  papel: {
    id: 'papel',
    name: 'Pergamino Astral',
    subtitle: 'Energía Holográfica',
    beats: 'piedra',
    beatsText: 'Envuelve Piedra Titánica',
    icon: '📜',
    glowColor: 'shadow-cyan-500/50',
    borderColor: 'border-cyan-400 group-hover:border-cyan-300',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    elementEffect: 'from-cyan-600/30 via-blue-600/20 to-transparent',
  },
  tijera: {
    id: 'tijera',
    name: 'Tijeras Láser',
    subtitle: 'Filo Cuántico',
    beats: 'papel',
    beatsText: 'Corta Pergamino Astral',
    icon: '✂️',
    glowColor: 'shadow-rose-500/50',
    borderColor: 'border-rose-400 group-hover:border-rose-300',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    elementEffect: 'from-rose-600/30 via-pink-600/20 to-transparent',
  },
};

export interface RoundRecord {
  round: number;
  playerMove: RPSMove;
  opponentMove: RPSMove;
  winner: 'player' | 'opponent' | 'tie';
}

export interface BetRecord {
  id: string;
  timestamp: number;
  gameTitle: string;
  opponentName: string;
  result: 'win' | 'loss' | 'tie';
  betAmount: number;
  payout: number;
  netProfit: number;
  finalScore: string;
}

export interface CatalogGame {
  id: string;
  title: string;
  category: 'pvp' | 'popular' | 'fast' | 'high_stakes';
  badge: string;
  minBet: number;
  activePlayers: number;
  image: string;
  description: string;
  isPlayable: boolean;
  featured?: boolean;
}

// Minimum bet across all games is 25 pesos / BerryCoins
export const MIN_PVP_BET = 25;

export interface PendingMatch {
  id: string;
  gameId: 'stacker' | 'rps' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad' | 'knifeclash';
  gameTitle: string;
  wager: number;
  playerScore: number;
  playerNick: string;
  playerAvatar: string;
  createdAt: number;
  expiresAt: number; // 24h duration
  status: 'waiting' | 'accepted' | 'refunded';
  mineIndices?: number[];
  roadSeed?: number;
  knifeSeed?: number;
  opponentNick?: string;
  opponentAvatar?: string;
  opponentScore?: number;
  winnerNick?: string;
  payout?: number;
}

export interface RoomDocument {
  id: string;
  gameId: 'stacker' | 'rps' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad' | 'knifeclash';
  gameTitle: string;
  wager: number;
  totalPot: number; // wager * 2
  payout: number; // wager * 2 * 0.94 (6% commission deducted)
  status: 'waiting' | 'playing' | 'waiting_opponent' | 'completed' | 'expired';
  hostId: string;
  hostNick: string;
  hostAvatar: string;
  hostRating?: number;
  hostScore: number;
  mineIndices?: number[]; // Exact 3 mine locations for same-seed PvP
  roadSeed?: number; // Exact procedural seed for Berries Road PvP
  knifeSeed?: number; // Exact procedural seed for Knife Clash PvP
  opponentId?: string | null;
  opponentNick?: string | null;
  opponentAvatar?: string | null;
  opponentRating?: number | null;
  opponentScore?: number | null;
  winnerId?: string | null;
  winnerNick?: string | null;
  claimedByWinner?: boolean;
  isRefunded?: boolean;
  hostReaction?: string | null;
  opponentReaction?: string | null;
  createdAt: unknown;
  createdMs: number;
  expiresAt: number;
  completedAt?: unknown;
}

export interface ClashEmote {
  id: string;
  emoji: string;
  label: string;
}

export const CLASH_EMOTES: ClashEmote[] = [
  { id: 'king', emoji: '👑', label: 'Rey Ganador' },
  { id: 'skull', emoji: '💀', label: 'Calavera' },
  { id: 'fire', emoji: '🔥', label: 'Fuego Épico' },
  { id: 'applause', emoji: '👏', label: 'Aplauso' },
  { id: 'crying', emoji: '😭', label: 'Llanto' },
  { id: 'cool', emoji: '😎', label: 'Gafas Pro' },
];

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  type: 'win' | 'loss' | 'refund' | 'challenge';
}

export interface PlayerStats {
  totalRounds: number;
  wins: number;
  losses: number;
  ties: number;
  totalWagered: number;
  highestWin: number;
  currentStreak: number;
  highestStreak: number;
}

export interface VIPTier {
  name: string;
  level: number;
  minWager: number;
  tagColor: string;
  perk: string;
}

export const VIP_TIERS: VIPTier[] = [
  { name: 'Bronze Berry', level: 1, minWager: 0, tagColor: 'text-amber-500', perk: 'Bono base + Ruleta activa' },
  { name: 'Silver Berry', level: 2, minWager: 500, tagColor: 'text-slate-300', perk: 'Multiplicador racha x2.2' },
  { name: 'Ruby High Roller', level: 3, minWager: 2500, tagColor: 'text-rose-400', perk: 'Recarga express + Bono VIP' },
  { name: 'Diamond Berries Elite', level: 4, minWager: 10000, tagColor: 'text-cyan-300', perk: 'Multiplicador Jackpot x3.0' },
];

export const CHIP_DENOMINATIONS = [25, 50, 100, 250, 500, 1000] as const;

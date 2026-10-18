import { RPSMove } from '../types/casino';

/**
 * Provably fair engine simulation.
 * In production crypto casinos, a SHA-256 HMAC of serverSeed + clientSeed + nonce determines the outcome.
 */

// Simple robust string hashing for client demonstration
export function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // Return pseudo-SHA256 64-char lookalike
  return `${hex}e49a1f8b72c90e3a44b9d10c55fa8790bc41de7a99f1c24e6b12a843`.slice(0, 64);
}

export function generateRandomSeed(length: number = 32): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function determineDealerMove(serverSeed: string, clientSeed: string, nonce: number): { move: RPSMove; hash: string } {
  const raw = `${serverSeed}:${clientSeed}:${nonce}`;
  const hash = generateHash(raw);
  
  // Pick byte integer
  let total = 0;
  for (let i = 0; i < 4; i++) {
    total += hash.charCodeAt(i);
  }
  
  const moves: RPSMove[] = ['piedra', 'papel', 'tijera'];
  const move = moves[total % 3];

  return { move, hash };
}

export function evaluateRound(playerMove: RPSMove, dealerMove: RPSMove): 'win' | 'loss' | 'tie' {
  if (playerMove === dealerMove) return 'tie';
  if (
    (playerMove === 'piedra' && dealerMove === 'tijera') ||
    (playerMove === 'papel' && dealerMove === 'piedra') ||
    (playerMove === 'tijera' && dealerMove === 'papel')
  ) {
    return 'win';
  }
  return 'loss';
}

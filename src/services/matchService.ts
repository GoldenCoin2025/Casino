import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { RoomDocument } from '../types/casino';

// BERRYS Platform Fee: 6%
export const BERRYS_COMMISSION_RATE = 0.06;

export function calculatePayout(wager: number): number {
  const totalPot = wager * 2;
  const commission = totalPot * BERRYS_COMMISSION_RATE;
  return Math.round(totalPot - commission);
}

/**
 * Search for an existing waiting room for the same game & wager in Firestore
 */
export async function findOpenWaitingRoom(
  gameId: 'stacker' | 'rps' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad' | 'knifeclash',
  wager: number,
  currentUserId: string
): Promise<RoomDocument | null> {
  const roomsPath = 'rooms';
  try {
    const q = query(
      collection(db, 'rooms'),
      where('status', '==', 'waiting'),
      where('gameId', '==', gameId),
      where('wager', '==', wager),
      limit(5)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data() as RoomDocument;
      if (data.hostId !== currentUserId) {
        return { ...data, id: d.id };
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, roomsPath);
  }
}

/**
 * Create a new room in Firestore when initiating a duel
 */
export async function createGameRoom(params: {
  gameId: 'stacker' | 'rps' | 'blockblast' | 'colorclash' | 'mines' | 'berriesroad' | 'knifeclash';
  gameTitle: string;
  wager: number;
  userId: string;
  username: string;
  avatar: string;
  rating: number;
  mineIndices?: number[];
  roadSeed?: number;
  knifeSeed?: number;
}): Promise<string> {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const roomPath = `rooms/${roomId}`;
  const totalPot = params.wager * 2;
  const payout = calculatePayout(params.wager);
  const nowMs = Date.now();
  const expiresAt = nowMs + 24 * 60 * 60 * 1000; // 24-hour expiration

  const roomData: RoomDocument = {
    id: roomId,
    gameId: params.gameId,
    gameTitle: params.gameTitle,
    wager: params.wager,
    totalPot,
    payout,
    status: 'waiting',
    hostId: params.userId,
    hostNick: params.username,
    hostAvatar: params.avatar,
    hostRating: params.rating,
    hostScore: 0,
    ...(params.mineIndices ? { mineIndices: params.mineIndices } : {}),
    ...(params.roadSeed !== undefined ? { roadSeed: params.roadSeed } : {}),
    ...(params.knifeSeed !== undefined ? { knifeSeed: params.knifeSeed } : {}),
    opponentId: null,
    opponentNick: null,
    opponentAvatar: null,
    opponentRating: null,
    opponentScore: null,
    winnerId: null,
    winnerNick: null,
    claimedByWinner: false,
    isRefunded: false,
    createdAt: serverTimestamp(),
    createdMs: nowMs,
    expiresAt,
  };

  try {
    await setDoc(doc(db, 'rooms', roomId), roomData);
    return roomId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, roomPath);
  }
}

/**
 * Join an existing waiting room as Player 2
 */
export async function joinGameRoom(
  roomId: string,
  user: { uid: string; username: string; avatar: string; rating: number }
): Promise<void> {
  const roomPath = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      opponentId: user.uid,
      opponentNick: user.username,
      opponentAvatar: user.avatar,
      opponentRating: user.rating,
      status: 'playing',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, roomPath);
  }
}

/**
 * Save host score when no live opponent joined and transition room to 'waiting_opponent' (24-hour Async challenge)
 */
export async function publishAsyncHostScore(
  roomId: string,
  score: number,
  reaction?: string | null,
  mineIndices?: number[]
): Promise<void> {
  const roomPath = `rooms/${roomId}`;
  try {
    const payload: Record<string, unknown> = {
      hostScore: score,
      status: 'waiting_opponent',
      updatedAt: serverTimestamp(),
    };
    if (reaction) {
      payload.hostReaction = reaction;
    }
    if (mineIndices) {
      payload.mineIndices = mineIndices;
    }
    await updateDoc(doc(db, 'rooms', roomId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, roomPath);
  }
}

/**
 * Save quick Clash Royale style reaction emoji to a room in Firestore
 */
export async function saveRoomReaction(
  roomId: string,
  reaction: string,
  isHost: boolean
): Promise<void> {
  const roomPath = `rooms/${roomId}`;
  try {
    const field = isHost ? 'hostReaction' : 'opponentReaction';
    await updateDoc(doc(db, 'rooms', roomId), {
      [field]: reaction,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, roomPath);
  }
}

/**
 * Resolve challenge when a real Player 2 plays against a pending challenge
 */
export async function submitOpponentScoreAndResolve(
  roomId: string,
  opponentScore: number,
  opponent: { uid: string; username: string; avatar: string; rating: number }
): Promise<{
  winnerId: string;
  winnerNick: string;
  payout: number;
  isOpponentWinner: boolean;
  isTie: boolean;
}> {
  const roomPath = `rooms/${roomId}`;
  try {
    const snap = await getDoc(doc(db, 'rooms', roomId));
    if (!snap.exists()) {
      throw new Error('La sala no existe o ha sido eliminada.');
    }
    const room = snap.data() as RoomDocument;

    let winnerId: string = 'tie';
    let winnerNick: string = 'Empate';
    let isOpponentWinner = false;
    let isTie = false;

    if (opponentScore > room.hostScore) {
      winnerId = opponent.uid;
      winnerNick = opponent.username;
      isOpponentWinner = true;
    } else if (room.hostScore > opponentScore) {
      winnerId = room.hostId;
      winnerNick = room.hostNick;
    } else {
      isTie = true;
    }

    await updateDoc(doc(db, 'rooms', roomId), {
      opponentId: opponent.uid,
      opponentNick: opponent.username,
      opponentAvatar: opponent.avatar,
      opponentRating: opponent.rating,
      opponentScore,
      winnerId,
      winnerNick,
      status: 'completed',
      completedAt: serverTimestamp(),
      claimedByWinner: isOpponentWinner, // If opponent won, opponent collects immediately
    });

    return {
      winnerId,
      winnerNick,
      payout: room.payout,
      isOpponentWinner,
      isTie,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, roomPath);
  }
}

/**
 * Refund an expired room (>= 24 hours without accepted challenge)
 */
export async function refundExpiredRoom(roomId: string): Promise<number> {
  const roomPath = `rooms/${roomId}`;
  try {
    const snap = await getDoc(doc(db, 'rooms', roomId));
    if (!snap.exists()) throw new Error('Sala no encontrada.');
    const room = snap.data() as RoomDocument;

    if (room.isRefunded) {
      throw new Error('Esta sala ya fue reembolsada.');
    }

    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'expired',
      isRefunded: true,
      updatedAt: serverTimestamp(),
    });

    return room.wager;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, roomPath);
  }
}

/**
 * Mark room as claimed when Host claims their async victory payout
 */
export async function claimHostWinnerPayout(roomId: string): Promise<number> {
  const roomPath = `rooms/${roomId}`;
  try {
    const snap = await getDoc(doc(db, 'rooms', roomId));
    if (!snap.exists()) throw new Error('Sala no encontrada.');
    const room = snap.data() as RoomDocument;

    if (room.claimedByWinner) {
      throw new Error('Este premio ya fue acreditado.');
    }

    await updateDoc(doc(db, 'rooms', roomId), {
      claimedByWinner: true,
      updatedAt: serverTimestamp(),
    });

    return room.payout;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, roomPath);
  }
}

/**
 * Subscribe in real time to open challenges awaiting rivals in the web feed
 */
export function subscribeToOpenChallenges(
  callback: (rooms: RoomDocument[]) => void
): () => void {
  const roomsPath = 'rooms';
  const q = query(
    collection(db, 'rooms'),
    where('status', '==', 'waiting_opponent'),
    limit(25)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rooms: RoomDocument[] = [];
      snapshot.forEach((docSnap) => {
        rooms.push({ ...docSnap.data(), id: docSnap.id } as RoomDocument);
      });
      // Sort client side by createdMs descending
      rooms.sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));
      callback(rooms);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, roomsPath);
    }
  );
}

/**
 * Subscribe in real time to a user's own rooms (for the 24h pending matches menu)
 */
export function subscribeToUserRooms(
  userId: string,
  callback: (rooms: RoomDocument[]) => void
): () => void {
  const roomsPath = 'rooms';
  const q = query(
    collection(db, 'rooms'),
    where('hostId', '==', userId),
    limit(30)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rooms: RoomDocument[] = [];
      snapshot.forEach((docSnap) => {
        rooms.push({ ...docSnap.data(), id: docSnap.id } as RoomDocument);
      });
      rooms.sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));
      callback(rooms);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, roomsPath);
    }
  );
}

/**
 * Subscribe in real time to a single room (for live 2-player matchmaking & duel)
 */
export function subscribeToRoom(
  roomId: string,
  callback: (room: RoomDocument | null) => void
): () => void {
  const roomPath = `rooms/${roomId}`;
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => {
      if (snap.exists()) {
        callback({ ...snap.data(), id: snap.id } as RoomDocument);
      } else {
        callback(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, roomPath);
    }
  );
}

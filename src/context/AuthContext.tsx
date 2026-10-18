import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { BetRecord } from '../types/casino';

export interface UserProfileData {
  id: string;
  username: string;
  usernameLower: string;
  email: string;
  documentNumber: string;
  documentType: 'passport' | 'national_id' | 'dni' | 'cedula';
  country: string;
  countryFlag: string;
  avatar: string;
  balance: number;
  rating: number;
  wins: number;
  losses: number;
  totalWagered: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface RegisterParams {
  email: string;
  password: string;
  username: string;
  documentNumber: string;
  documentType: 'passport' | 'national_id' | 'dni' | 'cedula';
  country: string;
  countryFlag: string;
  avatar: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfileData | null;
  loading: boolean;
  registerUser: (params: RegisterParams) => Promise<void>;
  loginUser: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateBalance: (newBalance: number) => Promise<void>;
  recordMatch: (bet: BetRecord) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch user profile from Firestore with clean fallback
  const fetchProfile = async (uid: string): Promise<UserProfileData | null> => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data() as UserProfileData;
        setProfile(data);
        return data;
      }
      return null;
    } catch (error) {
      console.warn('Profile not found yet or error loading for UID:', uid, error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      try {
        if (currentUser) {
          await fetchProfile(currentUser.uid);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Error in onAuthStateChanged:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const registerUser = async (params: RegisterParams) => {
    const usernameLower = params.username.trim().toLowerCase();

    // 1. Check if username is already taken (graceful check)
    try {
      const uSnap = await getDoc(doc(db, 'usernames', usernameLower));
      if (uSnap.exists()) {
        throw new Error(`El nombre de usuario "${params.username}" ya está registrado por otro jugador.`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('ya está registrado')) {
        throw err;
      }
      // If error is network or permission, proceed to auth creation
      console.warn('Username check warning (proceeding):', err);
    }

    // 2. Create Firebase Auth user
    const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
    const uid = cred.user.uid;

    const initialProfile: UserProfileData = {
      id: uid,
      username: params.username.trim(),
      usernameLower,
      email: params.email.trim(),
      documentNumber: params.documentNumber.trim(),
      documentType: params.documentType,
      country: params.country,
      countryFlag: params.countryFlag,
      avatar: params.avatar,
      balance: 5000, // 5,000 Welcome BerryCoins!
      rating: 1500, // Initial ELO
      wins: 0,
      losses: 0,
      totalWagered: 0,
    };

    // Set active profile in React immediately to eliminate loading freeze
    setProfile(initialProfile);

    // 3. Persist profile, username index and public leaderboard entry
    try {
      await setDoc(doc(db, 'users', uid), {
        ...initialProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Best effort secondary collections
      setDoc(doc(db, 'usernames', usernameLower), {
        uid,
        createdAt: serverTimestamp(),
      }).catch((e) => console.warn('Could not index username doc:', e));

      setDoc(doc(db, 'leaderboard', uid), {
        id: uid,
        username: initialProfile.username,
        avatar: initialProfile.avatar,
        rating: initialProfile.rating,
        wins: initialProfile.wins,
        totalWagered: initialProfile.totalWagered,
        countryFlag: initialProfile.countryFlag,
        updatedAt: serverTimestamp(),
      }).catch((e) => console.warn('Could not seed leaderboard doc:', e));
    } catch (err) {
      console.error('Error persisting user profile:', err);
      // Still keep local profile active so user is not blocked
    }
  };

  const loginUser = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await fetchProfile(cred.user.uid);
  };

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const uid = cred.user.uid;
    const existing = await fetchProfile(uid);

    if (!existing) {
      // Create basic profile for first-time Google signin
      const defaultUsername = `Player_${uid.slice(0, 6)}`;
      const usernameLower = defaultUsername.toLowerCase();

      const newProfile: UserProfileData = {
        id: uid,
        username: defaultUsername,
        usernameLower,
        email: cred.user.email || '',
        documentNumber: `INTL-${uid.slice(0, 8).toUpperCase()}`,
        documentType: 'passport',
        country: 'Internacional',
        countryFlag: '🌐',
        avatar: '💎',
        balance: 5000,
        rating: 1500,
        wins: 0,
        losses: 0,
        totalWagered: 0,
      };

      try {
        await setDoc(doc(db, 'users', uid), {
          ...newProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'usernames', usernameLower), {
          uid,
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'leaderboard', uid), {
          id: uid,
          username: newProfile.username,
          avatar: newProfile.avatar,
          rating: newProfile.rating,
          wins: newProfile.wins,
          totalWagered: newProfile.totalWagered,
          countryFlag: newProfile.countryFlag,
          updatedAt: serverTimestamp(),
        });
        setProfile(newProfile);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const updateBalance = async (newBalance: number) => {
    if (!user || !profile) return;
    const userPath = `users/${user.uid}`;
    try {
      setProfile((prev) => (prev ? { ...prev, balance: newBalance } : null));
      await updateDoc(doc(db, 'users', user.uid), {
        balance: newBalance,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
  };

  const recordMatch = async (bet: BetRecord) => {
    if (!user || !profile) return;
    const betPath = `users/${user.uid}/bets/${bet.id}`;
    const userPath = `users/${user.uid}`;

    try {
      // 1. Record subcollection bet
      await setDoc(doc(db, 'users', user.uid, 'bets', bet.id), {
        ...bet,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      // 2. Update user stats
      const isWin = bet.result === 'win';
      const isLoss = bet.result === 'loss';
      const ratingDelta = isWin ? 25 : isLoss ? -15 : 0;
      const nextRating = Math.max(1000, profile.rating + ratingDelta);
      const nextWins = profile.wins + (isWin ? 1 : 0);
      const nextLosses = profile.losses + (isLoss ? 1 : 0);
      const nextWagered = profile.totalWagered + bet.betAmount;

      const updated = {
        ...profile,
        rating: nextRating,
        wins: nextWins,
        losses: nextLosses,
        totalWagered: nextWagered,
      };

      setProfile(updated);

      await updateDoc(doc(db, 'users', user.uid), {
        rating: nextRating,
        wins: nextWins,
        losses: nextLosses,
        totalWagered: nextWagered,
        updatedAt: serverTimestamp(),
      });

      // 3. Update public leaderboard entry
      await setDoc(
        doc(db, 'leaderboard', user.uid),
        {
          id: user.uid,
          username: profile.username,
          avatar: profile.avatar,
          rating: nextRating,
          wins: nextWins,
          totalWagered: nextWagered,
          countryFlag: profile.countryFlag,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, betPath || userPath);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        registerUser,
        loginUser,
        loginWithGoogle,
        logout,
        updateBalance,
        recordMatch,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

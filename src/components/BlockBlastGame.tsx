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
  Maximize2,
  Minimize2,
  Trophy,
  Coins,
  Flame,
  CheckCircle2,
  Sparkles,
  Play,
  Layers,
  X
} from 'lucide-react';

export type BlockColor = 'yellow' | 'green' | 'orange' | 'blue' | 'red' | 'purple' | 'cyan';

export interface PieceDef {
  id: string;
  name: string;
  shape: number[][]; // row x col
  color: BlockColor;
}

// 3D Beveled jewel styling for blocks matching the reference image
export const COLOR_THEMES: Record<
  BlockColor,
  {
    gradient: string;
    borderTopLeft: string;
    borderBottomRight: string;
    innerGlint: string;
    glow: string;
    text: string;
    accentHex: string;
  }
> = {
  yellow: {
    gradient: 'from-[#fef08a] via-[#facc15] to-[#ca8a04]',
    borderTopLeft: 'border-t-[#fffbeb] border-l-[#fffbeb]',
    borderBottomRight: 'border-b-[#713f12] border-r-[#713f12]',
    innerGlint: 'bg-[#fde047]',
    glow: 'rgba(250, 204, 21, 0.6)',
    text: 'text-amber-300',
    accentHex: '#facc15',
  },
  green: {
    gradient: 'from-[#86efac] via-[#22c55e] to-[#15803d]',
    borderTopLeft: 'border-t-[#dcfce7] border-l-[#dcfce7]',
    borderBottomRight: 'border-b-[#14532d] border-r-[#14532d]',
    innerGlint: 'bg-[#4ade80]',
    glow: 'rgba(34, 197, 94, 0.6)',
    text: 'text-emerald-300',
    accentHex: '#22c55e',
  },
  orange: {
    gradient: 'from-[#fed7aa] via-[#f97316] to-[#9a3412]',
    borderTopLeft: 'border-t-[#ffedd5] border-l-[#ffedd5]',
    borderBottomRight: 'border-b-[#7c2d12] border-r-[#7c2d12]',
    innerGlint: 'bg-[#fb923c]',
    glow: 'rgba(249, 115, 22, 0.6)',
    text: 'text-orange-300',
    accentHex: '#f97316',
  },
  blue: {
    gradient: 'from-[#bfdbfe] via-[#3b82f6] to-[#1e40af]',
    borderTopLeft: 'border-t-[#eff6ff] border-l-[#eff6ff]',
    borderBottomRight: 'border-b-[#172554] border-r-[#172554]',
    innerGlint: 'bg-[#60a5fa]',
    glow: 'rgba(59, 130, 246, 0.6)',
    text: 'text-blue-300',
    accentHex: '#3b82f6',
  },
  red: {
    gradient: 'from-[#fecaca] via-[#ef4444] to-[#991b1b]',
    borderTopLeft: 'border-t-[#fef2f2] border-l-[#fef2f2]',
    borderBottomRight: 'border-b-[#7f1d1d] border-r-[#7f1d1d]',
    innerGlint: 'bg-[#f87171]',
    glow: 'rgba(239, 68, 68, 0.6)',
    text: 'text-rose-300',
    accentHex: '#ef4444',
  },
  purple: {
    gradient: 'from-[#e9d5ff] via-[#a855f7] to-[#6b21a8]',
    borderTopLeft: 'border-t-[#faf5ff] border-l-[#faf5ff]',
    borderBottomRight: 'border-b-[#3b0764] border-r-[#3b0764]',
    innerGlint: 'bg-[#c084fc]',
    glow: 'rgba(168, 85, 247, 0.6)',
    text: 'text-purple-300',
    accentHex: '#a855f7',
  },
  cyan: {
    gradient: 'from-[#a5f3fc] via-[#06b6d4] to-[#0e7490]',
    borderTopLeft: 'border-t-[#ecfeff] border-l-[#ecfeff]',
    borderBottomRight: 'border-b-[#164e63] border-r-[#164e63]',
    innerGlint: 'bg-[#38bdf8]',
    glow: 'rgba(6, 182, 212, 0.6)',
    text: 'text-cyan-300',
    accentHex: '#06b6d4',
  },
};

// Polyomino shape templates
const SHAPE_TEMPLATES: { name: string; shape: number[][]; defaultColor: BlockColor }[] = [
  // 1x1 Dot
  { name: 'dot', shape: [[1]], defaultColor: 'yellow' },

  // 1x2 and 2x1
  { name: 'bar_2h', shape: [[1, 1]], defaultColor: 'cyan' },
  { name: 'bar_2v', shape: [[1], [1]], defaultColor: 'cyan' },

  // 1x3 and 3x1
  { name: 'bar_3h', shape: [[1, 1, 1]], defaultColor: 'orange' },
  { name: 'bar_3v', shape: [[1], [1], [1]], defaultColor: 'orange' },

  // 1x4 and 4x1 (Reference image style)
  { name: 'bar_4h', shape: [[1, 1, 1, 1]], defaultColor: 'red' },
  { name: 'bar_4v', shape: [[1], [1], [1], [1]], defaultColor: 'yellow' },

  // 1x5 and 5x1
  { name: 'bar_5h', shape: [[1, 1, 1, 1, 1]], defaultColor: 'purple' },
  { name: 'bar_5v', shape: [[1], [1], [1], [1], [1]], defaultColor: 'purple' },

  // 2x2 Square
  { name: 'sq_2x2', shape: [[1, 1], [1, 1]], defaultColor: 'blue' },

  // 3x3 Big Square
  { name: 'sq_3x3', shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], defaultColor: 'green' },

  // Small Corner 2x2
  { name: 'corner_tl', shape: [[1, 1], [1, 0]], defaultColor: 'green' },
  { name: 'corner_tr', shape: [[1, 1], [0, 1]], defaultColor: 'green' },
  { name: 'corner_bl', shape: [[1, 0], [1, 1]], defaultColor: 'green' },
  { name: 'corner_br', shape: [[0, 1], [1, 1]], defaultColor: 'green' },

  // L-Shapes 3x2 (Vertical 3)
  { name: 'L_3x2_1', shape: [[1, 0], [1, 0], [1, 1]], defaultColor: 'orange' },
  { name: 'L_3x2_2', shape: [[0, 1], [0, 1], [1, 1]], defaultColor: 'orange' },
  { name: 'L_3x2_3', shape: [[1, 1], [1, 0], [1, 0]], defaultColor: 'orange' },
  { name: 'L_3x2_4', shape: [[1, 1], [0, 1], [0, 1]], defaultColor: 'orange' },

  // L-Shapes 2x3 (Horizontal 3)
  { name: 'L_2x3_1', shape: [[1, 1, 1], [1, 0, 0]], defaultColor: 'yellow' },
  { name: 'L_2x3_2', shape: [[1, 1, 1], [0, 0, 1]], defaultColor: 'yellow' },
  { name: 'L_2x3_3', shape: [[1, 0, 0], [1, 1, 1]], defaultColor: 'yellow' },
  { name: 'L_2x3_4', shape: [[0, 0, 1], [1, 1, 1]], defaultColor: 'yellow' },

  // T-Shapes
  { name: 'T_up', shape: [[0, 1, 0], [1, 1, 1]], defaultColor: 'purple' },
  { name: 'T_down', shape: [[1, 1, 1], [0, 1, 0]], defaultColor: 'purple' },
  { name: 'T_left', shape: [[0, 1], [1, 1], [0, 1]], defaultColor: 'purple' },
  { name: 'T_right', shape: [[1, 0], [1, 1], [1, 0]], defaultColor: 'purple' },

  // Stepped piece (Reference image bottom middle)
  { name: 'step_blue', shape: [[1, 1, 1], [1, 1, 0], [0, 1, 0], [0, 1, 1]], defaultColor: 'blue' },
  { name: 'Z_shape', shape: [[1, 1, 0], [0, 1, 1]], defaultColor: 'red' },
  { name: 'S_shape', shape: [[0, 1, 1], [1, 1, 0]], defaultColor: 'green' },
];

interface FloatingPopup {
  id: number;
  text: string;
  badge?: string;
  x: number;
  y: number;
  colorClass: string;
}

interface BlockBlastGameProps {
  initialWager?: number;
  userBalance: number;
  onMatchComplete?: (record: BetRecord) => void;
  onBackToGrid: () => void;
  onPlayAgain?: (wagerAmt: number) => void;
}

export const BlockBlastGame: React.FC<BlockBlastGameProps> = ({
  initialWager = 50,
  userBalance,
  onMatchComplete,
  onBackToGrid,
  onPlayAgain,
}) => {
  const { profile, updateBalance } = useAuth();

  // Root fullscreen container & board ref
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // States
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(sound.getMuted());
  const [wager, setWager] = useState<number>(initialWager);
  const [gameStatus, setGameStatus] = useState<'betting' | 'playing' | 'game_over'>('playing');

  // Board state 8x8
  const [grid, setGrid] = useState<(BlockColor | null)[][]>(() =>
    Array(8).fill(null).map(() => Array(8).fill(null))
  );

  // 3 tray pieces
  const [trayPieces, setTrayPieces] = useState<(PieceDef | null)[]>([null, null, null]);

  // DRAG & DROP WITH OFFSET & GHOST PREVIEW
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [ghostPreview, setGhostPreview] = useState<{ row: number; col: number; isValid: boolean } | null>(null);

  // Scoring & Stats
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    const s = localStorage.getItem('blockblast_highscore');
    return s ? Number(s) : 0;
  });
  const [linesClearedTotal, setLinesClearedTotal] = useState<number>(0);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);
  const [gameOverReason, setGameOverReason] = useState<'timeout' | 'no_moves'>('no_moves');
  const [isFirestoreSaved, setIsFirestoreSaved] = useState<boolean>(false);

  // Animated feedback popups & lines clear effect
  const [popups, setPopups] = useState<FloatingPopup[]>([]);
  const [clearingEffect, setClearingEffect] = useState<{ rows: number[]; cols: number[] }>({
    rows: [],
    cols: [],
  });

  // Calculate potential payout
  const calculateGamePayout = useCallback((pts: number, bet: number) => {
    if (pts < 800) return Math.round(bet * 0.5);
    if (pts < 1500) return Math.round(bet * 1.2);
    if (pts < 2500) return Math.round(bet * 1.6);
    if (pts < 4000) return Math.round(bet * 2.2);
    return Math.round(bet * 3.5);
  }, []);

  const currentPayout = calculateGamePayout(score, wager);
  const currentNet = currentPayout - wager;

  // Sound toggle
  const toggleSound = () => {
    const next = sound.toggleMute();
    setIsAudioMuted(next);
  };

  // Check if a piece fits at (startRow, startCol)
  const canPlacePiece = useCallback(
    (piece: PieceDef, startRow: number, startCol: number, currentGrid: (BlockColor | null)[][]): boolean => {
      const rows = piece.shape.length;
      const cols = piece.shape[0].length;

      if (startRow < 0 || startCol < 0 || startRow + rows > 8 || startCol + cols > 8) {
        return false;
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (piece.shape[r][c] === 1) {
            if (currentGrid[startRow + r][startCol + c] !== null) {
              return false;
            }
          }
        }
      }
      return true;
    },
    []
  );

  // Check if piece can fit anywhere on the board
  const canPieceFitAnywhere = useCallback(
    (piece: PieceDef, currentGrid: (BlockColor | null)[][]): boolean => {
      const rows = piece.shape.length;
      const cols = piece.shape[0].length;
      for (let r = 0; r <= 8 - rows; r++) {
        for (let c = 0; c <= 8 - cols; c++) {
          if (canPlacePiece(piece, r, c, currentGrid)) {
            return true;
          }
        }
      }
      return false;
    },
    [canPlacePiece]
  );

  // Check if ANY piece in tray has a valid move
  const hasAnyValidMoves = useCallback(
    (pieces: (PieceDef | null)[], currentGrid: (BlockColor | null)[][]): boolean => {
      const activePieces = pieces.filter((p): p is PieceDef => p !== null);
      if (activePieces.length === 0) return true;
      return activePieces.some((p) => canPieceFitAnywhere(p, currentGrid));
    },
    [canPieceFitAnywhere]
  );

  // INTELLIGENT PIECE GENERATION ENGINE:
  // Guarantees that at least one of the 3 pieces can fit on the current board!
  const generateSmartTray = useCallback(
    (currentGrid: (BlockColor | null)[][]): (PieceDef | null)[] => {
      const fittingTemplates = SHAPE_TEMPLATES.filter((t) => {
        const dummyPiece: PieceDef = { id: 'test', name: t.name, shape: t.shape, color: 'blue' };
        return canPieceFitAnywhere(dummyPiece, currentGrid);
      });

      const colors: BlockColor[] = ['yellow', 'green', 'orange', 'blue', 'red', 'purple', 'cyan'];
      const createPieceInstance = (t: typeof SHAPE_TEMPLATES[0]): PieceDef => {
        const color = Math.random() > 0.3 ? t.defaultColor : colors[Math.floor(Math.random() * colors.length)];
        return {
          id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: t.name,
          shape: t.shape,
          color,
        };
      };

      const newPieces: PieceDef[] = [];

      // Slot 0: Guaranteed fitting piece if any shape can fit
      if (fittingTemplates.length > 0) {
        const guaranteed = fittingTemplates[Math.floor(Math.random() * fittingTemplates.length)];
        newPieces.push(createPieceInstance(guaranteed));
      } else {
        newPieces.push(createPieceInstance(SHAPE_TEMPLATES[0])); // single dot fallback
      }

      // Slots 1 and 2: diverse pieces
      for (let i = 1; i < 3; i++) {
        let selected;
        if (fittingTemplates.length > 0 && Math.random() < 0.65) {
          selected = fittingTemplates[Math.floor(Math.random() * fittingTemplates.length)];
        } else {
          selected = SHAPE_TEMPLATES[Math.floor(Math.random() * SHAPE_TEMPLATES.length)];
        }
        newPieces.push(createPieceInstance(selected));
      }

      // Shuffle order
      return newPieces.sort(() => Math.random() - 0.5);
    },
    [canPieceFitAnywhere]
  );

  // Initialize board and deduct initial wager
  useEffect(() => {
    const freshGrid: (BlockColor | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    setGrid(freshGrid);
    setTrayPieces(generateSmartTray(freshGrid));

    // Deduct initial wager from balance if available
    const curBal = profile ? profile.balance : userBalance;
    if (curBal >= wager) {
      updateBalance(curBal - wager).catch(console.error);
    }
  }, []);

  // Request browser Fullscreen automatically on user interaction / mount
  useEffect(() => {
    const handleTryFullscreen = () => {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        fullscreenContainerRef.current?.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener('click', handleTryFullscreen, { once: true });
    window.addEventListener('touchstart', handleTryFullscreen, { once: true });
    return () => {
      window.removeEventListener('click', handleTryFullscreen);
      window.removeEventListener('touchstart', handleTryFullscreen);
    };
  }, []);

  // Finish match handler
  const handleEndGame = useCallback(
    async (reason: 'timeout' | 'no_moves', finalScore: number, lines: number) => {
      setGameStatus('game_over');
      setGameOverReason(reason);
      setDraggingIndex(null);
      setDragPosition(null);
      setGhostPreview(null);

      const finalPayout = calculateGamePayout(finalScore, wager);
      const netProfit = finalPayout - wager;
      const result = netProfit > 0 ? 'win' : netProfit === 0 ? 'tie' : 'loss';

      if (finalPayout > 0) {
        sound.playWin();
        if (finalPayout >= wager * 2) {
          confetti({
            particleCount: 110,
            spread: 85,
            origin: { y: 0.5 },
          });
        }
      } else {
        sound.playLoss();
      }

      // Update credit balance in Firestore
      if (finalPayout > 0) {
        const nextBalance = (profile ? profile.balance : userBalance) + finalPayout;
        await updateBalance(nextBalance);
      }

      // Record match to Firestore bet history
      const betRec: BetRecord = {
        id: `bet_blockblast_${Date.now()}`,
        timestamp: Date.now(),
        gameTitle: 'Block Blast Arena Pro',
        opponentName: 'Desafío en Solitario (Modo Casino)',
        result,
        betAmount: wager,
        payout: finalPayout,
        netProfit,
        finalScore: `${finalScore} Pts (${lines} Líneas)`,
      };

      if (onMatchComplete) {
        onMatchComplete(betRec);
      }
      setIsFirestoreSaved(true);

      // Save high score
      if (finalScore > highScore) {
        setHighScore(finalScore);
        localStorage.setItem('blockblast_highscore', finalScore.toString());
      }
    },
    [calculateGamePayout, wager, profile, userBalance, updateBalance, onMatchComplete, highScore]
  );

  // Start fresh game / Rematch
  const handleStartFreshGame = async (selectedWager: number) => {
    const curBal = profile ? profile.balance : userBalance;
    if (curBal < selectedWager) {
      sound.playLoss();
      alert(`Saldo insuficiente ($${curBal} créditos). Necesitas al menos $${selectedWager} para jugar.`);
      return;
    }

    sound.playBet();
    await updateBalance(curBal - selectedWager);

    const freshGrid: (BlockColor | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    setWager(selectedWager);
    setGrid(freshGrid);
    setTrayPieces(generateSmartTray(freshGrid));
    setScore(0);
    setLinesClearedTotal(0);
    setComboMultiplier(1);
    setIsFirestoreSaved(false);
    setClearingEffect({ rows: [], cols: [] });
    setGameStatus('playing');
  };

  // FLUID DRAG & DROP WITH ELEVATION OFFSET:
  // Starts drag on a piece
  const handleStartDrag = (index: number, clientX: number, clientY: number) => {
    if (trayPieces[index] === null) return;
    sound.playBlockGrab();
    setDraggingIndex(index);
    setDragPosition({ x: clientX, y: clientY });
  };

  // Move drag and calculate ghost shadow on board
  const handleMoveDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (draggingIndex === null) return;
      setDragPosition({ x: clientX, y: clientY });

      // Apply vertical elevation offset: piece floats ~70px ABOVE the finger/cursor
      const elevatedY = clientY - 70;
      const elevatedX = clientX;

      if (boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        const piece = trayPieces[draggingIndex];
        if (!piece) return;

        // Check if inside board
        if (
          elevatedX >= rect.left - 20 &&
          elevatedX <= rect.right + 20 &&
          elevatedY >= rect.top - 20 &&
          elevatedY <= rect.bottom + 20
        ) {
          const cellWidth = rect.width / 8;
          const cellHeight = rect.height / 8;

          // Anchor piece so finger/cursor is centered on the piece shape
          const pieceHalfWidth = ((piece.shape[0].length - 1) / 2) * cellWidth;
          const pieceHalfHeight = ((piece.shape.length - 1) / 2) * cellHeight;

          const col = Math.round((elevatedX - rect.left - pieceHalfWidth) / cellWidth);
          const row = Math.round((elevatedY - rect.top - pieceHalfHeight) / cellHeight);

          const clampedCol = Math.max(0, Math.min(8 - piece.shape[0].length, col));
          const clampedRow = Math.max(0, Math.min(8 - piece.shape.length, row));

          const isValid = canPlacePiece(piece, clampedRow, clampedCol, grid);
          setGhostPreview({ row: clampedRow, col: clampedCol, isValid });
        } else {
          setGhostPreview(null);
        }
      }
    },
    [draggingIndex, trayPieces, canPlacePiece, grid]
  );

  // Drop piece onto board or snap back
  const handleEndDrag = useCallback(() => {
    if (draggingIndex === null) return;

    const piece = trayPieces[draggingIndex];
    if (piece && ghostPreview && ghostPreview.isValid) {
      // PLACE PIECE INTO GRID!
      sound.playBlockPlace(linesClearedTotal);

      const nextGrid = grid.map((r) => [...r]);
      let blocksCount = 0;

      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[0].length; c++) {
          if (piece.shape[r][c] === 1) {
            nextGrid[ghostPreview.row + r][ghostPreview.col + c] = piece.color;
            blocksCount++;
          }
        }
      }

      // Check lines to clear
      const rowsToClear: number[] = [];
      const colsToClear: number[] = [];

      for (let r = 0; r < 8; r++) {
        if (nextGrid[r].every((cell) => cell !== null)) {
          rowsToClear.push(r);
        }
      }

      for (let c = 0; c < 8; c++) {
        let isColFull = true;
        for (let r = 0; r < 8; r++) {
          if (nextGrid[r][c] === null) {
            isColFull = false;
            break;
          }
        }
        if (isColFull) colsToClear.push(c);
      }

      const totalLines = rowsToClear.length + colsToClear.length;
      let pointsEarned = blocksCount * 10;
      let nextCombo = comboMultiplier;
      let badgeText = '';

      if (totalLines > 0) {
        nextCombo = comboMultiplier + 1;
        setComboMultiplier(nextCombo);

        sound.playBlockBlastClear(totalLines);
        if (nextCombo > 1) {
          sound.playComboBurst(nextCombo);
        }

        if (nextCombo === 2) badgeText = '¡COMBO x2! 🔥';
        else if (nextCombo === 3) badgeText = '¡GENIAL! Combo x3 ⚡';
        else if (nextCombo === 4) badgeText = '¡PERFECTO! Combo x4 🌟';
        else if (nextCombo >= 5) badgeText = `¡INCREÍBLE! Combo x${nextCombo} 💥`;
        else if (totalLines >= 3) badgeText = '¡TRIPLE BLAST! 🚀';
        else if (totalLines === 2) badgeText = '¡DOBLE BLAST! ✨';
        else badgeText = '¡LÍNEA COMPLETA! 🎉';

        const lineBonus = totalLines * 160 * nextCombo;
        pointsEarned += lineBonus;

        setClearingEffect({ rows: rowsToClear, cols: colsToClear });

        confetti({
          particleCount: 30 * totalLines,
          spread: 70,
          origin: { y: 0.45 },
          colors: ['#facc15', '#22c55e', '#38bdf8', '#ef4444', '#a855f7'],
        });

        rowsToClear.forEach((r) => {
          for (let c = 0; c < 8; c++) nextGrid[r][c] = null;
        });
        colsToClear.forEach((c) => {
          for (let r = 0; r < 8; r++) nextGrid[r][c] = null;
        });

        setTimeout(() => {
          setClearingEffect({ rows: [], cols: [] });
        }, 340);
      } else {
        setComboMultiplier(1);
        nextCombo = 1;
      }

      // Update score
      const newScore = score + pointsEarned;
      setScore(newScore);
      const newTotalLines = linesClearedTotal + totalLines;
      setLinesClearedTotal(newTotalLines);

      // Popup badge
      const popupId = Date.now() + Math.random();
      setPopups((prev) => [
        ...prev.slice(-3),
        {
          id: popupId,
          text: `+${pointsEarned}`,
          badge: badgeText,
          x: ghostPreview.col * 12.5 + 4,
          y: ghostPreview.row * 12.5 + 4,
          colorClass: totalLines > 0 ? 'text-amber-300 scale-125' : 'text-cyan-300',
        },
      ]);
      setTimeout(() => {
        setPopups((prev) => prev.filter((p) => p.id !== popupId));
      }, 1200);

      // Deduct piece from tray
      const nextTray = [...trayPieces];
      nextTray[draggingIndex] = null;

      // Refill if empty
      const isTrayEmpty = nextTray.every((p) => p === null);
      const finalTray = isTrayEmpty ? generateSmartTray(nextGrid) : nextTray;

      setGrid(nextGrid);
      setTrayPieces(finalTray);

      // Check if moves remain
      if (!hasAnyValidMoves(finalTray, nextGrid)) {
        setTimeout(() => {
          handleEndGame('no_moves', newScore, newTotalLines);
        }, 500);
      }
    } else {
      // SNAP BACK TO TRAY SMOOTHLY
      sound.playChip();
    }

    setDraggingIndex(null);
    setDragPosition(null);
    setGhostPreview(null);
  }, [
    draggingIndex,
    trayPieces,
    ghostPreview,
    linesClearedTotal,
    grid,
    comboMultiplier,
    score,
    generateSmartTray,
    hasAnyValidMoves,
    handleEndGame,
  ]);

  // Window pointer listeners with preventDefault to completely eliminate page scroll during play
  useEffect(() => {
    if (draggingIndex === null) return;

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      handleMoveDrag(e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      e.preventDefault();
      handleEndDrag();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerUp, { passive: false });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [draggingIndex, handleMoveDrag, handleEndDrag]);

  const activeDraggingPiece = draggingIndex !== null ? trayPieces[draggingIndex] : null;

  return (
    <div
      ref={fullscreenContainerRef}
      className="fixed inset-0 z-50 w-screen h-screen bg-[#070e28] flex flex-col items-center justify-between py-3 px-3 sm:py-5 overflow-hidden select-none touch-none text-slate-100 font-sans"
      style={{ touchAction: 'none' }}
    >
      {/* 1. TOP MINIMALIST CASINO HEADER: SHOWING ONLY CURRENT SCORE (AND CLEAN CONTROLS) */}
      <header className="w-full max-w-md flex items-center justify-between gap-3 px-2">
        {/* Left: Minimal Back & Sound */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sound.playChip();
              onBackToGrid();
            }}
            className="p-2.5 rounded-2xl bg-blue-950/90 hover:bg-blue-900 border border-blue-500/30 text-slate-300 hover:text-white transition-all cursor-pointer shadow-md"
            title="Volver al Casino"
          >
            <ArrowLeft className="w-5 h-5 text-cyan-400" />
          </button>

          <button
            onClick={toggleSound}
            className="p-2.5 rounded-2xl bg-blue-950/90 hover:bg-blue-900 border border-blue-500/30 text-slate-300 hover:text-white transition-all cursor-pointer shadow-md"
            title={isAudioMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isAudioMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
          </button>
        </div>

        {/* Center: BIG CLEAN ARCADE SCORE (MINIMALIST CASINO HUD) */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 font-mono">
            PUNTUACIÓN
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight drop-shadow-[0_2px_8px_rgba(56,189,248,0.5)]">
              {score.toLocaleString('es-ES')}
            </span>
            {comboMultiplier > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-black animate-bounce shadow-md">
                x{comboMultiplier}
              </span>
            )}
          </div>
        </div>

        {/* Right: Balance Pill & Restart */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-2xl bg-blue-950/90 border border-amber-500/40 flex items-center gap-1.5 text-xs font-mono font-black text-amber-300 shadow-md">
            <Coins className="w-4 h-4 text-amber-400 animate-spin [animation-duration:8s]" />
            <span>${(profile ? profile.balance : userBalance).toLocaleString('es-ES')}</span>
          </div>

          <button
            onClick={() => {
              if (confirm('¿Reiniciar la partida?')) {
                handleStartFreshGame(wager);
              }
            }}
            className="p-2.5 rounded-2xl bg-blue-950/90 hover:bg-blue-900 border border-blue-500/30 text-slate-300 hover:text-white transition-all cursor-pointer shadow-md"
            title="Reiniciar"
          >
            <RotateCcw className="w-5 h-5 text-amber-400" />
          </button>
        </div>
      </header>

      {/* 2. MAIN 8X8 BOARD WITH 3D BEVELED CELLS & REAL-TIME GHOST PREVIEW */}
      <main className="relative flex-1 flex flex-col items-center justify-center w-full my-auto">
        <div className="relative p-3 sm:p-4 rounded-3xl bg-gradient-to-b from-[#152349] via-[#0f1b3e] to-[#0a132e] border-4 border-[#25396b] shadow-2xl shadow-black/80">
          <div
            ref={boardRef}
            className="grid grid-cols-8 grid-rows-8 gap-1.5 sm:gap-2 w-[310px] h-[310px] sm:w-[410px] sm:h-[410px] p-2 rounded-2xl bg-[#080f26] border-2 border-[#1c2c54] shadow-inner shadow-black relative"
          >
            {grid.map((row, rIdx) =>
              row.map((cellColor, cIdx) => {
                const isClearing = clearingEffect.rows.includes(rIdx) || clearingEffect.cols.includes(cIdx);

                // Ghost preview highlight
                let isGhostCell = false;
                let isGhostValid = false;

                if (ghostPreview && activeDraggingPiece) {
                  const relR = rIdx - ghostPreview.row;
                  const relC = cIdx - ghostPreview.col;
                  if (
                    relR >= 0 &&
                    relR < activeDraggingPiece.shape.length &&
                    relC >= 0 &&
                    relC < activeDraggingPiece.shape[0].length &&
                    activeDraggingPiece.shape[relR][relC] === 1
                  ) {
                    isGhostCell = true;
                    isGhostValid = ghostPreview.isValid;
                  }
                }

                const theme = cellColor ? COLOR_THEMES[cellColor] : null;
                const ghostTheme = activeDraggingPiece ? COLOR_THEMES[activeDraggingPiece.color] : null;

                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={`relative rounded-lg transition-all duration-100 flex items-center justify-center ${
                      cellColor
                        ? `bg-gradient-to-br ${theme?.gradient} border-2 ${theme?.borderTopLeft} ${theme?.borderBottomRight} shadow-md shadow-black/40`
                        : 'bg-[#111a36] border border-[#1b284c]'
                    } ${
                      isClearing
                        ? 'animate-ping scale-110 brightness-200 z-20 shadow-lg shadow-cyan-400'
                        : ''
                    } ${
                      isGhostCell
                        ? isGhostValid
                          ? `bg-gradient-to-br ${ghostTheme?.gradient} opacity-75 border-2 border-white ring-2 ring-cyan-400 scale-[1.03] animate-pulse z-10 shadow-lg`
                          : 'bg-rose-500/40 border-2 border-rose-400 z-10'
                        : ''
                    }`}
                  >
                    {/* Inner jewel facet shine */}
                    {cellColor && !isClearing && (
                      <div
                        className={`w-[60%] h-[60%] rounded-xs ${theme?.innerGlint} opacity-70 shadow-[inset_0_2px_3px_rgba(255,255,255,0.8),inset_0_-2px_3px_rgba(0,0,0,0.5)]`}
                      />
                    )}

                    {/* Translucent ghost jewel glint */}
                    {isGhostCell && isGhostValid && !cellColor && (
                      <div className="w-[50%] h-[50%] rounded-xs bg-white/40" />
                    )}
                  </div>
                );
              })
            )}

            {/* FLOATING TEXT POPUPS */}
            {popups.map((popup) => (
              <div
                key={popup.id}
                className={`absolute pointer-events-none font-black font-display text-sm sm:text-base animate-bounce ${popup.colorClass} drop-shadow-lg z-30 transition-all flex flex-col items-center`}
                style={{ left: `${popup.x}%`, top: `${popup.y}%` }}
              >
                {popup.badge && (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md mb-0.5">
                    {popup.badge}
                  </span>
                )}
                <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {popup.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 3. BOTTOM TRAY: 3 DRAGGABLE PIECES */}
      <footer className="w-full max-w-md pb-2">
        <div className="grid grid-cols-3 gap-3 items-center justify-center p-3 sm:p-4 rounded-3xl bg-[#091333]/90 border-2 border-blue-500/40 backdrop-blur-md shadow-xl">
          {trayPieces.map((piece, pIdx) => {
            if (!piece) {
              return (
                <div
                  key={`empty_${pIdx}`}
                  className="h-24 sm:h-28 rounded-2xl border-2 border-dashed border-blue-900/40 flex items-center justify-center opacity-25"
                >
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Colocado</span>
                </div>
              );
            }

            const isBeingDragged = draggingIndex === pIdx;
            const theme = COLOR_THEMES[piece.color];
            const canFit = canPieceFitAnywhere(piece, grid);

            return (
              <div
                key={piece.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleStartDrag(pIdx, e.clientX, e.clientY);
                }}
                className={`relative h-24 sm:h-28 rounded-2xl flex items-center justify-center p-2 transition-all cursor-grab active:cursor-grabbing ${
                  isBeingDragged ? 'opacity-30 scale-90' : 'bg-[#0e1b42]/80 hover:bg-[#132354] border border-blue-500/30'
                } ${!canFit ? 'opacity-40 grayscale' : ''}`}
                style={{ touchAction: 'none' }}
              >
                {/* Piece Shape Grid */}
                <div
                  className="grid gap-1 items-center justify-center pointer-events-none"
                  style={{
                    gridTemplateColumns: `repeat(${piece.shape[0].length}, minmax(0, 1fr))`,
                  }}
                >
                  {piece.shape.map((row, r) =>
                    row.map((val, c) => {
                      if (val === 0) return <div key={`${r}-${c}`} className="w-5 h-5 sm:w-6 sm:h-6" />;
                      return (
                        <div
                          key={`${r}-${c}`}
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-gradient-to-br ${theme.gradient} border-2 ${theme.borderTopLeft} ${theme.borderBottomRight} shadow-sm flex items-center justify-center`}
                        >
                          <div
                            className={`w-2 h-2 rounded-xs ${theme.innerGlint} opacity-70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]`}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                {!canFit && (
                  <span className="absolute bottom-1 px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 text-[8px] font-bold border border-rose-500/40">
                    Sin espacio
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </footer>

      {/* 4. FLOATING DRAG GHOST (ELEVATED ABOVE FINGER WITH SMOOTH OFFSET) */}
      {draggingIndex !== null && dragPosition && activeDraggingPiece && (
        <div
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 scale-115 drop-shadow-[0_20px_25px_rgba(0,0,0,0.8)]"
          style={{
            left: `${dragPosition.x}px`,
            top: `${dragPosition.y - 70}px`, // ~70px elevation above finger
          }}
        >
          <div
            className="grid gap-1.5 p-2 rounded-xl bg-black/40 backdrop-blur-xs border border-white/20"
            style={{
              gridTemplateColumns: `repeat(${activeDraggingPiece.shape[0].length}, minmax(0, 1fr))`,
            }}
          >
            {activeDraggingPiece.shape.map((row, r) =>
              row.map((val, c) => {
                if (val === 0) return <div key={`drag_${r}_${c}`} className="w-9 h-9" />;
                const theme = COLOR_THEMES[activeDraggingPiece.color];
                return (
                  <div
                    key={`drag_${r}_${c}`}
                    className={`w-9 h-9 rounded-lg bg-gradient-to-br ${theme.gradient} border-2 ${theme.borderTopLeft} ${theme.borderBottomRight} shadow-xl flex items-center justify-center ring-1 ring-white/40`}
                  >
                    <div className={`w-4 h-4 rounded-xs ${theme.innerGlint} opacity-70`} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 5. PERSISTENT GLASSMORPHISM GAME OVER MODAL */}
      {gameStatus === 'game_over' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in select-none">
          <div className="relative w-full max-w-md bg-gradient-to-b from-[#0e1d4d]/95 via-[#091436]/95 to-[#050d26]/95 border-2 border-cyan-400/60 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-cyan-950/90 space-y-5 animate-in zoom-in-95">
            <div className="space-y-1">
              <span className="px-3.5 py-1 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>CASINO RECORD</span>
              </span>
              <h3 className="text-3xl font-black text-white font-display tracking-tight">
                ¡Partida Finalizada!
              </h3>
              <p className="text-xs text-slate-400">
                Ninguna de las piezas restantes cabe en el tablero.
              </p>
            </div>

            {/* Big Score Display */}
            <div className="p-4 rounded-2xl bg-[#060e28]/90 border-2 border-blue-600/40 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-mono">
                Puntuación Final Obtenida
              </span>
              <span className="text-4xl sm:text-5xl font-black font-mono text-cyan-300 tabular-nums drop-shadow-[0_2px_10px_rgba(34,211,238,0.5)]">
                {score.toLocaleString('es-ES')}
              </span>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">
                    Líneas Destruidas
                  </span>
                  <span className="text-base font-black text-white">
                    {linesClearedTotal}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">
                    Racha Combo
                  </span>
                  <span className="text-base font-black text-amber-300">
                    x{comboMultiplier}.0
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Credits Outcome */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/90 to-cyan-950/90 border border-amber-500/40 text-left space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Entrada Apostada:</span>
                <span className="font-mono font-bold text-slate-200">${wager} créditos</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-1">
                <span className="text-slate-300">Premio Ganado:</span>
                <span className="font-mono font-black text-amber-300 text-sm">
                  ${currentPayout.toLocaleString('es-ES')} créditos
                </span>
              </div>
              <div className="flex items-center justify-between font-bold pt-1 border-t border-white/10">
                <span className={currentNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  Balance Neto:
                </span>
                <span className={`font-mono font-black ${currentNet >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {currentNet >= 0 ? `+$${currentNet}` : `-$${Math.abs(currentNet)}`} créditos
                </span>
              </div>
            </div>

            {/* Firestore Persistence Confirmation */}
            <div className="px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Puntuación y resultado guardados en Firestore correctamente.</span>
            </div>

            {/* Wager Selector for Rematch */}
            <div className="p-3 rounded-2xl bg-[#060e28] border border-blue-500/30 text-left space-y-2">
              <span className="text-[10px] font-black uppercase text-cyan-300 tracking-wider block">
                Selecciona valor de entrada para la Revancha:
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {[25, 50, 100, 250, 500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      sound.playChip();
                      setWager(amt);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-mono font-black border transition-all cursor-pointer ${
                      wager === amt
                        ? 'bg-cyan-400 text-slate-950 border-white shadow-md scale-105'
                        : 'bg-blue-950/80 text-cyan-200 border-blue-600/40 hover:bg-blue-900'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => handleStartFreshGame(wager)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-cyan-950/60 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>JUGAR REVANCHA / APOSTAR (${wager} CRÉDITOS)</span>
              </button>

              <button
                onClick={() => {
                  sound.playChip();
                  onBackToGrid();
                }}
                className="w-full py-3 rounded-2xl bg-blue-950/80 hover:bg-blue-900 border border-blue-600/40 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                VOLVER AL LOBBY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

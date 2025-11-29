import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { DEFAULT_BINGO_CELLS, SETTING_DEFAULTS } from '@/shared/constants/defaults';
import type { BingoCellConfig, BingoProgress } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { fetchFromFirebase, listenToFirebase, syncToFirebase } from '@/shared/services/sync/firebase/syncCore';
import { bingoProgressStrategy } from '@/shared/services/sync/firebase/strategies';
import { db } from '@/data/db/dexieClient';

interface BingoModalProps {
    open: boolean;
    onClose: () => void;
    cells?: BingoCellConfig[];
    maxLines?: number;
    lineRewardXP?: number;
    onProgressChange?: (progress: BingoProgress) => void;
}

export const BINGO_PROGRESS_STORAGE_KEY = 'bingo-progress';
const LINE_INDEXES: number[][] = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

const LINE_LABELS = ['Row 1', 'Row 2', 'Row 3', 'Col 1', 'Col 2', 'Col 3', 'Diag ↘', 'Diag ↙'];

const seededShuffle = (list: BingoCellConfig[], seedStr: string) => {
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
        seed = (seed << 5) - seed + seedStr.charCodeAt(i);
        seed |= 0;
    }
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
        seed = (seed * 1664525 + 1013904223) % 0xffffffff;
        const j = Math.abs(seed) % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

export function BingoModal({ open, onClose, cells, maxLines = SETTING_DEFAULTS.bingoMaxLines, lineRewardXP = SETTING_DEFAULTS.bingoLineRewardXP, onProgressChange }: BingoModalProps) {
    const baseCells = useMemo(() => (cells && cells.length === 9 ? cells : DEFAULT_BINGO_CELLS), [cells]);
    const today = getLocalDate();
    const displayCells = useMemo(() => seededShuffle(baseCells, today), [baseCells, today]);
    const addXP = useGameStateStore(state => state.addXP);

    const [progress, setProgress] = useState<BingoProgress>({
        date: today,
        completedCells: [],
        completedLines: [],
    });
    const [recentLines, setRecentLines] = useState<number[]>([]);
    const [loaded, setLoaded] = useState(false);

    const storageKey = `${BINGO_PROGRESS_STORAGE_KEY}:${today}`;

    // Load saved progress (daily) + fetch from Firebase
    useEffect(() => {
        if (!open) return;
        let mounted = true;
        (async () => {
            try {
                const remote = await fetchFromFirebase<BingoProgress>(bingoProgressStrategy, today);
                if (mounted && remote && remote.date === today) {
                    setProgress(remote);
                    return;
                }
            } catch (error) {
                console.error('Failed to fetch bingo progress:', error);
            }
            try {
                const stored = await db.systemState.get(storageKey);
                const value = stored?.value as BingoProgress | undefined;
                if (mounted && value && value.date === today) {
                    setProgress(value);
                    return;
                }
            } catch (error) {
                console.error('Failed to load bingo progress from Dexie:', error);
            }
            if (mounted) {
                setProgress({ date: today, completedCells: [], completedLines: [] });
            }
            if (mounted) {
                setLoaded(true);
            }
        })();

        // Live updates from Firebase while open
        const unsubscribe = listenToFirebase<BingoProgress>(bingoProgressStrategy, (remote) => {
            if (remote?.date === today) {
                setProgress(remote);
                setLoaded(true);
            }
        }, today);

        return () => {
            mounted = false;
            unsubscribe?.();
        };
    }, [open, today, storageKey]);

    // Persist progress
    useEffect(() => {
        if (!loaded) return;
        (async () => {
            try {
                await db.systemState.put({ key: storageKey, value: progress });
            } catch (error) {
                console.error('Failed to save bingo progress to Dexie:', error);
            }
            syncToFirebase(bingoProgressStrategy, progress, today).catch(err => {
                console.error('Failed to sync bingo progress:', err);
            });
        })();
    }, [progress, today, storageKey, loaded]);

    useEffect(() => {
        if (!open) return;
        onProgressChange?.(progress);
    }, [progress, open, onProgressChange]);

    const completedLineCount = progress.completedLines.length;
    const remainingLines = Math.max(0, maxLines - completedLineCount);
    const lineMembership = useMemo(() => {
        const map = new Map<number, number[]>();
        LINE_INDEXES.forEach((indexes, lineIdx) => {
            indexes.forEach(i => {
                const arr = map.get(i) || [];
                arr.push(lineIdx);
                map.set(i, arr);
            });
        });
        return map;
    }, []);

    const handleCompleteCell = (cellId: string) => {
        if (!open) return;
        const cell = displayCells.find(c => c.id === cellId);
        if (!cell) return;
        if (progress.completedCells.includes(cellId)) return;

        let lineXpAward = 0;
        let newLineCount = 0;
        let fullBoardAward = 0;

        setProgress(prev => {
            if (prev.completedCells.includes(cellId)) return prev;
            const nextCompletedCells = [...prev.completedCells, cellId];

            // Detect newly completed lines
            const availableSlots = Math.max(0, maxLines - prev.completedLines.length);
            const newlyCompleted = LINE_INDEXES
                .map((indexes, idx) => ({ indexes, idx }))
                .filter(line => !prev.completedLines.includes(line.idx))
                .filter(line => line.indexes.every(i => nextCompletedCells.includes(displayCells[i].id)))
                .slice(0, availableSlots);

            newLineCount = newlyCompleted.length;
            lineXpAward = newLineCount * lineRewardXP;

            if (newLineCount > 0) {
                setRecentLines(newlyCompleted.map(l => l.idx));
                setTimeout(() => setRecentLines([]), 1400);
            }

            if (newLineCount === 0 && availableSlots === 0) {
                toast.error(`하루에 최대 ${maxLines} 빙고까지만 인정돼요.`);
            } else if (newLineCount > 0) {
                toast.success(`빙고 ${newLineCount}개 완료! +${lineXpAward} XP`);
            }

            if (nextCompletedCells.length === 9) {
                fullBoardAward = 200;
                toast.success('전체 9칸 완료! +200 XP');
            }

            return {
                ...prev,
                completedCells: nextCompletedCells,
                completedLines: [...prev.completedLines, ...newlyCompleted.map(l => l.idx)],
            };
        });

        if (cell.xp > 0) {
            addXP(cell.xp).catch(console.error);
        }
        if (lineXpAward > 0) {
            addXP(lineXpAward).catch(console.error);
        }
        if (fullBoardAward > 0) {
            addXP(fullBoardAward).catch(console.error);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur">
            <div className="w-full max-w-lg rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--color-text)]">🟦 데일리 빙고</h3>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                            셀을 완료하면 XP를 획득하고, 빙고 1줄마다 {lineRewardXP} XP! (최대 {maxLines}빙고 인정)
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition"
                    >
                        닫기
                    </button>
                </div>

                <div className="mb-3 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                    <span>완료 셀: {progress.completedCells.length}/9</span>
                    <span>빙고: {completedLineCount}/{maxLines} · 남은 인정: {remainingLines}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {displayCells.map((cell, index) => {
                        const cellLines = lineMembership.get(index) || [];
                        const inCompletedLine = cellLines.some(li => progress.completedLines.includes(li));
                        const inRecentLine = cellLines.some(li => recentLines.includes(li));
                        const isDone = progress.completedCells.includes(cell.id);
                        return (
                            <button
                                key={cell.id || index}
                                type="button"
                                onClick={() => handleCompleteCell(cell.id)}
                                className={`group relative flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center transition-all ${isDone
                                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
                                    : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text)] hover:border-[var(--color-primary)]/60 hover:bg-[var(--color-bg-elevated)]'
                                    } ${inCompletedLine ? 'ring-2 ring-emerald-400/50' : ''} ${inRecentLine ? 'animate-pulse' : ''}`}
                                disabled={isDone}
                            >
                                <span className="text-2xl">{isDone ? '✅' : '🧩'}</span>
                                <span className="text-sm font-semibold line-clamp-2">{cell.text}</span>
                                <span className="text-[11px] text-[var(--color-text-tertiary)]">+{cell.xp} XP</span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-[11px] text-[var(--color-text-tertiary)]">
                    하루 기준으로 진행도가 초기화됩니다. 이미 완료한 셀은 다시 누를 수 없습니다.
                </div>

                {progress.completedLines.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                        {progress.completedLines.map(idx => (
                            <span
                                key={idx}
                                className={`rounded-full px-2 py-1 font-semibold ${recentLines.includes(idx) ? 'bg-emerald-400/30 text-emerald-900 animate-pulse' : 'bg-emerald-500/20 text-emerald-200'}`}
                            >
                                {LINE_LABELS[idx] || `Line ${idx + 1}`}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

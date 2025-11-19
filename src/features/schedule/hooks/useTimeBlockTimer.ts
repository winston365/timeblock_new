import { useState, useEffect, useCallback } from 'react';
import type { TimeBlockState } from '@/shared/types/domain';

interface UseTimeBlockTimerProps {
    state: TimeBlockState;
    blockId: string;
    isLocked: boolean;
    onToggleLock?: () => void;
    onUpdateBlockState?: (blockId: string, updates: Partial<TimeBlockState>) => Promise<void>;
    tasksCount: number;
}

export const useTimeBlockTimer = ({
    state,
    blockId,
    isLocked,
    onToggleLock,
    onUpdateBlockState,
    tasksCount
}: UseTimeBlockTimerProps) => {
    const [timerElapsed, setTimerElapsed] = useState(0);

    useEffect(() => {
        if (!state?.lockTimerStartedAt) {
            setTimerElapsed(0);
            return;
        }

        const updateTimer = async () => {
            const elapsed = Math.floor((Date.now() - state.lockTimerStartedAt!) / 1000);
            const duration = (state.lockTimerDuration || 180000) / 1000;

            if (elapsed >= duration) {
                setTimerElapsed(duration);
                if (!isLocked && onToggleLock) {
                    onToggleLock();
                    try {
                        const { updateBlockState } = await import('@/data/repositories/dailyDataRepository');
                        await updateBlockState(blockId, {
                            lockTimerStartedAt: null,
                            lockTimerDuration: undefined,
                        });
                    } catch (error) {
                        console.error('Failed to clear timer state:', error);
                    }
                }
            } else {
                setTimerElapsed(elapsed);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [state?.lockTimerStartedAt, state?.lockTimerDuration, isLocked, onToggleLock, blockId]);

    const handleStartLockTimer = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (tasksCount === 0) {
            alert('빈 블록은 잠글 수 없습니다. 작업을 먼저 추가해주세요.');
            return;
        }
        if (onUpdateBlockState) {
            try {
                await onUpdateBlockState(blockId, {
                    lockTimerStartedAt: Date.now(),
                    lockTimerDuration: 180000,
                });
            } catch (error) {
                console.error('Failed to start lock timer:', error);
            }
        }
    };

    const handleCancelLockTimer = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onUpdateBlockState) {
            try {
                await onUpdateBlockState(blockId, {
                    lockTimerStartedAt: null,
                    lockTimerDuration: undefined,
                });
            } catch (error) {
                console.error('Failed to cancel lock timer:', error);
            }
        }
    };

    const formatRemainingTime = useCallback(() => {
        if (!state?.lockTimerStartedAt) return '3:00';
        const duration = (state.lockTimerDuration || 180000) / 1000;
        const remaining = Math.max(duration - timerElapsed, 0);
        const mins = Math.floor(remaining / 60);
        const secs = Math.floor(remaining % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, [state?.lockTimerStartedAt, state?.lockTimerDuration, timerElapsed]);

    return {
        timerElapsed,
        handleStartLockTimer,
        handleCancelLockTimer,
        formatRemainingTime
    };
};

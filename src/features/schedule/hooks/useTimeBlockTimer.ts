/**
 * useTimeBlockTimer - 타임블록 잠금 타이머 관리 훅
 *
 * @role 타임블록 잠금 대기 타이머의 시작, 취소, 경과 시간 추적
 * @responsibilities
 *   - 잠금 타이머 시작 및 취소 핸들러 제공
 *   - 타이머 경과 시간 추적 및 자동 잠금 실행
 *   - 남은 시간 포맷팅 유틸리티 제공
 * @dependencies
 *   - dailyDataRepository: 블록 상태 업데이트
 *   - TimeBlockState: 타이머 상태 타입
 */

import { useState, useEffect, useCallback } from 'react';
import type { TimeBlockState } from '@/shared/types/domain';

/**
 * useTimeBlockTimer 훅 Props
 */
interface UseTimeBlockTimerProps {
    /** 타임블록 상태 */
    state: TimeBlockState;
    /** 타임블록 ID */
    blockId: string;
    /** 현재 잠금 여부 */
    isLocked: boolean;
    /** 잠금 토글 콜백 */
    onToggleLock?: () => void;
    /** 블록 상태 업데이트 콜백 */
    onUpdateBlockState?: (blockId: string, updates: Partial<TimeBlockState>) => Promise<void>;
    /** 블록 내 작업 수 */
    tasksCount: number;
}

/**
 * 타임블록 잠금 타이머 관리 훅
 *
 * @param props - 타이머 설정 props
 * @param props.state - 타임블록 상태
 * @param props.blockId - 타임블록 ID
 * @param props.isLocked - 현재 잠금 여부
 * @param props.onToggleLock - 잠금 토글 콜백
 * @param props.onUpdateBlockState - 블록 상태 업데이트 콜백
 * @param props.tasksCount - 블록 내 작업 수
 * @returns 타이머 경과 시간 및 핸들러 함수들
 */
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

    /**
     * 잠금 타이머 시작 핸들러
     *
     * @param e - 마우스 클릭 이벤트
     */
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

    /**
     * 잠금 타이머 취소 핸들러
     *
     * @param e - 마우스 클릭 이벤트
     */
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

    /**
     * 남은 시간 포맷팅
     *
     * @returns "분:초" 형식의 남은 시간 문자열
     */
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

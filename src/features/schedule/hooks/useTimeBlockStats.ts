/**
 * useTimeBlockStats - 타임블록 통계 계산 훅
 *
 * @role 타임블록 내 작업들의 XP, 소요시간 통계 계산
 * @responsibilities
 *   - 총 XP 계산
 *   - 총 소요시간 계산
 *   - 완료/미완료 소요시간 분리 계산
 * @dependencies
 *   - calculateTaskXP: XP 계산 유틸리티
 */

import { useMemo } from 'react';
import type { Task } from '@/shared/types/domain';
import { calculateTaskXP } from '@/shared/lib/utils';

/**
 * 타임블록 통계 계산 훅
 *
 * @param tasks - 통계를 계산할 작업 배열
 * @returns 타임블록 통계 객체 (maxXP, totalDuration, completedDuration, pendingDuration)
 */
export const useTimeBlockStats = (tasks: Task[]) => {
    const stats = useMemo(() => {
        const maxXP = tasks.reduce((sum, task) => sum + calculateTaskXP(task), 0);

        const totalDuration = tasks.reduce((sum, task) => sum + task.adjustedDuration, 0);

        const completedDuration = tasks
            .filter(task => task.completed)
            .reduce((sum, task) => sum + task.adjustedDuration, 0);

        const pendingDuration = tasks
            .filter(task => !task.completed)
            .reduce((sum, task) => sum + task.adjustedDuration, 0);

        return {
            maxXP,
            totalDuration,
            completedDuration,
            pendingDuration
        };
    }, [tasks]);

    return stats;
};

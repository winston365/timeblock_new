import { useMemo } from 'react';
import type { Task } from '@/shared/types/domain';
import { calculateTaskXP } from '@/shared/lib/utils';

export const useTimeBlockStats = (tasks: Task[]) => {
    const stats = useMemo(() => {
        const maxXP = tasks.reduce((sum, task) => sum + calculateTaskXP(task), 0);

        const totalDuration = tasks.reduce((sum, task) => sum + task.adjustedDuration, 0);

        const completedDuration = tasks
            .filter(t => t.completed)
            .reduce((sum, task) => sum + task.adjustedDuration, 0);

        const pendingDuration = tasks
            .filter(t => !t.completed)
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

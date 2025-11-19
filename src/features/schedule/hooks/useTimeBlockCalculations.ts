import { useMemo } from 'react';

interface UseTimeBlockCalculationsProps {
    block: {
        start: number;
        end: number;
    };
    isCurrentBlock: boolean;
    pendingDuration: number;
}

export type TimeStatus = 'comfortable' | 'balanced' | 'tight' | 'critical';

export const useTimeBlockCalculations = ({
    block,
    isCurrentBlock,
    pendingDuration
}: UseTimeBlockCalculationsProps) => {

    const timeRemaining = useMemo(() => {
        if (!isCurrentBlock) return null;

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const blockEndMinutes = block.end * 60;
        const currentMinutes = currentHour * 60 + currentMinute;
        const remainingMinutes = blockEndMinutes - currentMinutes;

        if (remainingMinutes <= 0) return { hours: 0, minutes: 0, text: '0m', totalMinutes: 0 };

        const hours = Math.floor(remainingMinutes / 60);
        const minutes = remainingMinutes % 60;

        let text = '';
        if (hours > 0 && minutes > 0) {
            text = `${hours}h${minutes}m`;
        } else if (hours > 0) {
            text = `${hours}h`;
        } else {
            text = `${minutes}m`;
        }

        return { hours, minutes, text, totalMinutes: remainingMinutes };
    }, [block.end, isCurrentBlock]);

    const remainingMinutes = timeRemaining?.totalMinutes || 0;

    const timeStatus: TimeStatus = useMemo(() => {
        if (pendingDuration === 0) return 'balanced';
        const ratio = remainingMinutes / pendingDuration;
        if (ratio >= 1.3) return 'comfortable';
        if (ratio >= 1.15) return 'balanced';
        if (ratio >= 0.9) return 'tight';
        return 'critical';
    }, [pendingDuration, remainingMinutes]);

    const progressPercentage = useMemo(() => {
        if (pendingDuration === 0) return 0;
        const percentage = (pendingDuration / remainingMinutes) * 100;
        return Math.min(Math.max(percentage, 0), 100);
    }, [pendingDuration, remainingMinutes]);

    const formatMinutesToHM = (minutes: number): string => {
        if (minutes === 0) return '0m';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        if (hours > 0 && mins > 0) {
            return `${hours}h${mins}m`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else {
            return `${mins}m`;
        }
    };

    return {
        timeRemaining,
        remainingMinutes,
        timeStatus,
        progressPercentage,
        formatMinutesToHM
    };
};

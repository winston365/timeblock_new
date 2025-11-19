import React from 'react';
import { TimeStatus } from '../hooks/useTimeBlockCalculations';

interface TimeBlockStatusProps {
    timeStatus: TimeStatus;
    remainingMinutes: number;
    pendingDuration: number;
    formatMinutesToHM: (minutes: number) => string;
}

export const TimeBlockStatus: React.FC<TimeBlockStatusProps> = ({
    timeStatus,
    remainingMinutes,
    pendingDuration,
    formatMinutesToHM
}) => {
    const statusStyles = {
        comfortable: {
            badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
            fill: 'bg-emerald-500',
        },
        balanced: {
            badge: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
            fill: 'bg-indigo-500',
        },
        tight: {
            badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
            fill: 'bg-amber-500',
        },
        critical: {
            badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
            fill: 'bg-rose-500',
        },
    };

    const getStatusText = (): string => {
        const texts = {
            comfortable: '여유',
            balanced: '적정',
            tight: '촉박',
            critical: '위험'
        };
        return texts[timeStatus];
    };

    const statusStyle = statusStyles[timeStatus];
    const plannedWidth = remainingMinutes ? Math.min((pendingDuration / (remainingMinutes || 1)) * 100, 100) : 0;

    return (
        <div className="mt-4 lg:mt-0 lg:ml-6 flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
            <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-bold ${statusStyle.badge.split(' ')[1]}`}>
                    {getStatusText()}
                </span>
                <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                    남은 시간: {formatMinutesToHM(remainingMinutes)}
                </span>
            </div>
            <div className="h-8 w-[1px] bg-[var(--color-border)]"></div>
            <div className="w-24 flex flex-col gap-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                    <div
                        className={`h-full rounded-full ${statusStyle.fill}`}
                        style={{ width: `${plannedWidth}%` }}
                    />
                </div>
                <span className="text-[10px] text-[var(--color-text-tertiary)] text-right">
                    계획 대비
                </span>
            </div>
        </div>
    );
};

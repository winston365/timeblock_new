import React from 'react';
import type { TimeBlockState } from '@/shared/types/domain';

interface TimeBlockHeaderProps {
    block: {
        id: string;
        label: string;
        start: number;
        end: number;
    };
    isCurrentBlock: boolean;
    isPastBlock: boolean;
    tasksCount: number;
    maxXP: number;
    state: TimeBlockState;
    onToggleExpand: () => void;
    onToggleLock?: () => void;
    toggleFocusMode: () => void;
    timer: {
        formatRemainingTime: () => string;
        handleStartLockTimer: (e: React.MouseEvent) => void;
        handleCancelLockTimer: (e: React.MouseEvent) => void;
    };
    children?: React.ReactNode;
}

export const TimeBlockHeader: React.FC<TimeBlockHeaderProps> = ({
    block,
    isCurrentBlock,
    isPastBlock,
    tasksCount,
    maxXP,
    state,
    onToggleExpand,
    onToggleLock,
    toggleFocusMode,
    timer,
    children
}) => {
    const headerClassName = [
        'flex flex-col gap-3 cursor-pointer px-4 py-3 select-none lg:flex-row lg:items-center lg:justify-between transition-colors duration-200',
        isCurrentBlock ? 'bg-[var(--color-bg-elevated)]' : 'bg-transparent',
        isPastBlock ? 'py-2' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={headerClassName} onClick={onToggleExpand}>
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Left: Time Label & Badges */}
                <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold tracking-tight ${isCurrentBlock ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                        {block.start.toString().padStart(2, '0')}:00 - {block.end.toString().padStart(2, '0')}:00
                    </span>

                    <div className="flex items-center gap-2 text-[10px] font-medium opacity-80">
                        {state?.isLocked ? (
                            <span className="text-amber-500">🔒</span>
                        ) : (
                            <>
                                <span className="text-[var(--color-text-tertiary)]">
                                    {tasksCount} tasks
                                </span>
                                {maxXP > 0 && (
                                    <span className="text-[var(--color-reward)]">
                                        • {maxXP} XP
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isCurrentBlock && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleFocusMode();
                            }}
                            className="rounded-lg bg-[var(--color-primary)]/10 p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                            title="Focus Mode"
                        >
                            🎯
                        </button>
                    )}
                    {!state?.isLocked && !isPastBlock && (
                        state?.lockTimerStartedAt ? (
                            <div className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-elevated)] px-2 py-1">
                                <span className="text-xs font-mono text-[var(--color-primary)]">{timer.formatRemainingTime()}</span>
                                <button
                                    onClick={timer.handleCancelLockTimer}
                                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={timer.handleStartLockTimer}
                                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)] transition-colors"
                            >
                                ⏱️ 3m
                            </button>
                        )
                    )}

                    {/* Lock Button (Only show if needed or locked) */}
                    {(state?.isLocked || (!isPastBlock && tasksCount > 0)) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleLock?.();
                            }}
                            className={`rounded-lg p-1.5 transition-colors ${state?.isLocked ? 'text-amber-500 bg-amber-500/10' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]'}`}
                            title={state?.isLocked ? 'Unlock' : 'Lock Block'}
                        >
                            {state?.isLocked ? '🔓' : '🔒'}
                        </button>
                    )}
                </div>
            </div>

            {/* Status Panel (Current Block Only) */}
            {children}
        </div>
    );
};

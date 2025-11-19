import React from 'react';
import type { TimeBlockState } from '@/shared/types/domain';
import type { TimeStatus } from '../hooks/useTimeBlockCalculations';

const STATUS_META: Record<TimeStatus, { label: string; badge: string }> = {
  comfortable: {
    label: 'Comfort',
    badge: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
  },
  balanced: {
    label: 'On Track',
    badge: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200'
  },
  tight: {
    label: 'Tight',
    badge: 'border-amber-400/40 bg-amber-500/10 text-amber-300'
  },
  critical: {
    label: 'Critical',
    badge: 'border-rose-400/40 bg-rose-500/10 text-rose-200'
  }
};

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
  timeStatus: TimeStatus;
  timeRemainingText?: string | null;
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
  timeStatus,
  timeRemainingText,
  onToggleExpand,
  onToggleLock,
  toggleFocusMode,
  timer,
  children
}) => {
  const headerClassName = [
    'flex cursor-pointer flex-col gap-4 px-5 py-4 select-none transition-colors duration-200',
    isCurrentBlock ? 'bg-[var(--color-bg-elevated)]/70 backdrop-blur-[2px]' : 'bg-transparent'
  ].join(' ');

  const timeRangeLabel = `${block.start.toString().padStart(2, '0')}:00 - ${block.end
    .toString()
    .padStart(2, '0')}:00`;

  const showTimerControls = !state?.isLocked && !isPastBlock;

  return (
    <div className={headerClassName} onClick={onToggleExpand}>
      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--color-bg-tertiary)]/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              {block.label}
            </span>
            {isCurrentBlock && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_META[timeStatus].badge}`}>
                {STATUS_META[timeStatus].label}
              </span>
            )}
            {timeRemainingText && (
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                {timeRemainingText} left
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className={`font-mono text-lg font-bold tracking-tight ${isCurrentBlock ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
              {timeRangeLabel}
            </span>
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-[var(--color-text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <span className="uppercase tracking-wide text-[10px] text-[var(--color-text-tertiary)]">tasks</span>
                {tasksCount}
              </span>
              {maxXP > 0 && (
                <span className="inline-flex items-center gap-1 text-[var(--color-reward)]">
                  <span className="uppercase tracking-wide text-[10px] text-[var(--color-text-tertiary)]">xp</span>
                  {maxXP}
                </span>
              )}
              {state?.isLocked && (
                <span className="text-amber-400">Locked</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isCurrentBlock && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFocusMode();
              }}
              className="inline-flex items-center gap-1 rounded-full border border-transparent bg-[var(--color-primary)]/15 px-3 py-1 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-white"
            >
              Focus Mode
            </button>
          )}
          {showTimerControls &&
            (state?.lockTimerStartedAt ? (
              <div className="flex items-center gap-2 rounded-full bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                <span className="font-mono">{timer.formatRemainingTime()}</span>
                <button
                  onClick={timer.handleCancelLockTimer}
                  className="text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-danger)]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={timer.handleStartLockTimer}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                Warm-up 3m
              </button>
            ))}
          {(state?.isLocked || (!isPastBlock && tasksCount > 0)) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock?.();
              }}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${state?.isLocked ? 'bg-amber-500/15 text-amber-400' : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]'}`}
            >
              {state?.isLocked ? 'Unlock Block' : 'Lock Block'}
            </button>
          )}
        </div>
      </div>

      {children}
    </div>
  );
};

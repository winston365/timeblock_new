import React from 'react';
import type { TimeBlockState } from '@/shared/types/domain';
import type { TimeStatus } from '../hooks/useTimeBlockCalculations';

const CONTEXT_META = {
  current: {
    label: '현재',
    className: 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
  },
  past: {
    label: '지난',
    className: 'border-[var(--color-border)] text-[var(--color-text-tertiary)]'
  },
  upcoming: {
    label: '예정',
    className: 'border-[var(--color-reward)]/40 text-[var(--color-reward)]'
  }
} as const;

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
  timeRemainingLabel: string;
  completionPercentage: number;
  needsPlanBoost: boolean;
  planLoadRatio: number;
  onRequestAddTask?: () => void;
  onToggleExpand: () => void;
  onToggleLock?: () => void;
  timer: {
    formatRemainingTime: () => string;
    handleStartLockTimer: (e: React.MouseEvent) => void;
    handleCancelLockTimer: (e: React.MouseEvent) => void;
  };
  remainingMinutes?: number;
  formatMinutesToHM?: (minutes: number) => string;
  children?: React.ReactNode;
}

export const TimeBlockHeader: React.FC<TimeBlockHeaderProps> = ({
  block,
  isCurrentBlock,
  isPastBlock,
  tasksCount,
  maxXP,
  state,
  completionPercentage,
  onToggleExpand,
  timer,
  remainingMinutes = 0,
  formatMinutesToHM = (m) => `${m}m`,
  children
}) => {
  const timeRangeLabel = `${block.start.toString().padStart(2, '0')}:00-${block.end.toString().padStart(2, '0')}:00`;
  const contextKey = isCurrentBlock ? 'current' : isPastBlock ? 'past' : 'upcoming';
  const context = CONTEXT_META[contextKey];
  const showTimerControls = !state?.isLocked && !isPastBlock && isCurrentBlock;
  const remainingDisplay = formatMinutesToHM(remainingMinutes);

  const headerClassName = [
    'relative flex cursor-pointer items-center gap-3 rounded-xl border bg-[var(--color-bg-elevated)]/60 px-3 py-2 select-none transition-colors duration-200 backdrop-blur-sm',
    isCurrentBlock
      ? 'border-[var(--color-primary)]/30 shadow-[0_4px_15px_rgba(99,102,241,0.15)]'
      : 'border-[var(--color-border)] hover:border-[var(--color-border-light)]'
  ].join(' ');

  return (
    <div className={headerClassName} onClick={onToggleExpand}>
      {/* 왼쪽: 블록 정보 */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        {/* 컨텍스트 뱃지 */}
        <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${context.className}`}>
          {context.label}
        </span>

        {/* 블록명 + 시간 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-[var(--color-text)] truncate">{block.label}</span>
          <span className="text-[11px] text-[var(--color-text-tertiary)] shrink-0">{timeRangeLabel}</span>
        </div>

        {/* 진행률 */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
            <div
              className="h-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${Math.min(Math.max(completionPercentage, 0), 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
            {Math.round(completionPercentage)}%
          </span>
        </div>
      </div>

      {/* 오른쪽: 상태 정보 */}
      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
        {/* 작업/XP 요약 */}
        <div className="hidden md:flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)]">
          <span>{tasksCount}개</span>
          {maxXP > 0 && <span className="text-[var(--color-reward)]">+{maxXP}XP</span>}
        </div>

        {/* 남은 시간 (현재 블록 아닐 때) */}
        {!isCurrentBlock && remainingMinutes > 0 && (
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            {remainingDisplay}
          </span>
        )}

        {/* 상태 뱃지들 */}
        {state?.isLocked && (
          <span className="text-[11px] text-amber-400">🔒</span>
        )}
        {state?.isPerfect && (
          <span className="text-[11px] text-yellow-400" title="Perfect Plan">👑</span>
        )}

        {/* 집중 타이머 (현재 블록만) */}
        {showTimerControls && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              if (state?.lockTimerStartedAt) {
                timer.handleCancelLockTimer(e);
              } else {
                timer.handleStartLockTimer(e);
              }
            }}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${state?.lockTimerStartedAt
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
              : 'border-[var(--color-primary)]/50 bg-[var(--color-bg)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10'
              }`}
          >
            <span>{state?.lockTimerStartedAt ? '🔒' : '⏱️'}</span>
            <span className="tabular-nums">{timer.formatRemainingTime()}</span>
          </button>
        )}
      </div>

      {children}
    </div>
  );
};

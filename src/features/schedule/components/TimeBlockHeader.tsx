import React from 'react';
import type { TimeBlockState } from '@/shared/types/domain';
import type { TimeStatus } from '../hooks/useTimeBlockCalculations';

const CONTEXT_META = {
  current: {
    label: '현재 블록',
    className: 'border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
  },
  past: {
    label: '지난 블록',
    className: 'border border-[var(--color-border)] text-[var(--color-text-tertiary)]'
  },
  upcoming: {
    label: '예정 블록',
    className: 'border border-[var(--color-reward)]/40 text-[var(--color-reward)]'
  }
} as const;

const STATUS_META: Record<TimeStatus, { icon: string; label: string; className: string }> = {
  plan_light: {
    icon: 'PL',
    label: '계획 부족',
    className: 'bg-sky-500/15 text-sky-100 border-sky-300/30'
  },
  comfortable: {
    icon: 'OK',
    label: '여유',
    className: 'bg-emerald-500/15 text-emerald-200 border-emerald-300/30'
  },
  balanced: {
    icon: '=',
    label: '균형',
    className: 'bg-indigo-500/15 text-indigo-200 border-indigo-300/30'
  },
  tight: {
    icon: '!',
    label: '빠듯',
    className: 'bg-amber-500/15 text-amber-50 border-amber-300/30'
  },
  critical: {
    icon: '!!',
    label: '긴급',
    className: 'bg-rose-500/20 text-rose-100 border-rose-500/40'
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
  timeRemainingLabel,
  completionPercentage,
  needsPlanBoost,
  planLoadRatio,
  onRequestAddTask,
  onToggleExpand,
  onToggleLock,
  timer,
  children
}) => {
  const headerClassName = [
    'flex cursor-pointer flex-col gap-3 px-5 py-4 select-none transition-colors duration-200 rounded-t-2xl',
    isCurrentBlock ? 'bg-[var(--color-bg-elevated)]/80 backdrop-blur-sm' : 'bg-transparent'
  ].join(' ');

  const timeRangeLabel = `${block.start.toString().padStart(2, '0')}:00 - ${block.end.toString().padStart(2, '0')}:00`;
  const contextKey = isCurrentBlock ? 'current' : isPastBlock ? 'past' : 'upcoming';
  const context = CONTEXT_META[contextKey];
  const statusKey = STATUS_META[timeStatus] ? timeStatus : 'balanced';
  const statusBadge = STATUS_META[statusKey];
  const showTimerControls = !state?.isLocked && !isPastBlock;
  const showRemainingChip = !isCurrentBlock;

  return (
    <div className={headerClassName} onClick={onToggleExpand}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold text-[var(--color-text)]">{block.label}</span>
            <span className="text-sm text-[var(--color-text-tertiary)]">{timeRangeLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold ${context.className}`}>
              {context.label}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-semibold ${statusBadge.className}`}>
              <span aria-hidden="true">{statusBadge.icon}</span>
              {statusBadge.label}
            </span>
            {showRemainingChip && (
              <span className="rounded-full bg-[var(--color-bg-tertiary)]/70 px-3 py-1 text-[12px] font-semibold text-[var(--color-text-secondary)]">
                남은 {timeRemainingLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <span className="text-[var(--color-text-tertiary)]">작업</span>
            {tasksCount}개
          </span>
          {maxXP > 0 && (
            <span className="inline-flex items-center gap-1 text-[var(--color-reward)]">
              <span className="text-[var(--color-text-tertiary)]">보상</span>
              {maxXP} XP
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className="text-[var(--color-text-tertiary)]">진행률</span>
            {Math.round(completionPercentage)}%
          </span>
          {state?.isLocked && (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <span aria-hidden="true">🔒</span>
              잠금 중
            </span>
          )}
          {state?.isPerfect && (
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/50 bg-yellow-400/10 px-2 py-0.5 text-xs font-bold text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.3)] animate-pulse">
              <span aria-hidden="true">👑</span>
              Perfect Plan
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1" onClick={e => e.stopPropagation()}>
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
            className="flex flex-1 min-w-[140px] flex-col rounded-xl border border-[var(--color-border)] px-3 py-2 text-left transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <span className="text-xs font-semibold text-[var(--color-text)]">타이머</span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              {state?.lockTimerStartedAt ? `남은 ${timer.formatRemainingTime()}` : '3분 뒤 자동 잠금'}
            </span>
          </button>
        )}

        <button
          type="button"
          role="switch"
          aria-checked={state?.isLocked ?? false}
          onClick={e => {
            e.stopPropagation();
            onToggleLock?.();
          }}
          className="flex flex-1 min-w-[140px] items-center justify-between rounded-xl border border-[var(--color-border)] px-3 py-2 text-left transition hover:border-amber-400"
        >
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[var(--color-text)]">블록 잠금</span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              {state?.isLocked ? '잠금 해제' : '작업 완료 시 잠금'}
            </span>
          </div>
          <div
            className={`relative h-5 w-10 rounded-full transition ${state?.isLocked ? 'bg-amber-400' : 'bg-[var(--color-border)]'}`}
          >
            <span
              className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white transition ${state?.isLocked ? 'right-1' : 'left-1'
                }`}
            />
          </div>
        </button>

        {needsPlanBoost && !isPastBlock && onRequestAddTask && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onRequestAddTask();
            }}
            className="flex flex-1 min-w-[140px] flex-col rounded-xl border border-dashed border-rose-400/60 bg-rose-500/5 px-3 py-2 text-left text-rose-100 transition hover:border-rose-400"
          >
            <span className="text-xs font-semibold">계획 보강 필요</span>
            <span className="text-[11px] text-rose-100/80">{planLoadRatio.toFixed(1)}배 작업 추가 추천</span>
          </button>
        )}
      </div>

      {children}
    </div>
  );
};

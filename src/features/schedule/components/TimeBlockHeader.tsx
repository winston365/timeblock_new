import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
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
  remainingMinutes?: number;
  formatMinutesToHM?: (minutes: number) => string;
  children?: React.ReactNode;
}

const STATUS_CONFIG: Record<
  TimeStatus,
  {
    icon: string;
    label: string;
    copy: string;
    border: string;
    track: string;
    fill: string;
    ring?: string;
    glow?: string;
    textStyle?: string;
    actionLabel?: string;
    actionIcon?: string;
  }
> = {
  plan_light: {
    icon: 'PL',
    label: '계획 부족',
    copy: '시간이 넉넉해요',
    border: 'border-sky-500/45',
    track: 'bg-sky-500/18',
    fill: 'bg-gradient-to-r from-sky-200 via-sky-300 to-sky-200',
    glow: 'shadow-[0_0_10px_rgba(14,165,233,0.15)]',
    textStyle: 'font-medium text-sky-400',
    actionLabel: '작업 채우기',
    actionIcon: '📥'
  },
  comfortable: {
    icon: 'OK',
    label: '여유',
    copy: '여유가 있습니다',
    border: 'border-emerald-500/35',
    track: 'bg-emerald-500/18',
    fill: 'bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-200',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.15)]',
    textStyle: 'font-medium text-emerald-400',
    actionLabel: '작업 채우기',
    actionIcon: '📥'
  },
  balanced: {
    icon: '=',
    label: '균형',
    copy: '계획대로 진행 중',
    border: 'border-indigo-500/35',
    track: 'bg-indigo-500/18',
    fill: 'bg-gradient-to-r from-indigo-300 via-indigo-400 to-indigo-200',
    glow: 'shadow-[0_0_10px_rgba(99,102,241,0.15)]',
    textStyle: 'font-medium text-indigo-400',
    actionLabel: '상태 유지',
    actionIcon: '✨'
  },
  tight: {
    icon: '!',
    label: '빠듯',
    copy: '우선순위 조정 필요',
    border: 'border-amber-500/35',
    track: 'bg-amber-500/18',
    fill: 'bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    textStyle: 'font-bold text-amber-500',
    actionLabel: '우선순위 조정',
    actionIcon: '⚡'
  },
  critical: {
    icon: '!!',
    label: '긴급',
    copy: '즉시 집중 필요',
    border: 'border-rose-500/40',
    track: 'bg-rose-500/15',
    fill: 'bg-gradient-to-r from-rose-400 via-rose-500 to-rose-600',
    ring: 'ring-2 ring-rose-500/40',
    glow: 'shadow-[0_0_15px_rgba(244,63,94,0.3)]',
    textStyle: 'font-black text-rose-500',
    actionLabel: '미완료 미루기',
    actionIcon: '⏭️'
  }
};

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
  // onToggleLock is no longer used - timer-based lock only
  timer,
  remainingMinutes = 0,
  formatMinutesToHM = (m) => `${m}m`,
  children
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const config = STATUS_CONFIG[timeStatus];
  const headerClassName = [
    'relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-2xl border bg-[var(--color-bg-elevated)]/60 p-4 select-none shadow-[0_15px_40px_rgba(0,0,0,0.25)] transition-colors duration-200 backdrop-blur-sm',
    config.border,
    config.glow ?? '',
    config.ring ?? '',
    isCurrentBlock ? 'outline outline-1 outline-[var(--color-primary)]/40' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const timeRangeLabel = `${block.start.toString().padStart(2, '0')}:00 - ${block.end.toString().padStart(2, '0')}:00`;
  const contextKey = isCurrentBlock ? 'current' : isPastBlock ? 'past' : 'upcoming';
  const context = CONTEXT_META[contextKey];
  const statusKey = STATUS_META[timeStatus] ? timeStatus : 'balanced';
  const statusBadge = STATUS_META[statusKey];
  const showTimerControls = !state?.isLocked && !isPastBlock;
  const showRemainingChip = !isCurrentBlock;
  const remainingDisplay = timeRemainingLabel || formatMinutesToHM(remainingMinutes);

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRequestAddTask) {
      onRequestAddTask();
      toast.success('인박스/템플릿에서 작업을 채워요');
    } else {
      toast('곧 더 많은 액션이 추가될 예정이에요!', { icon: '🚧' });
    }
    setIsMenuOpen(false);
  };

  return (
    <div className={headerClassName} onClick={onToggleExpand}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${statusBadge.className}`}>
              <span aria-hidden="true">{config.icon}</span>
              {config.label}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${context.className}`}>
              {context.label}
            </span>
            {showRemainingChip && (
              <span className="rounded-full bg-[var(--color-bg-tertiary)]/70 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                남은 {remainingDisplay}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-[var(--color-text)]">{block.label}</span>
            <span className="text-sm text-[var(--color-text-tertiary)]">{timeRangeLabel}</span>
          </div>

          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {config.copy}
            {needsPlanBoost ? ' · 계획을 더 채우면 안정적이에요' : ''}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 text-right text-[12px] text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-text)]">진행 {Math.round(completionPercentage)}%</span>
          <span>작업 {tasksCount}개</span>
          {maxXP > 0 && <span className="text-[var(--color-reward)]">보상 {maxXP} XP</span>}
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

      <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]/60">
        <div
          className={`absolute left-0 top-0 h-full ${config.fill}`}
          style={{ width: `${Math.min(Math.max(completionPercentage, 0), 100)}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-bg-tertiary)]/70"
          onClick={() => setIsMenuOpen(prev => !prev)}
        >
          <span className="text-base">{config.actionIcon}</span>
          <span>{config.actionLabel}</span>
          <span className="text-[11px] text-[var(--color-text-tertiary)]">스마트 액션</span>
        </button>

        {needsPlanBoost && onRequestAddTask && (
          <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400 ring-1 ring-rose-500/30">
            보강 추천 {planLoadRatio.toFixed(1)}x
          </span>
        )}

        {isCurrentBlock && showTimerControls && (
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
            className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${state?.lockTimerStartedAt
              ? 'border-amber-500 bg-amber-500/15 text-amber-300'
              : 'border-[var(--color-primary)] bg-[var(--color-bg)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10'
              }`}
          >
            <span className="text-lg">{state?.lockTimerStartedAt ? '🔒' : '⏱️'}</span>
            <span className="tabular-nums">{timer.formatRemainingTime()}</span>
            <span className="text-[11px] opacity-80">{state?.lockTimerStartedAt ? '잠금 중' : '3분 집중'}</span>
          </button>
        )}
      </div>

      {isMenuOpen && (
        <div
          className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="mb-2 text-[11px] font-semibold text-[var(--color-text-tertiary)]">💡 스마트 제안</div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-[var(--color-bg-tertiary)]"
            onClick={handleActionClick}
          >
            <span className="text-base">{config.actionIcon}</span>
            <div className="flex flex-col">
              <span className="font-semibold text-[var(--color-text)]">{config.actionLabel}</span>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">상태에 맞춰 바로 실행</span>
            </div>
          </button>
        </div>
      )}

      {children}
    </div >
  );
};

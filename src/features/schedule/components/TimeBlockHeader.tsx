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

  // Status Calculation
  const config = STATUS_CONFIG[timeStatus];

  return (
    <div className={headerClassName} onClick={onToggleExpand}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold text-[var(--color-text)]">{block.label}</span>
            {block.label !== timeRangeLabel && (
              <span className="text-sm text-[var(--color-text-tertiary)]">{timeRangeLabel}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold ${context.className}`}>
              {context.label}
            </span>
            {!isCurrentBlock && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-semibold ${statusBadge.className}`}>
                <span aria-hidden="true">{statusBadge.icon}</span>
                {statusBadge.label}
              </span>
            )}
            {showRemainingChip && (
              <span className="rounded-full bg-[var(--color-bg-tertiary)]/70 px-3 py-1 text-[12px] font-semibold text-[var(--color-text-secondary)]">
                남은 {timeRemainingLabel}
              </span>
            )}
          </div>


        </div>

        {/* 3분 잠금 타이머 (중앙 배치 & 크기 확대) - Flex Flow 내 배치 */}
        {isCurrentBlock && showTimerControls && (
          <div className="flex flex-1 justify-center px-4">
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
              className={`flex items-center gap-3 rounded-xl border-2 px-6 py-3 shadow-lg transition-all hover:scale-105 active:scale-95 ${state?.lockTimerStartedAt
                ? 'border-amber-500 bg-amber-500/20 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                : 'border-[var(--color-primary)] bg-[var(--color-bg-elevated)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10'
                }`}
            >
              <span className={`text-3xl ${state?.lockTimerStartedAt ? 'animate-pulse' : ''}`}>
                {state?.lockTimerStartedAt ? '🔒' : '⏱️'}
              </span>
              <div className="flex flex-col items-start leading-none">
                <span className="text-2xl font-extrabold tabular-nums tracking-tight">
                  {timer.formatRemainingTime()}
                </span>
                <span className="text-xs font-bold opacity-90">
                  {state?.lockTimerStartedAt ? '잠금 중...' : '3분 집중 시작'}
                </span>
              </div>
            </button>
          </div>
        )}


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

      <div className="flex flex-col gap-2 pt-1" onClick={e => e.stopPropagation()}>
        {/* 통합 컨트롤 바 (타이머 + 상태 + 계획보강) */}
        {isCurrentBlock && (
          <div className={`relative flex items-center gap-2 rounded-xl border bg-[var(--color-bg-surface)] p-1.5 transition-all duration-300 ${config.border} ${config.ring ?? ''} ${config.glow ?? ''}`}>

            {/* Progress Border (Bottom) */}
            <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
              <div
                className="absolute bottom-0 left-0 h-[3px] bg-[var(--color-primary)]/80 transition-all duration-500"
                style={{ width: `${Math.min(completionPercentage, 100)}%` }}
              />
            </div>

            {/* 1. 타이머 컨트롤 (이동됨) */}

            {/* 2. 상태 바 (중앙) - 인터랙티브 배지 */}
            <div
              className="group relative flex flex-1 cursor-pointer items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-[var(--color-bg-tertiary)]/30"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs transition-all duration-300 ${config.textStyle}`}>
                  {config.label}
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">·</span>
                <span className={`text-xs transition-all duration-300 ${config.textStyle}`}>
                  {formatMinutesToHM(remainingMinutes)} 남음
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">
                  {Math.round(completionPercentage)}%
                </span>
                {/* 스마트 액션 힌트 (호버 시 표시) */}
                <span className="hidden text-[10px] text-[var(--color-primary)] opacity-0 transition-opacity group-hover:block group-hover:opacity-100">
                  👇 {config.actionLabel}
                </span>
              </div>

              {/* 스마트 액션 메뉴 */}
              {isMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[180px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-3 py-2 text-[10px] font-semibold text-[var(--color-text-tertiary)] bg-[var(--color-bg-tertiary)]/30">
                    💡 스마트 제안
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition hover:bg-[var(--color-bg-tertiary)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (config.actionLabel === '작업 채우기' && onRequestAddTask) {
                        onRequestAddTask();
                        toast.success('인박스에서 작업을 가져옵니다');
                      } else {
                        toast('이 기능은 곧 업데이트됩니다!', { icon: '🚧' });
                      }
                      setIsMenuOpen(false);
                    }}
                  >
                    <span className="text-base">{config.actionIcon}</span>
                    <div className="flex flex-col">
                      <span className="font-medium text-[var(--color-text)]">{config.actionLabel}</span>
                      <span className="text-[10px] text-[var(--color-text-tertiary)]">클릭하여 실행</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 3. 계획 보강 (우측, 필요시) */}
            {needsPlanBoost && onRequestAddTask && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onRequestAddTask();
                }}
                className="flex flex-col items-center rounded-lg bg-rose-500/10 px-2 py-1 text-rose-500 transition hover:bg-rose-500/20"
                title={`${planLoadRatio.toFixed(1)}배 작업 추가 추천`}
              >
                <span className="text-xs font-bold">+추가</span>
                <span className="text-[9px] opacity-80">보강</span>
              </button>
            )}
          </div>
        )}
      </div>

      {children}
    </div >
  );
};

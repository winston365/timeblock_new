import React from 'react';
import { TimeStatus } from '../hooks/useTimeBlockCalculations';

interface TimeBlockStatusProps {
  timeStatus: TimeStatus;
  remainingMinutes: number;
  pendingDuration: number;
  formatMinutesToHM: (minutes: number) => string;
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
  }
> = {
  plan_light: {
    icon: 'PL',
    label: '계획이 가벼워요',
    copy: '시간이 넉넉해요. 인박스/템플릿에서 몇 개 더 채워보는 건 어떨까요?',
    border: 'border-sky-500/45',
    track: 'bg-sky-500/18',
    fill: 'bg-gradient-to-r from-sky-200 via-sky-300 to-sky-200'
  },
  comfortable: {
    icon: 'OK',
    label: '여유 있음',
    copy: '남은 시간에 여유가 있습니다.',
    border: 'border-emerald-500/35',
    track: 'bg-emerald-500/18',
    fill: 'bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-200'
  },
  balanced: {
    icon: '=',
    label: '균형 유지',
    copy: '계획한 대로 진행 중입니다.',
    border: 'border-indigo-500/35',
    track: 'bg-indigo-500/18',
    fill: 'bg-gradient-to-r from-indigo-300 via-indigo-400 to-indigo-200'
  },
  tight: {
    icon: '!',
    label: '시간 빠듯',
    copy: '다음 작업 우선순위를 좁혀보세요.',
    border: 'border-amber-500/35',
    track: 'bg-amber-500/18',
    fill: 'bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200'
  },
  critical: {
    icon: '!!',
    label: '긴급',
    copy: '즉시 집중이 필요합니다.',
    border: 'border-rose-500/40',
    track: 'bg-rose-500/15',
    fill: 'bg-gradient-to-r from-rose-400 via-rose-500 to-rose-600',
    ring: 'ring-2 ring-rose-500/40'
  }
};

export const TimeBlockStatus: React.FC<TimeBlockStatusProps> = ({
  timeStatus,
  remainingMinutes,
  pendingDuration,
  formatMinutesToHM
}) => {
  const config = STATUS_CONFIG[timeStatus];
  const utilizationRatio = remainingMinutes > 0 ? pendingDuration / remainingMinutes : 1;
  const utilizationWidth = Math.min(Math.max(utilizationRatio * 100, 0), 100);
  const isOverrun = utilizationRatio >= 1;
  const isPlanLight = timeStatus === 'plan_light';

  return (
    <div
      className={[
        'mt-4 flex w-full flex-wrap items-center gap-4 rounded-xl border bg-[var(--color-bg)] px-4 py-3 text-left shadow-sm lg:mt-0',
        config.border,
        config.ring ?? ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          {config.icon}
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-[var(--color-text)]">{config.label}</span>
          <span className="text-xs text-[var(--color-text-tertiary)]">{config.copy}</span>
        </div>
      </div>
      <div className="ml-auto flex flex-1 flex-col gap-2 text-right lg:flex-row lg:items-center lg:text-left">
        <div className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {formatMinutesToHM(remainingMinutes)} 남음
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className={`relative h-[10px] w-full overflow-hidden rounded-full ${config.track}`}>
            {isPlanLight && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-sky-300/80" />
            )}
            <div
              className={`h-full rounded-full ${config.fill} transition-all duration-500`}
              style={{ width: `${utilizationWidth}%` }}
            />
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] lg:text-right">
            {isPlanLight ? '계획이 부족해요' : `계획 소요${isOverrun ? ' (초과)' : ''}`}
          </span>
        </div>
      </div>
    </div>
  );
};

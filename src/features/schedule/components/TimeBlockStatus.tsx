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
  comfortable: {
    icon: '😌',
    label: '여유 있음',
    copy: '남은 시간이 충분해요.',
    border: 'border-emerald-500/30',
    track: 'bg-emerald-500/15',
    fill: 'bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-200'
  },
  balanced: {
    icon: '🙂',
    label: '일정 맞춰야 함',
    copy: '계획대로 꾸준히 진행 중이에요.',
    border: 'border-indigo-500/30',
    track: 'bg-indigo-500/15',
    fill: 'bg-gradient-to-r from-indigo-300 via-indigo-400 to-indigo-200'
  },
  tight: {
    icon: '😣',
    label: '시간 촉박',
    copy: '다음 작업 속도를 높여야 해요.',
    border: 'border-amber-500/30',
    track: 'bg-amber-500/15',
    fill: 'bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200'
  },
  critical: {
    icon: '🚨',
    label: '긴급 조정 필요',
    copy: '즉시 우선순위를 조정하세요.',
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

  return (
    <div
      className={[
        'mt-4 flex w-full flex-wrap items-center gap-4 rounded-xl border bg-[var(--color-bg)] px-4 py-3 text-left shadow-sm lg:ml-6 lg:mt-0',
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
          <div className={`h-2 w-full overflow-hidden rounded-full ${config.track}`}>
            <div
              className={`h-full rounded-full ${config.fill} transition-all duration-500`}
              style={{ width: `${utilizationWidth}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--color-text-tertiary)] lg:text-right">
            계획 대비 소요{isOverrun ? ' (초과)' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

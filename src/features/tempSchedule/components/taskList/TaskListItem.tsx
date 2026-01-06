import { memo, useMemo } from 'react';

import type { RecurrenceRule, TempScheduleTask } from '@/shared/types/tempSchedule';
import { minutesToTimeStr } from '@/shared/lib/utils';

import { ArchivedBadge, DurationBadge, FavoriteBadge, RecurringBadge } from '../StatusBadges';
import { getDaysDiff, getTodayStr, normalizeYmd } from '../../utils/taskGrouping';

/** 임박 일정으로 간주하는 시간 (분) */
const IMMINENT_THRESHOLD_MINUTES = 60;

export interface TaskListItemProps {
  readonly task: TempScheduleTask;
  readonly onEdit: (task: TempScheduleTask) => void;
  readonly onDelete: (id: string) => void;
  readonly showDDay?: boolean;
  readonly isNextUp?: boolean;
  readonly currentTime: number;
}

const getDDayLabel = (dateStr: string): string => {
  const diff = getDaysDiff(dateStr);
  if (diff < 0) return `D${diff}`;
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === 2) return '모레';
  if (diff <= 7) return `D+${diff}`;
  return dateStr;
};

const isImminent = (task: TempScheduleTask): boolean => {
  const today = getTodayStr();
  const scheduledDate = normalizeYmd(task.scheduledDate) ?? today;
  if (scheduledDate !== today) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const minutesUntilStart = task.startTime - currentMinutes;

  return minutesUntilStart > 0 && minutesUntilStart <= IMMINENT_THRESHOLD_MINUTES;
};

const isPast = (task: TempScheduleTask): boolean => {
  const today = getTodayStr();
  const scheduledDate = normalizeYmd(task.scheduledDate) ?? today;

  if (scheduledDate < today) return true;

  if (scheduledDate === today) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return task.endTime < currentMinutes;
  }

  return false;
};

const isInProgress = (task: TempScheduleTask, currentMinutes: number): boolean => {
  const today = getTodayStr();
  const scheduledDate = normalizeYmd(task.scheduledDate) ?? today;
  if (scheduledDate !== today) return false;

  return task.startTime <= currentMinutes && currentMinutes < task.endTime;
};

const getImminentLabel = (task: TempScheduleTask): string | null => {
  const today = getTodayStr();
  const scheduledDate = normalizeYmd(task.scheduledDate) ?? today;

  if (scheduledDate !== today) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const minutesUntilStart = task.startTime - currentMinutes;

  if (minutesUntilStart <= 0) return null;
  if (minutesUntilStart <= IMMINENT_THRESHOLD_MINUTES) {
    return `${minutesUntilStart}분 후 시작`;
  }
  return null;
};

const getRecurrenceLabel = (recurrence: RecurrenceRule): string => {
  switch (recurrence.type) {
    case 'daily':
      return '매일';
    case 'weekly': {
      if (!recurrence.weeklyDays || recurrence.weeklyDays.length === 0) return '매주';
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayNames = recurrence.weeklyDays.sort((a, b) => a - b).map(d => days[d]);
      return `매주 ${dayNames.join(', ')}`;
    }
    case 'monthly':
      return '매월';
    case 'custom':
      return `${recurrence.intervalDays}일마다`;
    case 'none':
    default:
      return '1회';
  }
};

const formatTimeRange = (startTime: number, endTime: number): string => {
  return `${minutesToTimeStr(startTime)} - ${minutesToTimeStr(endTime)}`;
};

export const TaskListItem = memo(function TaskListItem({
  task,
  onEdit,
  onDelete,
  showDDay = false,
  isNextUp = false,
  currentTime,
}: TaskListItemProps) {
  const imminent = isImminent(task);
  const past = isPast(task);
  const inProgress = isInProgress(task, currentTime);
  const imminentLabel = getImminentLabel(task);
  const durationMinutes = task.endTime - task.startTime;
  const isRecurringTask = task.recurrence.type !== 'none';
  const isArchived = task.isArchived;

  const progressPercent = useMemo(() => {
    if (!inProgress) return 0;
    const totalDuration = task.endTime - task.startTime;
    const elapsed = currentTime - task.startTime;
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  }, [inProgress, task.startTime, task.endTime, currentTime]);

  return (
    <div
      className={`
        group flex items-start gap-3 rounded-xl border p-3 transition-all cursor-pointer relative overflow-hidden
        ${isArchived
          ? 'border-[var(--color-border)]/30 bg-[var(--color-bg-surface)]/30 opacity-50'
          : inProgress
            ? 'border-green-500/50 bg-green-500/10 shadow-md shadow-green-500/20 ring-2 ring-green-500/30'
            : imminent
              ? 'border-orange-500/50 bg-orange-500/10 shadow-md shadow-orange-500/20'
              : past
                ? 'border-[var(--color-border)]/50 bg-[var(--color-bg-surface)]/50 opacity-60'
                : isNextUp
                  ? 'border-blue-500/50 bg-blue-500/5'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-primary)]/50 hover:shadow-md'
        }
      `}
      onClick={() => onEdit(task)}
    >
      {inProgress && (
        <div
          className="absolute inset-0 bg-green-500/10 transition-all duration-1000"
          style={{ width: `${progressPercent}%` }}
        />
      )}

      <div
        className={`w-1.5 self-stretch rounded-full flex-shrink-0 z-10 ${past ? 'opacity-50' : ''}`}
        style={{ backgroundColor: task.color }}
      />

      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-center gap-2">
          {inProgress && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-bold animate-pulse">
              진행 중
            </span>
          )}
          {isNextUp && !inProgress && !imminent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
              다음
            </span>
          )}
          {task.favorite && <FavoriteBadge />}
          {isRecurringTask && <RecurringBadge />}
          {isArchived && <ArchivedBadge />}
          <span
            className={`font-semibold text-sm truncate ${
              past ? 'text-[var(--color-text-tertiary)] line-through' : 'text-[var(--color-text)]'
            }`}
          >
            {task.name}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <span
            className={`font-mono font-bold text-base ${
              inProgress
                ? 'text-green-400'
                : imminent
                  ? 'text-orange-400'
                  : past
                    ? 'text-[var(--color-text-tertiary)]'
                    : 'text-[var(--color-text)]'
            }`}
          >
            {formatTimeRange(task.startTime, task.endTime)}
          </span>
          <DurationBadge durationMinutes={durationMinutes} />
        </div>

        {inProgress && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-green-400 font-medium">
            <span>⏳</span>
            <span>{task.endTime - currentTime}분 남음</span>
            <span className="text-[var(--color-text-tertiary)]">({Math.round(progressPercent)}% 완료)</span>
          </div>
        )}

        {imminentLabel && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-orange-400 font-medium">
            <span className="animate-pulse">🔥</span>
            <span>{imminentLabel}</span>
          </div>
        )}

        {past && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
            <span>✅</span>
            <span>완료됨</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--color-text-tertiary)]">
          <span>{getRecurrenceLabel(task.recurrence)}</span>

          {showDDay && task.scheduledDate && task.recurrence.type === 'none' && (
            <>
              <span className="text-[var(--color-border)]">•</span>
              <span className={getDaysDiff(task.scheduledDate) <= 1 ? 'text-[var(--color-primary)] font-medium' : ''}>
                {getDDayLabel(task.scheduledDate)}
              </span>
            </>
          )}
        </div>

        {task.memo && (
          <div className="mt-1 text-[10px] text-[var(--color-text-tertiary)] truncate">💬 {task.memo}</div>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          title="편집"
          type="button"
        >
          ✏️
        </button>
        <button
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-tertiary)] hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('이 스케줄을 삭제하시겠습니까?')) {
              onDelete(task.id);
            }
          }}
          title="삭제"
          type="button"
        >
          🗑️
        </button>
      </div>
    </div>
  );
});

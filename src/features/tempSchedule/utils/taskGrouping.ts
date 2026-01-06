import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { getLocalDate } from '@/shared/lib/utils';

export interface DateGroup {
  readonly label: string;
  readonly emoji: string;
  readonly tasks: TempScheduleTask[];
  readonly sortOrder: number;
}

export const getTodayStr = (): string => {
  return getLocalDate();
};

/**
 * YYYY-MM-DD 문자열을 로컬 Date로 파싱
 * @note new Date('YYYY-MM-DD')는 환경에 따라 UTC로 해석될 수 있어 사용하지 않는다.
 */
export const parseYmdToLocalDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  const head = dateStr.slice(0, 10);
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(head);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;

  const date = new Date(year, monthIndex, day);
  if (date.getFullYear() !== year) return null;
  if (date.getMonth() !== monthIndex) return null;
  if (date.getDate() !== day) return null;
  return date;
};

export const normalizeYmd = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;

  const head = dateStr.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;

  return getLocalDate(parsed);
};

/**
 * 두 날짜 사이의 일수 차이 계산
 */
export const getDaysDiff = (dateStr: string, baseDate: string = getTodayStr()): number => {
  const normalizedDateStr = normalizeYmd(dateStr);
  const normalizedBaseDate = normalizeYmd(baseDate) ?? baseDate;

  if (!normalizedDateStr) return 0;

  const date = parseYmdToLocalDate(normalizedDateStr);
  const base = parseYmdToLocalDate(normalizedBaseDate);
  if (!date || !base) return 0;

  const diffTime = date.getTime() - base.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * 일회성 일정을 날짜 그룹으로 분류
 */
export const groupTasksByDate = (tasks: readonly TempScheduleTask[], baseDate: string = getTodayStr()): DateGroup[] => {
  const today = normalizeYmd(baseDate) ?? baseDate;

  const groups: Record<string, { label: string; emoji: string; tasks: TempScheduleTask[]; sortOrder: number }> = {};

  for (const task of tasks) {
    const date = normalizeYmd(task.scheduledDate) ?? today;
    const diff = getDaysDiff(date, today);

    let groupKey: string;
    let label: string;
    let emoji: string;
    let sortOrder: number;

    if (diff < 0) {
      groupKey = 'past';
      label = '지난 일정';
      emoji = '⏰';
      sortOrder = 99;
    } else if (diff === 0) {
      groupKey = 'today';
      label = '오늘';
      emoji = '📌';
      sortOrder = 0;
    } else if (diff === 1) {
      groupKey = 'tomorrow';
      label = '내일';
      emoji = '📅';
      sortOrder = 1;
    } else if (diff <= 7) {
      groupKey = 'thisWeek';
      label = '이번 주';
      emoji = '🗓️';
      sortOrder = 2;
    } else {
      groupKey = 'later';
      label = '다가오는 일정';
      emoji = '📆';
      sortOrder = 3;
    }

    if (!groups[groupKey]) {
      groups[groupKey] = { label, emoji, tasks: [], sortOrder };
    }

    groups[groupKey].tasks.push(task);
  }

  return Object.values(groups)
    .map(group => ({
      ...group,
      tasks: group.tasks.sort((a, b) => {
        const dateA = normalizeYmd(a.scheduledDate) ?? today;
        const dateB = normalizeYmd(b.scheduledDate) ?? today;
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return a.startTime - b.startTime;
      }),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

/**
 * 다음 예정 일정인지 확인 (오늘의 아직 시작 안 한 일정 중 가장 빠른 것)
 */
export const getNextUpcomingTask = (
  tasks: readonly TempScheduleTask[],
  currentMinutes: number,
  baseDate: string = getTodayStr()
): TempScheduleTask | null => {
  const today = normalizeYmd(baseDate) ?? baseDate;

  const upcoming = tasks
    .filter(t => {
      const date = normalizeYmd(t.scheduledDate) ?? today;
      return date === today && t.startTime > currentMinutes;
    })
    .sort((a, b) => a.startTime - b.startTime);

  return upcoming[0] ?? null;
};

export const splitTasksByRecurrence = (
  tasks: readonly TempScheduleTask[]
): { readonly recurring: TempScheduleTask[]; readonly oneTime: TempScheduleTask[] } => {
  const recurring: TempScheduleTask[] = [];
  const oneTime: TempScheduleTask[] = [];

  for (const task of tasks) {
    if (task.recurrence.type !== 'none') {
      recurring.push(task);
    } else {
      oneTime.push(task);
    }
  }

  return { recurring, oneTime };
};

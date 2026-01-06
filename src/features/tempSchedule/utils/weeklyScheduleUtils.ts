import { getLocalDate } from '@/shared/lib/utils';

export type FormattedWeekDate = {
  readonly day: number;
  readonly month: number;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
};

/**
 * Parses a YYYY-MM-DD string as a local Date.
 *
 * @note Avoids `new Date('YYYY-MM-DD')` because it can be interpreted as UTC.
 */
export const parseYmdToLocalDate = (dateStr: string): Date | null => {
  if (typeof dateStr !== 'string') return null;

  const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (!match) return null;

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year) return null;
  if (date.getMonth() !== month - 1) return null;
  if (date.getDate() !== day) return null;
  return date;
};

/**
 * Subpixel snap utility.
 *
 * Uses devicePixelRatio to align borders/lines to the same pixel grid.
 */
export const snapToPixel = (value: number): number => {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.round(value * dpr) / dpr;
};

export const formatDate = (dateStr: string): FormattedWeekDate => {
  const date = parseYmdToLocalDate(dateStr) ?? new Date(dateStr);
  const today = getLocalDate();
  const dayOfWeek = date.getDay();

  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    isToday: dateStr === today,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  };
};

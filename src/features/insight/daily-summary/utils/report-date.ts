/**
 * @file report-date.ts
 * @description Date utilities for daily summary report.
 */

import { getLocalDate } from '@/shared/lib/utils';

import type { ReportDate } from '../types';

const REPORT_CACHE_KEY_PREFIX = 'daily_summary_report';

/** Returns yesterday's local date string (YYYY-MM-DD). */
export const getYesterday = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDate(yesterday);
};

/** Formats a YYYY-MM-DD string into Korean locale full date. */
export const formatDateKorean = (dateStr: string): string => {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  };
  return date.toLocaleDateString('ko-KR', options);
};

/** Returns the cache key used in systemState. */
export const getCacheKey = (date: string): string => {
  return `${REPORT_CACHE_KEY_PREFIX}:${date}`;
};

/** Resolves report target date string from the UI selection. */
export const resolveReportDate = (reportDate: ReportDate): string => {
  return reportDate === 'today' ? getLocalDate() : getYesterday();
};

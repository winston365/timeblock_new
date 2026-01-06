/**
 * @file use-daily-summary-controller.ts
 * @description Controller hook for DailySummaryModal async orchestration.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { loadDailyData } from '@/data/repositories/dailyDataRepository';
import { getSystemState, setSystemState } from '@/data/repositories/systemRepository';
import { useSettingsStore } from '@/shared/stores/settingsStore';

import type { DailyReport, ReportDate, ReportPage } from '../types';
import { buildDailyReport } from '../utils/report-builder';
import { getCacheKey, resolveReportDate } from '../utils/report-date';

export interface DailySummaryController {
  readonly reportDate: ReportDate;
  readonly setReportDate: (date: ReportDate) => void;
  readonly currentPage: ReportPage;
  readonly setCurrentPage: (page: ReportPage) => void;
  readonly report: DailyReport | null;
  readonly isLoading: boolean;
  readonly isRegenerating: boolean;
  readonly error: string | null;
  readonly targetDate: string;
  readonly pages: readonly ReportPage[];
  readonly loadReport: (date: string, forceRegenerate?: boolean) => Promise<void>;
  readonly handleRegenerate: () => Promise<void>;
  readonly handleDateSelect: (date: ReportDate) => void;
}

export interface UseDailySummaryControllerParams {
  readonly open: boolean;
}

/**
 * Manages report generation, caching, and modal state.
 * Keeps UI component lean while preserving existing behavior.
 */
export const useDailySummaryController = ({ open }: UseDailySummaryControllerParams): DailySummaryController => {
  const { settings } = useSettingsStore();

  const [reportDate, setReportDate] = useState<ReportDate>('today');
  const [currentPage, setCurrentPage] = useState<ReportPage>('overview');
  const [report, setReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetDate = useMemo(() => {
    return resolveReportDate(reportDate);
  }, [reportDate]);

  const pages = useMemo<readonly ReportPage[]>(() => ['overview', 'tasks', 'ai-analysis'], []);

  const loadReport = useCallback(
    async (date: string, forceRegenerate = false) => {
      if (!settings?.geminiApiKey) {
        setError('Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
        return;
      }

      const cacheKey = getCacheKey(date);

      if (!forceRegenerate) {
        try {
          const cached = await getSystemState<DailyReport>(cacheKey);
          if (cached) {
            setReport(cached);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Failed to load cached report:', e);
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const dailyData = await loadDailyData(date);
        const newReport = await buildDailyReport(date, dailyData, settings.geminiApiKey);

        try {
          await setSystemState(cacheKey, newReport);
        } catch (e) {
          console.warn('Failed to cache report:', e);
        }

        setReport(newReport);
      } catch (e) {
        console.error('Failed to generate report:', e);
        setError(`보고서 생성 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
      } finally {
        setIsLoading(false);
      }
    },
    [settings?.geminiApiKey]
  );

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    await loadReport(targetDate, true);
    setIsRegenerating(false);
  }, [loadReport, targetDate]);

  const handleDateSelect = useCallback((date: ReportDate) => {
    setReportDate(date);
    setReport(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      setCurrentPage('overview');
      setReport(null);
      setError(null);
      setReportDate('today');
      setIsLoading(false);
      setIsRegenerating(false);
    }
  }, [open]);

  return {
    reportDate,
    setReportDate,
    currentPage,
    setCurrentPage,
    report,
    isLoading,
    isRegenerating,
    error,
    targetDate,
    pages,
    loadReport,
    handleRegenerate,
    handleDateSelect,
  };
};

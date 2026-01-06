/**
 * @file report-builder.ts
 * @description Builds a daily summary report and AI analysis.
 */

import { calculateTaskXP } from '@/shared/lib/utils';
import { callGeminiAPI } from '@/shared/services/ai/geminiApi';
import type { DailyData } from '@/shared/types/domain';

import type { DailyReport } from '../types';
import { formatDateKorean } from './report-date';
import { createDailyReportBase } from '@/features/insight/utils/dailySummaryReport';

/**
 * Generates AI analysis markdown for the given daily data.
 * @param dailyData - Daily data to analyze.
 * @param apiKey - Gemini API key.
 * @param date - Target date (YYYY-MM-DD).
 */
export const generateAIAnalysis = async (
  dailyData: DailyData | null,
  apiKey: string,
  date: string
): Promise<string> => {
  if (!dailyData || !apiKey) {
    return '데이터가 없거나 API 키가 설정되지 않았습니다.';
  }

  const tasks = dailyData.tasks || [];
  const completedTasks = tasks.filter(t => t.completed);
  const uncompletedTasks = tasks.filter(t => !t.completed);
  const totalXP = completedTasks.reduce((sum, t) => sum + calculateTaskXP(t), 0);

  const prompt = `당신은 생산성 코치입니다. 사용자의 하루 데이터를 분석하고 인사이트를 제공해주세요.

## 분석 대상 날짜
${date} (${formatDateKorean(date)})

## 데이터 요약
- 총 작업: ${tasks.length}개
- 완료된 작업: ${completedTasks.length}개 (${tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%)
- 미완료 작업: ${uncompletedTasks.length}개
- 획득 XP: ${totalXP}

## 완료된 작업
${completedTasks.map(t => `- ${t.text} (+${calculateTaskXP(t)}XP)`).join('\n') || '없음'}

## 미완료 작업
${uncompletedTasks.map(t => `- ${t.text}`).join('\n') || '없음'}

## 출력 형식
다음 형식으로 분석 결과를 작성해주세요:

### 🎯 오늘의 성과
(완료한 작업들에 대한 긍정적 피드백)

### 📊 패턴 분석
(작업 완료 패턴, 생산성 추세 분석)

### 💡 개선 제안
(미완료 작업이 있다면 그 원인 분석과 개선 방법)

### ⭐ 내일을 위한 팁
(다음 날 더 나은 하루를 위한 구체적인 조언)

한국어로 작성하고, 친근하면서도 전문적인 톤으로 작성해주세요.`;

  try {
    const systemPrompt =
      '당신은 친근하고 전문적인 생산성 코치입니다. 사용자의 일일 데이터를 분석하고 통찰력 있는 피드백을 제공합니다.';
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;
    const result = await callGeminiAPI(fullPrompt, [], apiKey);

    return result.text;
  } catch (error) {
    console.error('AI 분석 생성 실패:', error);
    return `AI 분석 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
  }
};

/**
 * Builds a report object and includes AI analysis.
 * @param date - Target date (YYYY-MM-DD).
 * @param dailyData - Daily data fetched from repository.
 * @param apiKey - Gemini API key.
 */
export const buildDailyReport = async (
  date: string,
  dailyData: DailyData | null,
  apiKey: string
): Promise<DailyReport> => {
  const base = createDailyReportBase(date, dailyData);
  const aiAnalysis = await generateAIAnalysis(dailyData, apiKey, date);

  return { ...base, aiAnalysis };
};

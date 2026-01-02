/**
 * historyInsightUtils.ts
 *
 * @file T29-T30: 히스토리 인사이트 계산 유틸리티
 * @description
 *   - 지난 N주간 데이터 분석
 *   - 3줄 인사이트 생성
 *   - ADHD 친화적: 간결한 피드백, 긍정적 강화
 */

import type { WeeklyGoal, WeeklyGoalHistory } from '@/shared/types/domain';

/**
 * 인사이트 라인 타입
 */
export interface InsightLine {
  /** 아이콘 */
  icon: string;
  /** 메시지 */
  message: string;
  /** 감정 톤 (positive, neutral, improvement) */
  tone: 'positive' | 'neutral' | 'improvement';
}

/**
 * 히스토리 인사이트 결과
 */
export interface HistoryInsight {
  /** 3줄 인사이트 */
  lines: InsightLine[];
  /** 전체 달성률 (%) */
  overallAchievementRate: number;
  /** 총 주 수 */
  totalWeeks: number;
  /** 달성 주 수 */
  completedWeeks: number;
  /** 연속 달성 주 */
  currentStreak: number;
  /** 최장 연속 달성 */
  longestStreak: number;
  /** 평균 진행률 */
  avgProgress: number;
  /** 추세 (improving, stable, declining) */
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * 단일 목표의 히스토리 인사이트 계산
 */
export function calculateGoalInsight(goal: WeeklyGoal): HistoryInsight {
  const histories = goal.history || [];
  
  // 기본값 (히스토리 없음)
  if (histories.length === 0) {
    return {
      lines: [
        { icon: '🌱', message: '이번 주가 첫 도전이에요!', tone: 'positive' },
        { icon: '💪', message: '작은 시작이 큰 변화를 만들어요', tone: 'neutral' },
        { icon: '✨', message: '파이팅!', tone: 'positive' },
      ],
      overallAchievementRate: 0,
      totalWeeks: 0,
      completedWeeks: 0,
      currentStreak: 0,
      longestStreak: 0,
      avgProgress: 0,
      trend: 'stable',
    };
  }

  // 정렬 (최신순)
  const sortedHistories = [...histories].sort(
    (a, b) => b.weekStartDate.localeCompare(a.weekStartDate)
  );

  // 통계 계산
  const totalWeeks = sortedHistories.length;
  const completedWeeks = sortedHistories.filter(h => h.completed).length;
  const overallAchievementRate = Math.round((completedWeeks / totalWeeks) * 100);

  // 평균 진행률
  const avgProgress = Math.round(
    sortedHistories.reduce((sum, h) => {
      const rate = h.target > 0 ? (h.finalProgress / h.target) * 100 : 0;
      return sum + rate;
    }, 0) / totalWeeks
  );

  // 연속 달성 계산 (최신부터)
  let currentStreak = 0;
  for (const h of sortedHistories) {
    if (h.completed) {
      currentStreak++;
    } else {
      break;
    }
  }

  // 최장 연속 달성
  let longestStreak = 0;
  let tempStreak = 0;
  for (const h of sortedHistories) {
    if (h.completed) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // 추세 계산 (최근 3주)
  const recentWeeks = sortedHistories.slice(0, Math.min(3, totalWeeks));
  const trend = calculateTrend(recentWeeks);

  // 3줄 인사이트 생성
  const lines = generateInsightLines({
    totalWeeks,
    completedWeeks,
    overallAchievementRate,
    avgProgress,
    currentStreak,
    longestStreak,
    trend,
    goalTitle: goal.title,
  });

  return {
    lines,
    overallAchievementRate,
    totalWeeks,
    completedWeeks,
    currentStreak,
    longestStreak,
    avgProgress,
    trend,
  };
}

/**
 * 추세 계산
 */
function calculateTrend(
  recentHistories: WeeklyGoalHistory[]
): 'improving' | 'stable' | 'declining' {
  if (recentHistories.length < 2) return 'stable';

  const progressRates = recentHistories.map(h =>
    h.target > 0 ? h.finalProgress / h.target : 0
  );

  // 최근 것이 첫 번째 (내림차순 정렬되어 있음)
  const latest = progressRates[0];
  const older = progressRates.slice(1);
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  const diff = latest - olderAvg;
  if (diff > 0.1) return 'improving';
  if (diff < -0.1) return 'declining';
  return 'stable';
}

/**
 * 3줄 인사이트 생성
 */
function generateInsightLines(data: {
  totalWeeks: number;
  completedWeeks: number;
  overallAchievementRate: number;
  avgProgress: number;
  currentStreak: number;
  longestStreak: number;
  trend: 'improving' | 'stable' | 'declining';
  goalTitle: string;
}): InsightLine[] {
  const lines: InsightLine[] = [];

  // Line 1: 달성률 요약
  if (data.overallAchievementRate >= 80) {
    lines.push({
      icon: '🏆',
      message: `${data.totalWeeks}주 중 ${data.completedWeeks}주 달성! (${data.overallAchievementRate}%)`,
      tone: 'positive',
    });
  } else if (data.overallAchievementRate >= 50) {
    lines.push({
      icon: '📊',
      message: `${data.totalWeeks}주 중 ${data.completedWeeks}주 달성 (${data.overallAchievementRate}%)`,
      tone: 'neutral',
    });
  } else {
    lines.push({
      icon: '📈',
      message: `${data.totalWeeks}주 기록, 평균 ${data.avgProgress}% 진행`,
      tone: 'improvement',
    });
  }

  // Line 2: 연속 달성 또는 추세
  if (data.currentStreak >= 3) {
    lines.push({
      icon: '🔥',
      message: `${data.currentStreak}주 연속 달성 중! 최장 ${data.longestStreak}주`,
      tone: 'positive',
    });
  } else if (data.longestStreak >= 2) {
    lines.push({
      icon: '⭐',
      message: `최장 ${data.longestStreak}주 연속 달성 기록 보유`,
      tone: 'neutral',
    });
  } else if (data.trend === 'improving') {
    lines.push({
      icon: '📈',
      message: '최근 점점 좋아지고 있어요!',
      tone: 'positive',
    });
  } else if (data.trend === 'declining') {
    lines.push({
      icon: '💡',
      message: '이번 주에 다시 시작해봐요',
      tone: 'improvement',
    });
  } else {
    lines.push({
      icon: '🎯',
      message: '꾸준히 진행 중이에요',
      tone: 'neutral',
    });
  }

  // Line 3: 격려 메시지
  if (data.overallAchievementRate >= 80) {
    lines.push({
      icon: '✨',
      message: '대단해요! 이 페이스를 유지해봐요',
      tone: 'positive',
    });
  } else if (data.currentStreak > 0) {
    lines.push({
      icon: '💪',
      message: '연속 달성 중! 멈추지 마세요',
      tone: 'positive',
    });
  } else if (data.avgProgress >= 70) {
    lines.push({
      icon: '🌟',
      message: '조금만 더 하면 달성할 수 있어요!',
      tone: 'neutral',
    });
  } else {
    lines.push({
      icon: '🌱',
      message: '작은 진전도 의미 있어요. 파이팅!',
      tone: 'improvement',
    });
  }

  return lines;
}

/**
 * 전체 목표들의 종합 인사이트 계산
 */
export function calculateOverallInsight(goals: WeeklyGoal[]): {
  totalGoals: number;
  goalsWithHistory: number;
  overallAvgRate: number;
  bestGoal: { title: string; rate: number } | null;
  needsAttention: { title: string; rate: number } | null;
} {
  const goalsWithHistory = goals.filter(g => g.history && g.history.length > 0);

  if (goalsWithHistory.length === 0) {
    return {
      totalGoals: goals.length,
      goalsWithHistory: 0,
      overallAvgRate: 0,
      bestGoal: null,
      needsAttention: null,
    };
  }

  // 각 목표별 달성률 계산
  const goalRates = goalsWithHistory.map(g => {
    const histories = g.history || [];
    const completedWeeks = histories.filter(h => h.completed).length;
    const rate = histories.length > 0 ? (completedWeeks / histories.length) * 100 : 0;
    return { title: g.title, rate: Math.round(rate) };
  });

  // 전체 평균
  const overallAvgRate = Math.round(
    goalRates.reduce((sum, g) => sum + g.rate, 0) / goalRates.length
  );

  // 최고 성과 목표
  const bestGoal = goalRates.reduce((best, g) =>
    g.rate > best.rate ? g : best
  );

  // 주의 필요 목표 (50% 미만)
  const needsAttention = goalRates
    .filter(g => g.rate < 50)
    .sort((a, b) => a.rate - b.rate)[0] || null;

  return {
    totalGoals: goals.length,
    goalsWithHistory: goalsWithHistory.length,
    overallAvgRate,
    bestGoal: bestGoal.rate > 0 ? bestGoal : null,
    needsAttention,
  };
}

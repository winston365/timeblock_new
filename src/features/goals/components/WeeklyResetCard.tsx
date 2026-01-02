/**
 * WeeklyResetCard.tsx
 *
 * @file 주간 리셋 안내 카드
 * @description
 *   - T10: 주 1회 노출 (월요일 또는 새 주 첫 방문 시)
 *   - 지난주 요약 표시
 *   - 히스토리 링크 제공
 *   - ADHD 친화적: 긍정적 강화, 과거 회고 기회
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { WeeklyGoal } from '@/shared/types/domain';
import { getWeekLabel, getWeekLabelKoreanShort } from '../utils/weekUtils';
import { 
  getGoalsResetBannerLastSeenWeek, 
  setGoalsResetBannerLastSeenWeek 
} from '../utils/goalSystemState';

interface WeeklyResetCardProps {
  /** 전체 목표 목록 */
  allGoals: WeeklyGoal[];
}

/**
 * 지난주 요약 계산
 */
function calculateLastWeekSummary(goals: WeeklyGoal[]): {
  totalGoals: number;
  completedGoals: number;
  avgProgress: number;
  hasHistory: boolean;
} {
  // 최신 히스토리에서 지난주 데이터 추출
  const lastWeekHistories = goals
    .filter(g => g.history && g.history.length > 0)
    .map(g => g.history[g.history.length - 1]);

  if (lastWeekHistories.length === 0) {
    return { totalGoals: 0, completedGoals: 0, avgProgress: 0, hasHistory: false };
  }

  const completedGoals = lastWeekHistories.filter(h => h.completed).length;
  const avgProgress = lastWeekHistories.reduce((sum, h) => {
    const progress = h.target > 0 ? (h.finalProgress / h.target) * 100 : 0;
    return sum + progress;
  }, 0) / lastWeekHistories.length;

  return {
    totalGoals: lastWeekHistories.length,
    completedGoals,
    avgProgress: Math.round(avgProgress),
    hasHistory: true,
  };
}

/**
 * 주간 리셋 안내 카드 컴포넌트
 */
export default function WeeklyResetCard({ allGoals }: WeeklyResetCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 현재 주 라벨
  const currentWeekLabel = getWeekLabel();
  const currentWeekLabelKorean = getWeekLabelKoreanShort();

  // 지난주 요약
  const lastWeekSummary = useMemo(() => calculateLastWeekSummary(allGoals), [allGoals]);

  // 표시 여부 확인 (주 1회)
  useEffect(() => {
    let mounted = true;

    const checkVisibility = async () => {
      try {
        const lastSeenWeek = await getGoalsResetBannerLastSeenWeek();
        
        if (mounted) {
          // 이번 주에 처음 보는 경우만 표시
          const shouldShow = lastSeenWeek !== currentWeekLabel && lastWeekSummary.hasHistory;
          setIsVisible(shouldShow);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[WeeklyResetCard] Failed to check visibility:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void checkVisibility();

    return () => {
      mounted = false;
    };
  }, [currentWeekLabel, lastWeekSummary.hasHistory]);

  // 카드 닫기
  const handleDismiss = useCallback(async () => {
    setIsVisible(false);
    await setGoalsResetBannerLastSeenWeek(currentWeekLabel);
  }, [currentWeekLabel]);

  // 로딩 중이거나 표시 안 함
  if (isLoading || !isVisible) {
    return null;
  }

  // 성과 메시지 결정
  const getAchievementMessage = () => {
    if (lastWeekSummary.avgProgress >= 100) {
      return { emoji: '🏆', text: '완벽한 한 주였어요!' };
    }
    if (lastWeekSummary.avgProgress >= 80) {
      return { emoji: '🎉', text: '훌륭한 한 주였어요!' };
    }
    if (lastWeekSummary.avgProgress >= 50) {
      return { emoji: '💪', text: '좋은 진전이 있었어요!' };
    }
    return { emoji: '🌱', text: '새로운 시작이에요!' };
  };

  const achievement = getAchievementMessage();

  return (
    <div className="mx-4 mb-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-4">
      <div className="flex items-start justify-between gap-4">
        {/* 왼쪽: 메시지 */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">{achievement.emoji}</span>
          <div>
            <h3 className="text-sm font-bold text-white">
              새 주가 시작됐어요! {currentWeekLabelKorean}
            </h3>
            <p className="text-xs text-white/70">
              {achievement.text} 지난주: {lastWeekSummary.completedGoals}/{lastWeekSummary.totalGoals} 목표 달성 (평균 {lastWeekSummary.avgProgress}%)
            </p>
          </div>
        </div>

        {/* 오른쪽: 액션 버튼 */}
        <div className="flex items-center gap-2">
          {/* 히스토리 보기 버튼 */}
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20 hover:text-white transition"
            title="지난 주 히스토리 보기"
          >
            📊 히스토리
          </button>
          
          {/* 닫기 버튼 */}
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white/80 transition"
            aria-label="닫기"
            title="이번 주에는 다시 표시하지 않음"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

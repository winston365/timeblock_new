/**
 * HistoryInsightPanel.tsx
 *
 * @file T30: 히스토리 인사이트 UI 컴포넌트
 * @description
 *   - 3줄 인사이트 표시
 *   - 연속 달성, 추세 시각화
 *   - ADHD 친화적: 간결한 정보, 긍정적 피드백
 */

import { useMemo } from 'react';
import type { WeeklyGoal } from '@/shared/types/domain';
import { calculateGoalInsight, type InsightLine } from '../utils/historyInsightUtils';

interface HistoryInsightPanelProps {
  /** 대상 목표 */
  goal: WeeklyGoal;
  /** 축소 모드 */
  compact?: boolean;
}

/**
 * 인사이트 라인 아이템 컴포넌트
 */
function InsightLineItem({
  line,
  compact,
}: {
  line: InsightLine;
  compact?: boolean;
}) {
  const toneStyles = {
    positive: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    neutral: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    improvement: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border ${toneStyles[line.tone]} ${
        compact ? 'px-2 py-1.5 text-[10px]' : 'px-3 py-2 text-xs'
      }`}
    >
      <span className={compact ? 'text-sm' : 'text-base'}>{line.icon}</span>
      <span>{line.message}</span>
    </div>
  );
}

/**
 * 히스토리 인사이트 패널 컴포넌트
 */
export default function HistoryInsightPanel({
  goal,
  compact = false,
}: HistoryInsightPanelProps) {
  // 인사이트 계산
  const insight = useMemo(() => calculateGoalInsight(goal), [goal]);

  // 히스토리가 없으면 간단 메시지만
  if (insight.totalWeeks === 0) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/5 ${compact ? 'p-3' : 'p-4'}`}>
        <div className={`flex items-center gap-2 text-white/60 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          <span className="text-xl">🌱</span>
          <span>이번 주가 첫 도전이에요! 파이팅!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 ${compact ? 'p-3' : 'p-4'}`}>
      {/* 헤더 */}
      <div className={`mb-3 flex items-center justify-between ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <h4 className="font-bold text-white">📊 인사이트</h4>
        <span className="text-white/50">
          {insight.totalWeeks}주 기록 기반
        </span>
      </div>

      {/* 3줄 인사이트 */}
      <div className={`space-y-2 ${compact ? 'space-y-1.5' : ''}`}>
        {insight.lines.map((line, index) => (
          <InsightLineItem key={index} line={line} compact={compact} />
        ))}
      </div>

      {/* 추가 통계 (확장 모드에서만) */}
      {!compact && (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-white/5 p-3 text-center">
          <div>
            <div className="text-lg font-bold text-white">
              {insight.overallAchievementRate}%
            </div>
            <div className="text-[10px] text-white/50">달성률</div>
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-300">
              {insight.currentStreak}주
            </div>
            <div className="text-[10px] text-white/50">현재 연속</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-300">
              {insight.avgProgress}%
            </div>
            <div className="text-[10px] text-white/50">평균 진행</div>
          </div>
        </div>
      )}

      {/* 추세 표시 */}
      <div className={`mt-3 flex items-center gap-2 text-white/60 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {insight.trend === 'improving' && (
          <>
            <span className="text-emerald-400">📈</span>
            <span>상승 추세</span>
          </>
        )}
        {insight.trend === 'stable' && (
          <>
            <span className="text-blue-400">➡️</span>
            <span>안정적</span>
          </>
        )}
        {insight.trend === 'declining' && (
          <>
            <span className="text-amber-400">📉</span>
            <span>하락 추세 - 이번 주에 반등!</span>
          </>
        )}
      </div>
    </div>
  );
}

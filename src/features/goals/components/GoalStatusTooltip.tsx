/**
 * GoalStatusTooltip.tsx
 *
 * @file 목표 상태 상세 툴팁 컴포넌트
 * @description
 *   - Role: 목표 상태와 계산 방식을 상세히 설명하는 툴팁
 *   - Responsibilities:
 *     - 오늘 목표량 계산 방식 설명
 *     - 경고/위험 상태 이유 설명
 *     - ADHD 친화적: 명확하고 이해하기 쉬운 설명
 *   - Key Dependencies: CatchUpInfo 타입
 */

import { useState, useCallback, useRef, useEffect, type ReactNode, type KeyboardEvent } from 'react';
import type { WeeklyGoal } from '@/shared/types/domain';
import type { CatchUpInfo } from '../utils/catchUpUtils';
import { CATCH_UP_THRESHOLDS } from '../constants/goalConstants';

interface GoalStatusTooltipProps {
  /** 목표 정보 */
  goal: WeeklyGoal;
  /** 오늘까지 해야하는 누적 목표량 */
  todayTarget: number;
  /** 오늘 하루 해야하는 양 (남은 기간 기준) */
  dailyTargetForToday: number;
  /** 남은 일수 */
  remainingDays: number;
  /** 만회 정보 */
  catchUpInfo: CatchUpInfo;
  /** 트리거할 자식 요소 */
  children: ReactNode;
}

/**
 * 목표 상태 상세 툴팁 컴포넌트
 */
export default function GoalStatusTooltip({
  goal,
  todayTarget,
  dailyTargetForToday,
  remainingDays,
  catchUpInfo,
  children,
}: GoalStatusTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const { severity, catchUpNeeded, isBehind, isCompleted } = catchUpInfo;

  // 툴팁 위치 계산
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 280; // 예상 툴팁 너비
    const tooltipHeight = 200; // 예상 툴팁 높이

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.bottom + 8;

    // 화면 경계 체크
    if (left < 8) left = 8;
    if (left + tooltipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tooltipWidth - 8;
    }
    if (top + tooltipHeight > window.innerHeight - 8) {
      top = rect.top - tooltipHeight - 8;
    }

    setPosition({ top, left });
  }, []);

  // 마우스 오버 시 툴팁 표시
  const handleMouseEnter = useCallback(() => {
    updatePosition();
    setIsVisible(true);
  }, [updatePosition]);

  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  // 키보드 접근성 (포커스 시 툴팁 표시)
  const handleFocus = useCallback(() => {
    updatePosition();
    setIsVisible(true);
  }, [updatePosition]);

  const handleBlur = useCallback(() => {
    setIsVisible(false);
  }, []);

  // ESC 키로 툴팁 닫기
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsVisible(false);
    }
  }, []);

  // 클릭 외부 시 툴팁 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  // 하루 평균 목표량 계산
  const dailyAverage = goal.target / 7;

  // 계산 방식 설명
  const getCalculationExplanation = (): string => {
    if (remainingDays <= 0) {
      return `오늘이 마지막 날이에요. 남은 ${(goal.target - goal.currentProgress).toLocaleString()} ${goal.unit}을 완료해야 해요.`;
    }
    
    const remaining = goal.target - goal.currentProgress;
    return `남은 ${remaining.toLocaleString()} ${goal.unit} ÷ ${remainingDays}일 = 하루 ${dailyTargetForToday.toLocaleString()} ${goal.unit}`;
  };

  // 상태 설명
  const getStatusExplanation = (): string => {
    if (isCompleted) {
      return '🎉 주간 목표를 모두 달성했어요! 정말 대단해요!';
    }

    if (!isBehind) {
      return '✨ 순조롭게 진행 중이에요. 이대로만 하면 충분해요!';
    }

    const warningRatio = CATCH_UP_THRESHOLDS.WARNING_RATIO;
    const dangerRatio = CATCH_UP_THRESHOLDS.DANGER_RATIO;

    if (severity === 'danger') {
      return `🔴 하루 목표량(${Math.round(dailyAverage).toLocaleString()})의 ${dangerRatio}배(${Math.round(dailyAverage * dangerRatio).toLocaleString()}) 이상 뒤처져 있어요. 집중적인 만회가 필요해요.`;
    }

    return `🟡 하루 목표량(${Math.round(dailyAverage).toLocaleString()})의 ${warningRatio}~${dangerRatio}배 만큼 뒤처져 있어요. 조금만 더 힘내봐요!`;
  };

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-describedby="goal-status-tooltip"
        className="outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded"
      >
        {children}
      </div>

      {/* 툴팁 */}
      {isVisible && position && (
        <div
          ref={tooltipRef}
          id="goal-status-tooltip"
          role="tooltip"
          className="fixed z-[1070] w-72 rounded-xl bg-gray-900/95 p-4 shadow-2xl backdrop-blur-sm border border-white/10 text-left"
          style={{ top: position.top, left: position.left }}
        >
          {/* 헤더 */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
            <span className="text-lg">{goal.icon || '📚'}</span>
            <h4 className="font-bold text-white text-sm truncate flex-1">{goal.title}</h4>
          </div>

          {/* 진행 상황 */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-white/60">현재 진행도:</span>
              <span className="text-white font-semibold">
                {goal.currentProgress.toLocaleString()} / {goal.target.toLocaleString()} {goal.unit}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-white/60">오늘까지 목표:</span>
              <span className="text-white font-semibold">
                {todayTarget.toLocaleString()} {goal.unit}
              </span>
            </div>

            {isBehind && (
              <div className="flex justify-between">
                <span className="text-white/60">부족분:</span>
                <span className={`font-semibold ${severity === 'danger' ? 'text-red-400' : 'text-amber-400'}`}>
                  -{catchUpNeeded.toLocaleString()} {goal.unit}
                </span>
              </div>
            )}
          </div>

          {/* 계산 방식 설명 */}
          <div className="mt-3 p-2 rounded-lg bg-white/5 text-[11px] text-white/70">
            <div className="font-semibold text-white/90 mb-1">📐 오늘 목표량 계산:</div>
            <div>{getCalculationExplanation()}</div>
          </div>

          {/* 상태 설명 */}
          <div className="mt-2 p-2 rounded-lg bg-white/5 text-[11px] text-white/70">
            <div className="font-semibold text-white/90 mb-1">📊 현재 상태:</div>
            <div>{getStatusExplanation()}</div>
          </div>

          {/* ADHD 친화적 응원 메시지 */}
          {!isCompleted && (
            <div className="mt-3 text-center text-[10px] text-white/50">
              💡 작은 것부터 시작해도 괜찮아요. 하나씩 해나가봐요!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

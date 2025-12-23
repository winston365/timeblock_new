/**
 * CatchUpAlertBanner.tsx
 *
 * @file 뒤처진 목표 알림 배너 (모달 대체)
 * @description
 *   - Role: 모달 대신 상단 배너로 뒤처진 목표 알림 표시
 *   - Responsibilities:
 *     - 뒤처진 목표 요약 표시
 *     - 스누즈 기능 (30분/1시간/3시간)
 *     - 배너 닫기 기능
 *   - ADHD 친화적: 갑작스러운 모달 대신 지속적이지만 방해되지 않는 배너
 */

import { useState, useCallback, useMemo } from 'react';
import type { WeeklyGoal } from '@/shared/types/domain';
import type { CatchUpInfo } from '../utils/catchUpUtils';

interface CatchUpAlertBannerProps {
  /** 배너 표시 여부 */
  isVisible: boolean;
  /** 뒤처진 목표들 */
  behindGoals: Array<{
    goal: WeeklyGoal;
    catchUpInfo: CatchUpInfo;
  }>;
  /** 배너 닫기 (오늘 더 이상 표시 안 함) */
  onDismiss: () => void;
  /** 스누즈 (일정 시간 후 다시 표시) */
  onSnooze: (durationMinutes: number) => void;
}

/** 스누즈 옵션 */
const SNOOZE_OPTIONS = [
  { label: '30분', minutes: 30 },
  { label: '1시간', minutes: 60 },
  { label: '3시간', minutes: 180 },
] as const;

/**
 * 뒤처진 목표 알림 배너 컴포넌트
 */
export default function CatchUpAlertBanner({
  isVisible,
  behindGoals,
  onDismiss,
  onSnooze,
}: CatchUpAlertBannerProps) {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  // 스누즈 선택 핸들러
  const handleSnooze = useCallback(
    (minutes: number) => {
      onSnooze(minutes);
      setShowSnoozeMenu(false);
    },
    [onSnooze]
  );

  // 스누즈 메뉴 토글
  const toggleSnoozeMenu = useCallback(() => {
    setShowSnoozeMenu((prev) => !prev);
  }, []);

  // ESC 키로 스누즈 메뉴 닫기
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && showSnoozeMenu) {
      setShowSnoozeMenu(false);
      e.stopPropagation();
    }
  }, [showSnoozeMenu]);

  // 심각도별 통계
  const stats = useMemo(() => {
    const dangerCount = behindGoals.filter(
      ({ catchUpInfo }) => catchUpInfo.severity === 'danger'
    ).length;
    const warningCount = behindGoals.length - dangerCount;
    return { dangerCount, warningCount };
  }, [behindGoals]);

  // 배너 스타일 결정
  const bannerStyle = useMemo(() => {
    if (stats.dangerCount > 0) {
      return {
        bgClass: 'bg-gradient-to-r from-red-500/90 to-orange-500/90',
        emoji: '🚨',
        message: '집중이 필요한 목표가 있어요!',
      };
    }
    return {
      bgClass: 'bg-gradient-to-r from-amber-500/90 to-yellow-500/90',
      emoji: '⚡',
      message: '조금만 더 힘내봐요!',
    };
  }, [stats.dangerCount]);

  if (!isVisible || behindGoals.length === 0) {
    return null;
  }

  return (
    <div
      className={`relative z-40 ${bannerStyle.bgClass} px-4 py-2 shadow-lg backdrop-blur-sm`}
      role="alert"
      aria-live="polite"
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* 왼쪽: 메시지 및 통계 */}
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">{bannerStyle.emoji}</span>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white">
            <span className="font-semibold">{bannerStyle.message}</span>
            <span className="text-white/80">
              ({behindGoals.length}개 목표 뒤처짐:
              {stats.dangerCount > 0 && (
                <span className="ml-1">
                  🔴 {stats.dangerCount}
                </span>
              )}
              {stats.warningCount > 0 && (
                <span className="ml-1">
                  🟡 {stats.warningCount}
                </span>
              )}
              )
            </span>
          </div>
        </div>

        {/* 오른쪽: 액션 버튼들 */}
        <div className="flex items-center gap-2">
          {/* 스누즈 버튼 */}
          <div className="relative">
            <button
              onClick={toggleSnoozeMenu}
              className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-haspopup="true"
              aria-expanded={showSnoozeMenu}
              aria-label="스누즈 옵션 열기"
            >
              ⏰ 나중에
            </button>

            {/* 스누즈 드롭다운 메뉴 */}
            {showSnoozeMenu && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-32 rounded-lg bg-gray-900/95 p-1 shadow-xl backdrop-blur-sm"
                role="menu"
              >
                {SNOOZE_OPTIONS.map((option) => (
                  <button
                    key={option.minutes}
                    onClick={() => handleSnooze(option.minutes)}
                    className="w-full rounded-md px-3 py-2 text-left text-xs text-white transition-colors hover:bg-white/10"
                    role="menuitem"
                  >
                    {option.label} 후에 다시
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 닫기 버튼 (오늘 더 이상 표시 안 함) */}
          <button
            onClick={onDismiss}
            className="rounded-lg bg-white/10 p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="오늘 더 이상 표시 안 함"
            title="오늘 더 이상 표시 안 함"
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

      {/* 클릭 외부 시 스누즈 메뉴 닫기 */}
      {showSnoozeMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSnoozeMenu(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/**
 * CatchUpAlertBanner.tsx
 *
 * @file 뒤처진 목표 알림 배너 (모달 대체)
 * @description
 *   - Role: 모달 대신 상단 배너로 뒤처진 목표 알림 표시
 *   - Responsibilities:
 *     - 뒤처진 목표 요약 표시
 *     - 스누즈 기능 (기본 2시간)
 *     - 배너 닫기 기능 (오늘 하루)
 *     - 스누즈 만료 시각 표시
 *     - View/Snooze/Dismiss 3가지 액션 제공
 *     - 사용자 주도 재오픈 진입점 (클릭/버튼으로 모달 열기)
 *   - ADHD 친화적: 갑작스러운 모달 대신 지속적이지만 방해되지 않는 배너
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { WeeklyGoal } from '@/shared/types/domain';
import type { CatchUpInfo } from '../utils/catchUpUtils';
import { CATCH_UP_DEFAULTS } from '@/shared/constants/defaults';
import { useToastStore } from '@/shared/stores/toastStore';
import { modalStackRegistry } from '@/shared/hooks/modalStackRegistry';

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
  /** 스누즈 종료 시각 (ISO 8601 문자열 또는 null) */
  snoozeUntil?: string | null;
  /** 상세 모달 열기 콜백 */
  onOpenModal?: () => void;
}

/** 스누즈 옵션 레이블 생성 */
const formatSnoozeLabel = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`;
  }
  return `${minutes}분`;
};

/** 시간 남은 문자열 생성 */
const formatTimeRemaining = (isoString: string): string => {
  const endTime = new Date(isoString);
  const now = new Date();
  const diffMs = endTime.getTime() - now.getTime();
  
  if (diffMs <= 0) return '곧 만료';
  
  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes >= 60) {
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return minutes > 0 ? `${hours}시간 ${minutes}분 후` : `${hours}시간 후`;
  }
  return `${diffMinutes}분 후`;
};

/** 스누즈 종료 시각 표시 */
const formatSnoozeEndTime = (isoString: string): string => {
  const endTime = new Date(isoString);
  const hours = endTime.getHours().toString().padStart(2, '0');
  const minutes = endTime.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * 뒤처진 목표 알림 배너 컴포넌트
 */
export default function CatchUpAlertBanner({
  isVisible,
  behindGoals,
  onDismiss,
  onSnooze,
  snoozeUntil,
  onOpenModal,
}: CatchUpAlertBannerProps) {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const snoozeMenuRef = useRef<HTMLDivElement>(null);
  const snoozeButtonRef = useRef<HTMLButtonElement>(null);
  const popoverIdRef = useRef<symbol | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  // 스누즈 메뉴 열기/닫기
  const openSnoozeMenu = useCallback(() => {
    const popoverId = Symbol('snooze-popover');
    popoverIdRef.current = popoverId;
    modalStackRegistry.add(popoverId);
    setShowSnoozeMenu(true);
  }, []);

  const closeSnoozeMenu = useCallback(() => {
    if (popoverIdRef.current) {
      modalStackRegistry.remove(popoverIdRef.current);
      popoverIdRef.current = null;
    }
    setShowSnoozeMenu(false);
    snoozeButtonRef.current?.focus();
  }, []);

  const toggleSnoozeMenu = useCallback(() => {
    if (showSnoozeMenu) {
      closeSnoozeMenu();
    } else {
      openSnoozeMenu();
    }
  }, [showSnoozeMenu, openSnoozeMenu, closeSnoozeMenu]);

  // 스누즈 선택 핸들러
  const handleSnooze = useCallback(
    (minutes: number) => {
      onSnooze(minutes);
      closeSnoozeMenu();
      addToast(`⏰ ${formatSnoozeLabel(minutes)} 후에 다시 알려드릴게요!`, 'info', 3000);
    },
    [onSnooze, closeSnoozeMenu, addToast]
  );

  // 기본 스누즈 (2시간)
  const handleDefaultSnooze = useCallback(() => {
    handleSnooze(CATCH_UP_DEFAULTS.DEFAULT_SNOOZE_MINUTES);
  }, [handleSnooze]);

  // 오늘 닫기 핸들러
  const handleDismiss = useCallback(() => {
    onDismiss();
    addToast('오늘 하루 동안 표시하지 않을게요.', 'info', 3000);
  }, [onDismiss, addToast]);

  // 상세 보기 핸들러
  const handleViewDetails = useCallback(() => {
    onOpenModal?.();
  }, [onOpenModal]);

  // ESC 키로 스누즈 메뉴 닫기 (ESC 스택 정리)
  useEffect(() => {
    if (!showSnoozeMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // ESC 스택 top-of-stack 체크
        if (popoverIdRef.current && modalStackRegistry.isTop(popoverIdRef.current)) {
          e.preventDefault();
          e.stopPropagation();
          closeSnoozeMenu();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSnoozeMenu, closeSnoozeMenu]);

  // 클릭 외부 시 스누즈 메뉴 닫기
  useEffect(() => {
    if (!showSnoozeMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        snoozeMenuRef.current &&
        !snoozeMenuRef.current.contains(e.target as Node) &&
        snoozeButtonRef.current &&
        !snoozeButtonRef.current.contains(e.target as Node)
      ) {
        closeSnoozeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSnoozeMenu, closeSnoozeMenu]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (popoverIdRef.current) {
        modalStackRegistry.remove(popoverIdRef.current);
        popoverIdRef.current = null;
      }
    };
  }, []);

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
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* 왼쪽: 메시지 및 통계 (클릭하면 상세 모달 열기) */}
        <button
          onClick={handleViewDetails}
          className="flex items-center gap-3 text-left hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50 rounded-lg px-2 py-1 -mx-2 -my-1"
          aria-label="뒤처진 목표 상세 보기"
        >
          <span className="text-xl" aria-hidden="true">{bannerStyle.emoji}</span>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white">
            <span className="font-semibold">{bannerStyle.message}</span>
            <span className="text-white/80">
              ({behindGoals.length}개 목표 뒤처짐:
              {stats.dangerCount > 0 && (
                <span className="ml-1" aria-label={`위험 ${stats.dangerCount}개`}>
                  <span aria-hidden="true">🔴</span> {stats.dangerCount}
                </span>
              )}
              {stats.warningCount > 0 && (
                <span className="ml-1" aria-label={`주의 ${stats.warningCount}개`}>
                  <span aria-hidden="true">🟡</span> {stats.warningCount}
                </span>
              )}
              )
            </span>
            {/* 스누즈 종료 시각 표시 */}
            {snoozeUntil && (
              <span className="text-white/70 text-xs ml-2">
                (스누즈: {formatSnoozeEndTime(snoozeUntil)}까지, {formatTimeRemaining(snoozeUntil)})
              </span>
            )}
          </div>
        </button>

        {/* 오른쪽: 3가지 액션 버튼들 */}
        <div className="flex items-center gap-2">
          {/* View 버튼 (상세 보기) */}
          <button
            onClick={handleViewDetails}
            className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="뒤처진 목표 상세 보기"
          >
            👀 보기
          </button>

          {/* 스누즈 버튼 (기본 2시간) */}
          <div className="relative">
            <button
              ref={snoozeButtonRef}
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
                ref={snoozeMenuRef}
                className="absolute right-0 top-full z-[1060] mt-1 w-40 rounded-lg bg-gray-900/95 p-1 shadow-xl backdrop-blur-sm border border-white/10"
                role="menu"
              >
                {/* 기본 스누즈 (2시간) - 강조 표시 */}
                <button
                  onClick={handleDefaultSnooze}
                  className="w-full rounded-md px-3 py-2 text-left text-xs text-white bg-white/10 transition-colors hover:bg-white/20 font-semibold"
                  role="menuitem"
                >
                  ⭐ 기본 ({formatSnoozeLabel(CATCH_UP_DEFAULTS.DEFAULT_SNOOZE_MINUTES)})
                </button>
                <div className="my-1 border-t border-white/10" />
                {CATCH_UP_DEFAULTS.SNOOZE_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => handleSnooze(minutes)}
                    className={`w-full rounded-md px-3 py-2 text-left text-xs text-white transition-colors hover:bg-white/10 ${
                      minutes === CATCH_UP_DEFAULTS.DEFAULT_SNOOZE_MINUTES ? 'hidden' : ''
                    }`}
                    role="menuitem"
                  >
                    {formatSnoozeLabel(minutes)} 후
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dismiss 버튼 (오늘 더 이상 표시 안 함) */}
          <button
            onClick={handleDismiss}
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
    </div>
  );
}

/**
 * Catch-up 배너 재오픈 진입점 버튼 (사용자 주도)
 * 배너가 스누즈/닫기 상태일 때 표시하여 언제든 다시 열 수 있게 함
 */
export function CatchUpReopenButton({
  behindGoalsCount,
  onClick,
  hasDangerGoals,
}: {
  behindGoalsCount: number;
  onClick: () => void;
  hasDangerGoals: boolean;
}) {
  if (behindGoalsCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        hasDangerGoals
          ? 'bg-red-500/90 text-white focus:ring-red-400'
          : 'bg-amber-500/90 text-white focus:ring-amber-400'
      }`}
      aria-label={`뒤처진 목표 ${behindGoalsCount}개 확인하기`}
      title="뒤처진 목표 확인하기"
    >
      <span aria-hidden="true">{hasDangerGoals ? '🔴' : '🟡'}</span>
      <span>{behindGoalsCount}</span>
      <span className="text-white/80">뒤처짐</span>
    </button>
  );
}

/**
 * WeeklyGoalCard.tsx
 *
 * @file 장기목표 카드 컴포넌트
 * @description
 *   - Role: 개별 장기목표의 진행 상황 표시 및 진행도 조절 UI
 *   - Responsibilities:
 *     - 7분할 진행도바 표시
 *     - +/-1, +/-5, +/-10 버튼으로 진행도 조절
 *     - 직접 값 입력으로 진행도 설정
 *     - 오늘의 목표량 자동 계산 표시 (Today target 상시 표기)
 *     - 만회 경고 표시 (심각도 레벨 + 텍스트 배지)
 *     - Quick Log Session 팝오버
 *     - 클릭 시 히스토리 모달 열기
 *     - 키보드 포커스 상태 표시
 *     - 정보 밀도 가드레일 (기본 3요소 + 점진 노출)
 *     - 히스토리 미리보기 칩 (hover-only 금지, Enter/Click/Touch)
 *   - Key Dependencies:
 *     - WeeklyProgressBar: 진행도바 컴포넌트
 *     - useWeeklyGoalStore: 상태 관리
 *     - catchUpUtils: 만회 심각도 계산
 */

import { useState, useMemo, useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import type { WeeklyGoal } from '@/shared/types/domain';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import { useToastStore } from '@/shared/stores/toastStore';
import WeeklyProgressBar from './WeeklyProgressBar';
import { QUICK_UPDATE_BUTTONS } from './constants/goalConstants';
import { calculateCatchUpInfo } from './utils/catchUpUtils';
import GoalStatusTooltip from './components/GoalStatusTooltip';
import QuickLogSessionPopover from './components/QuickLogSessionPopover';

interface WeeklyGoalCardProps {
  goal: WeeklyGoal;
  onEdit: () => void;
  onDelete: () => void;
  onShowHistory: () => void;
  /** 압축 모드 (그리드 레이아웃용) */
  compact?: boolean;
  /** 키보드 포커스 상태 */
  isFocused?: boolean;
  /** 포커스 콜백 (마우스 클릭 시) */
  onFocus?: () => void;
  /** Quick Log 강제 열기 (키보드에서) */
  forceQuickLogOpen?: boolean;
  /** Quick Log 닫기 콜백 */
  onQuickLogClose?: () => void;
}

/**
 * 장기목표 카드 컴포넌트
 */
export default function WeeklyGoalCard({
  goal,
  onEdit,
  onDelete,
  onShowHistory,
  compact = false,
  isFocused = false,
  onFocus,
  forceQuickLogOpen = false,
  onQuickLogClose,
}: WeeklyGoalCardProps) {
  const updateProgress = useWeeklyGoalStore((s) => s.updateProgress);
  const setProgress = useWeeklyGoalStore((s) => s.setProgress);
  const getDayOfWeekIndex = useWeeklyGoalStore((s) => s.getDayOfWeekIndex);
  const getTodayTarget = useWeeklyGoalStore((s) => s.getTodayTarget);
  const getRemainingDays = useWeeklyGoalStore((s) => s.getRemainingDays);
  const getDailyTargetForToday = useWeeklyGoalStore((s) => s.getDailyTargetForToday);
  const addToast = useToastStore((s) => s.addToast);
  
  const [directInput, setDirectInput] = useState('');
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [lastDelta, setLastDelta] = useState<number>(0);
  // 정보 밀도 가드레일: 기본 접힘 (헤더+프로그레스바+오늘상태+히스토리칩)
  const [isExpanded, setIsExpanded] = useState(false);
  // 히스토리 미리보기 상태
  const [showHistoryPreview, setShowHistoryPreview] = useState(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickLogButtonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 외부에서 Quick Log 열기 요청 처리
  useEffect(() => {
    if (forceQuickLogOpen && !showQuickLog) {
      setShowQuickLog(true);
    }
  }, [forceQuickLogOpen, showQuickLog]);

  // Quick Log 닫힐 때 외부에 알림
  const handleQuickLogClose = useCallback(() => {
    setShowQuickLog(false);
    onQuickLogClose?.();
    quickLogButtonRef.current?.focus();
  }, [onQuickLogClose]);

  // 포커스 시 스크롤
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.focus({ preventScroll: true });
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isFocused]);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };
  }, []);

  const dayIndex = getDayOfWeekIndex();
  const todayTarget = getTodayTarget(goal.target);
  const remainingDays = getRemainingDays();
  const dailyTargetForToday = getDailyTargetForToday(goal.target, goal.currentProgress);

  // 만회 정보 계산 (심각도 레벨 포함)
  const catchUpInfo = useMemo(
    () => calculateCatchUpInfo(goal, todayTarget),
    [goal, todayTarget]
  );

  const { isCompleted, isBehind, catchUpNeeded, config: severityConfig, severity } = catchUpInfo;
  const progressPercent = goal.target > 0 ? Math.round((goal.currentProgress / goal.target) * 100) : 0;

  // 오늘 할당량 달성 여부 (전체 목표 미달성 상태에서)
  const isQuotaAchieved = useMemo(() => {
    return goal.currentProgress >= todayTarget && goal.currentProgress < goal.target;
  }, [goal.currentProgress, todayTarget, goal.target]);

  // Today target 문구 생성 (완료/0일 때도 명확)
  const todayTargetLabel = useMemo(() => {
    if (isCompleted) {
      return { text: '완료!', subtext: '목표 달성' };
    }
    if (dailyTargetForToday === 0) {
      return { text: '0', subtext: isQuotaAchieved ? '할당량 달성' : '목표 없음' };
    }
    return { 
      text: dailyTargetForToday.toLocaleString(), 
      subtext: `${remainingDays}일 남음` 
    };
  }, [isCompleted, dailyTargetForToday, remainingDays, isQuotaAchieved]);

  // 애니메이션 트리거
  const triggerAnimation = useCallback((delta: number) => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    setAnimating(true);
    setLastDelta(delta);
    animationTimeoutRef.current = setTimeout(() => {
      setAnimating(false);
      setLastDelta(0);
    }, 300);
  }, []);

  const handleQuickUpdate = async (delta: number) => {
    if (updating) return;
    setUpdating(true);
    try {
      await updateProgress(goal.id, delta);
      
      // 애니메이션
      triggerAnimation(delta);
    } catch (error) {
      console.error('Failed to update progress:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDirectInputSubmit = async () => {
    const value = parseInt(directInput);
    if (isNaN(value)) {
      alert('숫자를 입력해주세요.');
      return;
    }
    
    if (updating) return;
    setUpdating(true);
    try {
      // 입력값을 추가할지 설정할지 결정 (+ 접두사가 있으면 추가)
      if (directInput.startsWith('+') || directInput.startsWith('-')) {
        await updateProgress(goal.id, value);
      } else {
        await setProgress(goal.id, value);
      }
      setDirectInput('');
      setShowDirectInput(false);
    } catch (error) {
      console.error('Failed to set progress:', error);
    } finally {
      setUpdating(false);
    }
  };

  // Quick Log Session 제출 핸들러
  const handleQuickLogSubmit = useCallback(async (value: number) => {
    if (value === 0) {
      // 0은 no-op (아무 작업 안 함)
      return;
    }
    if (updating) return;
    setUpdating(true);
    try {
      await updateProgress(goal.id, value);
      triggerAnimation(value);
      addToast(`${goal.title}: +${value} ${goal.unit} 기록됨`, 'success', 2000);
      handleQuickLogClose();
    } catch (error) {
      console.error('Failed to log session:', error);
      addToast('기록 실패', 'error', 2000);
    } finally {
      setUpdating(false);
    }
  }, [goal.id, goal.title, goal.unit, updating, updateProgress, triggerAnimation, addToast, handleQuickLogClose]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleDirectInputSubmit();
    } else if (e.key === 'Escape') {
      setShowDirectInput(false);
      setDirectInput('');
    }
  };

  const handleHeaderKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onShowHistory();
    }
  };

  const accent = goal.color || '#6366f1';
  const quickButtons = compact ? QUICK_UPDATE_BUTTONS.COMPACT : QUICK_UPDATE_BUTTONS.NORMAL;

  // 히스토리 미리보기 데이터 (최근 기록 1개)
  const historyPreviewData = useMemo(() => {
    const histories = goal.history;
    if (!histories || histories.length === 0) {
      return {
        label: '히스토리 없음',
        detail: '최근 기록이 없습니다',
        weekStartDate: null as string | null,
      };
    }

    const latest = histories.reduce((acc, cur) => (cur.weekStartDate > acc.weekStartDate ? cur : acc), histories[0]);
    const percent = latest.target > 0 ? Math.round((latest.finalProgress / latest.target) * 100) : latest.completed ? 100 : 0;

    return {
      label: `최근 ${percent}%`,
      detail: `${latest.finalProgress.toLocaleString()}/${latest.target.toLocaleString()} ${goal.unit}`,
      weekStartDate: latest.weekStartDate,
    };
  }, [goal.history, goal.unit]);

  // 히스토리 미리보기 토글 (hover-only 금지, Enter/Click/Touch)
  const handleHistoryPreviewToggle = useCallback(() => {
    setShowHistoryPreview((prev) => !prev);
  }, []);

  const handleHistoryPreviewKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleHistoryPreviewToggle();
    }
  }, [handleHistoryPreviewToggle]);

  return (
    <div
      ref={cardRef}
      onClick={onFocus}
      className={`group relative flex flex-col rounded-2xl border transition-all ${
        isFocused
          ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30 bg-white/10'
          : 'border-white/5 hover:border-white/10 bg-white/5 hover:bg-white/10'
      } shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${
        isCompleted ? 'ring-1 ring-emerald-400/30' : ''
      } ${compact ? 'gap-2 p-3' : 'gap-3 p-4'}`}
      role="article"
      aria-label={`${goal.title} 목표 카드${isFocused ? ' (포커스됨)' : ''}`}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center cursor-pointer ${compact ? 'gap-2' : 'gap-3'}`}
          onClick={onShowHistory}
          role="button"
          tabIndex={0}
          onKeyDown={handleHeaderKeyDown}
          aria-label="목표 히스토리 보기"
        >
          <div
            className={`shrink-0 flex items-center justify-center rounded-full ${compact ? 'h-8 w-8 text-base' : 'h-10 w-10 text-xl'}`}
            style={{ backgroundColor: `${accent}20` }}
          >
            {isCompleted ? '🎉' : goal.icon || '📚'}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={`font-bold text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>{goal.title}</h3>
            <p className={`text-white/60 ${compact ? 'text-[10px]' : 'text-xs'}`}>
              {goal.target.toLocaleString()} {goal.unit} / 주
            </p>
          </div>
        </div>

        {/* 진행률 배지 (애니메이션 포함) + Quota 달성 배지 + Severity 배지 */}
        <div className="flex items-center gap-1.5">
          {/* Quota 달성 배지 */}
          {isQuotaAchieved && (
            <div
              className={`rounded-full bg-emerald-500/20 text-emerald-300 font-medium ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
              title="오늘 목표량 달성!"
              aria-label="오늘 목표량 달성"
            >
              ✅ 오늘 OK
            </div>
          )}
          {/* 텍스트 Severity 배지 (색 의존 제거) */}
          {isBehind && !isCompleted && (
            <div
              className={`rounded-full font-medium ${severityConfig.bgClass} ${severityConfig.textClass} ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
              title={severityConfig.description}
              aria-label={severityConfig.ariaLabel}
            >
              <span aria-hidden="true">{severityConfig.icon}</span>
              <span className="ml-0.5">{severityConfig.accessibleLabel}</span>
            </div>
          )}
          {/* 진행률 배지 */}
          <div className={`rounded-full font-bold shrink-0 transition-all duration-200 ${
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-300'
              : isBehind
              ? 'bg-orange-500/20 text-orange-300'
              : 'bg-blue-500/20 text-blue-300'
          } ${animating ? 'scale-125 ring-2 ring-white/30' : ''} ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'}`}>
            {progressPercent}%
          </div>
        </div>

        {/* Actions (Hover) */}
        <div className={`absolute flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${compact ? 'right-1 top-1' : 'right-2 top-2'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className={`rounded text-white/50 hover:bg-white/10 hover:text-white ${compact ? 'p-1 text-xs' : 'p-1.5'}`}
            title="수정"
            aria-label="목표 수정"
          >
            ✏️
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className={`rounded text-white/50 hover:bg-red-500/20 hover:text-red-400 ${compact ? 'p-1 text-xs' : 'p-1.5'}`}
            title="삭제"
            aria-label="목표 삭제"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <WeeklyProgressBar
        target={goal.target}
        currentProgress={goal.currentProgress}
        todayTarget={todayTarget}
        dayIndex={dayIndex}
        color={accent}
        unit={goal.unit}
        height={compact ? 'h-4' : 'h-6'}
        compact={compact}
        animating={animating}
      />

      {/* 애니메이션 피드백 (숫자 변화 표시) */}
      {animating && lastDelta !== 0 && (
        <div 
          className={`goal-delta-fade-slide-up absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 font-bold text-2xl motion-reduce:hidden ${
            lastDelta > 0 ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {lastDelta > 0 ? `+${lastDelta}` : lastDelta}
        </div>
      )}

      {/* 오늘의 목표량 & 만회 정보 (심각도 레벨 표시) - Today target 상시 표기 */}
      <div className={`flex flex-wrap justify-between gap-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {/* Today target 상시 표기 */}
        <GoalStatusTooltip
          goal={goal}
          todayTarget={todayTarget}
          dailyTargetForToday={dailyTargetForToday}
          remainingDays={remainingDays}
          catchUpInfo={catchUpInfo}
        >
          <div 
            className={`rounded-lg bg-white/5 cursor-help ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
            aria-label={`오늘 목표: ${todayTargetLabel.text} ${goal.unit}, ${todayTargetLabel.subtext}`}
          >
            <span className="text-white/50">오늘: </span>
            <span className="font-bold text-white">{todayTargetLabel.text}</span>
            <span className="text-white/40 ml-1">
              ({todayTargetLabel.subtext})
            </span>
            <span className="ml-1 text-white/30">ⓘ</span>
          </div>
        </GoalStatusTooltip>

        {/* 히스토리 미리보기 칩 (hover-only 금지) */}
        <button
          type="button"
          onClick={handleHistoryPreviewToggle}
          onKeyDown={handleHistoryPreviewKeyDown}
          className={`rounded-lg bg-indigo-500/10 text-indigo-300 transition-colors hover:bg-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
          aria-expanded={showHistoryPreview}
          aria-label="히스토리 미리보기"
          title={historyPreviewData.weekStartDate ? `주 시작: ${historyPreviewData.weekStartDate} (클릭/Enter로 펼치기)` : '클릭/Enter로 펼치기'}
        >
          📊 {historyPreviewData.label}
        </button>

        {/* 상태 표시: 순항 / 뒤처짐 / 달성 */}
        {isCompleted ? (
          <div 
            className={`rounded-lg bg-emerald-500/10 text-emerald-300 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
            aria-label="주간 목표 달성 완료"
          >
            ✨ 달성!
          </div>
        ) : isBehind ? (
          <GoalStatusTooltip
            goal={goal}
            todayTarget={todayTarget}
            dailyTargetForToday={dailyTargetForToday}
            remainingDays={remainingDays}
            catchUpInfo={catchUpInfo}
          >
            <div
              className={`rounded-lg ${severityConfig.bgClass} ${severityConfig.textClass} ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} cursor-help`}
              aria-label={`${catchUpNeeded} ${goal.unit} 부족, ${severityConfig.ariaLabel}`}
            >
              {severityConfig.icon}{' '}
              <span className="font-bold">{catchUpNeeded.toLocaleString()}</span>
              {!compact && (
                <span className="ml-1 opacity-70">
                  {severity === 'danger' ? '만회 필요!' : '부족'}
                </span>
              )}
            </div>
          </GoalStatusTooltip>
        ) : (
          <div 
            className={`rounded-lg bg-emerald-500/10 text-emerald-300 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
            aria-label="목표 순조롭게 진행 중"
          >
            🟢 순조로워요!
          </div>
        )}
      </div>

      {/* 히스토리 미리보기 펼침 (Enter/Click/Touch) */}
      {showHistoryPreview && (
        <div className={`rounded-lg bg-indigo-500/5 border border-indigo-500/20 ${compact ? 'p-2 text-[10px]' : 'p-3 text-xs'}`}>
          <div className="flex items-center justify-between">
            <span className="text-indigo-300">📊 {historyPreviewData.detail}</span>
            <button
              type="button"
              onClick={onShowHistory}
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              전체 히스토리 보기
            </button>
          </div>
        </div>
      )}

      {/* 정보 밀도 가드레일: 점진 노출 토글 */}
      {compact && !isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-full rounded-lg bg-white/5 py-1.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white/70 transition"
        >
          ⚡ 빠른 조절 펼치기
        </button>
      )}

      {/* Quick Update Buttons + Quick Log Session (정보 밀도 가드레일: compact일 때 접힘) */}
      {(!compact || isExpanded) && (
        <div className={`flex flex-wrap items-center justify-center ${compact ? 'gap-1' : 'gap-2'}`}>
          {quickButtons.map(({ label, delta }) => (
            <button
              key={label}
              onClick={() => handleQuickUpdate(delta)}
              disabled={updating || (delta < 0 && goal.currentProgress + delta < 0)}
              className={`rounded-lg font-bold transition-all ${
                delta < 0
                  ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-30'
                  : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              } disabled:cursor-not-allowed ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
            >
              {label}
            </button>
          ))}

          {/* Quick Log Session 버튼 */}
          <div className="relative">
            <button
              ref={quickLogButtonRef}
              onClick={() => setShowQuickLog(true)}
              className={`rounded-lg bg-indigo-500/10 font-bold text-indigo-300 hover:bg-indigo-500/20 ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
              aria-label="빠른 세션 기록 (L 키)"
              aria-haspopup="true"
              aria-expanded={showQuickLog}
            >
              📝 기록
            </button>

            {/* Quick Log Session 팝오버 */}
            {showQuickLog && (
              <QuickLogSessionPopover
                unit={goal.unit}
                onSubmit={handleQuickLogSubmit}
                onClose={handleQuickLogClose}
                triggerRef={quickLogButtonRef}
              />
            )}
          </div>

          {/* Direct Input Toggle */}
          {!showDirectInput ? (
            <button
              onClick={() => setShowDirectInput(true)}
              className={`rounded-lg bg-white/5 font-bold text-white/60 hover:bg-white/10 hover:text-white ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
            >
              직접
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="+/-값"
                className={`rounded-lg border border-white/10 bg-white/5 text-white outline-none focus:border-white/30 ${compact ? 'w-16 px-1.5 py-1 text-[10px]' : 'w-24 px-2 py-1.5 text-xs'}`}
                autoFocus
              />
              <button
                onClick={handleDirectInputSubmit}
                disabled={updating || !directInput}
                className={`rounded-lg bg-[var(--color-primary)] font-bold text-white disabled:opacity-50 ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
              >
                ✓
              </button>
              <button
                onClick={() => { setShowDirectInput(false); setDirectInput(''); }}
                className={`rounded-lg bg-white/5 text-white/50 hover:text-white ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-xs'}`}
              >
                ✕
              </button>
            </div>
          )}

          {/* compact 모드에서 접기 버튼 */}
          {compact && isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white/70"
              title="접기"
            >
              ▲
            </button>
          )}
        </div>
      )}

      {/* 직접 입력 안내 - compact 모드에서는 숨김 */}
      {showDirectInput && !compact && (
        <p className="text-center text-[10px] text-white/40">
          숫자만 입력하면 해당 값으로 설정, +/- 붙이면 증감
        </p>
      )}
    </div>
  );
}

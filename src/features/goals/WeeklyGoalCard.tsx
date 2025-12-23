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
 *     - 오늘의 목표량 자동 계산 표시
 *     - 만회 경고 표시 (심각도 레벨: 🟢🟡🔴)
 *     - 클릭 시 히스토리 모달 열기
 *   - Key Dependencies:
 *     - WeeklyProgressBar: 진행도바 컴포넌트
 *     - useWeeklyGoalStore: 상태 관리
 *     - catchUpUtils: 만회 심각도 계산
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { WeeklyGoal } from '@/shared/types/domain';
import { useWeeklyGoalStore } from '@/shared/stores/weeklyGoalStore';
import WeeklyProgressBar from './WeeklyProgressBar';
import { QUICK_UPDATE_BUTTONS } from './constants/goalConstants';
import { calculateCatchUpInfo } from './utils/catchUpUtils';
import GoalStatusTooltip from './components/GoalStatusTooltip';

interface WeeklyGoalCardProps {
  goal: WeeklyGoal;
  onEdit: () => void;
  onDelete: () => void;
  onShowHistory: () => void;
  /** 압축 모드 (그리드 레이아웃용) */
  compact?: boolean;
}

/**
 * 장기목표 카드 컴포넌트
 */
export default function WeeklyGoalCard({ goal, onEdit, onDelete, onShowHistory, compact = false }: WeeklyGoalCardProps) {
  const updateProgress = useWeeklyGoalStore((s) => s.updateProgress);
  const setProgress = useWeeklyGoalStore((s) => s.setProgress);
  const getDayOfWeekIndex = useWeeklyGoalStore((s) => s.getDayOfWeekIndex);
  const getTodayTarget = useWeeklyGoalStore((s) => s.getTodayTarget);
  const getRemainingDays = useWeeklyGoalStore((s) => s.getRemainingDays);
  const getDailyTargetForToday = useWeeklyGoalStore((s) => s.getDailyTargetForToday);
  const [directInput, setDirectInput] = useState('');
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [lastDelta, setLastDelta] = useState<number>(0);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border border-white/5 bg-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all hover:border-white/10 hover:bg-white/10 ${
        isCompleted ? 'ring-1 ring-emerald-400/30' : ''
      } ${compact ? 'gap-2 p-3' : 'gap-3 p-4'}`}
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

        {/* 진행률 배지 (애니메이션 포함) + Quota 달성 배지 */}
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
        <div className={`absolute flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${compact ? 'right-1 top-1' : 'right-2 top-2'}`}>
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

      {/* 오늘의 목표량 & 만회 정보 (심각도 레벨 표시) */}
      <div className={`flex flex-wrap justify-between gap-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <GoalStatusTooltip
          goal={goal}
          todayTarget={todayTarget}
          dailyTargetForToday={dailyTargetForToday}
          remainingDays={remainingDays}
          catchUpInfo={catchUpInfo}
        >
          <div className={`rounded-lg bg-white/5 cursor-help ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
            <span className="text-white/50">오늘: </span>
            <span className="font-bold text-white">{dailyTargetForToday.toLocaleString()}</span>
            <span className="text-white/40 ml-1">({remainingDays}일)</span>
            <span className="ml-1 text-white/30">ⓘ</span>
          </div>
        </GoalStatusTooltip>

        {/* 상태 표시: 순항 / 뒤처짐 / 달성 */}
        {isCompleted ? (
          <div className={`rounded-lg bg-emerald-500/10 text-emerald-300 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
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
          <div className={`rounded-lg bg-emerald-500/10 text-emerald-300 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
            🟢 순조로워요!
          </div>
        )}
      </div>

      {/* Quick Update Buttons */}
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
      </div>

      {/* 직접 입력 안내 - compact 모드에서는 숨김 */}
      {showDirectInput && !compact && (
        <p className="text-center text-[10px] text-white/40">
          숫자만 입력하면 해당 값으로 설정, +/- 붙이면 증감
        </p>
      )}
    </div>
  );
}

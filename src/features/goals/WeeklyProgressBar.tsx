/**
 * WeeklyProgressBar.tsx
 *
 * @file 7분할 진행도바 컴포넌트
 * @description
 *   - Role: 주간 목표의 진행 상황을 7일 단위로 시각화
 *   - Responsibilities:
 *     - 7개 구분선 및 구분값 표시
 *     - 오늘 칸 하이라이트 (현재 요일 강조)
 *     - 오늘까지 해야 하는 양 회색으로 표시
 *     - 만회 경고색 (뒤처짐 표시)
 *     - 현재 진행도 표시
 */

import { useMemo } from 'react';

interface WeeklyProgressBarProps {
  /** 목표 총량 */
  target: number;
  /** 현재 진행도 */
  currentProgress: number;
  /** 오늘까지 해야하는 목표량 (7분할 기준) */
  todayTarget: number;
  /** 오늘이 주의 몇 번째 날인지 (0=월요일, 6=일요일) */
  dayIndex: number;
  /** 진행바 색상 */
  color?: string;
  /** 단위 (표시용) */
  unit?: string;
  /** 높이 (기본: h-6) */
  height?: string;
  /** 압축 모드 */
  compact?: boolean;
  /** 애니메이션 트리거 (진행도 업데이트 시 true) */
  animating?: boolean;
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

/**
 * 7분할 주간 진행도바
 */
export default function WeeklyProgressBar({
  target,
  currentProgress,
  todayTarget,
  dayIndex,
  color = '#6366f1',
  unit = '',
  height = 'h-6',
  compact = false,
  animating = false,
}: WeeklyProgressBarProps) {
  const safeTarget = target > 0 ? target : 0;
  const safeDayIndex = Math.min(6, Math.max(0, dayIndex));

  // 퍼센트 계산 (0 나누기 방지)
  const progressPercent = safeTarget > 0 ? Math.min(100, (currentProgress / safeTarget) * 100) : 0;
  const todayTargetPercent = safeTarget > 0 ? Math.min(100, (todayTarget / safeTarget) * 100) : 0;
  
  // 뒤처짐 상태 판단
  const isBehind = currentProgress < todayTarget;
  const catchUpNeeded = todayTarget - currentProgress;
  
  // 7분할 구분값 계산
  const divisionValues = useMemo(() => {
    const values = [];
    for (let i = 1; i <= 7; i++) {
      values.push(Math.round((target / 7) * i));
    }
    return values;
  }, [target]);

  // 색상 결정 (뒤처짐 정도에 따라)
  const progressColor = useMemo(() => {
    if (!isBehind) return color;
    const behindRatio = safeTarget > 0 ? catchUpNeeded / safeTarget : 0;
    if (behindRatio > 0.3) return '#ef4444'; // 빨간색 (30% 이상 뒤처짐)
    if (behindRatio > 0.15) return '#f97316'; // 주황색 (15% 이상 뒤처짐)
    return '#f59e0b'; // 노란색 (약간 뒤처짐)
  }, [isBehind, catchUpNeeded, safeTarget, color]);

  return (
    <div className="w-full">
      {/* 진행바 컨테이너 */}
      <div
        className={`relative ${height} w-full overflow-hidden rounded-lg bg-gray-700/50`}
        role="progressbar"
        aria-label="주간 목표 진행도"
        aria-valuemin={0}
        aria-valuemax={safeTarget}
        aria-valuenow={Math.min(Math.max(currentProgress, 0), safeTarget)}
      >
        {/* 오늘 칸 하이라이트 배경 */}
        <div
          className="absolute inset-y-0 bg-white/10 transition-all duration-300"
          style={{
            left: `${(safeDayIndex / 7) * 100}%`,
            width: `${100 / 7}%`,
          }}
        />

        {/* 오늘까지 해야할 양 (회색 배경) */}
        <div
          className="absolute inset-y-0 left-0 bg-gray-500/30 transition-all duration-300"
          style={{ width: `${todayTargetPercent}%` }}
        />

        {/* 현재 진행도 */}
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-500 ${animating ? 'animate-pulse motion-reduce:animate-none' : ''}`}
          style={{
            width: `${progressPercent}%`,
            background: `linear-gradient(90deg, ${progressColor}, ${progressColor}dd)`,
            boxShadow: `0 0 10px ${progressColor}40`,
          }}
        />

        {/* 7분할 구분선 */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="absolute inset-y-0 w-px"
            style={{
              left: `${(i / 7) * 100}%`,
              background: i <= safeDayIndex + 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}

        {/* 오늘 위치 마커 (오늘 칸 끝) */}
        <div
          className="absolute inset-y-0 w-1 rounded-full"
          style={{
            left: `${((safeDayIndex + 1) / 7) * 100}%`,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))',
            boxShadow: '0 0 8px rgba(255,255,255,0.6)',
          }}
        />

        {/* 진행도 텍스트 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold text-white drop-shadow-md ${compact ? 'text-[10px]' : 'text-xs'} ${animating ? 'scale-110 transition-transform motion-reduce:scale-100 motion-reduce:transition-none' : 'transition-transform motion-reduce:transition-none'}`}>
            {currentProgress.toLocaleString()} / {target.toLocaleString()} {compact ? '' : unit}
          </span>
        </div>
      </div>

      {/* 요일 레이블 - compact 모드에서는 숨김 */}
      {!compact && (
        <div className="mt-1 flex justify-between px-0.5">
          {DAY_LABELS.map((label, i) => (
            <span
              key={label}
              className={`text-[10px] font-medium transition-all ${
                i === safeDayIndex
                  ? 'text-white font-bold scale-110'
                  : i < safeDayIndex
                  ? 'text-white/60'
                  : 'text-white/30'
              }`}
            >
              {i === safeDayIndex ? `[${label}]` : label}
            </span>
          ))}
        </div>
      )}

      {/* 구분값 표시 - compact 모드에서는 숨김 */}
      {!compact && (
        <div className="mt-0.5 flex justify-between px-0.5 text-[9px] text-white/40">
          {divisionValues.slice(0, 6).map((value, i) => (
            <span key={i} className="w-4 text-center">
              {value >= 1000 ? `${Math.round(value / 1000)}k` : value}
            </span>
          ))}
          <span className="w-4 text-center text-white/60">{target >= 1000 ? `${Math.round(target / 1000)}k` : target}</span>
        </div>
      )}
    </div>
  );
}

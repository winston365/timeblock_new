/**
 * BossHealthBar - 보스 체력바 컴포넌트
 *
 * @role 현재 보스의 HP를 시각적으로 표시
 * @input currentHP, maxHP
 * @output 애니메이션 체력바 UI
 */

import { useMemo } from 'react';

interface BossHealthBarProps {
  currentHP: number;
  maxHP: number;
  /** 난이도별 색상 변경 (선택) */
  difficulty?: 'easy' | 'normal' | 'hard' | 'epic';
}

/**
 * HP 비율에 따른 색상 반환
 */
function getHealthColor(percentage: number, difficulty?: string): string {
  // Epic 난이도는 보라색 계열
  if (difficulty === 'epic') {
    if (percentage > 50) return 'bg-purple-500';
    if (percentage > 25) return 'bg-purple-600';
    return 'bg-purple-700';
  }

  // 일반 난이도별 색상
  if (percentage > 60) return 'bg-green-500';
  if (percentage > 30) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * HP 비율에 따른 그라데이션 배경
 */
function getHealthGradient(percentage: number, difficulty?: string): string {
  if (difficulty === 'epic') {
    return 'linear-gradient(90deg, #8b5cf6 0%, #a855f7 50%, #c084fc 100%)';
  }
  if (percentage > 60) {
    return 'linear-gradient(90deg, #22c55e 0%, #4ade80 100%)';
  }
  if (percentage > 30) {
    return 'linear-gradient(90deg, #eab308 0%, #facc15 100%)';
  }
  return 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)';
}

export function BossHealthBar({ currentHP, maxHP, difficulty }: BossHealthBarProps) {
  const percentage = useMemo(() => {
    if (maxHP <= 0) return 0;
    return Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  }, [currentHP, maxHP]);

  const isDefeated = currentHP <= 0;

  return (
    <div className="w-full">
      {/* HP 텍스트 */}
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className="font-bold text-[var(--color-text-secondary)]">HP</span>
        <span className={`font-mono font-bold ${isDefeated ? 'text-gray-500' : 'text-[var(--color-text)]'}`}>
          {currentHP} / {maxHP}
        </span>
      </div>

      {/* 체력바 컨테이너 */}
      <div className="relative h-5 w-full overflow-hidden rounded-lg bg-[var(--color-bg-elevated)] shadow-inner">
        {/* 배경 패턴 (빗금) */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, currentColor 4px, currentColor 6px)',
          }}
        />

        {/* 체력바 */}
        <div
          className={`relative h-full transition-all duration-500 ease-out ${getHealthColor(percentage, difficulty)}`}
          style={{
            width: `${percentage}%`,
            background: getHealthGradient(percentage, difficulty),
          }}
        >
          {/* 광택 효과 */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
          
          {/* 체력 감소 시 깜빡임 효과 */}
          {percentage < 30 && !isDefeated && (
            <div className="absolute inset-0 animate-pulse bg-red-600/30" />
          )}
        </div>

        {/* 처치됨 표시 */}
        {isDefeated && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-xs font-bold text-white drop-shadow-lg">💀 DEFEATED</span>
          </div>
        )}
      </div>

      {/* 퍼센티지 표시 (선택) */}
      {!isDefeated && (
        <div className="mt-1 text-center text-[10px] text-[var(--color-text-tertiary)]">
          {percentage.toFixed(0)}% 남음
        </div>
      )}
    </div>
  );
}

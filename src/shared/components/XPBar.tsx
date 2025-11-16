/**
 * XPBar
 *
 * @role 사용자의 현재 레벨과 XP 진행 상태를 시각적으로 표시하는 프로그레스 바 컴포넌트
 * @input totalXP (number), level (number)
 * @output 레벨, XP 진행률 바, 다음 레벨까지 필요한 XP를 표시하는 UI
 * @external_dependencies
 *   - getXPToNextLevel: XP 계산 유틸리티 함수
 */

import { getXPToNextLevel } from '@/shared/lib/utils';

interface XPBarProps {
  totalXP: number;
  level: number;
}

/**
 * XP 진행률 바를 렌더링하는 컴포넌트
 *
 * @param {XPBarProps} props - totalXP와 level을 포함하는 props
 * @returns {JSX.Element} XP 진행률 바 UI
 */
export default function XPBar({ totalXP, level }: XPBarProps) {
  const xpToNext = getXPToNextLevel(totalXP);
  const currentLevelXP = totalXP - (level - 1) * 100;
  const progress = (currentLevelXP / 100) * 100;

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-xs">
        <span className="text-sm font-semibold text-primary">레벨 {level}</span>
        <span className="text-xs font-semibold text-reward">
          {currentLevelXP} / 100 XP
        </span>
      </div>

      {/* Progress Track */}
      <div className="h-3 bg-bg-elevated rounded-md overflow-hidden relative mb-xs">
        <div
          className="h-full bg-gradient-to-r from-reward to-warning transition-all duration-500 relative overflow-hidden"
          style={{ width: `${progress}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end">
        <span className="text-xs font-medium text-reward">다음 레벨까지 {xpToNext} XP</span>
      </div>
    </div>
  );
}

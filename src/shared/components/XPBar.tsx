/**
 * XPBar
 *
 * @role 사용자의 현재 레벨과 XP 진행 상태를 시각적으로 표시하는 프로그레스 바 컴포넌트
 * @input totalXP (number), level (number)
 * @output 레벨, XP 진행률 바, 다음 레벨까지 필요한 XP를 표시하는 UI
 * @external_dependencies
 *   - getXPToNextLevel: XP 계산 유틸리티 함수
 *   - XPBar.css: 스타일시트
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
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-md">
      <div className="mb-[var(--spacing-xs)] flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">레벨 {level}</span>
        <span className="text-xs font-semibold text-reward">{currentLevelXP} / 100 XP</span>
      </div>
      <div className="relative mb-[var(--spacing-xs)] h-3 overflow-hidden rounded-[6px] bg-[var(--color-bg-tertiary)]">
        <div
          className="relative h-full rounded-[6px] bg-[linear-gradient(90deg,var(--color-reward),var(--color-warning))] transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        >
          <span className="pointer-events-none absolute inset-0 block animate-shimmer bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0)_100%)] opacity-70" />
        </div>
      </div>
      <div className="flex justify-end">
        <span className="text-xs font-medium text-reward">다음 레벨까지 {xpToNext} XP</span>
      </div>
    </div>
  );
}

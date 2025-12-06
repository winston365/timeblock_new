/**
 * BossHPBar - 보스 HP 바 컴포넌트
 *
 * @role 보스의 현재/최대 HP를 시각적으로 표시
 * @description
 *   - HP 비율에 따른 색상 변화 (일반 → 위험 → 치명적)
 *   - 치명적 상태에서 애니메이션 효과
 */

import {
  HP_LOW_THRESHOLD_PERCENT,
  HP_CRITICAL_THRESHOLD_PERCENT,
} from '../../constants/battleConstants';

interface BossHPBarProps {
  /** 현재 HP */
  current: number;
  /** 최대 HP */
  max: number;
}

/**
 * 보스 HP 바 컴포넌트
 */
export function BossHPBar({ current, max }: BossHPBarProps) {
  const percentage = (current / max) * 100;
  const isLow = percentage <= HP_LOW_THRESHOLD_PERCENT;
  const isCritical = percentage <= HP_CRITICAL_THRESHOLD_PERCENT;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-bold text-red-400">HP</span>
        <span
          className={`text-sm font-mono font-bold ${
            isCritical
              ? 'text-red-500 animate-pulse'
              : isLow
                ? 'text-orange-400'
                : 'text-red-300'
          }`}
        >
          {current} / {max}
        </span>
      </div>
      <div className="h-4 bg-black/50 rounded-full overflow-hidden border border-red-900/50">
        <div
          className={`h-full transition-all duration-500 ${
            isCritical
              ? 'bg-gradient-to-r from-red-700 via-red-500 to-red-700 animate-pulse'
              : isLow
                ? 'bg-gradient-to-r from-orange-600 to-red-500'
                : 'bg-gradient-to-r from-red-600 via-red-500 to-red-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

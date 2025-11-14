/**
 * src/shared/components/XPBar.tsx
 * XP 진행률 바 컴포넌트
 */

import { getXPToNextLevel } from '@/shared/lib/utils';
import './XPBar.css';

interface XPBarProps {
  totalXP: number;
  level: number;
}

export default function XPBar({ totalXP, level }: XPBarProps) {
  const xpToNext = getXPToNextLevel(totalXP);
  const currentLevelXP = totalXP - (level - 1) * 100;
  const progress = (currentLevelXP / 100) * 100;

  return (
    <div className="xp-bar-container">
      <div className="xp-bar-header">
        <span className="xp-level">레벨 {level}</span>
        <span className="xp-progress-text">
          {currentLevelXP} / 100 XP
        </span>
      </div>
      <div className="xp-bar-track">
        <div
          className="xp-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="xp-bar-footer">
        <span className="xp-next">다음 레벨까지 {xpToNext} XP</span>
      </div>
    </div>
  );
}

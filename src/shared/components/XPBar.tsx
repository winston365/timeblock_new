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
import './XPBar.css';

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

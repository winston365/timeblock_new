/**
 * src/features/gamification/LevelUpNotification.tsx
 * 레벨업 알림 모달
 */

import './gamification.css';

interface LevelUpNotificationProps {
  level: number;
  onClose: () => void;
}

export default function LevelUpNotification({ level, onClose }: LevelUpNotificationProps) {
  return (
    <div className="level-up-overlay" onClick={onClose}>
      <div className="level-up-modal" onClick={e => e.stopPropagation()}>
        <div className="level-up-animation">
          <div className="level-up-icon">🎉</div>
          <h2 className="level-up-title">레벨 업!</h2>
          <div className="level-up-level">
            <span className="level-number">{level}</span>
          </div>
          <p className="level-up-message">
            축하합니다! 레벨 {level}에 도달했습니다!
          </p>
          <button className="level-up-btn" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

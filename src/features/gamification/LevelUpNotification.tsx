/**
 * LevelUpNotification
 *
 * @role 레벨업 시 표시되는 축하 알림 모달
 * @input level (새로운 레벨), onClose (닫기 핸들러)
 * @output 레벨업 애니메이션 모달
 * @external_dependencies 없음
 */

import './gamification.css';

interface LevelUpNotificationProps {
  level: number;
  onClose: () => void;
}

/**
 * 레벨업 알림 모달
 *
 * @param {LevelUpNotificationProps} props - 컴포넌트 props
 * @returns {JSX.Element} 레벨업 모달
 */
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

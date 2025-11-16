/**
 * CompletionCelebrationModal
 *
 * @role 타이머 사용 작업 완료 시 화려한 축하 모달 표시
 * @input task (Task) - 완료된 작업 정보
 * @input xpGained (number) - 획득한 총 XP
 * @input timerBonus (number) - 타이머 보너스 XP
 * @input onClose (function) - 모달 닫기 콜백
 * @output 화려한 축하 UI와 애니메이션
 */

import type { Task } from '@/shared/types/domain';

interface CompletionCelebrationModalProps {
  task: Task;
  xpGained: number;
  timerBonus: number;
  onClose: () => void;
}

/**
 * 완료 축하 모달 컴포넌트
 *
 * @param {CompletionCelebrationModalProps} props
 * @returns {JSX.Element} 축하 모달 UI
 */
export function CompletionCelebrationModal({
  task,
  xpGained,
  timerBonus,
  onClose,
}: CompletionCelebrationModalProps) {
  return (
    <div className="modal-overlay celebration-overlay" onClick={onClose}>
      <div className="modal-content celebration-modal" onClick={e => e.stopPropagation()}>
        {/* 배경 애니메이션 효과 */}
        <div className="celebration-particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>

        <div className="modal-header celebration-header">
          <h2>🎉 완벽한 몰입! 🎉</h2>
        </div>

        <div className="modal-body celebration-body">
          <div className="celebration-badge">
            <div className="badge-icon">⏱️</div>
            <div className="badge-text">타이머 마스터</div>
          </div>

          <div className="celebration-task-name">"{task.text}"</div>

          <div className="celebration-message">
            와! 완전 몰입했네요!<br />
            정말 멋져요! 💖
          </div>

          <div className="celebration-xp">
            <div className="xp-row base-xp">
              <span className="xp-label">기본 XP</span>
              <span className="xp-value">+{xpGained - timerBonus}</span>
            </div>
            <div className="xp-row bonus-xp">
              <span className="xp-label">⏱️ 타이머 보너스</span>
              <span className="xp-value glow">+{timerBonus}</span>
            </div>
            <div className="xp-divider"></div>
            <div className="xp-row total-xp">
              <span className="xp-label">총 XP</span>
              <span className="xp-value total">+{xpGained}</span>
            </div>
          </div>

          <div className="celebration-encouragement">
            이 조자료 계속 힘내세요! 🚀
          </div>
        </div>

        <div className="modal-actions celebration-actions">
          <button
            type="button"
            className="btn-primary btn-celebration-close"
            onClick={onClose}
          >
            감사합니다! ✨
          </button>
        </div>
      </div>
    </div>
  );
}

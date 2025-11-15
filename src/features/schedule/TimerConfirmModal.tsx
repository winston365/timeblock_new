/**
 * TimerConfirmModal
 *
 * @role 작업 완료 시 타이머 사용 여부를 확인하는 모달
 * @input onConfirm (function) - 사용자가 선택한 타이머 사용 여부를 전달하는 콜백
 * @output 타이머 사용 여부 확인 UI
 */

import './schedule.css';

interface TimerConfirmModalProps {
  taskName: string;
  onConfirm: (timerUsed: boolean) => void;
}

/**
 * 타이머 확인 모달 컴포넌트
 *
 * @param {TimerConfirmModalProps} props - taskName과 onConfirm 콜백
 * @returns {JSX.Element} 타이머 확인 모달 UI
 */
export function TimerConfirmModal({ taskName, onConfirm }: TimerConfirmModalProps) {
  const handleYes = () => {
    onConfirm(true);
  };

  const handleNo = () => {
    onConfirm(false);
  };

  return (
    <div className="modal-overlay" onClick={handleNo}>
      <div className="modal-content timer-confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⏱️ 타이머 사용 확인</h2>
        </div>

        <div className="modal-body">
          <div className="timer-confirm-content">
            <div className="timer-confirm-task-name">"{taskName}"</div>
            <div className="timer-confirm-question">
              이 작업을 수행할 때 타이머를 사용하셨나요?
            </div>
            <div className="timer-confirm-hint">
              타이머를 사용하면 <strong>+20 XP 보너스</strong>를 받을 수 있어요! 💖
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleNo}
          >
            아니오
          </button>
          <button
            type="button"
            className="btn-primary btn-timer-yes"
            onClick={handleYes}
          >
            ⏱️ 예, 사용했어요!
          </button>
        </div>
      </div>
    </div>
  );
}

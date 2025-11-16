/**
 * TimerConfirmModal
 *
 * @role 작업 완료 시 타이머 사용 여부를 확인하는 모달
 * @input onConfirm (function) - 사용자가 선택한 타이머 사용 여부를 전달하는 콜백
 * @output 타이머 사용 여부 확인 UI
 */

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={handleNo}>
      <div className="bg-bg-surface rounded-lg shadow-xl max-w-[500px] w-[90vw] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-lg border-b border-border">
          <h2 className="text-lg font-bold text-text">⏱️ 타이머 사용 확인</h2>
        </div>

        <div className="p-lg flex flex-col gap-md">
          <div className="flex flex-col gap-sm text-center">
            <div className="text-base font-semibold text-text">"{taskName}"</div>
            <div className="text-sm text-text-secondary">
              이 작업을 수행할 때 타이머를 사용하셨나요?
            </div>
            <div className="text-sm text-text-tertiary">
              타이머를 사용하면 <strong className="text-primary">+20 XP 보너스</strong>를 받을 수 있어요! 💖
            </div>
          </div>
        </div>

        <div className="flex gap-sm p-lg justify-end border-t border-border">
          <button
            type="button"
            className="px-lg py-sm border border-border rounded-md text-sm font-medium bg-bg-base text-text transition-all hover:bg-bg-elevated"
            onClick={handleNo}
          >
            아니오
          </button>
          <button
            type="button"
            className="px-lg py-sm bg-primary text-white rounded-md text-sm font-medium transition-all hover:bg-primary-dark hover:-translate-y-px hover:shadow-md"
            onClick={handleYes}
          >
            ⏱️ 예, 사용했어요!
          </button>
        </div>
      </div>
    </div>
  );
}

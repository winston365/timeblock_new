/**
 * @file RealityCheckModal.tsx
 * @role 작업 완료 후 예상 시간 대비 실제 소요 시간을 피드백받는 모달
 * @input useRealityCheckStore에서 isOpen, taskTitle, estimatedDuration
 * @output 피드백 버튼 3개(더 빨랐음, 예상대로, 더 걸렸음)를 포함한 모달 UI
 * @dependencies realityCheckStore, toastStore, gameStateStore
 */

import { useRealityCheckStore } from '@/shared/stores/realityCheckStore';
import { useToastStore } from '@/shared/stores/toastStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { useModalEscapeClose } from '@/shared/hooks';

/**
 * 현실 점검 모달 컴포넌트
 * 작업 완료 후 사용자에게 예상 시간 대비 실제 소요 시간을 묻고 XP를 지급합니다.
 *
 * @returns {JSX.Element | null} 모달 UI (isOpen이 false면 null)
 */
export function RealityCheckModal() {
    const { isOpen, taskTitle, estimatedDuration, closeRealityCheck } = useRealityCheckStore();
    const { addXP } = useGameStateStore();
    const { addToast } = useToastStore();

    useModalEscapeClose(isOpen, closeRealityCheck);

    if (!isOpen) return null;

    const handleFeedback = (type: 'faster' | 'ontime' | 'slower') => {
        // 1. Feedback Message (즉시 표시)
        let message = '';
        if (type === 'faster') message = '🚀 대단해요! 예상보다 빨리 끝내셨네요. +5 XP';
        if (type === 'ontime') message = '🎯 완벽합니다! 예상이 정확했어요. +5 XP';
        if (type === 'slower') message = '⏳ 조금 더 걸렸네요. 다음엔 여유를 둬보세요! +5 XP';

        addToast(message, 'success');

        // 2. 모달 즉시 닫기 (낙관적 업데이트)
        closeRealityCheck();

        // 3. XP 처리는 백그라운드에서 비동기로 처리
        addXP(5, undefined).catch((error) => {
            console.error('Failed to add XP:', error);
            // XP 추가 실패 시에도 사용자 경험에는 영향 없음
        });
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-elevated)] p-6 shadow-2xl border border-[var(--color-border)] transform scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">📊 현실 점검 (Reality Check)</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    방금 <span className="font-semibold text-[var(--color-primary)]">"{taskTitle}"</span> 작업을 완료했습니다.
                    <br />
                    예상 소요 시간은 <span className="font-mono">{estimatedDuration}분</span>이었습니다.
                </p>

                <p className="text-sm font-medium text-[var(--color-text)] mb-4 text-center">
                    실제로 얼마나 걸리셨나요?
                </p>

                <div className="grid grid-cols-3 gap-4">
                    <button
                        onClick={() => handleFeedback('faster')}
                        className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
                    >
                        <span className="text-3xl transition-transform duration-300 group-hover:scale-110">🚀</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">더 빨랐음</span>
                    </button>

                    <button
                        onClick={() => handleFeedback('ontime')}
                        className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/60 hover:bg-indigo-500/10 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95"
                    >
                        <span className="text-3xl transition-transform duration-300 group-hover:scale-110">🎯</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">예상대로</span>
                    </button>

                    <button
                        onClick={() => handleFeedback('slower')}
                        className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/60 hover:bg-amber-500/10 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95"
                    >
                        <span className="text-3xl transition-transform duration-300 group-hover:scale-110">🐌</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-500">더 걸렸음</span>
                    </button>
                </div>

                <button
                    onClick={closeRealityCheck}
                    className="mt-6 w-full text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                >
                    건너뛰기
                </button>
            </div>
        </div>
    );
}

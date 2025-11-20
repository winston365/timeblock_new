import { useRealityCheckStore } from '@/shared/stores/realityCheckStore';
import { useToastStore } from '@/shared/stores/toastStore';
import { addXP } from '@/data/repositories/gameStateRepository';
import { useState } from 'react';

export function RealityCheckModal() {
    const { isOpen, taskTitle, estimatedDuration, closeRealityCheck } = useRealityCheckStore();
    const { addToast } = useToastStore();
    const [showReward, setShowReward] = useState(false);

    if (!isOpen) return null;

    const handleFeedback = async (type: 'faster' | 'ontime' | 'slower') => {
        // 1. XP Reward
        try {
            await addXP(5, 'Reality Check Feedback', 'other'); // 'productivity' is not a valid reason type, using 'other'
            setShowReward(true);
        } catch (error) {
            console.error('Failed to add XP:', error);
        }

        // 2. Feedback Message
        let message = '';
        if (type === 'faster') message = '🚀 대단해요! 예상보다 빨리 끝내셨네요.';
        if (type === 'ontime') message = '🎯 완벽합니다! 예상이 정확했어요.';
        if (type === 'slower') message = '⏳ 조금 더 걸렸네요. 다음엔 여유를 둬보세요!';

        addToast(message, 'success');

        // 3. Close after short delay to show reward
        setTimeout(() => {
            closeRealityCheck();
            setShowReward(false);
        }, 1000);
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

                {/* Floating Reward Animation */}
                {showReward && (
                    <div className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 animate-float-up-fade text-2xl font-bold text-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        +5 XP
                    </div>
                )}

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

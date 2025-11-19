import { useRealityCheckStore } from '@/shared/stores/realityCheckStore';
import { useToastStore } from '@/shared/stores/toastStore';

export function RealityCheckModal() {
    const { isOpen, taskTitle, estimatedDuration, closeRealityCheck } = useRealityCheckStore();
    const { addToast } = useToastStore();

    if (!isOpen) return null;

    const handleFeedback = (type: 'faster' | 'ontime' | 'slower') => {
        // In a real app, we would save this data to calibrate future estimates.
        // For now, we just give immediate feedback.

        let message = '';
        if (type === 'faster') message = '🚀 Great job! You were faster than expected.';
        if (type === 'ontime') message = '🎯 Perfect estimation!';
        if (type === 'slower') message = '⏳ That took a bit longer. Next time, add some buffer!';

        addToast(message, 'success');
        closeRealityCheck();
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg-elevated)] p-6 shadow-2xl border border-[var(--color-border)] transform scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">📊 Reality Check</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    You just completed <span className="font-semibold text-[var(--color-primary)]">"{taskTitle}"</span>.
                    <br />
                    You estimated <span className="font-mono">{estimatedDuration} min</span>.
                </p>

                <p className="text-sm font-medium text-[var(--color-text)] mb-4 text-center">
                    How long did it actually take?
                </p>

                <div className="grid grid-cols-3 gap-3">
                    <button
                        onClick={() => handleFeedback('faster')}
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 hover:bg-emerald-500/20 transition-colors"
                    >
                        <span className="text-2xl">🚀</span>
                        <span className="text-xs font-bold text-emerald-500">Faster</span>
                    </button>

                    <button
                        onClick={() => handleFeedback('ontime')}
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 hover:bg-indigo-500/20 transition-colors"
                    >
                        <span className="text-2xl">🎯</span>
                        <span className="text-xs font-bold text-indigo-500">On Time</span>
                    </button>

                    <button
                        onClick={() => handleFeedback('slower')}
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 hover:bg-amber-500/20 transition-colors"
                    >
                        <span className="text-2xl">🐌</span>
                        <span className="text-xs font-bold text-amber-500">Slower</span>
                    </button>
                </div>

                <button
                    onClick={closeRealityCheck}
                    className="mt-6 w-full text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                >
                    Skip
                </button>
            </div>
        </div>
    );
}

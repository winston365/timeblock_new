import { motion, AnimatePresence } from 'framer-motion';

interface QuickMemoProps {
    value: string;
    onChange: (value: string) => void;
    isVisible: boolean;
}

export function QuickMemo({ value, onChange, isVisible }: QuickMemoProps) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                >
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2 text-sm text-[var(--color-text-tertiary)]">
                            <span>📝</span>
                            <span className="font-medium">퀵 메모</span>
                            <span className="text-xs opacity-70">(현재 작업 완료 시 사라짐)</span>
                        </div>
                        <textarea
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder="지금 떠오른 생각을 빠르게 적어두세요..."
                            className="w-full resize-none bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none min-h-[80px]"
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

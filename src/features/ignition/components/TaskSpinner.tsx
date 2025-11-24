import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task } from '@/shared/types/domain';


interface TaskSpinnerProps {
    tasks: Task[];
    onSelect: (task: Task) => void;
    onSpinStart?: () => void;
    disabled?: boolean;
    statusText?: string;
}

export default function TaskSpinner({ tasks, onSelect, onSpinStart, disabled, statusText }: TaskSpinnerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [isSlowingDown, setIsSlowingDown] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const handleSpin = () => {
        if (isSpinning || disabled || tasks.length === 0) return;
        setIsSpinning(true);
        setIsSlowingDown(false);
        onSpinStart?.();

        // 1. Calculate weighted winner
        const totalWeight = tasks.reduce((sum, t) => sum + ((t as any).weight || 0), 0);
        let random = Math.random() * totalWeight;
        let winnerIndex = 0;

        for (let i = 0; i < tasks.length; i++) {
            random -= ((tasks[i] as any).weight || 0);
            if (random <= 0) {
                winnerIndex = i;
                break;
            }
        }

        // 2. Calculate steps to land on winner
        // Ensure at least 4 full rotations + distance to winner
        const currentIdx = currentIndex;
        const distance = (winnerIndex - currentIdx + tasks.length) % tasks.length;
        const minFullSpins = 4;
        const totalSteps = (minFullSpins * tasks.length) + distance;

        let speed = 30;
        let steps = 0;
        let activeIndex = currentIdx;

        const spin = () => {
            activeIndex = (activeIndex + 1) % tasks.length;
            setCurrentIndex(activeIndex);
            steps++;

            // Start slowing down
            if (steps > totalSteps - 25) {
                setIsSlowingDown(true);
                speed = Math.floor(speed * 1.12);
            }

            if (steps >= totalSteps) {
                // Stop exactly on winner
                timerRef.current = setTimeout(() => {
                    setIsSpinning(false);
                    onSelect(tasks[winnerIndex]);
                }, 1000);
            } else {
                timerRef.current = setTimeout(spin, speed);
            }
        };

        spin();
    };

    const currentTask = tasks[currentIndex];

    return (
        <div className="flex flex-col items-center justify-center gap-6 p-8">
            <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="absolute inset-0 flex items-center justify-center px-6 text-center"
                    >
                        <h3 className="text-2xl font-bold text-white line-clamp-2">
                            {currentTask?.text || '작업 준비 중...'}
                        </h3>
                    </motion.div>
                </AnimatePresence>

                {/* Spin Button Overlay */}
                {!isSpinning && !disabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                        <button
                            onClick={handleSpin}
                            className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3 text-lg font-bold text-white shadow-lg transition hover:scale-105 hover:shadow-orange-500/25 active:scale-95"
                        >
                            돌리기
                        </button>
                    </div>
                )}
            </div>

            <div className="text-sm text-white/50 animate-pulse h-6">
                {isSpinning ? (
                    isSlowingDown ? '운명의 작업을 선택하는 중...' : '빠르게 탐색 중...'
                ) : (
                    statusText || (disabled ? '결과 확인 중...' : '오늘의 추천 작업은?')
                )}
            </div>
        </div>
    );
}

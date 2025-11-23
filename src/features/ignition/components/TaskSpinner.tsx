import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task } from '@/shared/types/domain';

interface TaskSpinnerProps {
    tasks: Task[];
    onSelect: (task: Task) => void;
}

export default function TaskSpinner({ tasks, onSelect }: TaskSpinnerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSlowingDown, setIsSlowingDown] = useState(false);

    useEffect(() => {
        if (tasks.length === 0) return;

        let intervalId: NodeJS.Timeout;
        let speed = 30; // Faster initial speed (ms)
        let steps = 0;
        let activeIndex = 0; // Track locally to avoid stale closure
        // Target ~5 seconds total duration with faster spin
        // Fast phase: ~80 steps * 30ms = 2400ms
        // Slow phase: ~25 steps with increasing delay
        const maxSteps = 100 + Math.floor(Math.random() * 20);

        const spin = () => {
            activeIndex = (activeIndex + 1) % tasks.length;
            setCurrentIndex(activeIndex);
            steps++;

            // Start slowing down for the last 25 steps
            if (steps > maxSteps - 25) {
                setIsSlowingDown(true);
                // Gentler slowdown to avoid "stopping" feeling too early
                speed = Math.floor(speed * 1.12);
            }

            if (steps >= maxSteps) {
                // Stop and wait 1 second before selecting
                // This gives the user a moment to see what was selected
                intervalId = setTimeout(() => {
                    onSelect(tasks[activeIndex]);
                }, 1000);
            } else {
                intervalId = setTimeout(spin, speed);
            }
        };

        intervalId = setTimeout(spin, speed);

        return () => clearTimeout(intervalId);
    }, [tasks, onSelect]);

    const currentTask = tasks[currentIndex];

    return (
        <div className="flex flex-col items-center justify-center gap-6 p-8">
            <div className="relative h-24 w-full overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="absolute inset-0 flex items-center justify-center text-center"
                    >
                        <h3 className="text-2xl font-bold text-[var(--color-text)] line-clamp-2">
                            {currentTask?.text || '작업 찾는 중...'}
                        </h3>
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="text-sm text-[var(--color-text-tertiary)] animate-pulse">
                {isSlowingDown ? '운명의 작업을 선택하는 중...' : '오늘의 추천 작업은?'}
            </div>
        </div>
    );
}

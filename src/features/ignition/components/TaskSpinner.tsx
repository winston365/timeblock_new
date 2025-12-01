/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file TaskSpinner.tsx
 * @role 점화 시스템 스피너 UI 컴포넌트
 * @responsibilities
 *   - 작업 목록을 회전하며 무작위 선택 애니메이션 제공
 *   - 가중치 기반 당첨 확률 계산 및 시각적 감속 효과
 *   - 결과 확정 후 선택된 작업 콜백 호출
 * @dependencies framer-motion, Task 타입
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Task } from '@/shared/types/domain';

/**
 * TaskSpinner 컴포넌트 Props
 */
interface TaskSpinnerProps {
    tasks: Task[];
    onSelect: (task: Task) => void;
    onSpinStart?: () => void;
    disabled?: boolean;
    statusText?: string;
    /** 외부에서 확정된 결과 작업 (예: pendingSelection) */
    resultTask?: Task | null;
}

/**
 * 점화 스피너 컴포넌트
 * 작업 목록을 회전하며 가중치 기반으로 무작위 선택하는 룰렛 UI
 *
 * @param props - TaskSpinnerProps
 * @returns 스피너 UI 컴포넌트
 */
export default function TaskSpinner({ tasks, onSelect, onSpinStart, disabled, statusText, resultTask }: TaskSpinnerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [isSlowingDown, setIsSlowingDown] = useState(false);
    const [displayTasks, setDisplayTasks] = useState<Task[]>(tasks);
    const [hasResult, setHasResult] = useState(false);
    const [localResultTask, setLocalResultTask] = useState<Task | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const rafRef = useRef<number | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    // Keep the spinner display in sync with the latest tasks only when it's safe.
    // While spinning or right after a spin (hasResult), we freeze the list so the
    // visual result cannot drift when the parent re-fetches tasks mid-spin.
    useEffect(() => {
        if (isSpinning || hasResult) return;
        setDisplayTasks(tasks);
        if (!resultTask) {
            setLocalResultTask(null);
        }
        setCurrentIndex(prev => {
            if (tasks.length === 0) return 0;
            return Math.min(prev, tasks.length - 1);
        });
    }, [tasks, isSpinning, hasResult, resultTask]);

    const handleSpin = () => {
        if (isSpinning || disabled || tasks.length === 0) return;

        // Ensure any previous timer is cleared before starting a new spin
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        // ✅ Capture tasks array immediately to prevent React closure issues
        // This ensures the winner calculation and selection use the same array,
        // even if parent component re-renders and passes a new tasks array
        const capturedTasks = [...tasks];
        setDisplayTasks(capturedTasks);
        setHasResult(false);
        setLocalResultTask(null);

        setIsSpinning(true);
        setIsSlowingDown(false);
        onSpinStart?.();

        // 1. Calculate weighted winner
        const totalWeight = capturedTasks.reduce((sum, t) => sum + ((t as any).weight || 0), 0);
        let random = Math.random() * totalWeight;
        let winnerIndex = 0;

        for (let i = 0; i < capturedTasks.length; i++) {
            random -= ((capturedTasks[i] as any).weight || 0);
            if (random <= 0) {
                winnerIndex = i;
                break;
            }
        }

        // 2. Calculate steps to land on winner
        // Ensure at least 4 full rotations + distance to winner
        const startIndex = currentIndex;
        const distance = (winnerIndex - startIndex + capturedTasks.length) % capturedTasks.length;
        const baseSpeed = 18; // ms, slightly faster start
        const maxSpeed = 180; // ms, clear slowdown ceiling for visibility
        const tailSpeed = 160; // ms, minimum speed near the very end
        const minFullSpins = 4;
        const totalSteps = (minFullSpins * capturedTasks.length) + distance;
        let stepCount = 0;
        let activeIndex = startIndex;

        let lastTime = performance.now();
        let accumulator = 0;
        let currentStepDuration = baseSpeed;

        const loop = (now: number) => {
            const delta = now - lastTime;
            lastTime = now;
            accumulator += delta;

            while (accumulator >= currentStepDuration) {
                accumulator -= currentStepDuration;
                activeIndex = (activeIndex + 1) % capturedTasks.length;
                setCurrentIndex(activeIndex);
                stepCount++;

                const progress = stepCount / Math.max(totalSteps, 1); // 0→1
                // 좀 더 강한 감속 (sine out ^1.8)
                const eased = Math.pow(Math.sin((Math.min(progress, 1) * Math.PI) / 2), 1.8);
                currentStepDuration = baseSpeed + (maxSpeed - baseSpeed) * eased;
                // 마지막 20% 구간은 시각적 감속을 위해 최소 속도 보장
                if (progress > 0.8) currentStepDuration = Math.max(currentStepDuration, tailSpeed);
                if (progress > 0.5) setIsSlowingDown(true);

                if (stepCount >= totalSteps) {
                    setCurrentIndex(winnerIndex);
                    setHasResult(true);
                    setLocalResultTask(capturedTasks[winnerIndex]);
                    setIsSpinning(false);
                    timerRef.current = setTimeout(() => {
                        onSelect(capturedTasks[winnerIndex]);
                    }, 800);
                    if (rafRef.current) {
                        cancelAnimationFrame(rafRef.current);
                        rafRef.current = null;
                    }
                    return;
                }
            }

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
    };

    const currentTask = resultTask || localResultTask || displayTasks[currentIndex];
    const isWinnerView = hasResult && !isSpinning;
    const rarityRing = currentTask && (currentTask as any).rarity
        ? (currentTask as any).rarity === 'legendary'
            ? 'ring-amber-400 shadow-amber-400/40'
            : (currentTask as any).rarity === 'epic'
                ? 'ring-purple-400 shadow-purple-400/40'
                : (currentTask as any).rarity === 'rare'
                    ? 'ring-blue-400 shadow-blue-400/40'
                    : 'ring-emerald-400 shadow-emerald-400/40'
        : '';

    return (
        <div className="flex flex-col items-center justify-center gap-6 p-8">
            <div className={`relative h-32 w-full overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 transition duration-200 ${isWinnerView ? `scale-[1.02] ring-2 shadow-lg ${rarityRing}` : ''}`}>
                <motion.div
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: isSpinning ? 0 : 0.08 }}
                    className="absolute inset-0 flex items-center justify-center px-6 text-center"
                >
                    <h3 className={`text-2xl font-bold text-white line-clamp-2 ${isWinnerView ? 'animate-pulse' : ''}`}>
                        {currentTask?.text || '작업 준비 중...'}
                    </h3>
                </motion.div>

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

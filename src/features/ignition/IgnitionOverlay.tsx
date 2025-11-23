import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIgnitionStore } from './stores/useIgnitionStore';
import { useDailyData } from '@/shared/hooks';
import { generateMicroStep } from '@/shared/services/ai/geminiApi';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import RouletteWheel from './components/RouletteWheel';
import confetti from 'canvas-confetti';

export default function IgnitionOverlay() {
    const {
        isOpen,
        isSpinning,
        selectedTask,
        microStepText,
        timerState,
        timeLeft,
        closeIgnition,
        startSpin,
        stopSpin,
        setMicroStep,
        startTimer,
        pauseTimer,
    } = useIgnitionStore();

    const { dailyData } = useDailyData();
    const { addXP, addItem } = useGameStateStore();
    const [inboxTasks, setInboxTasks] = useState<any[]>([]);
    const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

    // Fetch inbox tasks when opened
    useEffect(() => {
        if (isOpen) {
            // Instant XP Reward for Courage
            addXP(5, undefined, true).catch(console.error);

            import('@/data/repositories/inboxRepository').then(({ loadInboxTasks }) => {
                loadInboxTasks().then(setInboxTasks);
            });
        }
    }, [isOpen, addXP]);

    const getAvailableTasks = () => {
        const dailyTasks = dailyData?.tasks || [];
        const allTasks = [...dailyTasks, ...inboxTasks];

        // Filter tasks:
        // 1. Not completed
        const tasks = allTasks.filter(t => !t.completed);

        // Add Rest Tickets to the pool with weights and rarity
        const restTickets = [
            {
                id: 'ticket_10',
                text: '☕ 10분 휴식권',
                resistance: 'low',
                isTicket: true,
                ticketType: 'rest_ticket_10',
                weight: 30,
                rarity: 'common' as const,
            },
            {
                id: 'ticket_30',
                text: '🛌 30분 휴식권',
                resistance: 'low',
                isTicket: true,
                ticketType: 'rest_ticket_30',
                weight: 15,
                rarity: 'rare' as const,
            },
            {
                id: 'ticket_120',
                text: '🌴 2시간 휴식권',
                resistance: 'low',
                isTicket: true,
                ticketType: 'rest_ticket_120',
                weight: 4,
                rarity: 'epic' as const,
            },
            {
                id: 'ticket_240',
                text: '🏖️ 4시간 휴식권',
                resistance: 'low',
                isTicket: true,
                ticketType: 'rest_ticket_240',
                weight: 1,
                rarity: 'legendary' as const,
            },
        ];

        // Assign weights to tasks (50% total for all tasks combined)
        const taskWeight = tasks.length > 0 ? 50 / tasks.length : 0;
        const tasksWithWeights = tasks.map(task => ({
            ...task,
            weight: taskWeight,
            rarity: undefined,
        }));

        // Combine tasks and tickets
        const pool = [...tasksWithWeights, ...restTickets];

        // If no tasks at all, return dummy task
        if (pool.length === 0) {
            return [{ id: 'dummy', text: '인박스 정리하기', resistance: 'low', weight: 1 } as any];
        }

        return pool;
    };

    const handleTaskSelect = (task: any) => {
        if (task.isTicket) {
            // Handle ticket win
            addItem(task.ticketType, 1).then(() => {
                // Show toast or some feedback?
                // For now, just close ignition or maybe show a "You won!" dialog?
                // Let's just close for now and maybe the user will check inventory
                closeIgnition();
            });
            return;
        }

        stopSpin(task);

        // Generate micro-step
        setIsLoadingPrompt(true);
        const { settings } = useSettingsStore.getState();
        generateMicroStep(task.text, settings?.geminiApiKey || '').then(step => {
            setMicroStep(step);
            setIsLoadingPrompt(false);
        }).catch(() => {
            setIsLoadingPrompt(false);
        });
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="fixed bottom-24 right-6 z-[2000] w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between bg-white/5 px-6 py-4">
                        <div className="flex items-center gap-2 text-amber-500">
                            <span className="text-xl">🔥</span>
                            <span className="font-bold">3분 점화</span>
                        </div>
                        <button
                            onClick={closeIgnition}
                            className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-8 text-center">
                        {isSpinning ? (
                            <RouletteWheel
                                items={getAvailableTasks()}
                                onSelect={handleTaskSelect}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-6">
                                {/* Selected Task Info */}
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-white">{selectedTask?.text}</h2>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                                            {selectedTask?.resistance === 'low' ? '🟢 쉬움' : selectedTask?.resistance === 'medium' ? '🟡 보통' : '🔴 어려움'}
                                        </span>
                                    </div>
                                </div>

                                {/* AI Micro Step Prompt */}
                                <div className="relative w-full rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 p-6 border border-amber-500/20">
                                    {isLoadingPrompt ? (
                                        <div className="flex items-center justify-center gap-2 text-amber-500">
                                            <span className="animate-spin">⏳</span>
                                            <span className="text-sm font-medium">혜은이가 아주 쉬운 시작 방법을 찾는 중...</span>
                                        </div>
                                    ) : (
                                        <p className="text-lg font-medium leading-relaxed text-amber-100">
                                            "{microStepText}"
                                        </p>
                                    )}
                                </div>

                                {/* Timer Display */}
                                <div className="flex flex-col items-center gap-4">
                                    <div className="font-mono text-6xl font-bold tracking-wider text-white">
                                        {formatTime(timeLeft)}
                                    </div>

                                    {timerState === 'completed' ? (
                                        <div className="space-y-4">
                                            <p className="text-xl font-bold text-emerald-400">🎉 점화 성공!</p>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={closeIgnition}
                                                    className="rounded-xl bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20"
                                                >
                                                    휴식하기
                                                </button>
                                                <button
                                                    onClick={closeIgnition}
                                                    className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600"
                                                >
                                                    계속하기 (몰입)
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-4">
                                            {timerState === 'idle' && (
                                                <button
                                                    onClick={startTimer}
                                                    className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:scale-105 hover:shadow-orange-500/25"
                                                >
                                                    <span>🚀</span>
                                                    <span>지금 시작하기</span>
                                                </button>
                                            )}

                                            {timerState === 'running' && (
                                                <button
                                                    onClick={pauseTimer}
                                                    className="rounded-xl bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20"
                                                >
                                                    일시정지
                                                </button>
                                            )}

                                            {timerState === 'paused' && (
                                                <button
                                                    onClick={startTimer}
                                                    className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white hover:bg-amber-600"
                                                >
                                                    다시 시작
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

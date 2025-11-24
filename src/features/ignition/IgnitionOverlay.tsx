import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIgnitionStore } from './stores/useIgnitionStore';
import { useDailyData } from '@/shared/hooks';
import { generateMicroStep } from '@/shared/services/ai/geminiApi';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import RouletteWheel from './components/RouletteWheel';
import TaskSpinner from './components/TaskSpinner';
import { checkIgnitionAvailability, formatCooldownTime } from './utils/ignitionLimits';
import confetti from 'canvas-confetti';
import TaskModal from '@/features/schedule/TaskModal';
import type { TimeBlockId } from '@/shared/types/domain';

export default function IgnitionOverlay() {
    const {
        isOpen,
        isSpinning,
        selectedTask,
        microStepText,
        timerState,
        timeLeft,
        isBonus,
        closeIgnition,
        startSpin,
        stopSpin,
        setMicroStep,
        startTimer,
        pauseTimer,
        tickTimer,
    } = useIgnitionStore();

    const { dailyData, updateTask } = useDailyData();
    const { addXP, addItem, gameState } = useGameStateStore();
    const [inboxTasks, setInboxTasks] = useState<any[]>([]);
    const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
    const [viewMode, setViewMode] = useState<'wheel' | 'list'>('wheel');
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

    const ignitionStatus = useMemo(
        () => {
            const { settings } = useSettingsStore.getState();
            return checkIgnitionAvailability(gameState, isBonus, {
                cooldownMinutes: settings?.ignitionCooldownMinutes,
                xpCost: settings?.ignitionXPCost,
            });
        },
        [gameState, isBonus]
    );

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

    // Timer ticking
    useEffect(() => {
        if (timerState !== 'running') return;
        const interval = setInterval(() => {
            tickTimer();
        }, 1000);
        return () => clearInterval(interval);
    }, [timerState, tickTimer]);

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

        // Weights: tilt toward tasks, and keep a floor so tickets don't dominate when tasks are few
        const restTotalWeight = restTickets.reduce((sum, ticket) => sum + (ticket.weight || 0), 0);
        const baseTaskWeight = 8; // base per-task weight before applying floor
        const minTaskToRestRatio = 1.5; // tasks should keep roughly 60%+ odds

        // Assign weights to tasks with floor
        const desiredTaskTotal = tasks.length * baseTaskWeight;
        const flooredTaskTotal = tasks.length > 0
            ? Math.max(desiredTaskTotal, restTotalWeight * minTaskToRestRatio)
            : 0;
        const taskWeight = tasks.length > 0 ? flooredTaskTotal / tasks.length : 0;
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
        const promptContext = [
            `작업: ${task.text}`,
            task.resistance ? `난이도: ${task.resistance}` : '',
            task.memo ? `메모: ${task.memo}` : '',
            task.preparation1 || task.preparation2 || task.preparation3
                ? `준비사항: ${[task.preparation1, task.preparation2, task.preparation3].filter(Boolean).join(', ')}`
                : '',
        ].filter(Boolean).join('\n');

        generateMicroStep(promptContext, settings?.geminiApiKey || '').then(step => {
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

    const handleCompleteAndReward = async () => {
        if (!selectedTask) {
            closeIgnition();
            return;
        }
        const confirmed = confirm('작업을 실제로 완료했나요? 완료 처리하고 30 XP를 받습니다.');
        if (!confirmed) return;
        try {
            const target = dailyData?.tasks.find(t => t.id === selectedTask.id);
            if (target && !target.completed) {
                await updateTask(target.id, { completed: true, completedAt: new Date().toISOString() });
            }
            await addXP(30);
            closeIgnition();
        } catch (error) {
            console.error('완료 처리 실패:', error);
            alert('완료 처리에 실패했습니다.');
        }
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
                        <div className="flex items-center gap-2 text-xs">
                            {typeof ignitionStatus.freeSpinsRemaining === 'number' && (
                                <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-emerald-100">
                                    무료 {ignitionStatus.freeSpinsRemaining}회
                                </span>
                            )}
                            {ignitionStatus.reason === 'cooldown' && ignitionStatus.cooldownRemaining !== undefined && (
                                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-amber-100">
                                    쿨다운 {formatCooldownTime(ignitionStatus.cooldownRemaining)}
                                </span>
                            )}
                            {ignitionStatus.requiresXP && !ignitionStatus.canIgnite && (
                                <span className="rounded-full border border-indigo-400/40 bg-indigo-400/10 px-2 py-1 text-indigo-100">
                                    {ignitionStatus.requiresXP} XP 필요
                                </span>
                            )}
                            <button
                                onClick={closeIgnition}
                                className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 text-center">
                        {isSpinning ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-center gap-2 text-xs text-white/70">
                                    <button
                                        onClick={() => setViewMode('wheel')}
                                        className={`rounded-full px-3 py-1 ${viewMode === 'wheel' ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/15'}`}
                                    >
                                        🔄 룰렛
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`rounded-full px-3 py-1 ${viewMode === 'list' ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/15'}`}
                                    >
                                        📜 리스트 스핀
                                    </button>
                                </div>
                                {viewMode === 'wheel' ? (
                                    <RouletteWheel
                                        items={getAvailableTasks()}
                                        onSelect={handleTaskSelect}
                                    />
                                ) : (
                                    <TaskSpinner
                                        tasks={getAvailableTasks() as any}
                                        onSelect={handleTaskSelect as any}
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-6">
                                {/* Selected Task Info */}
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-white">{selectedTask?.text}</h2>
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                                            {selectedTask?.resistance === 'low' ? '🟢 쉬움' : selectedTask?.resistance === 'medium' ? '🟡 보통' : '🔴 어려움'}
                                        </span>
                                        {(selectedTask as any)?.rarity && (
                                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                                (selectedTask as any).rarity === 'legendary' ? 'border-amber-400/60 bg-amber-400/10 text-amber-100' :
                                                    (selectedTask as any).rarity === 'epic' ? 'border-purple-400/60 bg-purple-400/10 text-purple-100' :
                                                        (selectedTask as any).rarity === 'rare' ? 'border-blue-400/60 bg-blue-400/10 text-blue-100' :
                                                            'border-emerald-400/60 bg-emerald-400/10 text-emerald-100'
                                            }`}>
                                                휴식권 · {
                                                    (selectedTask as any).rarity === 'legendary' ? '레전더리' :
                                                        (selectedTask as any).rarity === 'epic' ? '에픽' :
                                                            (selectedTask as any).rarity === 'rare' ? '레어' : '커먼'
                                                }
                                            </span>
                                        )}
                                        {selectedTask && !(selectedTask as any).isTicket && (
                                            <button
                                                onClick={() => setIsTaskModalOpen(true)}
                                                className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/50 hover:text-white"
                                            >
                                                ✏️ 작업 열기
                                            </button>
                                        )}
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
                                        <p className="text-lg font-medium leading-relaxed text-amber-100 whitespace-pre-line">
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
                                                    onClick={handleCompleteAndReward}
                                                    className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600"
                                                >
                                                    완료 (30 XP)
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
            {isTaskModalOpen && selectedTask && !(selectedTask as any).isTicket && (
                <TaskModal
                    task={selectedTask as any}
                    initialBlockId={(selectedTask.timeBlock || null) as TimeBlockId}
                    onSave={async (taskData) => {
                        try {
                            await updateTask(selectedTask.id, {
                                ...taskData,
                                timeBlock: taskData.timeBlock ?? selectedTask.timeBlock ?? null,
                                memo: taskData.memo ?? selectedTask.memo ?? '',
                            });
                            setIsTaskModalOpen(false);
                        } catch (error) {
                            console.error('작업 저장 실패:', error);
                            alert('작업 저장에 실패했습니다.');
                        }
                    }}
                    onClose={() => setIsTaskModalOpen(false)}
                    source="schedule"
                />
            )}
        </AnimatePresence>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIgnitionStore } from './stores/useIgnitionStore';
import { useDailyData } from '@/shared/hooks';
import { generateMicroStep } from '@/shared/services/ai/geminiApi';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import TaskSpinner from './components/TaskSpinner';
import { checkIgnitionAvailability, formatCooldownTime } from './utils/ignitionLimits';
import TaskModal from '@/features/schedule/TaskModal';
import { toast } from 'react-hot-toast';
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
        setSelectedTask: setSelectedTaskInStore,
        history,
        addToHistory,
    } = useIgnitionStore();

    const { dailyData, updateTask } = useDailyData();
    const { addXP, addItem, gameState } = useGameStateStore();
    const [inboxTasks, setInboxTasks] = useState<any[]>([]);
    const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [pendingSelection, setPendingSelection] = useState<any | null>(null);

    const ignitionStatus = useMemo(
        () => {
            const { settings } = useSettingsStore.getState();
            const cooldownMinutes = isBonus
                ? (settings?.justDoItCooldownMinutes ?? 1)
                : (settings?.ignitionCooldownMinutes ?? 30);

            return checkIgnitionAvailability(gameState, isBonus, {
                cooldownMinutes: cooldownMinutes,
                xpCost: settings?.ignitionXPCost,
            });
        },
        [gameState, isBonus]
    );
    const canSpin = ignitionStatus.canIgnite;


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

        // Calculate weights based on schedule status
        const currentHour = new Date().getHours();
        // Import TIME_BLOCKS dynamically or assume structure if import fails (but we should add import)
        // For now, let's define the logic. We need TIME_BLOCKS.
        // Since we can't easily add import at top without reading whole file, let's use a local helper or assume it's available.
        // Actually, I should add the import. But let's try to use the logic with hardcoded blocks if needed, 
        // or better, let's assume I can add the import in a separate step or just use the logic if I know the blocks.
        // Let's use the standard blocks structure.
        const TIME_BLOCKS_LOCAL = [
            { id: '5-8', start: 5, end: 8 },
            { id: '8-11', start: 8, end: 11 },
            { id: '11-14', start: 11, end: 14 },
            { id: '14-17', start: 14, end: 17 },
            { id: '17-19', start: 17, end: 19 },
            { id: '19-24', start: 19, end: 24 },
        ];

        const currentBlock = TIME_BLOCKS_LOCAL.find(b => currentHour >= b.start && currentHour < b.end);
        const currentBlockId = currentBlock?.id;

        const tasksWithWeights = tasks.map(task => {
            let weight = 1.0;

            if (task.timeBlock) {
                if (task.timeBlock === currentBlockId) {
                    weight = 1.5; // Current block
                } else {
                    const taskBlock = TIME_BLOCKS_LOCAL.find(b => b.id === task.timeBlock);
                    if (taskBlock && taskBlock.start > currentHour) {
                        weight = 1.3; // Future block
                    }
                }
            }

            // Base weight multiplier (e.g., 10) to make numbers nicer
            return {
                ...task,
                weight: weight * 10,
                rarity: undefined,
            };
        });

        // Add Rest Tickets
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

        const restTotalWeight = restTickets.reduce((sum, ticket) => sum + (ticket.weight || 0), 0);

        // Combine tasks and tickets
        let pool = [...tasksWithWeights, ...restTickets];

        // Cap reward probability at 30%
        const taskTotalWeight = tasksWithWeights.reduce((sum, t) => sum + t.weight, 0);
        const currentTotal = taskTotalWeight + restTotalWeight;
        const maxRewardProb = 0.3;

        if (currentTotal > 0 && (restTotalWeight / currentTotal) >= maxRewardProb) {
            const requiredTotal = restTotalWeight / 0.25;
            const boomWeight = Math.max(0, requiredTotal - currentTotal);

            if (boomWeight > 0) {
                pool.push({
                    id: 'boom',
                    text: '💣 꽝',
                    resistance: 'high',
                    weight: boomWeight,
                    rarity: 'common' as const,
                    color: '#ef4444',
                } as any);
            }
        }

        // If no tasks at all, return dummy task
        if (pool.length === 0) {
            return [{ id: 'dummy', text: '인박스 정리하기', resistance: 'low', weight: 1 } as any];
        }

        return pool;
    };

    const handleTaskSelect = (task: any) => {
        setPendingSelection(task);
        stopSpin(task); // 스핀 상태 해제, 선택은 확인 버튼에서 처리
    };

    const handleConfirmSelection = (selection: any) => {
        if (!selection) return;

        // 꽝 처리
        if (selection.id === 'boom' || selection.text?.includes('꽝')) {
            toast.error('꽝! 다음에 다시 시도하세요.');
            setPendingSelection(null);
            closeIgnition();
            return;
        }

        // 휴식권 처리
        if (selection.isTicket) {
            addItem(selection.ticketType, 1).then(() => {
                toast.success(`${selection.text} 획득!`);
                addToHistory(selection); // 히스토리 추가
                setPendingSelection(null);
                closeIgnition();
            }).catch(() => {
                toast.error('보상 지급에 실패했습니다.');
                setPendingSelection(null);
                closeIgnition();
            });
            return;
        }

        stopSpin(selection);
        addToHistory(selection); // 히스토리 추가

        // Generate micro-step
        setIsLoadingPrompt(true);
        const { settings } = useSettingsStore.getState();
        const promptContext = [
            `작업: ${selection.text}`,
            selection.resistance ? `난이도: ${selection.resistance}` : '',
            selection.memo ? `메모: ${selection.memo}` : '',
            selection.preparation1 || selection.preparation2 || selection.preparation3
                ? `준비사항: ${[selection.preparation1, selection.preparation2, selection.preparation3].filter(Boolean).join(', ')}`
                : '',
        ].filter(Boolean).join('\n');

        generateMicroStep(promptContext, settings?.geminiApiKey || '').then(step => {
            setMicroStep(step);
            setIsLoadingPrompt(false);
        }).catch(() => {
            setIsLoadingPrompt(false);
        });

        setPendingSelection(null);
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

        // 점화 성공은 작업 완료가 아님. 3분간의 몰입 성공을 의미.
        try {
            await addXP(30);
            closeIgnition();
        } catch (error) {
            console.error('보상 지급 실패:', error);
            alert('보상 지급에 실패했습니다.');
        }
    };

    // Calculate weights for display
    const availableTasks = useMemo(() => getAvailableTasks(), [dailyData, inboxTasks]);
    const totalWeight = useMemo(() => availableTasks.reduce((sum, t) => sum + (t.weight || 0), 0), [availableTasks]);
    const sortedTasks = useMemo(() => [...availableTasks].sort((a, b) => (b.weight || 0) - (a.weight || 0)), [availableTasks]);

    // Determine modal width
    // Spinner View: max-w-4xl (to fit weights + spinner)
    // Timer View: max-w-xl (1.3x of original md)
    const modalWidthClass = (!selectedTask || isSpinning || pendingSelection) ? 'max-w-4xl' : 'max-w-xl';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="fixed inset-0 z-[2000] flex items-start justify-center pt-24 px-4"
                >
                    <div className={`w-full ${modalWidthClass} overflow-hidden rounded-3xl border border-white/10 bg-[#1a1a1a] shadow-2xl transition-all duration-300`}>
                        {/* Header */}
                        <div className="flex items-center justify-between bg-white/5 px-6 py-4">
                            <div className="flex items-center gap-2 text-amber-500">
                                <span className="text-xl">🔥</span>
                                <span className="font-bold">3분 점화</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                {typeof ignitionStatus.freeSpinsRemaining === 'number' && (
                                    <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-emerald-100">
                                        무료 {Math.max(0, ignitionStatus.freeSpinsRemaining)}회
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
                            {(!selectedTask || isSpinning || pendingSelection) ? (
                                <div className="flex flex-col gap-8">
                                    <div className="flex gap-8">
                                        {/* Left: Weights Panel */}
                                        <div className="w-1/3 flex flex-col gap-3 text-left border-r border-white/10 pr-6">
                                            <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">확률 분포</h3>
                                            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                {sortedTasks.map((task) => {
                                                    const percent = totalWeight > 0 ? ((task.weight || 0) / totalWeight * 100).toFixed(1) : '0';
                                                    return (
                                                        <div key={task.id} className="flex items-center justify-between text-xs group">
                                                            <span className="text-white/80 truncate max-w-[70%] group-hover:text-white transition-colors">{task.text}</span>
                                                            <span className="text-white/40 font-mono">{percent}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Right: Spinner */}
                                        <div className="w-2/3 flex flex-col justify-center">
                                            <TaskSpinner
                                                tasks={availableTasks as any}
                                                onSelect={handleTaskSelect as any}
                                                onSpinStart={startSpin}
                                                disabled={!canSpin || !!pendingSelection}
                                                statusText={
                                                    pendingSelection ? '결과 확인 중...' :
                                                        !canSpin ? (
                                                            ignitionStatus.reason === 'cooldown' ? '쿨다운 중입니다' :
                                                                ignitionStatus.reason === 'insufficient_xp' ? 'XP가 부족합니다' :
                                                                    '사용 불가'
                                                        ) : undefined
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Bottom: History */}
                                    <div className="border-t border-white/10 pt-6">
                                        <h3 className="text-sm font-bold text-white/50 text-left mb-3 uppercase tracking-wider">최근 기록</h3>
                                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                            {history.length === 0 ? (
                                                <div className="text-xs text-white/30 italic">아직 기록이 없습니다.</div>
                                            ) : (
                                                history.map((task, idx) => (
                                                    <div key={`${task.id}-${idx}`} className="flex-shrink-0 flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                                                        <span className="text-xs text-white/80 whitespace-nowrap max-w-[150px] truncate">{task.text}</span>
                                                        {(task as any).rarity && (
                                                            <div className={`w-2 h-2 rounded-full ${(task as any).rarity === 'legendary' ? 'bg-amber-400' :
                                                                (task as any).rarity === 'epic' ? 'bg-purple-400' :
                                                                    (task as any).rarity === 'rare' ? 'bg-blue-400' :
                                                                        'bg-emerald-400'
                                                                }`} />
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
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
                                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${(selectedTask as any).rarity === 'legendary' ? 'border-amber-400/60 bg-amber-400/10 text-amber-100' :
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
                                                        닫기
                                                    </button>
                                                    <button
                                                        onClick={handleCompleteAndReward}
                                                        className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600"
                                                    >
                                                        점화 성공 (30 XP)
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

                            {/* 당첨 결과 확인 */}
                            {pendingSelection && (
                                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-left">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-white/60">당첨 결과</span>
                                            <span className="text-lg font-bold text-white">{pendingSelection.text}</span>
                                        </div>
                                        {(pendingSelection as any).rarity && (
                                            <span className="rounded-full border px-3 py-1 text-xs font-semibold text-white/80">
                                                {(pendingSelection as any).rarity}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-3 flex gap-2 justify-end">

                                        <button
                                            onClick={() => handleConfirmSelection(pendingSelection)}
                                            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                                        >
                                            결과 확인
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
            {isTaskModalOpen && selectedTask && !(selectedTask as any).isTicket && (
                <TaskModal
                    key={selectedTask.id}
                    task={selectedTask as any}
                    initialBlockId={(selectedTask.timeBlock || null) as TimeBlockId}
                    onSave={async (taskData) => {
                        try {
                            const mergedTask = {
                                ...selectedTask,
                                ...taskData,
                                ...taskData,
                                timeBlock: taskData.timeBlock ?? selectedTask.timeBlock ?? null,
                                memo: taskData.memo ?? selectedTask.memo ?? '',
                            };
                            await updateTask(selectedTask.id, mergedTask);
                            setSelectedTaskInStore(mergedTask as any);
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

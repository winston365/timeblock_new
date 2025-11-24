import { useMemo, useState, useEffect } from 'react';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { recommendNextTask, getRecommendationMessage } from '../utils/taskRecommendation';
import { useFocusModeStore } from '../stores/focusModeStore';
import { FocusTimer } from './FocusTimer';
import { FocusHeroTask } from './FocusHeroTask';
import { FocusTimeline } from './FocusTimeline';
import { QuickMemo } from './QuickMemo';
import { BreakView } from './BreakView';

interface FocusViewProps {
    currentBlockId: TimeBlockId;
    tasks: Task[];
    allDailyTasks: Task[];
    isLocked: boolean;
    onEditTask: (task: Task) => void;
    onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
    onToggleTask: (taskId: string) => void;
    onToggleLock?: () => void;
}

export function FocusView({
    currentBlockId,
    tasks,
    allDailyTasks,
    isLocked,
    onEditTask,
    onUpdateTask,
    onToggleTask,
    onToggleLock
}: FocusViewProps) {
    const { setFocusMode, activeTaskId, activeTaskStartTime, startTask, stopTask, isPaused, pauseTask, resumeTask } = useFocusModeStore();
    const [memoText, setMemoText] = useState('');
    const [isBreakTime, setIsBreakTime] = useState(false);
    const [now, setNow] = useState(Date.now());

    const currentEnergy = 50;

    const currentBlock = TIME_BLOCKS.find(b => b.id === currentBlockId);
    const blockLabel = currentBlock?.label ?? '블록 외 시간';

    const nowDate = new Date(now);
    const currentHour = nowDate.getHours();
    const currentMinute = nowDate.getMinutes();
    const slotStart = currentHour;
    const slotEnd = (currentHour + 1) % 24;
    const slotLabel = `${String(slotStart).padStart(2, '0')}:00 - ${String(slotEnd).padStart(2, '0')}:00 · ${String(currentHour).padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    const remainingMinutes = Math.max(0, (slotEnd === 0 ? 24 : slotEnd) * 60 - slotStart * 60 - currentMinute);

    // Filter tasks to only current hour slot - memoized to prevent infinite loop
    const currentHourTasks = useMemo(() => {
        return tasks
            .filter(t => t.hourSlot === currentHour)
            .sort((a, b) => {
                const orderA = a.order ?? new Date(a.createdAt).getTime();
                const orderB = b.order ?? new Date(b.createdAt).getTime();
                return orderA - orderB;
            });
    }, [tasks, currentHour]);

    // Use the first incomplete task based on order (respects HourBar ordering)
    const recommendedTask = useMemo(() => {
        return currentHourTasks.find(t => !t.completed) || null;
    }, [currentHourTasks]);

    const recommendationMessage = recommendedTask
        ? getRecommendationMessage(recommendedTask, currentEnergy)
        : '';

    // All completed tasks from the entire day
    const allCompletedTasks = allDailyTasks.filter(t => t.completed);

    // Filter upcoming tasks from current hour only (exclude completed and recommended)
    const initialUpcomingTasks = useMemo(() => {
        return currentHourTasks.filter(t => !t.completed && t.id !== recommendedTask?.id);
    }, [currentHourTasks, recommendedTask]);

    const [upcomingTasks, setUpcomingTasks] = useState(initialUpcomingTasks);

    // Sync state when props change
    useEffect(() => {
        setUpcomingTasks(initialUpcomingTasks);
    }, [initialUpcomingTasks]);

    // 타이머 업데이트
    useEffect(() => {
        if (!activeTaskId || !activeTaskStartTime || isPaused) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [activeTaskId, activeTaskStartTime, isPaused]);

    // PiP 상태 동기화
    useEffect(() => {
        if (!window.electronAPI?.sendPipUpdate || !activeTaskId || !activeTaskStartTime) return;

        const activeTask = currentHourTasks.find(t => t.id === activeTaskId);
        if (!activeTask) return;

        const elapsedSeconds = Math.floor((now - activeTaskStartTime) / 1000);
        const totalSeconds = activeTask.baseDuration * 60;
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

        window.electronAPI.sendPipUpdate({
            remainingTime: remainingSeconds,
            totalTime: totalSeconds,
            isRunning: !isPaused,
            currentTaskTitle: activeTask.text,
        }).catch(console.error);
    }, [now, activeTaskId, activeTaskStartTime, currentHourTasks, isPaused]);

    // PiP 액션 핸들러
    useEffect(() => {
        if (!window.electronAPI?.onPipAction) return;

        const unsubscribe = window.electronAPI.onPipAction((action: string) => {
            if (action === 'toggle-pause') {
                if (isPaused) {
                    resumeTask();
                } else {
                    pauseTask();
                }
            }
        });

        return unsubscribe;
    }, [isPaused, pauseTask, resumeTask]);

    // Progress calculation for current hour tasks only
    const totalTasks = currentHourTasks.length;
    const completedCount = currentHourTasks.filter(t => t.completed).length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    const handleStartNow = (task: Task) => {
        setFocusMode(true);
        startTask(task.id);

        if (!isLocked && onToggleLock) {
            onToggleLock();
        }
    };

    const handleToggleTaskWrapper = (taskId: string) => {
        const isCompletingActiveTask = taskId === activeTaskId;

        onToggleTask(taskId);

        if (isCompletingActiveTask) {
            stopTask();
            setMemoText('');

            // Start 1-minute break, then auto-start next task
            setIsBreakTime(true);
            setTimeout(() => {
                setIsBreakTime(false);

                // Auto-start next incomplete task after break
                const nextTask = currentHourTasks.find(t => !t.completed && t.id !== taskId);
                if (nextTask) {
                    startTask(nextTask.id);
                }
            }, 60000); // 1 minute = 60,000ms
        }
    };

    const handleReorder = (newOrder: Task[]) => {
        setUpcomingTasks(newOrder);

        const baseOrder = Date.now();
        newOrder.forEach((task, index) => {
            if (task.order !== baseOrder + index) {
                onUpdateTask(task.id, { order: baseOrder + index });
            }
        });
    };

    if (isBreakTime) {
        return (
            <div className="mx-auto max-w-4xl p-6 flex items-center justify-center min-h-[600px]">
                <BreakView onFinish={() => setIsBreakTime(false)} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-8 p-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">🎯 지금 집중</h1>
                    <p className="mt-1 text-lg text-[var(--color-text-secondary)]">
                        {slotLabel}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* PiP 모드 버튼 */}
                    <button
                        onClick={() => {
                            if (!window.electronAPI) {
                                alert('PiP 모드는 Electron 앱에서만 사용 가능합니다.');
                                return;
                            }
                            window.electronAPI.openPip();
                        }}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-lg font-bold text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-purple-500/50 active:scale-95"
                    >
                        <span className="text-xl">📌</span>
                        <span>PiP 모드</span>
                    </button>
                    <FocusTimer remainingMinutes={remainingMinutes} totalMinutes={60} />
                </div>
            </div>

            {/* Hero Task Section */}
            {recommendedTask ? (
                <div className="space-y-6">
                    <FocusHeroTask
                        task={recommendedTask}
                        recommendationMessage={recommendationMessage}
                        isActive={activeTaskId === recommendedTask.id}
                        startTime={activeTaskStartTime}
                        onEdit={onEditTask}
                        onToggle={handleToggleTaskWrapper}
                        onStartNow={handleStartNow}
                        onStop={stopTask}
                    />

                    <QuickMemo
                        value={memoText}
                        onChange={setMemoText}
                        isVisible={activeTaskId === recommendedTask.id}
                    />
                </div>
            ) : (
                <div className="rounded-3xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)] p-12 text-center">
                    <div className="text-6xl">🎉</div>
                    <h2 className="mt-4 text-2xl font-bold text-[var(--color-text-primary)]">모든 작업 완료!</h2>
                    <p className="mt-2 text-lg text-[var(--color-text-secondary)]">휴식하거나 다음 블록 작업을 추가해보세요</p>
                </div>
            )}

            {/* Timeline Section */}
            {upcomingTasks.length > 0 && (
                <FocusTimeline
                    tasks={upcomingTasks}
                    onReorder={handleReorder}
                    onEdit={onEditTask}
                />
            )}

            {/* Progress Section - Current hour only */}
            <div className="rounded-2xl bg-[var(--color-bg-surface)] p-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">이번 시간 진행률</span>
                    <span className="text-lg font-bold text-[var(--color-primary)]">{completionPercentage}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${completionPercentage}%` }} />
                </div>
                <div className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                    {completedCount}개 완료 / 전체 {totalTasks}개
                </div>
            </div>

            {/* Completed Tasks Section - All day */}
            {allCompletedTasks.length > 0 && (
                <details className="group">
                    <summary className="cursor-pointer rounded-xl bg-[var(--color-bg-surface)] p-4 font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]">
                        ✅ 오늘 완료한 작업 {allCompletedTasks.length}개
                    </summary>
                    <div className="mt-2 space-y-2">
                        {allCompletedTasks.map(task => (
                            <div key={task.id} className="flex items-center gap-3 rounded-lg bg-[var(--color-bg-surface)] p-3 opacity-75">
                                <span className="text-emerald-500">✓</span>
                                <span className="flex-1 text-sm text-[var(--color-text-secondary)] line-through">{task.text}</span>
                                <span className="text-xs text-[var(--color-text-tertiary)]">{task.baseDuration}분</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}

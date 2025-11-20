import { useMemo } from 'react';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { recommendNextTask, getRecommendationMessage } from '../utils/taskRecommendation';
import { NextTaskCard } from './NextTaskCard';
import { useFocusModeStore } from '../stores/focusModeStore';

interface FocusViewProps {
    currentBlockId: TimeBlockId;
    tasks: Task[];
    onEditTask: (task: Task) => void;
    onToggleTask: (taskId: string) => void;
    onToggleLock?: () => void;
}

export function FocusView({
    currentBlockId,
    tasks,
    onEditTask,
    onToggleTask,
    onToggleLock
}: FocusViewProps) {
    const { toggleFocusMode: startFocusMode } = useFocusModeStore();
    const currentEnergy = 50;

    const currentBlock = TIME_BLOCKS.find(b => b.id === currentBlockId);
    const blockLabel = currentBlock?.label ?? '블록 외 시간';

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const blockEnd = currentBlock?.end ?? 24;
    const remainingMinutes = (blockEnd - currentHour) * 60 - currentMinute;

    const recommendedTask = useMemo(() => {
        return recommendNextTask(tasks, {
            currentTime: now,
            remainingMinutes,
            currentEnergy
        });
    }, [tasks, remainingMinutes, currentEnergy]);

    const recommendationMessage = recommendedTask
        ? getRecommendationMessage(recommendedTask, currentEnergy)
        : '';

    const completedTasks = tasks.filter(t => t.completed);
    const upcomingTasks = tasks.filter(t => !t.completed && t.id !== recommendedTask?.id).slice(0, 3);

    const totalTasks = tasks.length;
    const completedCount = completedTasks.length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    const handleStartNow = (_task: Task) => {
        startFocusMode();
        if (onToggleLock) {
            onToggleLock();
        }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">🎯 지금 집중</h1>
                    <p className="mt-1 text-lg text-[var(--color-text-secondary)]">
                        {blockLabel} · {currentHour}:{currentMinute.toString().padStart(2, '0')}
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-medium text-[var(--color-text-tertiary)]">남은 시간</div>
                    <div className="text-2xl font-bold text-[var(--color-primary)]">
                        {Math.floor(remainingMinutes / 60)}시간 {remainingMinutes % 60}분
                    </div>
                </div>
            </div>

            {recommendedTask ? (
                <NextTaskCard
                    task={recommendedTask}
                    recommendationMessage={recommendationMessage}
                    onEdit={onEditTask}
                    onToggle={onToggleTask}
                    onStartNow={handleStartNow}
                />
            ) : (
                <div className="rounded-3xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)] p-12 text-center">
                    <div className="text-6xl">🎉</div>
                    <h2 className="mt-4 text-2xl font-bold text-[var(--color-text-primary)]">모든 작업 완료!</h2>
                    <p className="mt-2 text-lg text-[var(--color-text-secondary)]">휴식하거나 다음 블록 작업을 추가해보세요</p>
                </div>
            )}

            {upcomingTasks.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        📋 예정 작업 {upcomingTasks.length}개
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {upcomingTasks.map(task => (
                            <button
                                key={task.id}
                                onClick={() => onEditTask(task)}
                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 text-left transition-all hover:border-[var(--color-primary)] hover:shadow-md"
                            >
                                <div className="font-medium text-[var(--color-text-primary)]">{task.text}</div>
                                <div className="mt-1 text-sm text-[var(--color-text-tertiary)]">
                                    {task.baseDuration}분 · {task.resistance === 'low' ? '쉬움' : task.resistance === 'medium' ? '보통' : '어려움'}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-2xl bg-[var(--color-bg-surface)] p-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">진행률</span>
                    <span className="text-lg font-bold text-[var(--color-primary)]">{completionPercentage}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${completionPercentage}%` }} />
                </div>
                <div className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                    {completedCount}개 완료 / 전체 {totalTasks}개
                </div>
            </div>

            {completedTasks.length > 0 && (
                <details className="group">
                    <summary className="cursor-pointer rounded-xl bg-[var(--color-bg-surface)] p-4 font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]">
                        ✅ 완료한 작업 {completedTasks.length}개
                    </summary>
                    <div className="mt-2 space-y-2">
                        {completedTasks.slice(0, 5).map(task => (
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

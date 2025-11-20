import React, { useMemo, useState } from 'react';
import type { Task, TimeBlockState, TimeBlockId } from '@/shared/types/domain';
import HourBar from '../HourBar';

interface TimeBlockContentProps {
    isExpanded: boolean;
    block: {
        id: string;
        start: number;
        end: number;
    };
    tasks: Task[];
    isPastBlock: boolean;
    state: TimeBlockState;
    onToggleExpand: () => void;
    onCreateTask?: (text: string, blockId: TimeBlockId, hourSlot?: number) => Promise<void>;
    onEditTask: (task: Task) => void;
    onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
    onDeleteTask: (taskId: string) => void;
    onToggleTask: (taskId: string) => void;
}

export const TimeBlockContent: React.FC<TimeBlockContentProps> = ({
    isExpanded,
    block,
    tasks,
    isPastBlock,
    state,
    onToggleExpand,
    onCreateTask,
    onEditTask,
    onUpdateTask,
    onDeleteTask,
    onToggleTask,
}) => {
    const [taskFilter, setTaskFilter] = useState<'all' | 'completed' | 'pending' | 'highResistance'>('all');

    const filteredTasks = useMemo(() => {
        switch (taskFilter) {
            case 'completed':
                return tasks.filter(task => task.completed);
            case 'pending':
                return tasks.filter(task => !task.completed);
            case 'highResistance':
                return tasks.filter(task => task.resistance === 'high');
            default:
                return tasks;
        }
    }, [taskFilter, tasks]);

    if (!isExpanded) return null;

    const handleBlockContentClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onToggleExpand();
        }
    };

    const handleFilterChange = (key: 'completed' | 'pending' | 'highResistance') => {
        setTaskFilter(prev => (prev === key ? 'all' : key));
    };

    const filterButtons: Array<{ key: 'completed' | 'pending' | 'highResistance'; label: string }> = [
        { key: 'completed', label: '완료' },
        { key: 'pending', label: '미완료' },
        { key: 'highResistance', label: '높은저항' },
    ];

    return (
        <div className="flex flex-col gap-0 bg-[var(--color-bg-base)]/50" onClick={handleBlockContentClick}>
            {!isPastBlock && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3 text-[11px] text-[var(--color-text-tertiary)]">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {filterButtons.map(({ key, label }) => {
                            const isActive = taskFilter === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleFilterChange(key)}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                        isActive
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                            : 'border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-light)] hover:text-[var(--color-text-secondary)]'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <span className="text-[10px]">
                        표시 중: {filteredTasks.length} / {tasks.length || 0}개
                    </span>
                </div>
            )}

            {filteredTasks.length === 0 && tasks.length === 0 && !isPastBlock && (
                <div className="flex flex-col items-center justify-center border-b border-[var(--color-border)] border-dashed py-8 text-[var(--color-text-tertiary)]">
                    <span className="mb-2 text-2xl">🪄</span>
                    <p className="text-sm">작업을 드래그하여 옮기거나 추가해보세요</p>
                </div>
            )}

            {tasks.length > 0 && filteredTasks.length === 0 && !isPastBlock && (
                <div className="border-b border-[var(--color-border)] px-4 py-3 text-[11px] text-[var(--color-text-tertiary)]">
                    필터 조건에 맞는 작업이 없어요. 토글을 해제하거나 다른 필터를 선택해보세요.
                </div>
            )}

            {Array.from({ length: block.end - block.start }, (_, i) => block.start + i).map(hour => {
                const hourTasks = filteredTasks.filter(task => task.hourSlot === hour);

                return (
                    <HourBar
                        key={hour}
                        hour={hour}
                        blockId={block.id as TimeBlockId}
                        tasks={hourTasks}
                        isLocked={state?.isLocked || false}
                        onCreateTask={async (text, targetHour) => {
                            if (onCreateTask) {
                                await onCreateTask(text, block.id as TimeBlockId, targetHour);
                            }
                        }}
                        onEditTask={onEditTask}
                        onUpdateTask={(taskId, updates) => {
                            if (onUpdateTask) {
                                onUpdateTask(taskId, updates);
                            }
                        }}
                        onDeleteTask={onDeleteTask}
                        onToggleTask={onToggleTask}
                        onDropTask={(taskId, targetHour) => {
                            if (onUpdateTask) {
                                onUpdateTask(taskId, { hourSlot: targetHour, timeBlock: block.id as TimeBlockId });
                            }
                        }}
                    />
                );
            })}
        </div>
    );
};

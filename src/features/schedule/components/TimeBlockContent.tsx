import React from 'react';
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
    if (!isExpanded) return null;

    const handleBlockContentClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onToggleExpand();
        }
    };

    return (
        <div className="flex flex-col gap-0 bg-[var(--color-bg-base)]/50" onClick={handleBlockContentClick}>
            {tasks.length === 0 && !isPastBlock && (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-tertiary)] border-b border-[var(--color-border)] border-dashed">
                    <span className="text-2xl mb-2">📥</span>
                    <p className="text-sm">작업을 이곳으로 드래그하거나 추가하세요</p>
                </div>
            )}

            {Array.from({ length: block.end - block.start }, (_, i) => block.start + i).map(hour => {
                const hourTasks = tasks.filter(task => task.hourSlot === hour);

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

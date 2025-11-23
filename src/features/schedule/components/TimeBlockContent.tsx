import React from 'react';
import type { Task, TimeBlockState, TimeBlockId, TimeSlotTagTemplate } from '@/shared/types/domain';
import HourBar from '../HourBar';
import { DontDoChecklist } from './DontDoChecklist';

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
    hourSlotTags?: Record<number, string | null>;
    tagTemplates?: TimeSlotTagTemplate[];
    recentTagIds?: string[];
    onSelectHourTag?: (hour: number, tagId: string | null) => void;
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
    hourSlotTags = {},
    tagTemplates = [],
    recentTagIds = [],
    onSelectHourTag,
}) => {

    if (!isExpanded) return null;

    const handleBlockContentClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onToggleExpand();
        }
    };

    return (
        <div className="flex flex-col gap-0 bg-[var(--color-bg-base)]/50 rounded-b-2xl" onClick={handleBlockContentClick}>
            <DontDoChecklist timeBlockId={block.id} />

            {Array.from({ length: block.end - block.start }, (_, i) => block.start + i).map(hour => {
                const hourTasks = tasks.filter(task => task.hourSlot === hour);

                return (
                    <HourBar
                        key={hour}
                        hour={hour}
                        blockId={block.id as TimeBlockId}
                        tasks={hourTasks}
                        isLocked={state?.isLocked || false}
                        tagId={hourSlotTags?.[hour] || null}
                        tagTemplates={tagTemplates}
                        recentTagIds={recentTagIds}
                        onSelectTag={(tagId) => onSelectHourTag?.(hour, tagId)}
                        onCreateTask={async (text, targetHour) => {
                            if (onCreateTask) {
                                await onCreateTask(text, block.id as TimeBlockId, targetHour);
                            }
                        }}
                        onEditTask={onEditTask}
                        onUpdateTask={onUpdateTask || (() => { })}
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

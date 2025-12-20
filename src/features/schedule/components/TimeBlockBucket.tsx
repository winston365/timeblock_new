import { useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import { useToastStore } from '@/shared/stores/toastStore';
import TaskCard from '../TaskCard';
import { useDragDropManager } from '../hooks/useDragDropManager';
import { clampHourSlotToBlock, formatBucketRangeLabel, MAX_TASKS_PER_BLOCK } from '../utils/timeBlockBucket';

interface TimeBlockBucketProps {
  bucketStartHour: number;
  effectiveHourSlot: number;
  blockId: TimeBlockId;
  tasks: Task[];
  isLocked: boolean;
  onCreateTask: (text: string, hourSlot: number) => Promise<void>;
  onEditTask: (task: Task) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
}

export function TimeBlockBucket({
  bucketStartHour,
  effectiveHourSlot,
  blockId,
  tasks,
  isLocked,
  onCreateTask,
  onEditTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
}: TimeBlockBucketProps) {
  const [inlineInputValue, setInlineInputValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const addToast = useToastStore((state) => state.addToast);
  const { getDragData, isSameLocation } = useDragDropManager();

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const orderA = a.order ?? new Date(a.createdAt).getTime();
      const orderB = b.order ?? new Date(b.createdAt).getTime();
      return orderA - orderB;
    });
  }, [tasks]);

  const computeOrderBetween = (prev?: number, next?: number) => {
    if (prev === undefined && next === undefined) return Date.now();
    if (prev === undefined) return (next ?? 0) - 1;
    if (next === undefined) return prev + 1;
    if (prev === next) return prev + 0.001;
    return prev + (next - prev) / 2;
  };

  const canAcceptMoreFromOtherLocation = tasks.length < MAX_TASKS_PER_BLOCK;

  const handleInlineInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inlineInputValue.trim()) {
      e.preventDefault();
      const trimmedText = inlineInputValue.trim();

      if (!trimmedText) {
        toast.error('작업 제목을 입력해주세요.');
        return;
      }

      if (tasks.length >= MAX_TASKS_PER_BLOCK) {
        addToast(`이 시간대에는 최대 ${MAX_TASKS_PER_BLOCK}개의 작업만 추가할 수 있습니다.`, 'warning', 3000);
        return;
      }

      try {
        await onCreateTask(trimmedText, effectiveHourSlot);
        setInlineInputValue('');
        inlineInputRef.current?.focus();
      } catch (err) {
        console.error('Failed to create task:', err);
      }
    } else if (e.key === 'Escape') {
      setInlineInputValue('');
    }
  };

  const handleDropToEnd = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdateTask) return;
    const dragData = getDragData(e);
    if (!dragData) return;

    const isDifferentLocation = !isSameLocation(dragData, blockId, bucketStartHour);
    if (isDifferentLocation && !canAcceptMoreFromOtherLocation) {
      addToast(`이 시간대에는 최대 ${MAX_TASKS_PER_BLOCK}개의 작업만 추가할 수 있습니다.`, 'warning', 3000);
      return;
    }

    const last = sortedTasks[sortedTasks.length - 1];
    const lastOrder = last ? last.order ?? sortedTasks.length : undefined;

    const nextHourSlot =
      clampHourSlotToBlock(dragData.sourceHourSlot ?? undefined, blockId) ??
      clampHourSlotToBlock(effectiveHourSlot, blockId) ??
      effectiveHourSlot;

    onUpdateTask(dragData.taskId, {
      timeBlock: blockId,
      hourSlot: nextHourSlot,
      order: (lastOrder ?? 0) + 1,
    });
  };

  const handleDropBefore = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdateTask) return;
    const dragData = getDragData(e);
    if (!dragData) return;

    const targetTask = sortedTasks[targetIndex];
    if (!targetTask) return;

    if (dragData.taskId === targetTask.id && isSameLocation(dragData, blockId, bucketStartHour)) return;

    const isDifferentLocation = !isSameLocation(dragData, blockId, bucketStartHour);
    if (isDifferentLocation && !canAcceptMoreFromOtherLocation) {
      addToast(`이 시간대에는 최대 ${MAX_TASKS_PER_BLOCK}개의 작업만 추가할 수 있습니다.`, 'warning', 3000);
      return;
    }

    const prevTask = sortedTasks[targetIndex - 1];
    const prevOrder = prevTask?.order ?? targetIndex - 1;
    const nextOrder = targetTask.order ?? targetIndex;
    const newOrder = computeOrderBetween(prevOrder, nextOrder);

    const nextHourSlot =
      clampHourSlotToBlock(dragData.sourceHourSlot ?? undefined, blockId) ??
      clampHourSlotToBlock(effectiveHourSlot, blockId) ??
      effectiveHourSlot;

    onUpdateTask(dragData.taskId, {
      timeBlock: blockId,
      hourSlot: nextHourSlot,
      order: newOrder,
    });
  };

  return (
    <div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 transition hover:border-[var(--color-primary)]"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={handleDropToEnd}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--color-text)]">{formatBucketRangeLabel(bucketStartHour)}</div>
        <div className="text-xs text-[var(--color-text-tertiary)]">
          {tasks.length}/{MAX_TASKS_PER_BLOCK}
        </div>
      </div>

      <div className="space-y-2">
        {sortedTasks.map((task, index) => (
          <div
            key={task.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => handleDropBefore(e, index)}
          >
            <TaskCard
              task={task}
              onEdit={() => onEditTask(task)}
              onUpdateTask={(updates) => onUpdateTask?.(task.id, updates)}
              onDelete={() => onDeleteTask(task.id)}
              onToggle={() => onToggleTask(task.id)}
              hideMetadata={false}
              blockIsLocked={isLocked}
            />
          </div>
        ))}

        {!isLocked && (
          <div className="pt-1">
            <input
              ref={inlineInputRef}
              type="text"
              value={inlineInputValue}
              onChange={(e) => setInlineInputValue(e.target.value)}
              onKeyDown={handleInlineInputKeyDown}
              placeholder="작업을 입력하고 Enter로 추가하세요"
              className="w-full rounded-xl border border-dashed border-[var(--color-border)] bg-transparent px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              disabled={tasks.length >= MAX_TASKS_PER_BLOCK}
            />
            {tasks.length >= MAX_TASKS_PER_BLOCK && (
              <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                ⚠️ 이 시간대에는 최대 {MAX_TASKS_PER_BLOCK}개까지만 추가할 수 있습니다
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

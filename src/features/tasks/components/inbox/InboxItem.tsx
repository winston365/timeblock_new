import type { ReactElement } from 'react';

import TaskCard from '@/features/schedule/TaskCard';
import type { SlotFindMode } from '@/shared/services/schedule/slotFinder';
import type { Task } from '@/shared/types/domain';

export interface InboxItemProps {
  readonly task: Task;
  readonly isFocused: boolean;
  readonly todayISO: string;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onToggle: () => void;
  readonly onUpdateTask: (updates: Partial<Task>) => Promise<void> | void;
  readonly onDragEnd: () => void;

  readonly onQuickPlace: (mode: SlotFindMode) => void;
  readonly onTogglePin: () => void;
  readonly onToggleDefer: () => void;
}

export const InboxItem = ({
  task,
  isFocused,
  todayISO,
  onEdit,
  onDelete,
  onToggle,
  onUpdateTask,
  onDragEnd,
  onQuickPlace,
  onTogglePin,
  onToggleDefer,
}: InboxItemProps): ReactElement => {
  const isDeferred = (task.deferredUntil ?? null) !== null && (task.deferredUntil ?? '') > todayISO;

  return (
    <div
      className={`space-y-1 rounded-lg transition-all ${
        isFocused
          ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-[var(--color-bg-base)] bg-emerald-500/5'
          : ''
      }`}
    >
      <TaskCard
        task={task}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggle={onToggle}
        onUpdateTask={onUpdateTask}
        onDragEnd={onDragEnd}
        compact
      />

      <div className="flex flex-wrap items-center gap-1 px-1">
        <span className="text-[10px] text-[var(--color-text-tertiary)] mr-1">⚡</span>

        <button
          type="button"
          onClick={() => onQuickPlace('today')}
          className="rounded px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)] bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-600 transition-colors min-h-[24px]"
          title="오늘 배치 (T)"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onQuickPlace('tomorrow')}
          className="rounded px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)] bg-purple-500/10 hover:bg-purple-500/20 hover:text-purple-600 transition-colors min-h-[24px]"
          title="내일 배치 (O)"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => onQuickPlace('next')}
          className="rounded px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)] bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-600 transition-colors min-h-[24px]"
          title="다음 슬롯 배치 (N)"
        >
          Next
        </button>

        <span className="mx-1 text-[var(--color-border)]">│</span>

        <button
          type="button"
          onClick={onTogglePin}
          className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors min-h-[24px] ${
            task.isPinned
              ? 'bg-amber-500/20 text-amber-600'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-amber-500/10 hover:text-amber-600'
          }`}
          title={task.isPinned ? '고정 해제 (P)' : '고정 (P)'}
        >
          {task.isPinned ? '📌 고정' : '고정'}
        </button>

        <button
          type="button"
          onClick={onToggleDefer}
          className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors min-h-[24px] ${
            isDeferred
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-quaternary)]'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
          }`}
          title={isDeferred ? '보류 해제 (H)' : '내일까지 보류 (H)'}
        >
          {isDeferred ? '⏸️ 보류' : '보류'}
        </button>
      </div>
    </div>
  );
};

import type { ReactElement } from 'react';

export interface InboxHeaderProps {
  readonly taskCount: number;
  readonly onAddTask: () => void;
}

export const InboxHeader = ({ taskCount, onAddTask }: InboxHeaderProps): ReactElement => {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-[var(--color-text)]">📥 인박스</h3>
        <span className="rounded-full bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
          {taskCount}
        </span>
      </div>

      <button
        type="button"
        className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-md active:scale-95"
        onClick={onAddTask}
      >
        <span>+</span>
        <span>추가</span>
      </button>
    </div>
  );
};

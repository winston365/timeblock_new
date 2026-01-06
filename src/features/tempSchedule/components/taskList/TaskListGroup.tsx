import type { ReactNode } from 'react';

export type TaskListGroupVariant = 'today' | 'past' | 'default' | 'recurring';

export interface TaskListGroupProps {
  readonly label: string;
  readonly emoji: string;
  readonly count: number;
  readonly variant: TaskListGroupVariant;
  readonly children: ReactNode;
}

export const TaskListGroup = ({ label, emoji, count, variant, children }: TaskListGroupProps) => {
  const borderClass =
    variant === 'today'
      ? 'border-[var(--color-primary)]/30'
      : variant === 'past'
        ? 'border-[var(--color-border)]/30'
        : 'border-[var(--color-border)]/50';

  const labelClass =
    variant === 'today'
      ? 'text-[var(--color-primary)]'
      : variant === 'past'
        ? 'text-[var(--color-text-tertiary)]'
        : 'text-[var(--color-text-secondary)]';

  const countClass =
    variant === 'today'
      ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]';

  return (
    <div>
      <div className={`flex items-center gap-2 mb-2 pb-1 border-b ${borderClass}`}>
        <span className="text-sm">{emoji}</span>
        <span className={`text-xs font-bold tracking-wide ${labelClass}`}>{label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${countClass}`}>{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
};

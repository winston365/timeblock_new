import type { ReactNode } from 'react';

export type StatusBannerVariant = 'info' | 'loading' | 'success' | 'warning' | 'error';

interface StatusBannerProps {
  variant: StatusBannerVariant;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  rightSlot?: ReactNode;
}

function getVariantStyles(variant: StatusBannerVariant): {
  root: string;
  title: string;
  message: string;
  icon: string;
} {
  switch (variant) {
    case 'error':
      return {
        root: 'border-l-4 border-[var(--color-danger)]',
        title: 'text-[var(--color-danger)]',
        message: 'text-[var(--color-text-secondary)]',
        icon: '⚠️',
      };
    case 'warning':
      return {
        root: 'border-l-4 border-[var(--color-primary)]',
        title: 'text-[var(--color-text)]',
        message: 'text-[var(--color-text-secondary)]',
        icon: '⚠️',
      };
    case 'success':
      return {
        root: 'border-l-4 border-[var(--color-primary)]',
        title: 'text-[var(--color-text)]',
        message: 'text-[var(--color-text-secondary)]',
        icon: '✅',
      };
    case 'loading':
      return {
        root: 'border-l-4 border-[var(--color-primary)]',
        title: 'text-[var(--color-text)]',
        message: 'text-[var(--color-text-secondary)]',
        icon: '⏳',
      };
    case 'info':
    default:
      return {
        root: 'border-l-4 border-[var(--color-primary)]',
        title: 'text-[var(--color-text)]',
        message: 'text-[var(--color-text-secondary)]',
        icon: 'ℹ️',
      };
  }
}

export default function StatusBanner({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  className,
  rightSlot,
}: StatusBannerProps) {
  const styles = getVariantStyles(variant);
  const hasAction = Boolean(actionLabel && onAction);

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 ${styles.root} ${className ?? ''}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 text-base" aria-hidden="true">
          {styles.icon}
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${styles.title}`}>{title}</div>
          {message ? (
            <div className={`mt-1 text-xs leading-relaxed ${styles.message}`}>{message}</div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {rightSlot}
        {hasAction ? (
          <button
            type="button"
            onClick={onAction}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-1 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-bg-elevated)]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

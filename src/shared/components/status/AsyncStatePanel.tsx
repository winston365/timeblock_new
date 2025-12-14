import type { ReactNode } from 'react';
import StatusBanner from './StatusBanner';

interface AsyncStatePanelProps {
  loading?: boolean;
  loadingTitle?: string;
  error?: string | null;
  errorTitle?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  children?: ReactNode;
}

export default function AsyncStatePanel({
  loading,
  loadingTitle = '불러오는 중...',
  error,
  errorTitle = '오류가 발생했습니다',
  onRetry,
  retryLabel = '재시도',
  className,
  children,
}: AsyncStatePanelProps) {
  if (loading) {
    return <StatusBanner variant="loading" title={loadingTitle} className={className} />;
  }

  if (error) {
    return (
      <StatusBanner
        variant="error"
        title={errorTitle}
        message={error}
        actionLabel={onRetry ? retryLabel : undefined}
        onAction={onRetry}
        className={className}
      />
    );
  }

  return <>{children}</>;
}

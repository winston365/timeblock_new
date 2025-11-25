/**
 * LoadingScreen Component
 *
 * @role 앱 초기화 중 로딩 화면
 * @input error (optional)
 * @output 로딩 UI
 */

import { memo } from 'react';

interface LoadingScreenProps {
  error?: Error | null;
}

/**
 * 로딩 화면 컴포넌트
 */
function LoadingScreenComponent({ error }: LoadingScreenProps) {
  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-2 bg-[var(--color-bg-base)] text-[var(--color-text)]"
      role="status"
      aria-live="polite"
      aria-label="환경 설정 로딩 중"
    >
      <div className="text-lg font-semibold">데이터베이스 초기화 중...</div>
      {error && (
        <div className="text-sm text-red-500">오류 발생: {error.message}</div>
      )}
      <div className="text-xs text-[var(--color-text-tertiary)]">
        개발자 도구(F12)를 열어 로그를 확인해주세요
      </div>
    </div>
  );
}

export const LoadingScreen = memo(LoadingScreenComponent);

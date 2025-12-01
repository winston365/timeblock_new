/**
 * @file SyncErrorToast.tsx
 * 
 * @description
 * Role: Firebase 동기화 실패 시 표시되는 에러 토스트 컴포넌트
 * 
 * Responsibilities:
 * - 동기화 실패 메시지를 시각적으로 표시
 * - 5초 후 자동으로 사라지는 애니메이션 처리
 * - 재시도 및 닫기 버튼 제공
 * 
 * Key Dependencies:
 * - React useState/useEffect: 가시성 및 타이머 관리
 */

import { useEffect, useState } from 'react';

/** SyncErrorToast 컴포넌트의 props 인터페이스 */
interface SyncErrorToastProps {
  /** 표시할 에러 메시지 */
  message: string;
  /** 토스트 닫기 콜백 */
  onClose: () => void;
  /** 재시도 콜백 (선택) */
  onRetry?: () => void;
}

/**
 * Firebase 동기화 실패 시 표시되는 에러 토스트
 * 
 * 5초 후 자동으로 슬라이드 아웃되며, 재시도 및 닫기 버튼을 제공한다.
 * 
 * @param props - SyncErrorToast 컴포넌트 props
 * @param props.message - 표시할 에러 메시지
 * @param props.onClose - 토스트 닫기 콜백
 * @param props.onRetry - 재시도 콜백 (선택)
 * @returns 동기화 에러 토스트 React 엘리먼트
 */
export default function SyncErrorToast({ message, onClose, onRetry }: SyncErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const dismiss = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    dismiss();
  };

  return (
    <div
      className={[
        'fixed top-20 right-5 z-[10000] min-w-[320px] max-w-[480px] rounded-2xl border-2',
        'border-[#fca5a5] bg-[linear-gradient(135deg,#dc2626_0%,#991b1b_100%)]',
        'px-5 py-4 text-white shadow-xl transition-all duration-300',
        isVisible ? 'opacity-100 translate-x-0' : 'pointer-events-none opacity-0 translate-x-20',
      ].join(' ')}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-4">
        <div className="text-3xl drop-shadow">⚠️</div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="text-base font-bold tracking-wide">동기화 실패</div>
          <div className="text-sm text-white/90">{message}</div>
        </div>
        <div className="flex gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={handleRetry}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/40 bg-white/10 text-white transition hover:scale-105 hover:bg-white/20"
              title="다시 시도"
            >
              ↺
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/40 bg-white/10 text-white transition hover:bg-white/20"
            title="닫기"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

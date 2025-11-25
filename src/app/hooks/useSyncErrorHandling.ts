/**
 * useSyncErrorHandling Hook
 *
 * @role Firebase 동기화 에러 처리 로직 분리
 * @input 없음
 * @output 에러 토스트 상태 및 핸들러
 */

import { useState, useEffect, useCallback } from 'react';
import { setErrorCallback, retryNow } from '@/shared/services/sync/firebase/syncRetryQueue';

export interface SyncErrorToastData {
  id: string;
  collection: string;
  message: string;
  canRetry: boolean;
  retryId?: string;
}

interface SyncErrorHandlingState {
  syncErrorToasts: SyncErrorToastData[];
  removeSyncErrorToast: (id: string) => void;
  handleSyncRetry: (retryId: string | undefined) => Promise<void>;
}

/**
 * 동기화 에러 처리 훅
 */
export function useSyncErrorHandling(): SyncErrorHandlingState {
  const [syncErrorToasts, setSyncErrorToasts] = useState<SyncErrorToastData[]>([]);

  // 동기화 에러 콜백 설정
  useEffect(() => {
    setErrorCallback((collection, message, canRetry) => {
      const toastId = `sync-error-${Date.now()}-${Math.random()}`;
      setSyncErrorToasts(prev => [
        ...prev,
        {
          id: toastId,
          collection,
          message,
          canRetry,
          retryId: canRetry ? `${collection}-retry-${Date.now()}` : undefined,
        },
      ]);
    });
  }, []);

  // 에러 토스트 제거
  const removeSyncErrorToast = useCallback((id: string) => {
    setSyncErrorToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // 재시도 핸들러
  const handleSyncRetry = useCallback(async (retryId: string | undefined) => {
    if (!retryId) return;
    try {
      await retryNow(retryId);
    } catch (error) {
      console.error('Failed to retry sync:', error);
    }
  }, []);

  return {
    syncErrorToasts,
    removeSyncErrorToast,
    handleSyncRetry,
  };
}

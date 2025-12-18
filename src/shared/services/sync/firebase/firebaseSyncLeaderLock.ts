/**
 * Firebase Sync Leader Lock (Multi-window guard)
 *
 * @role Electron/브라우저 멀티 윈도우에서 RTDB 리스너가 중복 등록되어 다운로드가 배수로 증가하는 것을 완화합니다.
 * @note navigator.locks 기반 소프트 락. 지원되지 않는 환경에서는 리더로 간주(동작 유지).
 */

import { addSyncLog } from '@/shared/services/sync/syncLogger';

export interface FirebaseSyncLeaderHandle {
  instanceId: string;
  isLeader: boolean;
  release: () => void;
}

let currentHandle: FirebaseSyncLeaderHandle | null = null;

function generateInstanceId(): string {
  // localStorage 금지 준수: 메모리 기반 세션 ID
  return `rtdb-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function supportsWebLocks(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function';
}

export async function acquireFirebaseSyncLeaderLock(): Promise<FirebaseSyncLeaderHandle> {
  if (currentHandle) return currentHandle;

  const instanceId = generateInstanceId();

  if (!supportsWebLocks()) {
    currentHandle = {
      instanceId,
      isLeader: true,
      release: () => {
        currentHandle = null;
      },
    };
    return currentHandle;
  }

  let releaseResolver: (() => void) | null = null;
  const hold = new Promise<void>((resolve) => {
    releaseResolver = resolve;
  });

  let acquired = false;
  let acquiredResolver: ((v: boolean) => void) | null = null;
  const acquiredPromise = new Promise<boolean>((resolve) => {
    acquiredResolver = resolve;
  });

  // 락을 잡으면 callback이 종료될 때까지 락이 유지됩니다.
  navigator.locks
    .request(
      'timeblock-firebase-sync-listeners',
      { ifAvailable: true },
      async (lock: unknown) => {
        if (!lock) {
          acquiredResolver?.(false);
          return;
        }

        acquired = true;
        acquiredResolver?.(true);

        // 리더로서 락 유지
        addSyncLog('firebase', 'info', 'RTDB listener leader lock acquired', { instanceId });
        await hold;
      }
    )
    .catch((error: unknown) => {
      // locks.request 자체 실패 시: 안전하게 fallback(현행 동작 유지)
      console.warn('[FirebaseSyncLeaderLock] navigator.locks.request failed:', error);
      acquiredResolver?.(true);
      acquired = true;
    });

  // 락 획득 여부를 짧게 기다림(획득되면 true, 아니면 false)
  const isLeader = await Promise.race([
    acquiredPromise,
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 50)),
  ]);

  currentHandle = {
    instanceId,
    isLeader,
    release: () => {
      if (releaseResolver) releaseResolver();
      currentHandle = null;
      addSyncLog('firebase', 'info', 'RTDB listener leader lock released', { instanceId });
    },
  };

  // acquired 플래그가 나중에 true로 바뀌는 케이스 방지
  if (!isLeader && acquired) {
    currentHandle.isLeader = true;
  }

  return currentHandle;
}

export function releaseFirebaseSyncLeaderLock(): void {
  currentHandle?.release();
}

/**
 * Coalescing operation queue for SyncEngine.
 *
 * @role 원격 업데이트 적용을 직렬화하고, 동일 키의 연속 작업을 병합합니다.
 */

export type OperationKey = string;

interface QueuedOperation {
  readonly callback: () => Promise<void>;
  readonly timestamp: number;
}

export interface SyncEngineOperationQueue {
  /**
   * Enqueues a remote-update operation.
   * When `operationKey` is provided, pending operations for the same key are coalesced.
   */
  readonly enqueue: (callback: () => Promise<void>, operationKey?: OperationKey) => Promise<void>;
  /** Returns number of pending coalesced operations. */
  readonly getPendingCount: () => number;
}

export interface CreateQueueOptions {
  readonly getIsSyncingFromRemote: () => boolean;
  readonly setIsSyncingFromRemote: (value: boolean) => void;
  readonly onQueueError: (error: unknown) => void;
}

export const createSyncEngineOperationQueue = (options: CreateQueueOptions): SyncEngineOperationQueue => {
  let operationQueue: Promise<void> = Promise.resolve();
  const pendingOperations = new Map<OperationKey, QueuedOperation>();
  const lastSyncTimestamps = new Map<OperationKey, number>();
  const rapidSyncWarningGapMs = 50;

  const enqueue: SyncEngineOperationQueue['enqueue'] = async (callback, operationKey) => {
    const now = Date.now();

    if (operationKey) {
      pendingOperations.set(operationKey, { callback, timestamp: now });

      const lastSync = lastSyncTimestamps.get(operationKey);
      if (lastSync !== undefined) {
        const gapMs = now - lastSync;
        if (gapMs < rapidSyncWarningGapMs) {
          console.debug(
            `🔄 SyncEngine: Rapid sync detected for ${operationKey} (${gapMs}ms gap). Possible concurrent update.`
          );
        }
      }
    }

    operationQueue = operationQueue
      .then(async () => {
        const operation = operationKey
          ? pendingOperations.get(operationKey)
          : { callback, timestamp: now };

        if (!operation) return;

        if (operationKey) {
          pendingOperations.delete(operationKey);
        }

        if (options.getIsSyncingFromRemote()) {
          await operation.callback();
          return;
        }

        try {
          options.setIsSyncingFromRemote(true);
          await operation.callback();

          if (operationKey) {
            lastSyncTimestamps.set(operationKey, Date.now());
          }
        } catch (error) {
          console.error('❌ SyncEngine: Remote update failed:', error);
          throw error;
        } finally {
          options.setIsSyncingFromRemote(false);
        }
      })
      .catch((error) => {
        // Prevent queue chain break.
        console.error('❌ SyncEngine: Operation queue error:', error);
        options.onQueueError(error);
      });

    await operationQueue;
  };

  return {
    enqueue,
    getPendingCount: () => pendingOperations.size,
  };
};

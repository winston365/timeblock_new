/**
 * Task Completion Batcher Tests
 *
 * @description task:completed 이벤트 배치 처리 기능 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Feature flag를 true로 모킹
vi.mock('@/shared/constants/featureFlags', () => ({
  FEATURE_FLAGS: {
    BATCH_EVENTS_ENABLED: true,
    ITEM_SYNC_ENABLED: true,
    DEBUG_SYNC_ENABLED: false,
  },
  isFeatureEnabled: (flag: string) => {
    const flags: Record<string, boolean> = {
      BATCH_EVENTS_ENABLED: true,
      ITEM_SYNC_ENABLED: true,
      DEBUG_SYNC_ENABLED: false,
    };
    return flags[flag] ?? false;
  },
}));

describe('Task Completion Batcher', () => {
  // 각 테스트에서 새로운 EventBus와 batcher를 사용
  let eventBus: typeof import('@/shared/lib/eventBus').eventBus;
  let batcher: typeof import('@/shared/services/eventBatch/taskCompletionBatcher');

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();

    // 매 테스트마다 모듈을 새로 로드
    const eventBusModule = await import('@/shared/lib/eventBus');
    eventBus = eventBusModule.eventBus;
    eventBus.clear();

    batcher = await import('@/shared/services/eventBatch/taskCompletionBatcher');
  });

  afterEach(() => {
    batcher.cancelTaskCompletionBatch();
    eventBus.clear();
    vi.useRealTimers();
  });

  describe('initTaskCompletionBatcher', () => {
    it('should initialize when feature flag is enabled', () => {
      // 초기화 전에는 구독자가 없어야 함
      const beforeInit = eventBus.getSubscribers('task:completed');
      const beforeSize = beforeInit.get('task:completed')?.size ?? 0;

      batcher.initTaskCompletionBatcher();

      // 초기화 후에는 구독자가 있어야 함
      const afterInit = eventBus.getSubscribers('task:completed');
      const afterSize = afterInit.get('task:completed')?.size ?? 0;

      expect(afterSize).toBeGreaterThan(beforeSize);
    });
  });

  describe('batch collection', () => {
    it('should collect task:completed events', () => {
      batcher.initTaskCompletionBatcher();

      eventBus.emit('task:completed', {
        taskId: 'task-1',
        xpEarned: 10,
        isPerfectBlock: false,
        adjustedDuration: 30,
      });

      expect(batcher.getPendingBatchCount()).toBe(1);
    });

    it('should collect multiple events before debounce timeout', () => {
      batcher.initTaskCompletionBatcher();

      eventBus.emit('task:completed', {
        taskId: 'task-1',
        xpEarned: 10,
        isPerfectBlock: false,
        adjustedDuration: 30,
      });
      eventBus.emit('task:completed', {
        taskId: 'task-2',
        xpEarned: 20,
        isPerfectBlock: true,
        adjustedDuration: 45,
      });
      eventBus.emit('task:completed', {
        taskId: 'task-3',
        xpEarned: 15,
        isPerfectBlock: false,
        adjustedDuration: 60,
      });

      expect(batcher.getPendingBatchCount()).toBe(3);
    });

    it('should deduplicate events with same taskId after processing', () => {
      batcher.initTaskCompletionBatcher();

      // 같은 taskId로 두 번 이벤트 발행
      eventBus.emit('task:completed', {
        taskId: 'task-1',
        xpEarned: 10,
        isPerfectBlock: false,
        adjustedDuration: 30,
      });

      eventBus.emit('task:completed', {
        taskId: 'task-1',
        xpEarned: 15,
        isPerfectBlock: true,
        adjustedDuration: 45,
      });

      // 배치 이벤트 리스너 등록
      let receivedBatch: { completedTasks: unknown[]; totalXpEarned: number } | null = null;
      eventBus.on('task:completed:batch', (payload) => {
        receivedBatch = payload;
      });

      // 타이머 실행
      vi.advanceTimersByTime(300);

      // 중복 제거되어 1개만 있어야 함
      expect(receivedBatch?.completedTasks.length).toBe(1);
      // 마지막 값이 유지됨
      expect((receivedBatch?.completedTasks[0] as { xpEarned: number }).xpEarned).toBe(15);
    });
  });

  describe('batch processing', () => {
    it('should emit task:completed:batch after debounce timeout', () => {
      batcher.initTaskCompletionBatcher();

      let receivedBatch: { completedTasks: unknown[]; totalXpEarned: number } | null = null;
      eventBus.on('task:completed:batch', (payload) => {
        receivedBatch = payload;
      });

      eventBus.emit('task:completed', {
        taskId: 'task-1',
        xpEarned: 10,
        isPerfectBlock: false,
        adjustedDuration: 30,
      });

      eventBus.emit('task:completed', {
        taskId: 'task-2',
        xpEarned: 20,
        isPerfectBlock: true,
        adjustedDuration: 45,
      });

      // 배치 이벤트가 아직 발행되지 않음
      expect(receivedBatch).toBeNull();

      // 300ms 대기
      vi.advanceTimersByTime(300);

      // 배치 이벤트 발행됨
      expect(receivedBatch).not.toBeNull();
      expect(receivedBatch?.completedTasks.length).toBe(2);
      expect(receivedBatch?.totalXpEarned).toBe(30);
    });

    it('should calculate correct totalXpEarned', () => {
      batcher.initTaskCompletionBatcher();

      let receivedBatch: { totalXpEarned: number } | null = null;
      eventBus.on('task:completed:batch', (payload) => {
        receivedBatch = payload;
      });

      const xpValues = [10, 25, 15, 50];
      xpValues.forEach((xp, i) => {
        eventBus.emit('task:completed', {
          taskId: `task-${i}`,
          xpEarned: xp,
          isPerfectBlock: false,
          adjustedDuration: 30,
        });
      });

      vi.advanceTimersByTime(300);

      expect(receivedBatch?.totalXpEarned).toBe(100);
    });

    it('should reset pending count after processing', () => {
      batcher.initTaskCompletionBatcher();

      eventBus.emit('task:completed', {
        taskId: 'task-1',
        xpEarned: 10,
        isPerfectBlock: false,
        adjustedDuration: 30,
      });

      expect(batcher.getPendingBatchCount()).toBe(1);

      vi.advanceTimersByTime(300);

      expect(batcher.getPendingBatchCount()).toBe(0);
    });
  });

  describe('flush and cancel', () => {
    it('should immediately process batch on flush', () => {
      batcher.initTaskCompletionBatcher();

      let receivedBatch: { completedTasks: unknown[] } | null = null;
      eventBus.on('task:completed:batch', (payload) => {
        receivedBatch = payload;
      });

      eventBus.emit('task:completed', {
        taskId: 'task-1',
        xpEarned: 10,
        isPerfectBlock: false,
        adjustedDuration: 30,
      });

      // flush 호출
      batcher.flushTaskCompletionBatch();

      // 타이머 없이도 즉시 처리됨
      expect(receivedBatch).not.toBeNull();
      expect(receivedBatch?.completedTasks.length).toBe(1);
    });

    it('should discard pending events on cancel', () => {
      batcher.initTaskCompletionBatcher();

      let receivedBatch: unknown = null;
      eventBus.on('task:completed:batch', (payload) => {
        receivedBatch = payload;
      });

      eventBus.emit('task:completed', {
        taskId: 'task-1',
        xpEarned: 10,
        isPerfectBlock: false,
        adjustedDuration: 30,
      });

      // cancel 호출
      batcher.cancelTaskCompletionBatch();

      expect(batcher.getPendingBatchCount()).toBe(0);

      // 타이머가 지나도 배치 이벤트가 발행되지 않음
      vi.advanceTimersByTime(300);

      expect(receivedBatch).toBeNull();
    });
  });

  describe('debounce behavior', () => {
    it('should reset debounce timer on new event', () => {
      batcher.initTaskCompletionBatcher();

      let receivedBatch: { completedTasks: unknown[] } | null = null;
      eventBus.on('task:completed:batch', (payload) => {
        receivedBatch = payload;
      });

      // 첫 번째 이벤트
      eventBus.emit('task:completed', {
        taskId: 'task-1',
        xpEarned: 10,
        isPerfectBlock: false,
        adjustedDuration: 30,
      });

      // 200ms 후 두 번째 이벤트
      vi.advanceTimersByTime(200);

      eventBus.emit('task:completed', {
        taskId: 'task-2',
        xpEarned: 20,
        isPerfectBlock: false,
        adjustedDuration: 30,
      });

      // 아직 배치 발행되지 않음 (타이머 리셋)
      expect(receivedBatch).toBeNull();

      // 300ms 더 대기
      vi.advanceTimersByTime(300);

      // 이제 배치 발행됨
      expect(receivedBatch).not.toBeNull();
      expect(receivedBatch?.completedTasks.length).toBe(2);
    });
  });
});

describe('Debounced Sync', () => {
  let debouncedSync: typeof import('@/shared/services/sync/debouncedSync');

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    debouncedSync = await import('@/shared/services/sync/debouncedSync');
    debouncedSync.clearDebouncedSyncCache();
  });

  afterEach(() => {
    debouncedSync.clearDebouncedSyncCache();
    vi.useRealTimers();
  });

  it('should debounce sync calls', async () => {
    const syncFn = vi.fn().mockResolvedValue(undefined);
    const debounced = debouncedSync.createDebouncedSync('test-strategy', syncFn);

    // 여러 번 호출
    debounced();
    debounced();
    debounced();

    // 아직 실행되지 않음
    expect(syncFn).not.toHaveBeenCalled();

    // 300ms 대기
    vi.advanceTimersByTime(300);

    // 한 번만 실행됨
    expect(syncFn).toHaveBeenCalledTimes(1);
  });

  it('should reuse same debounce instance for same key', () => {
    const syncFn1 = vi.fn().mockResolvedValue(undefined);
    const syncFn2 = vi.fn().mockResolvedValue(undefined);

    const debounced1 = debouncedSync.createDebouncedSync('test-strategy', syncFn1);
    const debounced2 = debouncedSync.createDebouncedSync('test-strategy', syncFn2);

    debounced1();
    debounced2();

    vi.advanceTimersByTime(300);

    // 첫 번째 함수만 실행됨 (캐시된 인스턴스 재사용)
    expect(syncFn1).toHaveBeenCalledTimes(1);
    expect(syncFn2).not.toHaveBeenCalled();
  });

  it('should create separate instances for different keys', () => {
    const syncFn1 = vi.fn().mockResolvedValue(undefined);
    const syncFn2 = vi.fn().mockResolvedValue(undefined);

    const debounced1 = debouncedSync.createDebouncedSync('strategy-1', syncFn1);
    const debounced2 = debouncedSync.createDebouncedSync('strategy-2', syncFn2);

    debounced1();
    debounced2();

    vi.advanceTimersByTime(300);

    // 둘 다 실행됨
    expect(syncFn1).toHaveBeenCalledTimes(1);
    expect(syncFn2).toHaveBeenCalledTimes(1);
  });

  it('should flush pending sync immediately', () => {
    const syncFn = vi.fn().mockResolvedValue(undefined);
    debouncedSync.createDebouncedSync('test-strategy', syncFn)();

    expect(syncFn).not.toHaveBeenCalled();

    debouncedSync.flushDebouncedSync('test-strategy');

    expect(syncFn).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending sync', () => {
    const syncFn = vi.fn().mockResolvedValue(undefined);
    debouncedSync.createDebouncedSync('test-strategy', syncFn)();

    debouncedSync.cancelDebouncedSync('test-strategy');

    vi.advanceTimersByTime(300);

    expect(syncFn).not.toHaveBeenCalled();
  });

  it('should report pending status correctly', () => {
    const syncFn = vi.fn().mockResolvedValue(undefined);
    debouncedSync.createDebouncedSync('test-strategy', syncFn)();

    expect(debouncedSync.hasPendingSync('test-strategy')).toBe(true);

    vi.advanceTimersByTime(300);

    expect(debouncedSync.hasPendingSync('test-strategy')).toBe(false);
  });

  it('should flush all pending syncs', () => {
    const syncFn1 = vi.fn().mockResolvedValue(undefined);
    const syncFn2 = vi.fn().mockResolvedValue(undefined);

    debouncedSync.createDebouncedSync('strategy-1', syncFn1)();
    debouncedSync.createDebouncedSync('strategy-2', syncFn2)();

    debouncedSync.flushAllDebouncedSyncs();

    expect(syncFn1).toHaveBeenCalledTimes(1);
    expect(syncFn2).toHaveBeenCalledTimes(1);
  });
});

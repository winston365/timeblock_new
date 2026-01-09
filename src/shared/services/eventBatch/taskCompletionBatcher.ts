/**
 * Task Completion Batcher
 *
 * @file taskCompletionBatcher.ts
 * @description task:completed 이벤트를 배치로 모아서 처리하는 서비스
 *
 * @role
 *   - 여러 task:completed 이벤트를 수집하여 일정 시간 후 배치 이벤트로 발행
 *   - 연쇄 반응을 제어하여 성능 최적화
 * @responsibilities
 *   - task:completed 이벤트 수집 (debounce window 내)
 *   - task:completed:batch 이벤트 발행
 *   - FEATURE_FLAGS.BATCH_EVENTS_ENABLED로 기능 제어
 * @dependencies
 *   - eventBus: 이벤트 발행/구독
 *   - featureFlags: 기능 플래그
 */

import { eventBus } from '@/shared/lib/eventBus';
import type { TaskCompletedEvent, TaskCompletedBatchEvent } from '@/shared/lib/eventBus/types';
import { FEATURE_FLAGS } from '@/shared/constants/featureFlags';

// ============================================================================
// Constants
// ============================================================================

/** 배치 처리 대기 시간 (ms) */
const BATCH_DEBOUNCE_WAIT = 300;

// ============================================================================
// Types
// ============================================================================

interface PendingCompletion {
  taskId: string;
  xpEarned: number;
  isPerfectBlock: boolean;
  blockId?: string | null;
  goalId?: string | null;
  adjustedDuration: number;
  timestamp: number;
}

// ============================================================================
// Batcher State
// ============================================================================

/** 배치 대기 중인 완료 이벤트들 */
let pendingCompletions: PendingCompletion[] = [];

/** 배치 처리 타이머 ID */
let batchTimeoutId: ReturnType<typeof setTimeout> | null = null;

/** 배치 처리 중 여부 (중복 방지) */
let isProcessing = false;

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * 배치된 완료 이벤트들을 처리하고 task:completed:batch 이벤트 발행
 */
function processBatch(): void {
  if (pendingCompletions.length === 0 || isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    // 중복 제거 (같은 taskId가 여러 번 들어온 경우 마지막 것만 유지)
    const uniqueCompletions = new Map<string, PendingCompletion>();
    pendingCompletions.forEach(completion => {
      uniqueCompletions.set(completion.taskId, completion);
    });

    const completions = Array.from(uniqueCompletions.values());
    const totalXp = completions.reduce((sum, c) => sum + c.xpEarned, 0);

    // 배치 이벤트 발행
    const batchPayload: TaskCompletedBatchEvent = {
      completedTasks: completions.map(c => ({
        taskId: c.taskId,
        xpEarned: c.xpEarned,
        isPerfectBlock: c.isPerfectBlock,
        blockId: c.blockId,
        goalId: c.goalId,
        adjustedDuration: c.adjustedDuration,
      })),
      totalXpEarned: totalXp,
      batchTimestamp: Date.now(),
    };

    eventBus.emit('task:completed:batch', batchPayload);

    if (import.meta.env.DEV) {
      console.debug(
        `🔄 [TaskCompletionBatcher] Batch processed: ${completions.length} tasks, ${totalXp} XP`
      );
    }
  } finally {
    // 상태 초기화
    pendingCompletions = [];
    batchTimeoutId = null;
    isProcessing = false;
  }
}

/**
 * task:completed 이벤트를 배치에 추가
 *
 * @param event task:completed 이벤트 페이로드
 */
function addToBatch(event: TaskCompletedEvent): void {
  const pendingCompletion: PendingCompletion = {
    taskId: event.taskId,
    xpEarned: event.xpEarned,
    isPerfectBlock: event.isPerfectBlock,
    blockId: event.blockId,
    goalId: event.goalId,
    adjustedDuration: event.adjustedDuration,
    timestamp: Date.now(),
  };

  pendingCompletions.push(pendingCompletion);

  // 기존 타이머가 있으면 취소하고 새로 설정 (debounce)
  if (batchTimeoutId !== null) {
    clearTimeout(batchTimeoutId);
  }

  batchTimeoutId = setTimeout(processBatch, BATCH_DEBOUNCE_WAIT);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 배치 처리를 즉시 실행 (flush)
 * 테스트 또는 앱 종료 시 사용
 */
export function flushTaskCompletionBatch(): void {
  if (batchTimeoutId !== null) {
    clearTimeout(batchTimeoutId);
    batchTimeoutId = null;
  }

  if (pendingCompletions.length > 0) {
    processBatch();
  }
}

/**
 * 대기 중인 배치 취소
 */
export function cancelTaskCompletionBatch(): void {
  if (batchTimeoutId !== null) {
    clearTimeout(batchTimeoutId);
    batchTimeoutId = null;
  }
  pendingCompletions = [];
  isProcessing = false;
}

/**
 * 대기 중인 완료 이벤트 수 반환 (디버깅용)
 */
export function getPendingBatchCount(): number {
  return pendingCompletions.length;
}

/**
 * Task Completion Batcher 초기화
 *
 * FEATURE_FLAGS.BATCH_EVENTS_ENABLED가 true일 때만 활성화됩니다.
 * task:completed 이벤트를 구독하고 배치 처리를 수행합니다.
 */
export function initTaskCompletionBatcher(): void {
  if (!FEATURE_FLAGS.BATCH_EVENTS_ENABLED) {
    if (import.meta.env.DEV) {
      console.debug('[TaskCompletionBatcher] Disabled (BATCH_EVENTS_ENABLED = false)');
    }
    return;
  }

  // task:completed 이벤트 구독 (낮은 우선순위로 다른 핸들러 후에 실행)
  eventBus.on(
    'task:completed',
    (payload) => {
      addToBatch(payload);
    },
    { priority: -100 } // 다른 핸들러보다 늦게 실행
  );

  if (import.meta.env.DEV) {
    console.debug('[TaskCompletionBatcher] Initialized (BATCH_EVENTS_ENABLED = true)');
  }
}

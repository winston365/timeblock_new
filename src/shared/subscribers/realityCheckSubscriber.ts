/**
 * @file realityCheckSubscriber.ts
 * @module shared/subscribers
 * 
 * @description Reality Check Subscriber - Reality Check 모달 표시 이벤트 처리
 * 
 * @role EventBus를 통해 Reality Check 요청 이벤트를 수신하고 모달을 트리거
 * 
 * @responsibilities
 * - realityCheck:request 이벤트 수신 → Reality Check 모달 열기
 * - task:completed 이벤트 수신 → 10분 이상 작업 완료 시 Reality Check 트리거
 * - Store 간 순환 의존성 해소
 * 
 * @dependencies
 * - eventBus: 이벤트 구독
 * - useRealityCheckStore: Reality Check 모달 상태 관리
 */

import { eventBus } from '@/shared/lib/eventBus';
import { useRealityCheckStore } from '@/shared/stores/realityCheckStore';

/**
 * Reality Check Subscriber를 초기화합니다.
 * 
 * Reality Check 요청 이벤트를 구독하고 RealityCheckStore를 통해
 * 모달을 표시합니다. Store 간 직접 의존성 대신 이벤트 버스를 통해
 * Reality Check를 트리거합니다.
 * 
 * @returns {void}
 */
export function initRealityCheckSubscriber(): void {
    // Reality Check 요청 처리
    eventBus.on('realityCheck:request', ({ taskId, taskTitle, estimatedDuration }) => {
        try {
            useRealityCheckStore.getState().openRealityCheck(
                taskId,
                taskTitle,
                estimatedDuration
            );
        } catch (error) {
            console.error('[RealityCheckSubscriber] Failed to open Reality Check:', error);
        }
    });

    // NOTE: Task 완료 시 Reality Check 트리거는 Store에서 직접 처리함
    // realityCheck:request 이벤트로 위임되므로 여기서는 별도 처리 없음
}

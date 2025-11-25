/**
 * Reality Check Subscriber
 * 
 * @description Reality Check 모달 표시 이벤트 처리 (Store 간 순환 의존성 해소)
 */

import { eventBus } from '@/shared/lib/eventBus';
import { useRealityCheckStore } from '@/shared/stores/realityCheckStore';

/**
 * Reality Check Subscriber 초기화
 * - Store 간 직접 의존성 대신 이벤트 버스를 통해 Reality Check 트리거
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
            console.log(`✅ [RealityCheckSubscriber] Opened Reality Check for task: ${taskId}`);
        } catch (error) {
            console.error('[RealityCheckSubscriber] Failed to open Reality Check:', error);
        }
    });

    // Task 완료 시 10분 이상 작업이면 Reality Check 트리거
    eventBus.on('task:completed', ({ taskId, adjustedDuration }, meta) => {
        // 이미 realityCheck:request 이벤트로 처리된 경우 중복 방지
        // (meta.source가 realityCheck 관련이면 스킵)
        if (meta.source?.includes('realityCheck')) {
            return;
        }

        // 10분 이상 작업만 Reality Check
        if (adjustedDuration >= 10) {
            // task:completed 이벤트에서는 taskTitle을 알 수 없으므로,
            // 별도의 realityCheck:request 이벤트로 처리하도록 위임
            // (이 로직은 Store에서 이미 처리하므로 여기서는 스킵)
        }
    });

    console.log('✅ [RealityCheckSubscriber] Initialized');
}

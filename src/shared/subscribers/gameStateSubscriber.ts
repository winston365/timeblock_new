/**
 * @file gameStateSubscriber.ts
 * @module shared/subscribers
 * 
 * @description GameState Subscriber - GameState 갱신 및 퀴스트 진행 이벤트 처리
 * 
 * @role EventBus를 통해 게임 상태 갱신 이벤트를 수신하고 GameStateStore를 업데이트
 * 
 * @responsibilities
 * - gameState:refreshRequest 이벤트 수신 → GameState 갱신
 * - task:completed 이벤트 수신 → 작업 완료 퀴스트 진행
 * - block:locked 이벤트 수신 → 블록 잠금 퀴스트 진행
 * - block:perfect 이벤트 수신 → 퍼펙트 블록 퀴스트 진행
 * - Store 간 순환 의존성 해소
 * 
 * @dependencies
 * - eventBus: 이벤트 구독
 * - useGameStateStore: 게임 상태 관리
 */

import { eventBus } from '@/shared/lib/eventBus';
import { useGameStateStore } from '@/shared/stores/gameStateStore';

/**
 * GameState Subscriber를 초기화합니다.
 * 
 * GameState 갱신 요청 및 퀴스트 진행 관련 이벤트를 구독하고
 * GameStateStore를 통해 상태를 업데이트합니다.
 * Store 간 직접 의존성 대신 이벤트 버스를 통해 GameState를 갱신합니다.
 * 
 * @returns {void}
 */
export function initGameStateSubscriber(): void {
    // GameState 갱신 요청 처리
    eventBus.on('gameState:refreshRequest', async () => {
        try {
            await useGameStateStore.getState().refresh();
        } catch (error) {
            console.error('[GameStateSubscriber] Failed to refresh GameState:', error);
        }
    });

    // Task 완료 시 퀴스트 진행도 업데이트 (task:completed 이벤트 활용)
    eventBus.on('task:completed', async () => {
        try {
            const gameStateStore = useGameStateStore.getState();
            
            // 작업 완료 퀴스트 진행
            await gameStateStore.updateQuestProgress('complete_tasks', 1);
        } catch (error) {
            console.error('[GameStateSubscriber] Failed to update quest progress:', error);
        }
    });

    // Block 잠금 시 퀴스트 진행도 업데이트
    eventBus.on('block:locked', async ({ taskCount }) => {
        try {
            if (taskCount > 0) {
                await useGameStateStore.getState().updateQuestProgress('lock_blocks', 1);
            }
        } catch (error) {
            console.error('[GameStateSubscriber] Failed to update block lock quest:', error);
        }
    });

    // Perfect Block 달성 시 퀴스트 진행도 업데이트
    eventBus.on('block:perfect', async () => {
        try {
            await useGameStateStore.getState().updateQuestProgress('perfect_blocks', 1);
        } catch (error) {
            console.error('[GameStateSubscriber] Failed to update perfect block quest:', error);
        }
    });
}

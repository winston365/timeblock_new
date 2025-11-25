/**
 * GameState Subscriber
 * 
 * @description GameState 갱신 이벤트 처리 (Store 간 순환 의존성 해소)
 */

import { eventBus } from '@/shared/lib/eventBus';
import { useGameStateStore } from '@/shared/stores/gameStateStore';

/**
 * GameState Subscriber 초기화
 * - Store 간 직접 의존성 대신 이벤트 버스를 통해 GameState 갱신
 */
export function initGameStateSubscriber(): void {
    // GameState 갱신 요청 처리
    eventBus.on('gameState:refreshRequest', async ({ reason }) => {
        try {
            await useGameStateStore.getState().refresh();
            console.log(`✅ [GameStateSubscriber] Refreshed GameState${reason ? ` (${reason})` : ''}`);
        } catch (error) {
            console.error('[GameStateSubscriber] Failed to refresh GameState:', error);
        }
    });

    // Task 완료 시 퀘스트 진행도 업데이트 (task:completed 이벤트 활용)
    eventBus.on('task:completed', async () => {
        try {
            const gameStateStore = useGameStateStore.getState();
            
            // 작업 완료 퀘스트 진행
            await gameStateStore.updateQuestProgress('complete_tasks', 1);
            
            console.log('[GameStateSubscriber] Quest progress updated for task completion');
        } catch (error) {
            console.error('[GameStateSubscriber] Failed to update quest progress:', error);
        }
    });

    // Block 잠금 시 퀘스트 진행도 업데이트
    eventBus.on('block:locked', async ({ taskCount }) => {
        try {
            if (taskCount > 0) {
                await useGameStateStore.getState().updateQuestProgress('lock_blocks', 1);
                console.log('[GameStateSubscriber] Block lock quest progress updated');
            }
        } catch (error) {
            console.error('[GameStateSubscriber] Failed to update block lock quest:', error);
        }
    });

    // Perfect Block 달성 시 퀘스트 진행도 업데이트
    eventBus.on('block:perfect', async () => {
        try {
            await useGameStateStore.getState().updateQuestProgress('perfect_blocks', 1);
            console.log('[GameStateSubscriber] Perfect block quest progress updated');
        } catch (error) {
            console.error('[GameStateSubscriber] Failed to update perfect block quest:', error);
        }
    });

    console.log('✅ [GameStateSubscriber] Initialized');
}

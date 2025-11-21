/**
 * XP Subscriber
 * 
 * @description XP 관련 이벤트 처리
 */

import { eventBus } from '@/shared/lib/eventBus';
import { useGameStateStore } from '@/shared/stores/gameStateStore';

/**
 * XP Subscriber 초기화
 * 앱 시작 시 한 번만 호출
 */
export function initXpSubscriber(): void {
    // Task 완료 시 XP 추가
    eventBus.on('task:completed', async ({ xpEarned, blockId }) => {
        try {
            await useGameStateStore.getState().addXP(xpEarned, blockId || undefined);
            console.log(`✅ [XpSubscriber] Added ${xpEarned} XP`);
        } catch (error) {
            console.error('[XpSubscriber] Failed to add XP:', error);
        }
    });

    // Perfect Block 달성 시 보너스 XP
    eventBus.on('block:perfect', async ({ xpBonus }) => {
        try {
            await useGameStateStore.getState().addXP(xpBonus);
            console.log(`✅ [XpSubscriber] Perfect Block bonus: ${xpBonus} XP`);
        } catch (error) {
            console.error('[XpSubscriber] Failed to add bonus XP:', error);
        }
    });

    // Block 잠금 해제 시 XP 소비
    eventBus.on('block:unlocked', async ({ xpCost }) => {
        try {
            await useGameStateStore.getState().spendXP(xpCost);
            console.log(`✅ [XpSubscriber] Spent ${xpCost} XP to unlock block`);
        } catch (error) {
            console.error('[XpSubscriber] Failed to spend XP:', error);
        }
    });

    console.log('✅ [XpSubscriber] Initialized');
}

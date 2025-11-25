/**
 * XP Subscriber
 * 
 * @description XP 관련 이벤트 처리 (Store 간 순환 의존성 해소)
 */

import { eventBus } from '@/shared/lib/eventBus';
import { useGameStateStore } from '@/shared/stores/gameStateStore';

/**
 * XP Subscriber 초기화
 * 앱 시작 시 한 번만 호출
 */
export function initXpSubscriber(): void {
    // XP 획득 이벤트 처리 (통합)
    eventBus.on('xp:earned', async ({ amount, source, blockId }) => {
        try {
            // dont_do_check 소스는 skipEvents=true로 중복 이벤트 방지
            const skipEvents = source === 'dont_do_check';
            await useGameStateStore.getState().addXP(amount, blockId, skipEvents);
            console.log(`✅ [XpSubscriber] Added ${amount} XP from ${source}`);
        } catch (error) {
            console.error('[XpSubscriber] Failed to add XP:', error);
        }
    });

    // Task 완료 시 XP 추가 (task:completed는 이미 xpEarned 포함)
    eventBus.on('task:completed', async ({ xpEarned, blockId }) => {
        if (xpEarned > 0) {
            try {
                // task:completed는 이미 taskCompletionService에서 XP 처리됨
                // 여기서는 중복 처리 방지를 위해 스킵
                // await useGameStateStore.getState().addXP(xpEarned, blockId || undefined);
                console.log(`✅ [XpSubscriber] Task completed with ${xpEarned} XP (already processed)`);
            } catch (error) {
                console.error('[XpSubscriber] Failed to add XP:', error);
            }
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

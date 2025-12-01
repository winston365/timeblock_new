/**
 * @file xpSubscriber.ts
 * @module shared/subscribers
 * 
 * @description XP Subscriber - XP 관련 이벤트 처리
 * 
 * @role EventBus를 통해 XP 획득/소비 이벤트를 수신하고 GameStateStore에 반영
 * 
 * @responsibilities
 * - xp:earned 이벤트 수신 → GameStateStore.addXP() 호출
 * - task:completed 이벤트 수신 → XP 처리 완료 확인 (중복 방지)
 * - block:perfect 이벤트 수신 → 보너스 XP 지급
 * - block:unlocked 이벤트 수신 → XP 소비 처리
 * 
 * @dependencies
 * - eventBus: 이벤트 구독
 * - useGameStateStore: XP 상태 관리
 */

import { eventBus } from '@/shared/lib/eventBus';
import { useGameStateStore } from '@/shared/stores/gameStateStore';

/**
 * XP Subscriber를 초기화합니다.
 * 
 * XP 관련 이벤트(xp:earned, task:completed, block:perfect, block:unlocked)를
 * 구독하고 GameStateStore를 통해 XP 상태를 업데이트합니다.
 * 앱 시작 시 한 번만 호출해야 합니다.
 * 
 * @returns {void}
 */
export function initXpSubscriber(): void {
    // XP 획득 이벤트 처리 (통합)
    eventBus.on('xp:earned', async ({ amount, source, blockId }) => {
        try {
            // dont_do_check 소스는 skipEvents=true로 중복 이벤트 방지
            const skipEvents = source === 'dont_do_check';
            await useGameStateStore.getState().addXP(amount, blockId, skipEvents);
        } catch (error) {
            console.error('[XpSubscriber] Failed to add XP:', error);
        }
    });

    // Task 완료 시 XP 추가 (task:completed는 이미 xpEarned 포함)
    eventBus.on('task:completed', async ({ xpEarned }) => {
        if (xpEarned > 0) {
            try {
                // task:completed는 이미 taskCompletionService에서 XP 처리됨
                // 여기서는 중복 처리 방지를 위해 스킵
            } catch (error) {
                console.error('[XpSubscriber] Failed to add XP:', error);
            }
        }
    });

    // Perfect Block 달성 시 보너스 XP
    eventBus.on('block:perfect', async ({ xpBonus }) => {
        try {
            await useGameStateStore.getState().addXP(xpBonus);
        } catch (error) {
            console.error('[XpSubscriber] Failed to add bonus XP:', error);
        }
    });

    // Block 잠금 해제 시 XP 소비
    eventBus.on('block:unlocked', async ({ xpCost }) => {
        try {
            await useGameStateStore.getState().spendXP(xpCost);
        } catch (error) {
            console.error('[XpSubscriber] Failed to spend XP:', error);
        }
    });
}

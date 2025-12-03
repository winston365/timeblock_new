/**
 * @file waifuSubscriber.ts
 * @module shared/subscribers
 * 
 * @description Waifu Subscriber - Waifu 메시지 표시 이벤트 처리
 * 
 * @role EventBus를 통해 게임 이벤트를 수신하고 Waifu 리액션을 트리거
 * 
 * @responsibilities
 * - task:completed 이벤트 수신 → 작업 완료 축하 메시지 표시
 * - quest:completed 이벤트 수신 → 퀴스트 완료 메시지 표시
 * - Perfect Block 달성 시 특별 축하 메시지 표시
 * 
 * @dependencies
 * - eventBus: 이벤트 구독
 * - useWaifuCompanionStore: Waifu 리액션 표시
 */

import { eventBus } from '@/shared/lib/eventBus';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';

/**
 * Waifu Subscriber를 초기화합니다.
 * 
 * 게임 이벤트(task:completed, quest:completed)를 구독하고
 * 적절한 Waifu 축하 메시지 및 표정을 표시합니다.
 * 
 * @returns {void}
 */
export function initWaifuSubscriber(): void {
    const waifuStore = useWaifuCompanionStore.getState();

    // Task 완료 시 축하 메시지
    eventBus.on('task:completed', ({ isPerfectBlock }) => {
        if (isPerfectBlock) {
            waifuStore.show('완벽해! Perfect Block 달성! 🎉', {
                audioPath: '/audio/하.mp3', // TODO: 적절한 축하 오디오로 교체 필요
                expression: {
                    imagePath: '/assets/waifu/poses/loving/hyeeun_happy.webp',
                    durationMs: 3000,
                },
            });
        } else {
            const celebrationMessages = [
                '잘했어! 작업 완료! ✨',
                '오~ 하나 끝! 👏',
                '수고했어! 🌟',
            ];
            const celebrationMessage = celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)];
            waifuStore.show(celebrationMessage, {
                audioPath: '/audio/하.mp3', // TODO: 적절한 축하 오디오로 교체 필요
                expression: {
                    imagePath: '/assets/waifu/poses/loving/hyeeun_winking.webp', // 긍정적인 표정 사용
                    durationMs: 3000,
                },
            });
        }
    });

    // Quest 완료 시
    eventBus.on('quest:completed', ({ reward }) => {
        waifuStore.show(`퀴스트 완료! ${reward} XP 획득! 🏆`);
    });
}

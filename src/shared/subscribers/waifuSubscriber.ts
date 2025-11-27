/**
 * Waifu Subscriber
 * 
 * @description Waifu 메시지 표시
 */

import { eventBus } from '@/shared/lib/eventBus';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';

/**
 * Waifu Subscriber 초기화
 */
export function initWaifuSubscriber(): void {
    const waifuStore = useWaifuCompanionStore.getState();

    // Task 완료 시 축하 메시지
    // Task 완료 시 축하 메시지
    eventBus.on('task:completed', ({ isPerfectBlock }) => {
        if (isPerfectBlock) {
            waifuStore.show('완벽해! Perfect Block 달성! 🎉', {
                audioPath: '/audio/하.mp3', // TODO: 적절한 축하 오디오로 교체 필요
                expression: {
                    imagePath: '/assets/waifu/poses/loving/hyeeun_happy.png',
                    durationMs: 3000,
                },
            });
        } else {
            const messages = [
                '잘했어! 작업 완료! ✨',
                '오~ 하나 끝! 👏',
                '수고했어! 🌟',
            ];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            waifuStore.show(randomMessage, {
                audioPath: '/audio/하.mp3', // TODO: 적절한 축하 오디오로 교체 필요
                expression: {
                    imagePath: '/assets/waifu/poses/loving/hyeeun_smiling.png', // 긍정적인 표정 사용
                    durationMs: 3000,
                },
            });
        }
    });

    // Quest 완료 시
    eventBus.on('quest:completed', ({ reward }) => {
        waifuStore.show(`퀘스트 완료! ${reward} XP 획득! 🏆`);
    });

    console.log('✅ [WaifuSubscriber] Initialized');
}

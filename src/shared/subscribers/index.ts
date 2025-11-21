/**
 * Subscribers - Public API
 * 
 * @description 모든 subscribers 초기화
 */

import { initXpSubscriber } from './xpSubscriber';
import { initGoalSubscriber } from './goalSubscriber';
import { initWaifuSubscriber } from './waifuSubscriber';

export { initXpSubscriber, initGoalSubscriber, initWaifuSubscriber };

/**
 * 모든 Subscriber 한 번에 초기화
 */
export function initAllSubscribers(): void {
    console.log('🚀 [Subscribers] Initializing all event subscribers...');

    initXpSubscriber();
    initGoalSubscriber();
    initWaifuSubscriber();

    console.log('✅ [Subscribers] All subscribers initialized');
}

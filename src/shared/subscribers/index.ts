/**
 * @file index.ts
 * @module shared/subscribers
 * 
 * @description Subscribers Public API - 모든 EventBus Subscriber 초기화 및 내보내기
 * 
 * @role 애플리케이션 시작 시 모든 이벤트 구독자를 초기화하는 진입점
 * 
 * @responsibilities
 * - 개별 Subscriber 모듈 내보내기
 * - initAllSubscribers()를 통한 일괄 초기화 제공
 * 
 * @dependencies
 * - xpSubscriber: XP 이벤트 처리
 * - waifuSubscriber: Waifu 메시지 이벤트 처리
 * - gameStateSubscriber: GameState 갱신 이벤트 처리
 * - googleCalendarSubscriber: Google Calendar 동기화 이벤트 처리
 */

import { initXpSubscriber } from './xpSubscriber';
import { initWaifuSubscriber } from './waifuSubscriber';
import { initGameStateSubscriber } from './gameStateSubscriber';
import { initGoogleSyncSubscriber } from './googleSyncSubscriber';

export {
    initXpSubscriber,
    initWaifuSubscriber,
    initGameStateSubscriber,
    initGoogleSyncSubscriber,
};

/**
 * 모든 Subscriber를 한 번에 초기화합니다.
 * 
 * 애플리케이션 시작 시 한 번 호출하여 모든 EventBus 구독자를 등록합니다.
 * 각 Subscriber는 특정 도메인의 이벤트를 처리하며, Store 간 순환 의존성을 해소합니다.
 * 
 * @returns {void}
 */
export function initAllSubscribers(): void {
    initXpSubscriber();
    initWaifuSubscriber();
    initGameStateSubscriber();
    initGoogleSyncSubscriber();
}

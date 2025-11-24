/**
 * systemRepository.ts
 *
 * @role 시스템 전역 상태 관리 (Dexie 'systemState' 테이블 사용)
 * @description localStorage 대신 Dexie를 사용하여 시스템 상태를 영구 저장하고 관리합니다.
 */

import { db } from '../db/dexieClient';

/**
 * 시스템 상태 키 정의
 */
export const SYSTEM_KEYS = {
    LAST_INSIGHT_TIME: 'lastInsightGenerationTime',
    LAST_INSIGHT_TEXT: 'lastInsightText',
    PROCRASTINATION_MONITOR: 'procrastinationMonitorState',
    QUICK_WINS_COMPLETED: 'quickWinsCompletedState',
} as const;

/**
 * 시스템 상태 값 저장
 * @param key 상태 키
 * @param value 저장할 값
 */
export async function setSystemState(key: string, value: any): Promise<void> {
    try {
        await db.systemState.put({ key, value });
    } catch (error) {
        console.error(`Failed to set system state for key "${key}":`, error);
    }
}

/**
 * 시스템 상태 값 조회
 * @param key 상태 키
 * @returns 저장된 값 또는 undefined
 */
export async function getSystemState<T>(key: string): Promise<T | undefined> {
    try {
        const record = await db.systemState.get(key);
        return record?.value as T;
    } catch (error) {
        console.error(`Failed to get system state for key "${key}":`, error);
        return undefined;
    }
}

/**
 * 시스템 상태 값 삭제
 * @param key 상태 키
 */
export async function deleteSystemState(key: string): Promise<void> {
    try {
        await db.systemState.delete(key);
    } catch (error) {
        console.error(`Failed to delete system state for key "${key}":`, error);
    }
}

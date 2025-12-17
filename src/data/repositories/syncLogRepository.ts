/**
 * syncLogRepository.ts
 *
 * @role 동기화 로그 영속화 관리
 * @description systemState 테이블을 사용하여 동기화 로그 저장/조회
 */

import { db } from '../db/dexieClient';
import { SYSTEM_KEYS } from './systemRepository';

export type SyncType = 'dexie' | 'firebase';
export type SyncAction = 'save' | 'load' | 'sync' | 'error' | 'retry' | 'info';

export interface SyncLogEntry {
    id: string;
    timestamp: number;
    type: SyncType;
    action: SyncAction;
    message: string;
    data?: string;
    error?: string;
}

/**
 * 동기화 로그 조회
 */
export async function getSyncLogs(): Promise<SyncLogEntry[]> {
    try {
        const record = await db.systemState.get(SYSTEM_KEYS.SYNC_LOGS);
        if (!record || !record.value) return [];
        return record.value as SyncLogEntry[];
    } catch (error) {
        console.error('Failed to load sync logs from Dexie:', error);
        return [];
    }
}

/**
 * 동기화 로그 저장
 */
export async function saveSyncLogs(logs: SyncLogEntry[]): Promise<void> {
    try {
        await db.systemState.put({ key: SYSTEM_KEYS.SYNC_LOGS, value: logs });
    } catch (error) {
        console.error('Failed to save sync logs to Dexie:', error);
    }
}

/**
 * 디바이스 ID 조회
 */
export async function getDeviceIdFromDb(): Promise<string | undefined> {
    try {
        const record = await db.systemState.get(SYSTEM_KEYS.DEVICE_ID);
        return record?.value as string | undefined;
    } catch (error) {
        console.warn('Failed to load deviceId from Dexie:', error);
        return undefined;
    }
}

/**
 * 디바이스 ID 저장
 */
export async function saveDeviceIdToDb(deviceId: string): Promise<void> {
    try {
        await db.systemState.put({ key: SYSTEM_KEYS.DEVICE_ID, value: deviceId });
    } catch (error) {
        console.warn('Failed to save deviceId to Dexie:', error);
    }
}

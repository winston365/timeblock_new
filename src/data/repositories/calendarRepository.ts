/**
 * calendarRepository.ts
 *
 * @role Google Calendar 설정 및 매핑 데이터 영속화 관리
 * @description systemState 및 taskCalendarMappings 테이블 접근 제공
 */

import { db } from '../db/dexieClient';
import { SYSTEM_KEYS } from './systemRepository';

export interface GoogleCalendarSettings {
    enabled: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    calendarId?: string;
    email?: string;
    clientId?: string;
    clientSecret?: string;
}

export interface TaskCalendarMapping {
    taskId: string;
    eventId: string;
    calendarId: string;
    lastSyncedAt: number;
}

/**
 * Google Calendar 설정 로드
 */
export async function getGoogleCalendarSettings(): Promise<GoogleCalendarSettings | null> {
    try {
        const record = await db.systemState.get(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS);
        return record?.value as GoogleCalendarSettings | null;
    } catch (error) {
        console.error('[CalendarRepository] Failed to load settings:', error);
        return null;
    }
}

/**
 * Google Calendar 설정 저장
 */
export async function saveGoogleCalendarSettings(settings: GoogleCalendarSettings): Promise<void> {
    try {
        await db.systemState.put({ key: SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS, value: settings });
    } catch (error) {
        console.error('[CalendarRepository] Failed to save settings:', error);
        throw error;
    }
}

/**
 * Google Calendar 연동 해제
 */
export async function disconnectGoogleCalendar(): Promise<void> {
    try {
        await db.systemState.put({
            key: SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS,
            value: { enabled: false } as GoogleCalendarSettings,
        });
        await db.table('taskCalendarMappings').clear();
    } catch (error) {
        console.error('[CalendarRepository] Failed to disconnect:', error);
        throw error;
    }
}

/**
 * 작업-캘린더 매핑 조회
 */
export async function getTaskCalendarMapping(taskId: string): Promise<TaskCalendarMapping | undefined> {
    try {
        return await db.table('taskCalendarMappings').get(taskId);
    } catch (error) {
        console.error('[CalendarRepository] Failed to get mapping:', error);
        return undefined;
    }
}

/**
 * 작업-캘린더 매핑 저장
 */
export async function saveTaskCalendarMapping(mapping: TaskCalendarMapping): Promise<void> {
    try {
        await db.table('taskCalendarMappings').put(mapping);
    } catch (error) {
        console.error('[CalendarRepository] Failed to save mapping:', error);
        throw error;
    }
}

/**
 * 작업-캘린더 매핑 삭제
 */
export async function deleteTaskCalendarMapping(taskId: string): Promise<void> {
    try {
        await db.table('taskCalendarMappings').delete(taskId);
    } catch (error) {
        console.error('[CalendarRepository] Failed to delete mapping:', error);
    }
}

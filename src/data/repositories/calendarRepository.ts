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
    // Legacy fields (읽기 호환용)
    expiresAt?: number;
    accessTokenExpiry?: number;
    accessTokenExpiresAt?: number;
    calendarId?: string;
    email?: string;
    clientId?: string;
    clientSecret?: string;

    // Current fields
    tokenExpiresAt?: number;
    userEmail?: string;
    lastSyncAt?: number;
}

function normalizeGoogleCalendarSettings(raw: unknown): {
    normalized: GoogleCalendarSettings | null;
    didChange: boolean;
} {
    if (!raw || typeof raw !== 'object') {
        return { normalized: null, didChange: false };
    }

    const value = raw as Partial<GoogleCalendarSettings> & {
        tokenExpiresAt?: unknown;
        userEmail?: unknown;
        expiresAt?: unknown;
        accessTokenExpiry?: unknown;
        accessTokenExpiresAt?: unknown;
        email?: unknown;
    };

    const enabled = value.enabled;
    if (typeof enabled !== 'boolean') {
        return { normalized: null, didChange: false };
    }

    const coerceEpochMillis = (input: unknown): { value?: number; didCoerce: boolean } => {
        if (input === null || input === undefined) {
            return { value: undefined, didCoerce: false };
        }

        let parsed: number | undefined;
        let didCoerce = false;

        if (typeof input === 'number' && Number.isFinite(input)) {
            parsed = input;
        } else if (typeof input === 'string') {
            const trimmed = input.trim();
            if (trimmed.length === 0) return { value: undefined, didCoerce: false };
            const asNumber = Number(trimmed);
            if (!Number.isFinite(asNumber)) return { value: undefined, didCoerce: false };
            parsed = asNumber;
            didCoerce = true;
        } else {
            return { value: undefined, didCoerce: false };
        }

        // Heuristic: seconds epoch is typically < 1e12 (ms epoch ~ 1.7e12 in 2025)
        if (parsed < 1e12) {
            parsed = parsed * 1000;
            didCoerce = true;
        }

        return { value: parsed, didCoerce };
    };

    const legacyExpiresAtRaw =
        value.expiresAt ?? value.accessTokenExpiry ?? value.accessTokenExpiresAt;
    const legacyExpiresAtCoerced = coerceEpochMillis(legacyExpiresAtRaw);

    const currentTokenExpiresAtCoerced = coerceEpochMillis(value.tokenExpiresAt);
    const legacyEmail = typeof value.email === 'string' ? value.email : undefined;
    const currentUserEmail = typeof value.userEmail === 'string' ? value.userEmail : undefined;

    const tokenExpiresAt = currentTokenExpiresAtCoerced.value ?? legacyExpiresAtCoerced.value;
    const userEmail = currentUserEmail ?? legacyEmail;

    const normalized: GoogleCalendarSettings = {
        enabled,
        accessToken: typeof value.accessToken === 'string' ? value.accessToken : undefined,
        refreshToken: typeof value.refreshToken === 'string' ? value.refreshToken : undefined,
        calendarId: typeof value.calendarId === 'string' ? value.calendarId : undefined,
        clientId: typeof value.clientId === 'string' ? value.clientId : undefined,
        clientSecret: typeof value.clientSecret === 'string' ? value.clientSecret : undefined,
        lastSyncAt: typeof value.lastSyncAt === 'number' ? value.lastSyncAt : undefined,
        tokenExpiresAt,
        userEmail,
    };

    const hadLegacyKeys =
        value.expiresAt !== undefined ||
        value.accessTokenExpiry !== undefined ||
        value.accessTokenExpiresAt !== undefined ||
        value.email !== undefined;

    const filledFromLegacy =
        legacyExpiresAtCoerced.value !== undefined && currentTokenExpiresAtCoerced.value === undefined;

    const didChange =
        hadLegacyKeys ||
        filledFromLegacy ||
        (legacyEmail !== undefined && currentUserEmail === undefined) ||
        legacyExpiresAtCoerced.didCoerce ||
        currentTokenExpiresAtCoerced.didCoerce;

    return { normalized, didChange };
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
        const { normalized, didChange } = normalizeGoogleCalendarSettings(record?.value);
        if (!normalized) {
            return null;
        }

        // 레거시 필드(expiresAt/email) → 현행(tokenExpiresAt/userEmail) 자체 마이그레이션(write-back)
        if (didChange) {
            try {
                await db.systemState.put({
                    key: SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS,
                    value: normalized,
                });
            } catch (error) {
                console.warn('[CalendarRepository] Failed to write-back normalized settings:', error);
            }
        }

        return normalized;
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
        const { normalized } = normalizeGoogleCalendarSettings(settings);
        await db.systemState.put({
            key: SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS,
            value: normalized ?? settings,
        });
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

// ============================================================================
// Generic Calendar Mapping (Task + TempSchedule 공용)
// ============================================================================

export type CalendarMappingTable = 'taskCalendarMappings' | 'tempScheduleCalendarMappings';

export interface GenericCalendarMapping {
    taskId: string;         // Task ID 또는 TempSchedule ID
    calendarEventId: string;
    date: string;
    lastSyncedAt: number;
    syncStatus: 'synced' | 'pending' | 'error';
}

/**
 * Generic 매핑 조회
 */
export async function getCalendarMappingGeneric(
    mappingId: string,
    table: CalendarMappingTable
): Promise<GenericCalendarMapping | undefined> {
    try {
        return await db.table(table).get(mappingId);
    } catch (error) {
        console.error(`[CalendarRepository] Failed to get mapping from ${table}:`, error);
        return undefined;
    }
}

/**
 * Generic 매핑 저장
 */
export async function saveCalendarMappingGeneric(
    mapping: GenericCalendarMapping,
    table: CalendarMappingTable
): Promise<void> {
    try {
        await db.table(table).put(mapping);
    } catch (error) {
        console.error(`[CalendarRepository] Failed to save mapping to ${table}:`, error);
        throw error;
    }
}

/**
 * Generic 매핑 삭제
 */
export async function deleteCalendarMappingGeneric(
    mappingId: string,
    table: CalendarMappingTable
): Promise<void> {
    try {
        await db.table(table).delete(mappingId);
    } catch (error) {
        console.error(`[CalendarRepository] Failed to delete mapping from ${table}:`, error);
    }
}

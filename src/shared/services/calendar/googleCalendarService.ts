/**
 * Google Calendar Service
 *
 * @role Google Calendar API 호출을 위한 서비스 레이어
 * @responsibilities
 *   - OAuth 2.0 인증 (Authorization Code Flow with PKCE, Refresh Token 지원)
 *   - Calendar 이벤트 CRUD
 *   - Task ↔ Calendar Event 변환
 * @external_dependencies
 *   - Google Calendar API v3
 *   - Dexie (토큰 저장)
 *   - Electron IPC (OAuth 처리)
 */

import { db } from '@/data/db/dexieClient';
import type { Task } from '@/shared/types/domain';
import {
  type GoogleCalendarEvent,
  type GoogleCalendarSettings,
  type TaskCalendarMapping,
  GOOGLE_CALENDAR_API_BASE,
  RESISTANCE_TO_CALENDAR_COLOR,
  COMPLETED_TASK_COLOR,
} from './googleCalendarTypes';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'googleCalendarSettings';
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5분 전에 토큰 갱신

// ============================================================================
// Settings 관리
// ============================================================================

/**
 * Google Calendar 설정 로드
 */
export async function getGoogleCalendarSettings(): Promise<GoogleCalendarSettings | null> {
  try {
    const record = await db.systemState.get(STORAGE_KEY);
    return record?.value as GoogleCalendarSettings | null;
  } catch (error) {
    console.error('[GoogleCalendar] Failed to load settings:', error);
    return null;
  }
}

/**
 * Google Calendar 설정 저장
 */
export async function saveGoogleCalendarSettings(settings: GoogleCalendarSettings): Promise<void> {
  try {
    await db.systemState.put({ key: STORAGE_KEY, value: settings });
  } catch (error) {
    console.error('[GoogleCalendar] Failed to save settings:', error);
    throw error;
  }
}

/**
 * Google Calendar 연동 해제
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  try {
    // 설정 초기화
    await db.systemState.put({
      key: STORAGE_KEY,
      value: { enabled: false } as GoogleCalendarSettings,
    });
    // 매핑 데이터 삭제
    await db.table('taskCalendarMappings').clear();
  } catch (error) {
    console.error('[GoogleCalendar] Failed to disconnect:', error);
    throw error;
  }
}

// ============================================================================
// OAuth 2.0 인증 (Electron Main Process 연동)
// ============================================================================

/**
 * Google OAuth 로그인 (Authorization Code Flow with PKCE)
 * Electron Main Process를 통해 시스템 브라우저로 인증
 * @param clientId - Google OAuth Client ID
 * @param clientSecret - Google OAuth Client Secret
 * @returns 인증 성공 여부 및 사용자 이메일
 */
export async function loginWithGoogle(clientId: string, clientSecret: string): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  try {
    // Electron 환경 확인
    if (!window.electronAPI?.googleOAuthLogin) {
      return { success: false, error: 'Electron 환경에서만 Google Calendar 연동이 가능합니다.' };
    }

    // OAuth 로그인 시작 (시스템 브라우저 열림)
    const startResult = await window.electronAPI.googleOAuthLogin(clientId, clientSecret);
    if (!startResult.success) {
      return { success: false, error: startResult.error || '로그인 시작 실패' };
    }

    // 콜백 대기 및 토큰 수신
    const callbackResult = await window.electronAPI.googleOAuthWaitCallback();
    if (!callbackResult.success) {
      return { success: false, error: callbackResult.error || '인증 콜백 처리 실패' };
    }

    // 설정 저장
    const settings: GoogleCalendarSettings = {
      enabled: true,
      accessToken: callbackResult.accessToken,
      refreshToken: callbackResult.refreshToken,
      tokenExpiresAt: Date.now() + (callbackResult.expiresIn || 3600) * 1000,
      calendarId: 'primary',
      userEmail: callbackResult.email,
      clientId,
      clientSecret,
      lastSyncAt: undefined,
    };
    await saveGoogleCalendarSettings(settings);

    return { success: true, email: callbackResult.email };
  } catch (error) {
    console.error('[GoogleCalendar] Login failed:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 토큰이 유효한지 확인 (만료 5분 전부터 갱신 필요)
 */
export async function isTokenValid(): Promise<boolean> {
  const settings = await getGoogleCalendarSettings();
  if (!settings?.enabled || !settings.accessToken || !settings.tokenExpiresAt) {
    return false;
  }
  return settings.tokenExpiresAt > Date.now() + TOKEN_REFRESH_BUFFER;
}

/**
 * Access Token 자동 갱신
 */
async function refreshAccessToken(): Promise<boolean> {
  const settings = await getGoogleCalendarSettings();
  if (!settings?.refreshToken || !settings.clientId || !settings.clientSecret) {
    console.warn('[GoogleCalendar] Cannot refresh: missing refresh token or credentials');
    return false;
  }

  // Electron 환경 확인
  if (!window.electronAPI?.googleOAuthRefresh) {
    console.warn('[GoogleCalendar] Cannot refresh: not in Electron environment');
    return false;
  }

  try {
    const result = await window.electronAPI.googleOAuthRefresh(
      settings.clientId,
      settings.clientSecret,
      settings.refreshToken
    );

    if (!result.success) {
      console.error('[GoogleCalendar] Token refresh failed:', result.error);
      return false;
    }

    // 새 토큰 저장
    await saveGoogleCalendarSettings({
      ...settings,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken || settings.refreshToken, // 회전된 refresh_token 보존
      tokenExpiresAt: Date.now() + (result.expiresIn || 3600) * 1000,
    });

    console.log('[GoogleCalendar] Token refreshed successfully');
    return true;
  } catch (error) {
    console.error('[GoogleCalendar] Token refresh error:', error);
    return false;
  }
}

// 외부 모듈(예: Google Tasks)에서 401 발생 시 재사용할 수 있도록 export
export async function refreshGoogleAccessTokenForRetry(): Promise<boolean> {
  return refreshAccessToken();
}

/**
 * 유효한 액세스 토큰 가져오기 (필요시 자동 갱신)
 */
export async function getValidAccessToken(): Promise<string | null> {
  const settings = await getGoogleCalendarSettings();
  if (!settings?.enabled || !settings.accessToken) {
    return null;
  }

  // 토큰이 곧 만료되면 갱신
  const expiresAt = settings.tokenExpiresAt;
  if (!expiresAt || expiresAt < Date.now() + TOKEN_REFRESH_BUFFER) {
    console.log('[GoogleCalendar] Token expiring soon, refreshing...');
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return null;
    }
    // 갱신된 설정 다시 로드
    const newSettings = await getGoogleCalendarSettings();
    return newSettings?.accessToken || null;
  }

  return settings.accessToken;
}

// ============================================================================
// Calendar API 호출
// ============================================================================

/**
 * API 호출 헬퍼
 */
async function callCalendarApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  let attemptedRefresh = false;

  const doRequest = async (): Promise<Response> => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      throw new Error('인증이 필요합니다. Google 계정에 다시 로그인해주세요.');
    }

    return fetch(`${GOOGLE_CALENDAR_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  };

  let response = await doRequest();

  // 401/invalid_grant 발생 시 한 번만 리프레시 후 재시도
  if (!response.ok && response.status === 401 && !attemptedRefresh) {
    attemptedRefresh = true;
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doRequest();
    }
  }

  if (!response.ok) {
    let errorMessage = `API 호출 실패: ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.error?.message || errorMessage;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  // DELETE 요청은 응답 본문이 없을 수 있음
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Task를 Google Calendar 이벤트로 변환
 */
export function taskToCalendarEvent(task: Task, date: string): GoogleCalendarEvent {
  // hourSlot이 없으면 timeBlock의 시작 시간 사용
  let startHour = task.hourSlot ?? 9;

  // timeBlock에서 시작 시간 추출 (예: '8-11' -> 8)
  if (!task.hourSlot && task.timeBlock) {
    const match = task.timeBlock.match(/^(\d+)-/);
    if (match) {
      startHour = parseInt(match[1], 10);
    }
  }

  const startTime = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`);
  const endTime = new Date(startTime.getTime() + task.adjustedDuration * 60 * 1000);

  // 설명 생성 (메모 + 메타데이터)
  const descriptionParts: string[] = [];
  if (task.memo) {
    descriptionParts.push(task.memo);
  }
  descriptionParts.push('');
  descriptionParts.push('─────────────────');
  descriptionParts.push(`📊 난이도: ${getResistanceLabel(task.resistance)}`);
  descriptionParts.push(`⏱️ 예상 시간: ${task.adjustedDuration}분`);
  if (task.goalId) {
    descriptionParts.push(`🎯 목표 연결됨`);
  }
  if (task.completed) {
    descriptionParts.push(`✅ 완료됨 (${task.completedAt ? new Date(task.completedAt).toLocaleTimeString('ko-KR') : ''})`);
    if (task.actualDuration > 0) {
      descriptionParts.push(`📏 실제 소요: ${task.actualDuration}분`);
    }
  }
  descriptionParts.push('');
  descriptionParts.push('📱 TimeBlock Planner에서 생성됨');

  return {
    summary: `${task.emoji || '📌'} ${task.text}`,
    description: descriptionParts.join('\n'),
    start: {
      dateTime: startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    colorId: task.completed ? COMPLETED_TASK_COLOR : RESISTANCE_TO_CALENDAR_COLOR[task.resistance],
    extendedProperties: {
      private: {
        taskId: task.id,
        appSource: 'timeblock-planner',
        resistance: task.resistance,
      },
    },
  };
}

/**
 * 난이도 라벨 반환
 */
function getResistanceLabel(resistance: string): string {
  switch (resistance) {
    case 'low': return '🟢 쉬움';
    case 'medium': return '🟡 보통';
    case 'high': return '🔴 어려움';
    default: return resistance;
  }
}

// ============================================================================
// Calendar 이벤트 CRUD
// ============================================================================

/**
 * Generic Event 생성 (Task 외의 용도)
 */
export async function createCalendarEventGeneric(
  event: GoogleCalendarEvent,
  mappingId: string,
  mappingTable: 'taskCalendarMappings' | 'tempScheduleCalendarMappings'
): Promise<GoogleCalendarEvent> {
  const settings = await getGoogleCalendarSettings();
  const calendarId = settings?.calendarId || 'primary';

  const createdEvent = await callCalendarApi<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify(event),
    }
  );

  // 매핑 저장
  await db.table(mappingTable).put({
    taskId: mappingId, // taskId 컬럼을 ID로 사용 (TempSchedule ID 포함)
    calendarEventId: createdEvent.id!,
    date: event.start.dateTime?.split('T')[0] || '',
    lastSyncedAt: Date.now(),
    syncStatus: 'synced',
  });

  return createdEvent;
}

/**
 * Generic Event 업데이트
 */
export async function updateCalendarEventGeneric(
  event: GoogleCalendarEvent,
  mappingId: string,
  mappingTable: 'taskCalendarMappings' | 'tempScheduleCalendarMappings'
): Promise<GoogleCalendarEvent | null> {
  const mapping = await db.table(mappingTable).get(mappingId);
  if (!mapping) {
    return createCalendarEventGeneric(event, mappingId, mappingTable);
  }

  const settings = await getGoogleCalendarSettings();
  const calendarId = settings?.calendarId || 'primary';

  try {
    const updatedEvent = await callCalendarApi<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(mapping.calendarEventId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(event),
      }
    );

    await db.table(mappingTable).put({
      ...mapping,
      lastSyncedAt: Date.now(),
      syncStatus: 'synced',
    });

    return updatedEvent;
  } catch (error) {
    if ((error as Error).message.includes('404')) {
      await db.table(mappingTable).delete(mappingId);
      return createCalendarEventGeneric(event, mappingId, mappingTable);
    }
    throw error;
  }
}

/**
 * Generic Event 삭제
 */
export async function deleteCalendarEventGeneric(
  mappingId: string,
  mappingTable: 'taskCalendarMappings' | 'tempScheduleCalendarMappings'
): Promise<void> {
  const mapping = await db.table(mappingTable).get(mappingId);
  if (!mapping) return;

  const settings = await getGoogleCalendarSettings();
  const calendarId = settings?.calendarId || 'primary';

  try {
    await callCalendarApi(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(mapping.calendarEventId)}`,
      { method: 'DELETE' }
    );
  } catch (error) {
    if (!(error as Error).message.includes('404')) {
      throw error;
    }
  }

  await db.table(mappingTable).delete(mappingId);
}

// ... existing functions

// ============================================================================
// 동기화 상태 확인
// ============================================================================

/**
 * Google Calendar 연동 활성화 여부 확인
 */
export async function isGoogleCalendarEnabled(): Promise<boolean> {
  const settings = await getGoogleCalendarSettings();
  return settings?.enabled === true && !!settings.accessToken;
}

/**
 * 마지막 동기화 시간 업데이트
 */
export async function updateLastSyncTime(): Promise<void> {
  const settings = await getGoogleCalendarSettings();
  if (settings) {
    await saveGoogleCalendarSettings({
      ...settings,
      lastSyncAt: Date.now(),
    });
  }
}

// ============================================================================
// Legacy / Migration Wrappers
// ============================================================================

export async function createCalendarEvent(task: Task, date: string): Promise<GoogleCalendarEvent> {
  const event = taskToCalendarEvent(task, date);
  return createCalendarEventGeneric(event, task.id, 'taskCalendarMappings');
}

export async function updateCalendarEvent(task: Task, date: string): Promise<GoogleCalendarEvent | null> {
  const event = taskToCalendarEvent(task, date);
  return updateCalendarEventGeneric(event, task.id, 'taskCalendarMappings');
}

export async function deleteCalendarEvent(taskId: string): Promise<void> {
  return deleteCalendarEventGeneric(taskId, 'taskCalendarMappings');
}

export async function getTaskCalendarMapping(taskId: string): Promise<TaskCalendarMapping | undefined> {
  return db.table('taskCalendarMappings').get(taskId);
}

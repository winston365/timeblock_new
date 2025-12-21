import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  SYSTEM_KEYS,
  setSystemState,
  getSystemState,
  deleteSystemState,
} from '@/data/repositories/systemRepository';
import {
  getGoogleCalendarSettings as getRepoSettings,
  saveTaskCalendarMapping,
  deleteTaskCalendarMapping,
  deleteCalendarMappingGeneric,
} from '@/data/repositories/calendarRepository';
import {
  getValidAccessToken,
  createCalendarEventGeneric,
} from '@/shared/services/calendar/googleCalendarService';
import type { GoogleCalendarEvent } from '@/shared/services/calendar/googleCalendarTypes';
import { deleteGoogleTask } from '@/shared/services/calendar/googleTasksService';

type ElectronAPI = {
  googleOAuthRefresh?: (...args: unknown[]) => unknown;
};

function setElectronApiRefresh(mockImpl: (...args: unknown[]) => unknown) {
  const globalWithWindow = globalThis as unknown as {
    window?: { electronAPI?: ElectronAPI };
  };

  globalWithWindow.window = globalWithWindow.window ?? {};
  globalWithWindow.window.electronAPI = {
    googleOAuthRefresh: mockImpl,
  };
}

beforeEach(async () => {
  vi.restoreAllMocks();

  // 각 테스트를 저장소 레벨에서 초기화 (Dexie 직접 접근 금지 규칙 준수)
  await deleteSystemState(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS);
  await deleteTaskCalendarMapping('t1');
  await deleteCalendarMappingGeneric('m1', 'tempScheduleCalendarMappings');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Google Calendar token refresh stability', () => {
  it('normalizes legacy googleCalendarSettings (expiresAt/email -> tokenExpiresAt/userEmail) with write-back', async () => {
    const legacy = {
      enabled: true,
      accessToken: 'a',
      refreshToken: 'r',
      // 레거시/변종 필드: string + seconds epoch
      accessTokenExpiresAt: '1730000000',
      email: 'user@example.com',
      clientId: 'cid',
      clientSecret: 'csec',
    };

    await setSystemState(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS, legacy);

    const settings = await getRepoSettings();
    expect(settings?.tokenExpiresAt).toBe(1730000000 * 1000);
    expect(settings?.userEmail).toBe('user@example.com');

    const stored = await getSystemState<Record<string, unknown>>(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS);
    expect(stored?.tokenExpiresAt).toBe(1730000000 * 1000);
    expect(stored?.userEmail).toBe('user@example.com');
    expect(stored?.expiresAt).toBeUndefined();
    expect(stored?.accessTokenExpiry).toBeUndefined();
    expect(stored?.accessTokenExpiresAt).toBeUndefined();
    expect(stored?.email).toBeUndefined();
  });

  it('uses a single in-flight refresh and refreshes when accessToken is missing but refreshToken exists', async () => {
    await setSystemState(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS, {
      enabled: true,
      refreshToken: 'rt',
      clientId: 'cid',
      clientSecret: 'csec',
      tokenExpiresAt: Date.now() + 60 * 60 * 1000,
      calendarId: 'primary',
    });

    const refreshMock = vi.fn(async () => {
      // 동시 호출 경쟁 상태를 더 잘 드러내기 위해 microtask로 한 번 미룸
      await Promise.resolve();
      return {
        success: true,
        accessToken: 'new_access',
        refreshToken: 'rt_rotated',
        expiresIn: 3600,
      };
    });

    setElectronApiRefresh(refreshMock);

    const [t1, t2, t3] = await Promise.all([
      getValidAccessToken(),
      getValidAccessToken(),
      getValidAccessToken(),
    ]);

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect([t1, t2, t3]).toEqual(['new_access', 'new_access', 'new_access']);

    const stored = await getSystemState<Record<string, unknown>>(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS);
    expect(stored?.accessToken).toBe('new_access');
    expect(stored?.refreshToken).toBe('rt_rotated');
    expect(typeof stored?.tokenExpiresAt).toBe('number');
  });

  it('retries once on 401 for Calendar API calls after refresh', async () => {
    await setSystemState(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS, {
      enabled: true,
      accessToken: 'old_access',
      refreshToken: 'rt',
      // tokenExpiresAt 누락(레거시/부분 저장)이어도 선제 refresh 없이 호출하고,
      // 401에서 refresh+retry로 복구해야 한다.
      clientId: 'cid',
      clientSecret: 'csec',
      calendarId: 'primary',
    });

    setElectronApiRefresh(
      vi.fn(async () => ({
        success: true,
        accessToken: 'new_access',
        refreshToken: 'rt',
        expiresIn: 3600,
      }))
    );

    const getAuthorizationHeader = (headers: HeadersInit | undefined): string | undefined => {
      if (!headers) return undefined;
      if (headers instanceof Headers) return headers.get('Authorization') ?? undefined;
      if (Array.isArray(headers)) {
        return headers.find(([k]) => k.toLowerCase() === 'authorization')?.[1];
      }
      return headers['Authorization'] ?? headers['authorization'];
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      const auth = getAuthorizationHeader(init?.headers);

      // 첫 Calendar 호출은 401
      if (urlStr.includes('googleapis.com/calendar') && auth === 'Bearer old_access') {
        return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 리프레시 후 재시도는 200
      if (urlStr.includes('googleapis.com/calendar') && auth === 'Bearer new_access') {
        return new Response(JSON.stringify({ id: 'evt1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch call: ${urlStr} auth=${String(auth)}`);
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const event: GoogleCalendarEvent = {
      summary: 'test',
      start: { dateTime: new Date().toISOString(), timeZone: 'UTC' },
      end: { dateTime: new Date(Date.now() + 60_000).toISOString(), timeZone: 'UTC' },
    };

    const created = await createCalendarEventGeneric(event, 'm1', 'tempScheduleCalendarMappings');
    expect(created.id).toBe('evt1');

    // old token 1회 + new token 1회
    const calendarCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('googleapis.com/calendar'));
    expect(calendarCalls.length).toBe(2);
  });

  it('retries once on 401 for Tasks API calls after refresh (via deleteGoogleTask)', async () => {
    await setSystemState(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS, {
      enabled: true,
      accessToken: 'old_access',
      refreshToken: 'rt',
      tokenExpiresAt: Date.now() + 60 * 60 * 1000,
      clientId: 'cid',
      clientSecret: 'csec',
      calendarId: 'primary',
    });

    // deleteGoogleTask가 mapping을 요구하므로 레거시 매핑 형태로 삽입
    await saveTaskCalendarMapping({
      taskId: 't1',
      eventId: 'task123',
      calendarId: 'list1',
      lastSyncedAt: Date.now(),
    });

    const refreshMock = vi.fn(async () => ({
      success: true,
      accessToken: 'new_access',
      refreshToken: 'rt',
      expiresIn: 3600,
    }));
    setElectronApiRefresh(refreshMock);

    let tasksCallCount = 0;

    const getAuthorizationHeader = (headers: HeadersInit | undefined): string | undefined => {
      if (!headers) return undefined;
      if (headers instanceof Headers) return headers.get('Authorization') ?? undefined;
      if (Array.isArray(headers)) {
        return headers.find(([k]) => k.toLowerCase() === 'authorization')?.[1];
      }
      return headers['Authorization'] ?? headers['authorization'];
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      const auth = getAuthorizationHeader(init?.headers);

      // Calendar 삭제는 그냥 성공 처리(204)
      if (urlStr.includes('googleapis.com/calendar')) {
        return new Response(null, { status: 204 });
      }

      if (urlStr.includes('tasks.googleapis.com/tasks')) {
        tasksCallCount += 1;

        if (tasksCallCount === 1) {
          expect(auth).toBe('Bearer old_access');
          return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        expect(auth).toBe('Bearer new_access');
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${urlStr}`);
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    await deleteGoogleTask('t1');

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(tasksCallCount).toBe(2);

    await deleteTaskCalendarMapping('t1');
  });
});

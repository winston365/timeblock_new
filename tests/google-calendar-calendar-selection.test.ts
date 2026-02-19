import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SYSTEM_KEYS,
  deleteSystemState,
  setSystemState,
} from '@/data/repositories/systemRepository';
import {
  deleteCalendarMappingGeneric,
  saveCalendarMappingGeneric,
} from '@/data/repositories/calendarRepository';
import {
  createCalendarEventGeneric,
  deleteCalendarEventGeneric,
  fetchGoogleCalendarList,
  updateCalendarEventGeneric,
} from '@/shared/services/calendar/googleCalendarService';
import type { GoogleCalendarEvent } from '@/shared/services/calendar/googleCalendarTypes';

type ElectronAPI = {
  googleOAuthRefresh?: (...args: unknown[]) => unknown;
};

const getAuthorizationHeader = (headers: HeadersInit | undefined): string | undefined => {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    return headers.get('Authorization') ?? undefined;
  }
  if (Array.isArray(headers)) {
    return headers.find(([key]) => key.toLowerCase() === 'authorization')?.[1];
  }

  return headers['Authorization'] ?? headers['authorization'];
};

const setElectronApiRefresh = (mockImpl: (...args: unknown[]) => unknown): void => {
  const globalWithWindow = globalThis as unknown as {
    window?: { electronAPI?: ElectronAPI };
  };

  globalWithWindow.window = globalWithWindow.window ?? {};
  globalWithWindow.window.electronAPI = {
    googleOAuthRefresh: mockImpl,
  };
};

const sampleEvent: GoogleCalendarEvent = {
  summary: 'Calendar selection test',
  start: { dateTime: new Date().toISOString(), timeZone: 'UTC' },
  end: { dateTime: new Date(Date.now() + 60_000).toISOString(), timeZone: 'UTC' },
};

beforeEach(async () => {
  vi.restoreAllMocks();
  await deleteSystemState(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS);
  await deleteCalendarMappingGeneric('m-create', 'tempScheduleCalendarMappings');
  await deleteCalendarMappingGeneric('m-update', 'tempScheduleCalendarMappings');
  await deleteCalendarMappingGeneric('m-delete', 'tempScheduleCalendarMappings');
});

describe('Google Calendar calendar selection', () => {
  it('fetches calendar list with token refresh retry and returns minimal list', async () => {
    await setSystemState(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS, {
      enabled: true,
      accessToken: 'old_access',
      refreshToken: 'rt',
      clientId: 'cid',
      clientSecret: 'secret',
      calendarId: 'primary',
    });

    const refreshMock = vi.fn(async () => ({
      success: true,
      accessToken: 'new_access',
      refreshToken: 'rt',
      expiresIn: 3600,
    }));
    setElectronApiRefresh(refreshMock);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = getAuthorizationHeader(init?.headers);

      if (url.includes('/users/me/calendarList') && authorization === 'Bearer old_access') {
        return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/users/me/calendarList') && authorization === 'Bearer new_access') {
        return new Response(
          JSON.stringify({
            items: [
              { id: 'primary', summary: 'Personal', primary: true, accessRole: 'owner', kind: 'x' },
              { id: 'team-calendar', summary: 'Team Shared', accessRole: 'writer' },
              { id: '', summary: 'Invalid item should be ignored' },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const calendars = await fetchGoogleCalendarList();

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(calendars).toEqual([
      {
        id: 'primary',
        summary: 'Personal',
        primary: true,
        accessRole: 'owner',
      },
      {
        id: 'team-calendar',
        summary: 'Team Shared',
        accessRole: 'writer',
      },
    ]);
  });

  it('uses selected calendarId for create, update, and delete event endpoints', async () => {
    const selectedCalendarId = 'team-calendar@group.calendar.google.com';

    await setSystemState(SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS, {
      enabled: true,
      accessToken: 'valid_access',
      refreshToken: 'rt',
      tokenExpiresAt: Date.now() + 60 * 60 * 1000,
      clientId: 'cid',
      clientSecret: 'secret',
      calendarId: selectedCalendarId,
    });

    await saveCalendarMappingGeneric(
      {
        taskId: 'm-update',
        calendarEventId: 'evt-update',
        date: '2026-02-19',
        lastSyncedAt: Date.now(),
        syncStatus: 'synced',
      },
      'tempScheduleCalendarMappings'
    );

    await saveCalendarMappingGeneric(
      {
        taskId: 'm-delete',
        calendarEventId: 'evt-delete',
        date: '2026-02-19',
        lastSyncedAt: Date.now(),
        syncStatus: 'synced',
      },
      'tempScheduleCalendarMappings'
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (method === 'POST' && url.includes('/events')) {
        return new Response(JSON.stringify({ id: 'evt-create' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'PUT' && url.includes('/events/evt-update')) {
        return new Response(JSON.stringify({ id: 'evt-update' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'DELETE' && url.includes('/events/evt-delete')) {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    await createCalendarEventGeneric(sampleEvent, 'm-create', 'tempScheduleCalendarMappings');
    await updateCalendarEventGeneric(sampleEvent, 'm-update', 'tempScheduleCalendarMappings');
    await deleteCalendarEventGeneric('m-delete', 'tempScheduleCalendarMappings');

    const calendarUrls = fetchMock.mock.calls.map(([url]) => String(url));
    const encodedCalendarId = encodeURIComponent(selectedCalendarId);

    expect(calendarUrls).toHaveLength(3);
    expect(calendarUrls[0]).toContain(`/calendars/${encodedCalendarId}/events`);
    expect(calendarUrls[1]).toContain(`/calendars/${encodedCalendarId}/events/evt-update`);
    expect(calendarUrls[2]).toContain(`/calendars/${encodedCalendarId}/events/evt-delete`);
  });
});

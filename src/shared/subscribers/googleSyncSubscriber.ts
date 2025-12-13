/**
 * @file googleSyncSubscriber.ts
 * @module shared/subscribers
 *
 * @description Google Sync Subscriber
 * - Temp Schedule -> Google Calendar Events
 * - Main Schedule -> Google Calendar Events (Tasks도 일정으로 저장)
 *
 * @role EventBus를 통해 이벤트를 수신하고 Google 서비스와 동기화
 *
 * @responsibilities
 * - tempSchedule:* 이벤트 수신 → Calendar 이벤트 CRUD
 * - task:* 이벤트 수신 → Google Task CRUD
 * - Migration: 기존 Task가 Calendar 이벤트로 존재하면 삭제하고 Google Task로 생성
 */

import { eventBus } from '@/shared/lib/eventBus';
import {
  isGoogleCalendarEnabled,
  createCalendarEventGeneric,
  updateCalendarEventGeneric,
  deleteCalendarEventGeneric,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent, // For migration
  updateLastSyncTime,
} from '@/shared/services/calendar/googleCalendarService';
import {
  deleteGoogleTask,
} from '@/shared/services/calendar/googleTasksService';
import type { Task } from '@/shared/types/domain';
import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import type { GoogleCalendarEvent } from '@/shared/services/calendar/googleCalendarTypes';
import { getLocalDate, minutesToTimeStr } from '@/shared/lib/utils';
import { db } from '@/data/db/dexieClient';

// 중복 동기화 방지용 Set
const pendingSyncs = new Set<string>();

/**
 * Google Sync Subscriber 초기화
 */
export function initGoogleSyncSubscriber(): void {
  // ==========================================================================
  // 1. Temp Schedule -> Google Calendar Events
  // ==========================================================================

  eventBus.on('tempSchedule:created', async ({ task }) => {
    await handleTempScheduleSync(task, 'create');
  });

  eventBus.on('tempSchedule:updated', async ({ task }) => {
    await handleTempScheduleSync(task, 'update');
  });

  eventBus.on('tempSchedule:deleted', async ({ task }) => {
    await handleTempScheduleSync(task, 'delete');
  });

  // ==========================================================================
  // 2. Main Schedule -> Google Tasks
  // ==========================================================================

  eventBus.on('task:created', async ({ taskId }) => {
    await handleTaskSync(taskId, 'create');
  });

  eventBus.on('task:updated', async ({ taskId }) => {
    await handleTaskSync(taskId, 'update');
  });

  eventBus.on('task:completed', async ({ taskId }) => {
    await handleTaskSync(taskId, 'update');
  });

  eventBus.on('task:deleted', async ({ taskId }) => {
    await handleTaskSync(taskId, 'delete');
  });
}

// ============================================================================
// Temp Schedule Handlers
// ============================================================================

async function handleTempScheduleSync(task: TempScheduleTask, action: 'create' | 'update' | 'delete') {
  try {
    const enabled = await isGoogleCalendarEnabled();
    if (!enabled) return;

    // 중복 방지
    const syncKey = `temp:${task.id}`;
    if (pendingSyncs.has(syncKey)) return;
    pendingSyncs.add(syncKey);

    try {
      if (action === 'delete') {
        await deleteCalendarEventGeneric(task.id, 'tempScheduleCalendarMappings');
      } else {
        const event = tempToCalendarEvent(task);
        if (action === 'create') {
          await createCalendarEventGeneric(event, task.id, 'tempScheduleCalendarMappings');
        } else {
          await updateCalendarEventGeneric(event, task.id, 'tempScheduleCalendarMappings');
        }
      }

      await updateLastSyncTime();
    } finally {
      pendingSyncs.delete(syncKey);
    }
  } catch (error) {
    console.error(`[GoogleSync] Failed to sync temp schedule (${action}):`, error);
  }
}

function tempToCalendarEvent(task: TempScheduleTask): GoogleCalendarEvent {
  const date = task.scheduledDate || getLocalDate();
  const startTimeStr = minutesToTimeStr(task.startTime);
  const endTimeStr = minutesToTimeStr(task.endTime);
  const startTime = new Date(`${date}T${startTimeStr}:00`);
  const endTime = new Date(`${date}T${endTimeStr}:00`);

  return {
    summary: `[임시] ${task.name}`,
    description: task.memo || '',
    start: {
      dateTime: startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    colorId: '8', // Grey color for temp schedule
    extendedProperties: {
      private: {
        taskId: task.id,
        appSource: 'timeblock-planner',
        type: 'temp-schedule',
      },
    },
  };
}

// ============================================================================
// Main Task Handlers
// ============================================================================

async function handleTaskSync(taskId: string, action: 'create' | 'update' | 'delete') {
  try {
    const enabled = await isGoogleCalendarEnabled();
    if (!enabled) return;

    // 중복 방지
    const syncKey = `task:${taskId}`;
    if (pendingSyncs.has(syncKey)) return;
    pendingSyncs.add(syncKey);

    try {
      if (action === 'delete') {
        await deleteCalendarEvent(taskId);
        // 혹시 모를 Google Task도 삭제 (Cleanup)
        await deleteGoogleTask(taskId);
        return;
      }

      const task = await getTaskById(taskId);
      if (!task) return;

      // Reverse Migration: Google Task가 있다면 삭제
      // (이전에 Google Tasks로 동기화된 항목이 있을 수 있음)
      try {
        await deleteGoogleTask(taskId);
      } catch (e) {
        // Ignore error if task doesn't exist
      }

      const date = task.scheduledDate || getLocalDate();

      if (action === 'create') {
        await createCalendarEvent(task, date);
      } else {
        await updateCalendarEvent(task, date);
      }

      await updateLastSyncTime();
    } finally {
      pendingSyncs.delete(syncKey);
    }
  } catch (error) {
    console.error(`[GoogleSync] Failed to sync task (${action}):`, error);
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function getTaskById(taskId: string): Promise<Task | null> {
  try {
    const today = getLocalDate();

    // dailyData에서 검색
    const dailyData = await db.dailyData.get(today);
    if (dailyData) {
      const task = dailyData.tasks.find((t: Task) => t.id === taskId);
      if (task) return task;
    }

    // globalInbox에서 검색
    const inboxTask = await db.globalInbox.get(taskId);
    if (inboxTask) return inboxTask;

    // completedInbox에서 검색
    const completedTask = await db.completedInbox.get(taskId);
    if (completedTask) return completedTask;

    return null;
  } catch (error) {
    console.error('[GoogleSync] Failed to get task:', error);
    return null;
  }
}

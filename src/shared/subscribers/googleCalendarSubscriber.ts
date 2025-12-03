/**
 * @file googleCalendarSubscriber.ts
 * @module shared/subscribers
 *
 * @description Google Calendar Subscriber - Task 변경 이벤트를 구독하여 Google Calendar와 동기화
 *
 * @role EventBus를 통해 Task CRUD 이벤트를 수신하고 Google Calendar에 반영
 *
 * @responsibilities
 * - task:completed 이벤트 수신 → 완료 상태로 Calendar 이벤트 업데이트
 * - task:created 이벤트 수신 → Calendar 이벤트 생성
 * - task:updated 이벤트 수신 → Calendar 이벤트 업데이트
 * - task:deleted 이벤트 수신 → Calendar 이벤트 삭제
 *
 * @dependencies
 * - eventBus: 이벤트 구독
 * - googleCalendarService: Google Calendar API 호출
 */

import { eventBus } from '@/shared/lib/eventBus';
import {
  isGoogleCalendarEnabled,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  updateLastSyncTime,
  getTaskCalendarMapping,
} from '@/shared/services/calendar/googleCalendarService';
import type { Task } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';

// 중복 동기화 방지용 Set
const pendingSyncs = new Set<string>();

/**
 * Google Calendar Subscriber를 초기화합니다.
 *
 * Task 관련 이벤트를 구독하고 Google Calendar와 동기화합니다.
 * 앱 시작 시 한 번만 호출해야 합니다.
 *
 * @returns {void}
 */
export function initGoogleCalendarSubscriber(): void {
  // Task 완료 시 Calendar 이벤트 업데이트
  eventBus.on('task:completed', async ({ taskId }) => {
    try {
      const enabled = await isGoogleCalendarEnabled();
      if (!enabled) return;

      // Task 정보 가져오기 (dailyData 또는 inbox에서)
      const task = await getTaskById(taskId);
      if (!task || task.timeBlock === null) return; // 스케줄된 작업만 동기화

      const date = getLocalDate();
      await updateCalendarEvent(task, date);
      await updateLastSyncTime();
    } catch (error) {
      console.error('[GoogleCalendarSubscriber] Failed to sync task completion:', error);
    }
  });

  // Task 생성 시 Calendar 이벤트 생성
  eventBus.on('task:created', async ({ taskId, timeBlock }) => {
    try {
      const enabled = await isGoogleCalendarEnabled();
      if (!enabled) return;

      // 스케줄된 작업만 동기화 (timeBlock이 있는 경우)
      if (timeBlock === null) return;

      // 중복 방지
      if (pendingSyncs.has(taskId)) {
        console.log('[GoogleCalendarSubscriber] Skipping duplicate create for:', taskId);
        return;
      }

      // 이미 매핑이 있으면 스킵 (중복 생성 방지)
      const existingMapping = await getTaskCalendarMapping(taskId);
      if (existingMapping) {
        console.log('[GoogleCalendarSubscriber] Calendar event already exists for:', taskId);
        return;
      }

      pendingSyncs.add(taskId);
      try {
        const task = await getTaskById(taskId);
        if (!task) return;

        const date = getLocalDate();
        await createCalendarEvent(task, date);
        await updateLastSyncTime();
      } finally {
        pendingSyncs.delete(taskId);
      }
    } catch (error) {
      console.error('[GoogleCalendarSubscriber] Failed to create calendar event:', error);
      pendingSyncs.delete(taskId);
    }
  });

  // Task 업데이트 시 Calendar 이벤트 업데이트
  eventBus.on('task:updated', async ({ taskId, previousTimeBlock, newTimeBlock }) => {
    try {
      const enabled = await isGoogleCalendarEnabled();
      if (!enabled) return;

      // timeBlock이 null로 변경된 경우 Calendar 이벤트 삭제
      if (newTimeBlock === null) {
        await deleteCalendarEvent(taskId);
        await updateLastSyncTime();
        return;
      }

      // 중복 방지
      if (pendingSyncs.has(taskId)) {
        console.log('[GoogleCalendarSubscriber] Skipping duplicate update for:', taskId);
        return;
      }

      pendingSyncs.add(taskId);
      try {
        const task = await getTaskById(taskId);
        if (!task) return;

        const date = getLocalDate();
        await updateCalendarEvent(task, date);
        await updateLastSyncTime();
      } finally {
        pendingSyncs.delete(taskId);
      }
    } catch (error) {
      console.error('[GoogleCalendarSubscriber] Failed to update calendar event:', error);
      pendingSyncs.delete(taskId);
    }
  });

  // Task 삭제 시 Calendar 이벤트 삭제
  eventBus.on('task:deleted', async ({ taskId }) => {
    try {
      const enabled = await isGoogleCalendarEnabled();
      if (!enabled) return;

      await deleteCalendarEvent(taskId);
      await updateLastSyncTime();
    } catch (error) {
      console.error('[GoogleCalendarSubscriber] Failed to delete calendar event:', error);
    }
  });
}

/**
 * Task ID로 Task 정보 가져오기
 * dailyData 또는 globalInbox에서 검색
 */
async function getTaskById(taskId: string): Promise<Task | null> {
  try {
    const { db } = await import('@/data/db/dexieClient');
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
    console.error('[GoogleCalendarSubscriber] Failed to get task:', error);
    return null;
  }
}

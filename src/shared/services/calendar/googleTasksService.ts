/**
 * Google Tasks Service
 *
 * @role Google Tasks API 호출을 위한 서비스 레이어
 * @responsibilities
 *   - Google Tasks API v1 호출
 *   - TaskList 조회
 *   - Task CRUD
 * @external_dependencies
 *   - Google Tasks API v1
 *   - googleCalendarService (토큰 관리 공유)
 *   - calendarRepository (매핑 데이터)
 */

import type { Task } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import {
    getValidAccessToken,
    refreshGoogleAccessTokenForRetry,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
} from './googleCalendarService';
import type { GoogleCalendarEvent } from './googleCalendarTypes';
import {
    getTaskCalendarMapping,
    deleteTaskCalendarMapping,
} from '@/data/repositories/calendarRepository';

// ============================================================================
// Types
// ============================================================================

export interface GoogleTask {
    id: string;
    title: string;
    notes?: string;
    status: 'needsAction' | 'completed';
    due?: string; // RFC 3339 timestamp
    completed?: string; // RFC 3339 timestamp
    deleted?: boolean;
    hidden?: boolean;
}

export interface GoogleTaskList {
    id: string;
    title: string;
    updated: string;
}

export interface TaskGoogleTaskMapping {
    taskId: string;
    googleTaskId: string;
    googleTaskListId: string;
    lastSyncedAt: number;
    syncStatus: 'synced' | 'pending' | 'failed';
}

const GOOGLE_TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

// ============================================================================
// API Calls
// ============================================================================

/**
 * API 호출 헬퍼
 */
async function callTasksApi<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    let attemptedRefresh = false;

    const doRequest = async (): Promise<Response> => {
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
            throw new Error('인증이 필요합니다. Google 계정에 다시 로그인해주세요.');
        }

        return fetch(`${GOOGLE_TASKS_API_BASE}${endpoint}`, {
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
        const refreshed = await refreshGoogleAccessTokenForRetry();
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

    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}

// ============================================================================
// Task CRUD
// ============================================================================

type TaskWithDate = Task & { scheduledDate?: string };

function resolveEventDate(task: TaskWithDate): string {
    return task.scheduledDate || getLocalDate();
}

/**
 * Google Task 생성 -> Google Calendar 일정으로 저장 (시작/끝 시간 포함)
 */
export async function createGoogleTask(task: TaskWithDate): Promise<GoogleCalendarEvent> {
    const date = resolveEventDate(task);
    return createCalendarEvent(task, date);
}

/**
 * Google Task 업데이트 -> Google Calendar 일정 업데이트
 */
export async function updateGoogleTask(task: TaskWithDate): Promise<GoogleCalendarEvent | null> {
    const date = resolveEventDate(task);
    return updateCalendarEvent(task, date);
}

/**
 * Google Task 삭제
 * - 신규 정책: Task는 Calendar Event로 저장되므로 Google Tasks 항목은 삭제만 수행 (레거시 청소)
 */
export async function deleteGoogleTask(taskId: string): Promise<void> {
    // Calendar Event도 함께 삭제하여 타임블록 점유 해제
    try {
        await deleteCalendarEvent(taskId);
    } catch (error) {
        // ignore calendar deletion errors (e.g., event already removed)
        if (!(error as Error).message.includes('404')) {
            console.warn('[GoogleTasks] Failed to delete calendar event for task:', error);
        }
    }

    const mapping = await getTaskGoogleTaskMapping(taskId);
    if (!mapping) return;

    try {
        await callTasksApi(
            `/lists/${mapping.googleTaskListId}/tasks/${mapping.googleTaskId}`,
            { method: 'DELETE' }
        );
    } catch (error) {
        if (!(error as Error).message.includes('404')) {
            throw error;
        }
    }

    await deleteTaskGoogleTaskMappingById(taskId);
}

// ============================================================================
// Mapping Management
// ============================================================================

export async function getTaskGoogleTaskMapping(taskId: string): Promise<TaskGoogleTaskMapping | undefined> {
    const mapping = await getTaskCalendarMapping(taskId);
    if (!mapping) return undefined;
    // Convert to TaskGoogleTaskMapping format (legacy support)
    return {
        taskId: mapping.taskId,
        googleTaskId: mapping.eventId,
        googleTaskListId: mapping.calendarId,
        lastSyncedAt: mapping.lastSyncedAt,
        syncStatus: 'synced',
    };
}

async function deleteTaskGoogleTaskMappingById(taskId: string): Promise<void> {
    try {
        await deleteTaskCalendarMapping(taskId);
    } catch (error) {
        console.error('[GoogleTasks] Failed to delete mapping:', error);
    }
}

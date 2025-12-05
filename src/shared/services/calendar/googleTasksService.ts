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
 */

import { db } from '@/data/db/dexieClient';
import type { Task } from '@/shared/types/domain';
import { getValidAccessToken, refreshGoogleAccessTokenForRetry } from './googleCalendarService';

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
const DEFAULT_TASK_LIST_ID = '@default'; // 기본 목록

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

/**
 * Task를 Google Task 객체로 변환
 */
function taskToGoogleTask(task: Task): Partial<GoogleTask> {
    const notesParts: string[] = [];
    if (task.memo) notesParts.push(task.memo);
    notesParts.push('');
    notesParts.push(`📊 난이도: ${task.resistance}`);
    notesParts.push(`⏱️ 예상 시간: ${task.adjustedDuration}분`);
    if (task.goalId) notesParts.push(`🎯 목표 연결됨`);
    notesParts.push('');
    notesParts.push('📱 TimeBlock Planner에서 생성됨');

    const googleTask: Partial<GoogleTask> = {
        title: `${task.emoji || '📌'} ${task.text}`,
        notes: notesParts.join('\n'),
        status: task.completed ? 'completed' : 'needsAction',
    };

    // 마감일 설정 (오늘 날짜)
    // Google Tasks API의 due는 날짜만 필요 (시간 제외) - RFC 3339 format YYYY-MM-DDT00:00:00.000Z
    // 하지만 API 문서는 "The due date only records date information; the time portion of the timestamp is discarded when setting the due date." 라고 함.
    // 정확한 날짜 매칭을 위해 로컬 날짜를 UTC 자정으로 변환하여 전송하는 것이 안전함.
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    googleTask.due = `${year}-${month}-${day}T00:00:00.000Z`;

    if (task.completed) {
        googleTask.completed = new Date().toISOString();
    } else {
        googleTask.completed = undefined; // 미완료 시 null/undefined 전송
    }

    return googleTask;
}

/**
 * Google Task 생성
 */
export async function createGoogleTask(task: Task): Promise<GoogleTask> {
    const googleTaskBody = taskToGoogleTask(task);

    const createdTask = await callTasksApi<GoogleTask>(
        `/lists/${DEFAULT_TASK_LIST_ID}/tasks`,
        {
            method: 'POST',
            body: JSON.stringify(googleTaskBody),
        }
    );

    await saveTaskGoogleTaskMapping({
        taskId: task.id,
        googleTaskId: createdTask.id,
        googleTaskListId: DEFAULT_TASK_LIST_ID,
        lastSyncedAt: Date.now(),
        syncStatus: 'synced',
    });

    return createdTask;
}

/**
 * Google Task 업데이트
 */
export async function updateGoogleTask(task: Task): Promise<GoogleTask | null> {
    const mapping = await getTaskGoogleTaskMapping(task.id);
    if (!mapping) {
        return createGoogleTask(task);
    }

    const googleTaskBody = taskToGoogleTask(task);

    try {
        const updatedTask = await callTasksApi<GoogleTask>(
            `/lists/${mapping.googleTaskListId}/tasks/${mapping.googleTaskId}`,
            {
                method: 'PUT', // PATCH도 가능하지만 PUT이 전체 업데이트에 적합
                body: JSON.stringify(googleTaskBody),
            }
        );

        await saveTaskGoogleTaskMapping({
            ...mapping,
            lastSyncedAt: Date.now(),
            syncStatus: 'synced',
        });

        return updatedTask;
    } catch (error) {
        if ((error as Error).message.includes('404')) {
            await deleteTaskGoogleTaskMapping(task.id);
            return createGoogleTask(task);
        }
        throw error;
    }
}

/**
 * Google Task 삭제
 */
export async function deleteGoogleTask(taskId: string): Promise<void> {
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

    await deleteTaskGoogleTaskMapping(taskId);
}

// ============================================================================
// Mapping Management
// ============================================================================

async function saveTaskGoogleTaskMapping(mapping: TaskGoogleTaskMapping): Promise<void> {
    try {
        await db.table('taskGoogleTaskMappings').put(mapping);
    } catch (error) {
        console.error('[GoogleTasks] Failed to save mapping:', error);
    }
}

export async function getTaskGoogleTaskMapping(taskId: string): Promise<TaskGoogleTaskMapping | undefined> {
    try {
        return await db.table('taskGoogleTaskMappings').get(taskId);
    } catch (error) {
        console.error('[GoogleTasks] Failed to get mapping:', error);
        return undefined;
    }
}

async function deleteTaskGoogleTaskMapping(taskId: string): Promise<void> {
    try {
        await db.table('taskGoogleTaskMappings').delete(taskId);
    } catch (error) {
        console.error('[GoogleTasks] Failed to delete mapping:', error);
    }
}

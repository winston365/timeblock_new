/**
 * Inbox Repository
 *
 * @role 전역 인박스 작업 관리 (날짜 독립적)
 * @input Task CRUD 연산
 * @output 인박스 작업 목록, 추가/수정/삭제 함수
 * @dependencies
 *   - IndexedDB: globalInbox 테이블
 *   - Firebase: 실시간 동기화 (syncToFirebase)
 *   - @/shared/types/domain: Task 타입
 */

import { db } from '../db/dexieClient';
import type { Task } from '@/shared/types/domain';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';
import { syncToFirebase, fetchFromFirebase } from '@/shared/services/sync/firebase/syncCore';
import { globalInboxStrategy } from '@/shared/services/sync/firebase/strategies';

// ============================================================================
// Global Inbox CRUD
// ============================================================================

/**
 * 전역 인박스 작업 목록 로드
 *
 * @returns {Promise<Task[]>} 인박스 작업 배열 (최근 순으로 정렬)
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
 *   - Firebase 폴백 시 IndexedDB에 데이터 복원
 */
export async function loadInboxTasks(): Promise<Task[]> {
  try {
    // 1. IndexedDB에서 조회
    const tasks = await db.globalInbox.orderBy('createdAt').reverse().toArray();

    if (tasks.length > 0) {
      addSyncLog('dexie', 'load', `Loaded ${tasks.length} inbox tasks`);
      return tasks;
    }

    // 2. Firebase에서 조회 (fallback)
    if (isFirebaseInitialized()) {
      const firebaseTasks = await fetchFromFirebase<Task[]>(globalInboxStrategy);

      if (firebaseTasks && firebaseTasks.length > 0) {
        // Firebase 데이터를 IndexedDB에 저장
        await db.globalInbox.bulkPut(firebaseTasks);

        addSyncLog('firebase', 'load', `Loaded ${firebaseTasks.length} inbox tasks from Firebase`);
        return firebaseTasks;
      }
    }

    // 3. 데이터가 없으면 빈 배열 반환
    return [];
  } catch (error) {
    console.error('Failed to load inbox tasks:', error);
    addSyncLog('dexie', 'error', 'Failed to load inbox tasks', undefined, error as Error);
    return [];
  }
}

/**
 * 인박스 작업 추가
 *
 * @param {Task} task - 추가할 작업
 * @returns {Promise<void>}
 * @throws {Error} 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 작업 저장
 *   - Firebase에 동기화
 */
export async function addInboxTask(task: Task): Promise<void> {
  try {
    // timeBlock이 null인지 확인
    if (task.timeBlock !== null) {
      throw new Error('Inbox tasks must have timeBlock === null');
    }

    // IndexedDB에 저장
    await db.globalInbox.put(task);

    addSyncLog('dexie', 'save', `Added inbox task: ${task.text}`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      const allTasks = await db.globalInbox.toArray();
      await syncToFirebase(globalInboxStrategy, allTasks);
    }
  } catch (error) {
    console.error('Failed to add inbox task:', error);
    throw error;
  }
}

/**
 * 인박스 작업 업데이트
 *
 * @param {string} taskId - 업데이트할 작업 ID
 * @param {Partial<Task>} updates - 업데이트할 필드
 * @returns {Promise<void>}
 * @throws {Error} 작업이 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - IndexedDB에서 작업 업데이트
 *   - Firebase에 동기화
 */
export async function updateInboxTask(taskId: string, updates: Partial<Task>): Promise<void> {
  try {
    const task = await db.globalInbox.get(taskId);

    if (!task) {
      throw new Error(`Inbox task not found: ${taskId}`);
    }

    // 업데이트 적용
    const updatedTask: Task = { ...task, ...updates };

    // IndexedDB에 저장
    await db.globalInbox.put(updatedTask);

    addSyncLog('dexie', 'save', `Updated inbox task: ${task.text}`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      const allTasks = await db.globalInbox.toArray();
      await syncToFirebase(globalInboxStrategy, allTasks);
    }
  } catch (error) {
    console.error('Failed to update inbox task:', error);
    throw error;
  }
}

/**
 * 인박스 작업 삭제
 *
 * @param {string} taskId - 삭제할 작업 ID
 * @returns {Promise<void>}
 * @throws {Error} 저장 실패 시
 * @sideEffects
 *   - IndexedDB에서 작업 삭제
 *   - Firebase에 동기화
 */
export async function deleteInboxTask(taskId: string): Promise<void> {
  try {
    await db.globalInbox.delete(taskId);

    addSyncLog('dexie', 'save', `Deleted inbox task: ${taskId}`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      const allTasks = await db.globalInbox.toArray();
      await syncToFirebase(globalInboxStrategy, allTasks);
    }
  } catch (error) {
    console.error('Failed to delete inbox task:', error);
    throw error;
  }
}

/**
 * 인박스 작업 완료 토글
 *
 * @param {string} taskId - 토글할 작업 ID
 * @returns {Promise<Task>} 토글된 작업 객체
 * @throws {Error} 작업이 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - 작업의 completed 및 completedAt 필드 변경
 *   - Firebase에 동기화
 */
export async function toggleInboxTaskCompletion(taskId: string): Promise<Task> {
  try {
    const task = await db.globalInbox.get(taskId);

    if (!task) {
      throw new Error(`Inbox task not found: ${taskId}`);
    }

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;

    await db.globalInbox.put(task);

    addSyncLog('dexie', 'save', `Toggled inbox task completion: ${task.text}`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      const allTasks = await db.globalInbox.toArray();
      await syncToFirebase(globalInboxStrategy, allTasks);
    }

    return task;
  } catch (error) {
    console.error('Failed to toggle inbox task completion:', error);
    throw error;
  }
}

/**
 * 인박스 작업을 타임블록으로 이동 (전역 인박스에서 제거, dailyData에 추가)
 *
 * @param {string} taskId - 이동할 작업 ID
 * @param {string} blockId - 대상 타임블록 ID
 * @param {string} date - 대상 날짜
 * @returns {Promise<Task>} 이동된 작업 객체
 * @throws {Error} 작업이 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - 전역 인박스에서 작업 삭제
 *   - dailyData에 작업 추가 (별도 처리 필요)
 */
export async function moveInboxTaskToBlock(taskId: string): Promise<Task | null> {
  try {
    const task = await db.globalInbox.get(taskId);

    if (!task) {
      return null;
    }

    // 전역 인박스에서 제거
    await db.globalInbox.delete(taskId);

    addSyncLog('dexie', 'save', `Moved inbox task to time block: ${task.text}`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      const allTasks = await db.globalInbox.toArray();
      await syncToFirebase(globalInboxStrategy, allTasks);
    }

    return task;
  } catch (error) {
    console.error('Failed to move inbox task to block:', error);
    throw error;
  }
}

/**
 * 타임블록 작업을 전역 인박스로 이동 (dailyData에서 제거, globalInbox에 추가)
 *
 * @param {Task} task - 이동할 작업 객체
 * @returns {Promise<void>}
 * @throws {Error} 저장 실패 시
 * @sideEffects
 *   - 전역 인박스에 작업 추가
 *   - task.timeBlock = null 설정
 */
export async function moveTaskToInbox(task: Task): Promise<void> {
  try {
    // timeBlock을 null로 설정
    task.timeBlock = null;

    // 전역 인박스에 추가
    await db.globalInbox.put(task);

    addSyncLog('dexie', 'save', `Moved task to inbox: ${task.text}`);

    // Firebase 동기화
    if (isFirebaseInitialized()) {
      const allTasks = await db.globalInbox.toArray();
      await syncToFirebase(globalInboxStrategy, allTasks);
    }
  } catch (error) {
    console.error('Failed to move task to inbox:', error);
    throw error;
  }
}

/**
 * DailyData Repository - Task Operations
 * 
 * @role Task CRUD 및 Global Inbox 연동
 */

import { db } from '../../db/dexieClient';
import type { Task } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import {
  moveInboxTaskToBlock,
  moveTaskToInbox,
  deleteInboxTask,
  updateInboxTask,
  toggleInboxTaskCompletion,
} from '../inboxRepository';
import { loadDailyData, saveDailyData } from './coreOperations';

// ============================================================================
// Task CRUD
// ============================================================================

/**
 * Task 추가
 *
 * @param {Task} task - 추가할 작업 객체
 * @param {string} [date] - 날짜 (기본값: 오늘)
 */
export async function addTask(task: Task, date: string = getLocalDate()): Promise<void> {
  try {
    const dailyData = await loadDailyData(date);
    dailyData.tasks.push(task);
    await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
  } catch (error) {
    console.error('Failed to add task:', error);
    throw error;
  }
}

/**
 * Task 업데이트 (Global Inbox 지원)
 *
 * @param {string} taskId - 업데이트할 작업 ID
 * @param {Partial<Task>} updates - 업데이트할 필드
 * @param {string} [date] - 날짜 (기본값: 오늘)
 */
export async function updateTask(taskId: string, updates: Partial<Task>, date: string = getLocalDate()): Promise<void> {
  try {
    // 1. dailyData에서 찾기
    const dailyData = await loadDailyData(date);
    const taskIndex = dailyData.tasks.findIndex(t => t.id === taskId);

    if (taskIndex !== -1) {
      const task = dailyData.tasks[taskIndex];

      // timeBlock → inbox 이동 (타임블록에서 인박스로)
      if (updates.timeBlock === null && task.timeBlock !== null) {
        addSyncLog('dexie', 'save', `Moving task ${taskId} from timeblock to inbox`);

        // dailyData에서 제거
        dailyData.tasks.splice(taskIndex, 1);
        await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);

        // globalInbox로 이동 (updates 적용)
        const movedTask: Task = { ...task, ...updates };
        await moveTaskToInbox(movedTask);
        return;
      }

      // 일반 업데이트 (타임블록 내 이동 또는 속성 변경)
      dailyData.tasks[taskIndex] = {
        ...task,
        ...updates,
      };
      await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
      return;
    }

    // 2. globalInbox에서 찾기
    const inboxTask = await db.globalInbox.get(taskId);

    if (inboxTask) {
      // inbox → timeBlock 이동 (인박스에서 타임블록으로)
      if (updates.timeBlock !== null) {
        addSyncLog('dexie', 'save', `Moving task ${taskId} from inbox to timeblock`);

        // globalInbox에서 제거
        await moveInboxTaskToBlock(taskId);

        // dailyData에 추가 (updates 적용)
        const movedTask: Task = { ...inboxTask, ...updates };

        // ✅ hourSlot이 없으면 블록의 첫 시간대로 설정 (UI 표시 보장)
        if (!movedTask.hourSlot && movedTask.timeBlock) {
          const block = TIME_BLOCKS.find(b => b.id === movedTask.timeBlock);
          if (block) {
            movedTask.hourSlot = block.start;
          }
        }

        const todayData = await loadDailyData(date);

        // ✅ 중복 방지: 이미 존재하는 작업인지 확인
        const existingTaskIndex = todayData.tasks.findIndex(t => t.id === taskId);
        if (existingTaskIndex !== -1) {
          // 이미 존재하면 업데이트만
          todayData.tasks[existingTaskIndex] = movedTask;
        } else {
          // 존재하지 않으면 추가
          todayData.tasks.push(movedTask);
        }

        await saveDailyData(date, todayData.tasks, todayData.timeBlockStates);
        return;
      }

      // 인박스 내 업데이트
      await updateInboxTask(taskId, updates);
      return;
    }

    // 3. 어디에도 없으면 에러
    throw new Error(`Task not found: ${taskId}`);
  } catch (error) {
    console.error('Failed to update task:', error);
    throw error;
  }
}

/**
 * Task 삭제 (Global Inbox 지원)
 *
 * @param {string} taskId - 삭제할 작업 ID
 * @param {string} [date] - 날짜 (기본값: 오늘)
 */
export async function deleteTask(taskId: string, date: string = getLocalDate()): Promise<void> {
  try {
    // 1. dailyData에서 삭제 시도
    const dailyData = await loadDailyData(date);
    const taskExists = dailyData.tasks.some(t => t.id === taskId);

    if (taskExists) {
      dailyData.tasks = dailyData.tasks.filter(t => t.id !== taskId);
      await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
      return;
    }

    // 2. globalInbox에서 삭제 시도
    const inboxTask = await db.globalInbox.get(taskId);

    if (inboxTask) {
      await deleteInboxTask(taskId);
      return;
    }

    // 3. 어디에도 없으면 에러
    throw new Error(`Task not found: ${taskId}`);
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw error;
  }
}

/**
 * Task 완료 토글 (Global Inbox 지원)
 *
 * @param {string} taskId - 토글할 작업 ID
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<Task>} 토글된 작업 객체
 */
export async function toggleTaskCompletion(taskId: string, date: string = getLocalDate()): Promise<Task> {
  try {
    // 1. dailyData에서 토글 시도
    const dailyData = await loadDailyData(date);
    const task = dailyData.tasks.find(t => t.id === taskId);

    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;

      await saveDailyData(date, dailyData.tasks, dailyData.timeBlockStates);
      return task;
    }

    // 2. globalInbox에서 토글 시도
    const inboxTask = await db.globalInbox.get(taskId);

    if (inboxTask) {
      return await toggleInboxTaskCompletion(taskId);
    }

    // 3. 어디에도 없으면 에러
    throw new Error(`Task not found: ${taskId}`);
  } catch (error) {
    console.error('Failed to toggle task completion:', error);
    throw error;
  }
}

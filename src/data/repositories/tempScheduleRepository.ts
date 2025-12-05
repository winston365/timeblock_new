/**
 * 임시 스케줄 Repository
 *
 * @role 임시 스케줄 작업의 CRUD 및 Firebase 동기화
 * @responsibilities
 *   - 임시 스케줄 작업 목록 로드/저장/업데이트/삭제
 *   - 날짜별 필터링 및 반복 규칙 적용
 *   - Firebase 동기화 지원
 * @key_dependencies
 *   - Dexie (IndexedDB): 메인 저장소
 *   - baseRepository: 공통 CRUD 패턴
 *   - TempScheduleTask 타입
 */

import { db } from '@/data/db/dexieClient';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';
import { fetchFromFirebase, syncToFirebase } from '@/shared/services/sync/firebase/syncCore';
import type { SyncStrategy } from '@/shared/services/sync/firebase/syncCore';
import type { TempScheduleTask, RecurrenceRule, TempScheduleTemplate } from '@/shared/types/tempSchedule';
import { TEMP_SCHEDULE_DEFAULTS } from '@/shared/types/tempSchedule';
import { generateId } from '@/shared/lib/utils';
import { withFirebaseSync } from '@/shared/utils/firebaseGuard';
import { eventBus } from '@/shared/lib/eventBus';

// ============================================================================
// Firebase Sync Strategy
// ============================================================================

/**
 * Firebase 동기화 전략
 */
const tempScheduleFirebaseStrategy: SyncStrategy<TempScheduleTask[]> = {
  collection: 'tempScheduleTasks',
  serialize: (tasks) => tasks,
  getSuccessMessage: (tasks) => `TempScheduleTasks synced (${tasks.length} items)`,
};

/**
 * 임시 스케줄 전체를 Firebase에 동기화 (DRY: 중복 코드 제거)
 * @description 4개 함수에서 반복되던 패턴을 단일 함수로 추출
 */
async function syncTempScheduleToFirebase(): Promise<void> {
  const allTasks = await db.tempScheduleTasks.toArray();
  await syncToFirebase(tempScheduleFirebaseStrategy, allTasks, 'all');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 반복 규칙에 따라 특정 날짜에 작업이 표시되어야 하는지 확인
 * 
 * @param task - 임시 스케줄 작업
 * @param date - 확인할 날짜 (YYYY-MM-DD)
 * @returns 해당 날짜에 표시 여부
 */
export function shouldShowOnDate(task: TempScheduleTask, date: string): boolean {
  const { scheduledDate, recurrence } = task;

  // 특정 날짜에만 표시되는 경우
  if (scheduledDate && recurrence.type === 'none') {
    return scheduledDate === date;
  }

  // 반복 규칙 체크
  const targetDate = new Date(date);
  const taskStartDate = scheduledDate ? new Date(scheduledDate) : new Date(task.createdAt);

  // 시작일 이전이면 표시하지 않음
  if (targetDate < taskStartDate) {
    return false;
  }

  // 종료일 이후이면 표시하지 않음
  if (recurrence.endDate && targetDate > new Date(recurrence.endDate)) {
    return false;
  }

  switch (recurrence.type) {
    case 'daily':
      return true;

    case 'weekly':
      if (!recurrence.weeklyDays || recurrence.weeklyDays.length === 0) {
        return false;
      }
      return recurrence.weeklyDays.includes(targetDate.getDay());

    case 'monthly':
      // 매월 같은 날짜
      return targetDate.getDate() === taskStartDate.getDate();

    case 'custom':
      if (!recurrence.intervalDays || recurrence.intervalDays <= 0) {
        return false;
      }
      const daysDiff = Math.floor((targetDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff % recurrence.intervalDays === 0;

    case 'none':
    default:
      return scheduledDate === date;
  }
}

/**
 * 시간 문자열을 분으로 변환
 * 
 * @param time - 시간 문자열 (HH:MM)
 * @returns 자정 기준 분
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 분을 시간 문자열로 변환
 * 
 * @param minutes - 자정 기준 분
 * @returns 시간 문자열 (HH:MM)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * 작업 기간(분) 계산
 * 
 * @param task - 임시 스케줄 작업
 * @returns 기간 (분)
 */
export function getTaskDuration(task: TempScheduleTask): number {
  const startMinutes = timeToMinutes(task.startTime);
  const endMinutes = timeToMinutes(task.endTime);
  return endMinutes > startMinutes ? endMinutes - startMinutes : (24 * 60 - startMinutes) + endMinutes;
}

/**
 * 시간을 그리드 스냅에 맞게 조정
 * 
 * @param time - 시간 문자열 (HH:MM)
 * @param snapInterval - 스냅 간격 (분)
 * @returns 조정된 시간 문자열
 */
export function snapTimeToGrid(time: string, snapInterval: number = TEMP_SCHEDULE_DEFAULTS.gridSnapInterval): string {
  const minutes = timeToMinutes(time);
  const snappedMinutes = Math.round(minutes / snapInterval) * snapInterval;
  return minutesToTime(snappedMinutes);
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * 모든 임시 스케줄 작업 로드
 * 
 * @returns 모든 임시 스케줄 작업 배열
 */
export async function loadTempScheduleTasks(): Promise<TempScheduleTask[]> {
  try {
    const tasks = (await db.tempScheduleTasks.toArray()).map(t => ({
      ...t,
      favorite: t.favorite ?? false,
    }));

    if (tasks.length > 0) {
      addSyncLog('dexie', 'load', 'TempScheduleTasks loaded from IndexedDB', { count: tasks.length });
      return tasks;
    }

    // Firebase fallback
    if (isFirebaseInitialized()) {
      const firebaseTasks = await fetchFromFirebase<TempScheduleTask[]>(tempScheduleFirebaseStrategy, 'all');

      if (firebaseTasks && firebaseTasks.length > 0) {
        const normalized = firebaseTasks.map(t => ({ ...t, favorite: t.favorite ?? false }));
        await db.tempScheduleTasks.bulkPut(normalized);
        addSyncLog('firebase', 'load', 'TempScheduleTasks loaded from Firebase', { count: firebaseTasks.length });
        return normalized;
      }
    }

    return [];
  } catch (error) {
    console.error('Failed to load temp schedule tasks:', error);
    addSyncLog('dexie', 'error', 'Failed to load TempScheduleTasks', undefined, error as Error);
    return [];
  }
}

/**
 * 특정 날짜의 임시 스케줄 작업 로드 (반복 규칙 적용)
 * 
 * @param date - 날짜 (YYYY-MM-DD)
 * @returns 해당 날짜에 표시될 작업 배열
 */
export async function loadTempScheduleTasksForDate(date: string): Promise<TempScheduleTask[]> {
  const allTasks = await loadTempScheduleTasks();
  return allTasks.filter(task => shouldShowOnDate(task, date));
}

/**
 * 날짜 범위의 임시 스케줄 작업 로드
 * 
 * @param startDate - 시작 날짜 (YYYY-MM-DD)
 * @param endDate - 종료 날짜 (YYYY-MM-DD)
 * @returns 날짜별 작업 맵
 */
export async function loadTempScheduleTasksForRange(
  startDate: string,
  endDate: string
): Promise<Record<string, TempScheduleTask[]>> {
  const allTasks = await loadTempScheduleTasks();
  const result: Record<string, TempScheduleTask[]> = {};

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    result[dateStr] = allTasks.filter(task => shouldShowOnDate(task, dateStr));
  }

  return result;
}

/**
 * 임시 스케줄 작업 추가
 * 
 * @param taskData - 작업 데이터 (id, createdAt, updatedAt 제외)
 * @returns 생성된 작업
 */
export async function addTempScheduleTask(
  taskData: Omit<TempScheduleTask, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TempScheduleTask> {
  const now = new Date().toISOString();

  const newTask: TempScheduleTask = {
    ...taskData,
    id: generateId('tempschedule'),
    createdAt: now,
    updatedAt: now,
    favorite: taskData.favorite ?? false,
  };

  try {
    await db.tempScheduleTasks.add(newTask);
    addSyncLog('dexie', 'save', 'TempScheduleTask added', { id: newTask.id, name: newTask.name });

    // Firebase 동기화 (withFirebaseSync로 보일러플레이트 제거)
    withFirebaseSync(syncTempScheduleToFirebase, 'TempSchedule:add');

    // 이벤트 발행
    eventBus.emit('tempSchedule:created', { task: newTask });

    return newTask;
  } catch (error) {
    console.error('Failed to add temp schedule task:', error);
    addSyncLog('dexie', 'error', 'Failed to add TempScheduleTask', { name: taskData.name }, error as Error);
    throw error;
  }
}

/**
 * 임시 스케줄 작업 업데이트
 * 
 * @param id - 작업 ID
 * @param updates - 업데이트할 필드
 * @returns 업데이트된 작업
 */
export async function updateTempScheduleTask(
  id: string,
  updates: Partial<Omit<TempScheduleTask, 'id' | 'createdAt'>>
): Promise<TempScheduleTask | null> {
  try {
    const existingTask = await db.tempScheduleTasks.get(id);

    if (!existingTask) {
      console.warn(`TempScheduleTask not found: ${id}`);
      return null;
    }

    const updatedTask: TempScheduleTask = {
      ...existingTask,
      ...updates,
      updatedAt: new Date().toISOString(),
      favorite: updates.favorite ?? existingTask.favorite ?? false,
    };

    await db.tempScheduleTasks.put(updatedTask);
    addSyncLog('dexie', 'save', 'TempScheduleTask updated', { id, name: updatedTask.name });

    // Firebase 동기화 (withFirebaseSync로 보일러플레이트 제거)
    withFirebaseSync(syncTempScheduleToFirebase, 'TempSchedule:update');

    // 이벤트 발행
    eventBus.emit('tempSchedule:updated', { task: updatedTask, oldTask: existingTask });

    return updatedTask;
  } catch (error) {
    console.error('Failed to update temp schedule task:', error);
    addSyncLog('dexie', 'error', 'Failed to update TempScheduleTask', { id }, error as Error);
    throw error;
  }
}

/**
 * 임시 스케줄 작업 삭제
 * 
 * @param id - 작업 ID
 */
export async function deleteTempScheduleTask(id: string): Promise<void> {
  try {
    // 자식 작업도 함께 삭제
    const childTasks = await db.tempScheduleTasks.where('parentId').equals(id).toArray();
    const childIds = childTasks.map(t => t.id);

    // 삭제 전 작업 정보 가져오기 (이벤트 발행용)
    const taskToDelete = await db.tempScheduleTasks.get(id);

    await db.tempScheduleTasks.bulkDelete([id, ...childIds]);
    addSyncLog('dexie', 'save', 'TempScheduleTask deleted', { id, childCount: childIds.length });

    // Firebase 동기화 (withFirebaseSync로 보일러플레이트 제거)
    withFirebaseSync(syncTempScheduleToFirebase, 'TempSchedule:delete');

    // 이벤트 발행
    if (taskToDelete) {
      eventBus.emit('tempSchedule:deleted', { task: taskToDelete });
    }
  } catch (error) {
    console.error('Failed to delete temp schedule task:', error);
    addSyncLog('dexie', 'error', 'Failed to delete TempScheduleTask', { id }, error as Error);
    throw error;
  }
}

/**
 * 모든 임시 스케줄 작업 저장 (전체 교체)
 * 
 * @param tasks - 저장할 작업 배열
 */
export async function saveTempScheduleTasks(tasks: TempScheduleTask[]): Promise<void> {
  try {
    await db.tempScheduleTasks.clear();

    if (tasks.length > 0) {
      await db.tempScheduleTasks.bulkPut(tasks);
    }

    addSyncLog('dexie', 'save', 'TempScheduleTasks saved', { count: tasks.length });

    // Firebase 동기화 (withFirebaseSync로 보일러플레이트 제거)
    // 참고: 이 경우 tasks를 직접 전달해야 하므로 람다 사용
    withFirebaseSync(
      () => syncToFirebase(tempScheduleFirebaseStrategy, tasks, 'all'),
      'TempSchedule:save'
    );
  } catch (error) {
    console.error('Failed to save temp schedule tasks:', error);
    addSyncLog('dexie', 'error', 'Failed to save TempScheduleTasks', undefined, error as Error);
    throw error;
  }
}

/**
 * 특정 작업의 자식 작업 조회 (중첩 블록)
 * 
 * @param parentId - 부모 작업 ID
 * @returns 자식 작업 배열
 */
export async function getChildTasks(parentId: string): Promise<TempScheduleTask[]> {
  try {
    return await db.tempScheduleTasks.where('parentId').equals(parentId).toArray();
  } catch (error) {
    console.error('Failed to get child tasks:', error);
    return [];
  }
}

/**
 * 기본 반복 규칙 생성
 */
export function createDefaultRecurrence(): RecurrenceRule {
  return {
    type: 'none',
    weeklyDays: [],
    intervalDays: 1,
    endDate: null,
  };
}

/**
 * 기본 임시 스케줄 작업 생성
 * 
 * @param name - 작업 이름
 * @param startTime - 시작 시간
 * @param endTime - 종료 시간
 * @param scheduledDate - 예정 날짜 (null이면 반복 일정)
 * @returns 작업 데이터 (id, createdAt, updatedAt 제외)
 */
export function createDefaultTempScheduleTask(
  name: string,
  startTime: string,
  endTime: string,
  scheduledDate: string | null = null
): Omit<TempScheduleTask, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    startTime,
    endTime,
    scheduledDate,
    color: TEMP_SCHEDULE_DEFAULTS.defaultColor,
    parentId: null,
    recurrence: createDefaultRecurrence(),
    order: 0,
    memo: '',
  };
}

// ============================================================================
// Template Functions
// ============================================================================

const TEMPLATES_STORAGE_KEY = 'tempScheduleTemplates';

/**
 * 템플릿 목록 로드
 */
export async function loadTemplates(): Promise<TempScheduleTemplate[]> {
  try {
    const record = await db.systemState.get(TEMPLATES_STORAGE_KEY);
    return (record?.value as TempScheduleTemplate[]) || [];
  } catch (error) {
    console.error('Failed to load templates:', error);
    return [];
  }
}

/**
 * 템플릿 저장
 */
export async function saveTemplate(
  name: string,
  tasks: TempScheduleTask[]
): Promise<TempScheduleTemplate> {
  const now = new Date().toISOString();

  const template: TempScheduleTemplate = {
    id: generateId('template'),
    name,
    tasks: tasks.map(t => ({
      name: t.name,
      startTime: t.startTime,
      endTime: t.endTime,
      color: t.color,
      parentId: t.parentId,
      recurrence: { type: 'none', weeklyDays: [], intervalDays: 1, endDate: null },
      order: t.order,
      memo: t.memo,
      favorite: t.favorite,
    })),
    createdAt: now,
    updatedAt: now,
  };

  try {
    const templates = await loadTemplates();
    templates.push(template);
    await db.systemState.put({ key: TEMPLATES_STORAGE_KEY, value: templates });
    addSyncLog('dexie', 'save', 'Template saved', { id: template.id, name });
    return template;
  } catch (error) {
    console.error('Failed to save template:', error);
    throw error;
  }
}

/**
 * 템플릿 삭제
 */
export async function deleteTemplate(id: string): Promise<void> {
  try {
    const templates = await loadTemplates();
    const filtered = templates.filter(t => t.id !== id);
    await db.systemState.put({ key: TEMPLATES_STORAGE_KEY, value: filtered });
    addSyncLog('dexie', 'save', 'Template deleted', { id });
  } catch (error) {
    console.error('Failed to delete template:', error);
    throw error;
  }
}

/**
 * 템플릿을 특정 날짜에 적용
 */
export async function applyTemplate(
  template: TempScheduleTemplate,
  targetDate: string
): Promise<TempScheduleTask[]> {
  const createdTasks: TempScheduleTask[] = [];

  for (const taskData of template.tasks) {
    const newTask = await addTempScheduleTask({
      ...taskData,
      scheduledDate: targetDate,
      recurrence: { type: 'none', weeklyDays: [], intervalDays: 1, endDate: null },
    });
    createdTasks.push(newTask);
  }

  addSyncLog('dexie', 'save', 'Template applied', {
    templateId: template.id,
    targetDate,
    taskCount: createdTasks.length
  });

  return createdTasks;
}

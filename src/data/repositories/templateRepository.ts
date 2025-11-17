/**
 * Template Repository
 *
 * @role 작업 템플릿 데이터 관리 및 자동 생성 작업 처리
 * @input Template 객체, 템플릿 ID, Task 생성 요청
 * @output Template 배열, Template 객체, Task 객체
 * @external_dependencies
 *   - IndexedDB (db.templates): 메인 저장소
 *   - localStorage (STORAGE_KEYS.TEMPLATES): 백업 저장소
 *   - Firebase: 실시간 동기화 (syncToFirebase)
 *   - @/shared/types/domain: Template, Task, TimeBlockId, Resistance 타입
 */

import { db } from '../db/dexieClient';
import type { Template, Task, TimeBlockId, Resistance, RecurrenceType } from '@/shared/types/domain';
import { saveToStorage, getFromStorage, generateId } from '@/shared/lib/utils';
import { STORAGE_KEYS } from '@/shared/lib/constants';
import { isFirebaseInitialized } from '@/shared/services/firebaseService';
import { syncToFirebase, fetchFromFirebase } from '@/shared/services/firebase/syncCore';
import { templateStrategy } from '@/shared/services/firebase/strategies';
import { addSyncLog } from '@/shared/services/syncLogger';

// ============================================================================
// Template CRUD
// ============================================================================

/**
 * 모든 템플릿 로드
 *
 * @returns {Promise<Template[]>} 템플릿 배열
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
 *   - localStorage 폴백 시 IndexedDB에 데이터 복원
 *   - Firebase 폴백 시 IndexedDB에 데이터 복원
 */
export async function loadTemplates(): Promise<Template[]> {
  try {
    // 1. IndexedDB에서 조회
    const templates = await db.templates.toArray();

    if (templates.length > 0) {
      // preparation 필드의 undefined를 빈 문자열로 정제, category와 isFavorite 기본값 설정
      return templates.map(template => ({
        ...template,
        preparation1: template.preparation1 ?? '',
        preparation2: template.preparation2 ?? '',
        preparation3: template.preparation3 ?? '',
        category: template.category ?? '',
        isFavorite: template.isFavorite ?? false,
      }));
    }

    // 2. localStorage에서 조회
    const localTemplates = getFromStorage<Template[]>(STORAGE_KEYS.TEMPLATES, []);

    if (localTemplates.length > 0) {
      // preparation 필드 정제
      const sanitizedTemplates = localTemplates.map(template => ({
        ...template,
        preparation1: template.preparation1 ?? '',
        preparation2: template.preparation2 ?? '',
        preparation3: template.preparation3 ?? '',
      }));

      // localStorage 데이터를 IndexedDB에 저장
      await db.templates.bulkPut(sanitizedTemplates);
      return sanitizedTemplates;
    }

    // 3. Firebase에서 조회
    if (isFirebaseInitialized()) {
      const firebaseTemplates = await fetchFromFirebase<Template[]>(templateStrategy, 'all');

      if (firebaseTemplates && firebaseTemplates.length > 0) {
        // preparation 필드 정제
        const sanitizedTemplates = firebaseTemplates.map(template => ({
          ...template,
          preparation1: template.preparation1 ?? '',
          preparation2: template.preparation2 ?? '',
          preparation3: template.preparation3 ?? '',
          category: template.category ?? '',
          isFavorite: template.isFavorite ?? false,
        }));

        // Firebase 데이터를 IndexedDB와 localStorage에 저장
        await db.templates.bulkPut(sanitizedTemplates);
        saveToStorage(STORAGE_KEYS.TEMPLATES, sanitizedTemplates);

        addSyncLog('firebase', 'load', `Loaded ${sanitizedTemplates.length} templates from Firebase`);
        return sanitizedTemplates;
      }
    }

    return [];
  } catch (error) {
    console.error('Failed to load templates:', error);
    return [];
  }
}

/**
 * 템플릿 생성
 *
 * @param {string} name - 템플릿 이름
 * @param {string} text - 작업 내용
 * @param {string} memo - 메모
 * @param {number} baseDuration - 기본 소요 시간 (분)
 * @param {Resistance} resistance - 저항도 (low, medium, high)
 * @param {TimeBlockId} timeBlock - 타임블록 ID
 * @param {boolean} autoGenerate - 자동 생성 여부
 * @param {string} preparation1 - 준비 사항 1
 * @param {string} preparation2 - 준비 사항 2
 * @param {string} preparation3 - 준비 사항 3
 * @param {RecurrenceType} recurrenceType - 반복 주기 타입
 * @param {number[]} weeklyDays - 매주 반복 요일 (0=일요일, ..., 6=토요일)
 * @param {number} intervalDays - N일 주기
 * @param {string} category - 카테고리
 * @param {boolean} isFavorite - 즐겨찾기 여부
 * @returns {Promise<Template>} 생성된 템플릿
 * @throws {Error} IndexedDB 또는 localStorage 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 템플릿 저장
 *   - localStorage에 백업
 *   - Firebase에 비동기 동기화
 */
export async function createTemplate(
  name: string,
  text: string,
  memo: string,
  baseDuration: number,
  resistance: Resistance,
  timeBlock: TimeBlockId,
  autoGenerate: boolean,
  preparation1?: string,
  preparation2?: string,
  preparation3?: string,
  recurrenceType: RecurrenceType = 'none',
  weeklyDays?: number[],
  intervalDays?: number,
  category?: string,
  isFavorite?: boolean
): Promise<Template> {
  try {
    const template: Template = {
      id: `template-${Date.now()}`,
      name,
      text,
      memo,
      baseDuration,
      resistance,
      timeBlock,
      autoGenerate,
      recurrenceType,
      weeklyDays: weeklyDays || [],
      intervalDays: intervalDays || 1,
      preparation1: preparation1 || '',
      preparation2: preparation2 || '',
      preparation3: preparation3 || '',
      category: category || '',
      isFavorite: isFavorite || false,
    };

    // 1. IndexedDB에 저장
    await db.templates.put(template);

    // 2. localStorage에도 저장
    const templates = await loadTemplates();
    saveToStorage(STORAGE_KEYS.TEMPLATES, templates);

    addSyncLog('dexie', 'save', 'Template created', {
      id: template.id,
      name: template.name,
      autoGenerate: template.autoGenerate
    });

    // 3. Firebase에 비동기 동기화
    if (isFirebaseInitialized()) {
      syncToFirebase(templateStrategy, templates, 'all').catch(err => {
        console.error('Firebase sync failed, but local save succeeded:', err);
      });
    }

    return template;
  } catch (error) {
    console.error('Failed to create template:', error);
    addSyncLog('dexie', 'error', 'Failed to create template', undefined, error as Error);
    throw error;
  }
}

/**
 * 템플릿 업데이트
 *
 * @param {string} id - 템플릿 ID
 * @param {Partial<Omit<Template, 'id'>>} updates - 업데이트할 필드
 * @returns {Promise<Template>} 업데이트된 템플릿
 * @throws {Error} 템플릿이 존재하지 않거나 저장 실패 시
 * @sideEffects
 *   - IndexedDB에서 템플릿 조회 및 업데이트
 *   - localStorage에 백업
 *   - Firebase에 비동기 동기화
 */
export async function updateTemplate(
  id: string,
  updates: Partial<Omit<Template, 'id'>>
): Promise<Template> {
  try {
    const template = await db.templates.get(id);

    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    // preparation 필드의 undefined를 빈 문자열로 정제
    const sanitizedUpdates = {
      ...updates,
      preparation1: updates.preparation1 ?? template.preparation1 ?? '',
      preparation2: updates.preparation2 ?? template.preparation2 ?? '',
      preparation3: updates.preparation3 ?? template.preparation3 ?? '',
    };

    const updatedTemplate = { ...template, ...sanitizedUpdates };

    // 1. IndexedDB에 저장
    await db.templates.put(updatedTemplate);

    // 2. localStorage에도 저장
    const templates = await loadTemplates();
    saveToStorage(STORAGE_KEYS.TEMPLATES, templates);

    addSyncLog('dexie', 'save', 'Template updated', {
      id: updatedTemplate.id,
      name: updatedTemplate.name
    });

    // 3. Firebase에 비동기 동기화
    if (isFirebaseInitialized()) {
      syncToFirebase(templateStrategy, templates, 'all').catch(err => {
        console.error('Firebase sync failed, but local save succeeded:', err);
      });
    }

    return updatedTemplate;
  } catch (error) {
    console.error('Failed to update template:', error);
    addSyncLog('dexie', 'error', 'Failed to update template', undefined, error as Error);
    throw error;
  }
}

/**
 * 템플릿 삭제
 *
 * @param {string} id - 삭제할 템플릿 ID
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 삭제 실패 시
 * @sideEffects
 *   - IndexedDB에서 템플릿 삭제
 *   - localStorage에 변경사항 반영
 *   - Firebase에 비동기 동기화
 */
export async function deleteTemplate(id: string): Promise<void> {
  try {
    // 1. IndexedDB에서 삭제
    await db.templates.delete(id);

    // 2. localStorage에도 반영
    const templates = await loadTemplates();
    saveToStorage(STORAGE_KEYS.TEMPLATES, templates);

    addSyncLog('dexie', 'save', 'Template deleted', { id });

    // 3. Firebase에 비동기 동기화
    if (isFirebaseInitialized()) {
      syncToFirebase(templateStrategy, templates, 'all').catch(err => {
        console.error('Firebase sync failed, but local delete succeeded:', err);
      });
    }

  } catch (error) {
    console.error('Failed to delete template:', error);
    addSyncLog('dexie', 'error', 'Failed to delete template', undefined, error as Error);
    throw error;
  }
}

/**
 * 특정 템플릿 조회
 *
 * @param {string} id - 템플릿 ID
 * @returns {Promise<Template | undefined>} 템플릿 객체 또는 undefined
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
 */
export async function getTemplate(id: string): Promise<Template | undefined> {
  try {
    const template = await db.templates.get(id);

    if (!template) {
      return undefined;
    }

    // preparation 필드의 undefined를 빈 문자열로 정제
    return {
      ...template,
      preparation1: template.preparation1 ?? '',
      preparation2: template.preparation2 ?? '',
      preparation3: template.preparation3 ?? '',
    };
  } catch (error) {
    console.error('Failed to get template:', error);
    return undefined;
  }
}

// ============================================================================
// 템플릿에서 작업 생성
// ============================================================================

/**
 * 템플릿에서 Task 생성
 *
 * @param {Template} template - 템플릿 객체
 * @returns {Task} 생성된 작업 객체
 * @throws 없음
 * @sideEffects 없음 (순수 함수)
 */
export function createTaskFromTemplate(template: Template): Task {
  const now = new Date().toISOString();
  const adjustedDuration = Math.round(template.baseDuration * getResistanceMultiplier(template.resistance));

  return {
    id: generateId('task'),
    text: template.text,
    memo: template.memo,
    baseDuration: template.baseDuration,
    resistance: template.resistance,
    adjustedDuration,
    timeBlock: template.timeBlock,
    completed: false,
    actualDuration: 0,
    createdAt: now,
    completedAt: null,
    fromAutoTemplate: false,
    preparation1: template.preparation1 || '',
    preparation2: template.preparation2 || '',
    preparation3: template.preparation3 || '',
  };
}

/**
 * 자동 생성 템플릿에서 Task 생성
 *
 * @param {Template} template - 자동 생성 템플릿 객체
 * @returns {Task} fromAutoTemplate 플래그가 true인 작업 객체
 * @throws 없음
 * @sideEffects 없음 (순수 함수)
 */
export function createTaskFromAutoTemplate(template: Template): Task {
  const task = createTaskFromTemplate(template);
  task.fromAutoTemplate = true;
  return task;
}

/**
 * 저항도 배율 가져오기
 */
function getResistanceMultiplier(resistance: Resistance): number {
  const multipliers = {
    low: 1.0,
    medium: 1.3,
    high: 1.6,
  };
  return multipliers[resistance];
}

// ============================================================================
// 자동 생성
// ============================================================================

/**
 * 자동 생성 템플릿 조회
 *
 * @returns {Promise<Template[]>} autoGenerate가 true인 템플릿 배열
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 필터링된 데이터 조회
 */
export async function getAutoGenerateTemplates(): Promise<Template[]> {
  try {
    const templates = await db.templates.where('autoGenerate').equals(1).toArray();

    // preparation 필드의 undefined를 빈 문자열로 정제
    return templates.map(template => ({
      ...template,
      preparation1: template.preparation1 ?? '',
      preparation2: template.preparation2 ?? '',
      preparation3: template.preparation3 ?? '',
    }));
  } catch (error) {
    console.error('Failed to get auto-generate templates:', error);
    return [];
  }
}

/**
 * 템플릿이 오늘 생성되어야 하는지 확인
 *
 * @param {Template} template - 템플릿 객체
 * @param {string} today - 오늘 날짜 (YYYY-MM-DD)
 * @returns {boolean} 오늘 생성 여부
 */
function shouldGenerateToday(template: Template, today: string): boolean {
  const { recurrenceType, weeklyDays, intervalDays, lastGeneratedDate } = template;

  // 매일 생성
  if (recurrenceType === 'daily') {
    // 오늘 이미 생성했다면 스킵
    return lastGeneratedDate !== today;
  }

  // 매주 특정 요일
  if (recurrenceType === 'weekly' && weeklyDays && weeklyDays.length > 0) {
    const dayOfWeek = new Date(today).getDay(); // 0=일요일, 1=월요일, ...
    const shouldGenerate = weeklyDays.includes(dayOfWeek);

    // 해당 요일이고 오늘 아직 생성하지 않았다면
    return shouldGenerate && lastGeneratedDate !== today;
  }

  // N일 주기
  if (recurrenceType === 'interval' && intervalDays) {
    // 마지막 생성 날짜가 없으면 생성
    if (!lastGeneratedDate) return true;

    // 마지막 생성 날짜로부터 N일이 지났는지 확인
    const lastDate = new Date(lastGeneratedDate);
    const todayDate = new Date(today);
    const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    return daysDiff >= intervalDays;
  }

  // recurrenceType이 'none'이면 생성하지 않음
  return false;
}

/**
 * 자동 생성 템플릿에서 작업 생성 (매일 00시 실행)
 *
 * @returns {Promise<Task[]>} 생성된 작업 배열
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 자동 생성 템플릿 조회
 *   - 템플릿의 lastGeneratedDate 업데이트
 */
export async function generateTasksFromAutoTemplates(): Promise<Task[]> {
  try {
    const autoTemplates = await getAutoGenerateTemplates();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tasksToGenerate: Task[] = [];

    for (const template of autoTemplates) {
      // 주기에 따라 오늘 생성해야 하는지 확인
      if (shouldGenerateToday(template, today)) {
        const task = createTaskFromAutoTemplate(template);
        tasksToGenerate.push(task);

        // 템플릿의 lastGeneratedDate 업데이트
        await updateTemplate(template.id, {
          lastGeneratedDate: today
        });
      }
    }

    return tasksToGenerate;
  } catch (error) {
    console.error('Failed to generate tasks from auto-templates:', error);
    return [];
  }
}

/**
 * Template Repository
 *
 * @role 작업 템플릿 데이터 관리 및 자동 생성 작업 처리
 * @input Template 객체, 템플릿 ID, Task 생성 요청
 * @output Template 배열, Template 객체, Task 객체
 * @external_dependencies
 *   - IndexedDB (db.templates): 메인 저장소
 *   - localStorage (STORAGE_KEYS.TEMPLATES): 백업 저장소
 *   - @/shared/types/domain: Template, Task, TimeBlockId, Resistance 타입
 */

import { db } from '../db/dexieClient';
import type { Template, Task, TimeBlockId, Resistance } from '@/shared/types/domain';
import { saveToStorage, getFromStorage } from '@/shared/lib/utils';
import { STORAGE_KEYS } from '@/shared/lib/constants';

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
 */
export async function loadTemplates(): Promise<Template[]> {
  try {
    // 1. IndexedDB에서 조회
    const templates = await db.templates.toArray();

    if (templates.length > 0) {
      // preparation 필드의 undefined를 빈 문자열로 정제
      return templates.map(template => ({
        ...template,
        preparation1: template.preparation1 ?? '',
        preparation2: template.preparation2 ?? '',
        preparation3: template.preparation3 ?? '',
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
 * @returns {Promise<Template>} 생성된 템플릿
 * @throws {Error} IndexedDB 또는 localStorage 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 템플릿 저장
 *   - localStorage에 백업
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
  preparation3?: string
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
      preparation1: preparation1 || '',
      preparation2: preparation2 || '',
      preparation3: preparation3 || '',
    };

    // IndexedDB에 저장
    await db.templates.put(template);

    // localStorage에도 저장
    const templates = await loadTemplates();
    saveToStorage(STORAGE_KEYS.TEMPLATES, templates);

    return template;
  } catch (error) {
    console.error('Failed to create template:', error);
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

    // IndexedDB에 저장
    await db.templates.put(updatedTemplate);

    // localStorage에도 저장
    const templates = await loadTemplates();
    saveToStorage(STORAGE_KEYS.TEMPLATES, templates);

    return updatedTemplate;
  } catch (error) {
    console.error('Failed to update template:', error);
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
 */
export async function deleteTemplate(id: string): Promise<void> {
  try {
    await db.templates.delete(id);

    // localStorage에도 반영
    const templates = await loadTemplates();
    saveToStorage(STORAGE_KEYS.TEMPLATES, templates);

  } catch (error) {
    console.error('Failed to delete template:', error);
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
    id: `task-${Date.now()}`,
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
 * 자동 생성 템플릿에서 작업 생성 (매일 00시 실행)
 *
 * @returns {Promise<Task[]>} 생성된 작업 배열
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 자동 생성 템플릿 조회
 */
export async function generateTasksFromAutoTemplates(): Promise<Task[]> {
  try {
    const autoTemplates = await getAutoGenerateTemplates();
    const tasks = autoTemplates.map(template => createTaskFromAutoTemplate(template));

    return tasks;
  } catch (error) {
    console.error('Failed to generate tasks from auto-templates:', error);
    return [];
  }
}

/**
 * Template 저장소
 * 템플릿 CRUD 및 자동 생성 관리
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
 */
export async function loadTemplates(): Promise<Template[]> {
  try {
    // 1. IndexedDB에서 조회
    const templates = await db.templates.toArray();

    if (templates.length > 0) {
      return templates;
    }

    // 2. localStorage에서 조회
    const localTemplates = getFromStorage<Template[]>(STORAGE_KEYS.TEMPLATES, []);

    if (localTemplates.length > 0) {
      // localStorage 데이터를 IndexedDB에 저장
      await db.templates.bulkPut(localTemplates);
      return localTemplates;
    }

    return [];
  } catch (error) {
    console.error('Failed to load templates:', error);
    return [];
  }
}

/**
 * 템플릿 생성
 */
export async function createTemplate(
  name: string,
  text: string,
  memo: string,
  baseDuration: number,
  resistance: Resistance,
  timeBlock: TimeBlockId,
  autoGenerate: boolean
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
    };

    // IndexedDB에 저장
    await db.templates.put(template);

    // localStorage에도 저장
    const templates = await loadTemplates();
    saveToStorage(STORAGE_KEYS.TEMPLATES, templates);

    console.log('✅ Template created:', template.name);
    return template;
  } catch (error) {
    console.error('Failed to create template:', error);
    throw error;
  }
}

/**
 * 템플릿 업데이트
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

    const updatedTemplate = { ...template, ...updates };

    // IndexedDB에 저장
    await db.templates.put(updatedTemplate);

    // localStorage에도 저장
    const templates = await loadTemplates();
    saveToStorage(STORAGE_KEYS.TEMPLATES, templates);

    console.log('✅ Template updated:', updatedTemplate.name);
    return updatedTemplate;
  } catch (error) {
    console.error('Failed to update template:', error);
    throw error;
  }
}

/**
 * 템플릿 삭제
 */
export async function deleteTemplate(id: string): Promise<void> {
  try {
    await db.templates.delete(id);

    // localStorage에도 반영
    const templates = await loadTemplates();
    saveToStorage(STORAGE_KEYS.TEMPLATES, templates);

    console.log('✅ Template deleted:', id);
  } catch (error) {
    console.error('Failed to delete template:', error);
    throw error;
  }
}

/**
 * 특정 템플릿 조회
 */
export async function getTemplate(id: string): Promise<Template | undefined> {
  try {
    return await db.templates.get(id);
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
  };
}

/**
 * 자동 생성 템플릿에서 Task 생성
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
 */
export async function getAutoGenerateTemplates(): Promise<Template[]> {
  try {
    return await db.templates.where('autoGenerate').equals(1).toArray();
  } catch (error) {
    console.error('Failed to get auto-generate templates:', error);
    return [];
  }
}

/**
 * 자동 생성 템플릿에서 작업 생성 (매일 00시 실행)
 */
export async function generateTasksFromAutoTemplates(): Promise<Task[]> {
  try {
    const autoTemplates = await getAutoGenerateTemplates();
    const tasks = autoTemplates.map(template => createTaskFromAutoTemplate(template));

    console.log(`✅ Generated ${tasks.length} tasks from auto-templates`);
    return tasks;
  } catch (error) {
    console.error('Failed to generate tasks from auto-templates:', error);
    return [];
  }
}

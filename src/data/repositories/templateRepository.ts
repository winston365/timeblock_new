/**
 * Template Repository
 *
 * @role 작업 템플릿 데이터 관리 및 자동 생성 작업 처리
 * @input Template 객체, 템플릿 ID, Task 생성 요청
 * @output Template 배열, Template 객체, Task 객체
 * @external_dependencies
 *   - IndexedDB (db.templates): 메인 저장소
 *   - Firebase: 실시간 동기화 (fetchFromFirebase)
 *   - @/shared/types/domain: Template, Task, TimeBlockId, Resistance 타입
 */

import { db } from '../db/dexieClient';
import type { Template, Task, TimeBlockId, Resistance, RecurrenceType } from '@/shared/types/domain';
import { RESISTANCE_MULTIPLIERS } from '@/shared/types/domain';
import { getBlockById } from '@/shared/utils/timeBlockUtils';
import { generateId, getLocalDate } from '@/shared/lib/utils';
import { withFirebaseFetch } from '@/shared/utils/firebaseGuard';
import { fetchFromFirebase } from '@/shared/services/sync/firebase/syncCore';
import { templateStrategy } from '@/shared/services/sync/firebase/strategies';
import { addSyncLog } from '@/shared/services/sync/syncLogger';

// ============================================================================
// Template 정제 (Sanitization)
// ============================================================================

/**
 * Template 필드 정제 (undefined → 기본값)
 * 
 * Firebase에서 로드한 데이터나 구버전 데이터의 누락 필드를 기본값으로 채웁니다.
 * 
 * @param template - 정제할 Template 객체
 * @returns 정제된 Template 객체
 */
function sanitizeTemplate(template: Template): Template {
  return {
    ...template,
    preparation1: template.preparation1 ?? '',
    preparation2: template.preparation2 ?? '',
    preparation3: template.preparation3 ?? '',
    category: template.category ?? '',
    isFavorite: template.isFavorite ?? false,
    imageUrl: template.imageUrl ?? '',
  };
}
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
 *   - Firebase 폴백 시 IndexedDB에 데이터 복원
 */
export async function loadTemplates(): Promise<Template[]> {
  try {
    // 1. IndexedDB에서 조회
    const templates = await db.templates.toArray();

    if (templates.length > 0) {
      return templates.map(sanitizeTemplate);
    }

    // 2. Firebase에서 조회 (IndexedDB가 비어있을 때만)
    const firebaseTemplates = await withFirebaseFetch(
      () => fetchFromFirebase<Template[]>(templateStrategy),
      null
    );

    if (firebaseTemplates && firebaseTemplates.length > 0) {
      const sanitizedTemplates = firebaseTemplates.map(sanitizeTemplate);
      addSyncLog('firebase', 'load', `Loaded ${sanitizedTemplates.length} templates from Firebase`);
      return sanitizedTemplates;
    }

    return [];
  } catch (error) {
    console.error('Failed to load templates:', error);
    return [];
  }
}

/**
 * ?쒗뵆由??앹꽦
 *
 * @param {string} name - ?쒗뵆由??대쫫
 * @param {string} text - ?묒뾽 ?댁슜
 * @param {string} memo - 硫붾え
 * @param {number} baseDuration - 湲곕낯 ?뚯슂 ?쒓컙 (遺?
 * @param {Resistance} resistance - ???룄 (low, medium, high)
 * @param {TimeBlockId} timeBlock - ??꾨툝濡?ID
 * @param {boolean} autoGenerate - ?먮룞 ?앹꽦 ?щ?
 * @param {string} preparation1 - 以鍮??ы빆 1
 * @param {string} preparation2 - 以鍮??ы빆 2
 * @param {string} preparation3 - 以鍮??ы빆 3
 * @param {RecurrenceType} recurrenceType - 諛섎났 二쇨린 ???
 * @param {number[]} weeklyDays - 留ㅼ＜ 諛섎났 ?붿씪 (0=?쇱슂?? ..., 6=?좎슂??
 * @param {number} intervalDays - N??二쇨린
 * @param {string} category - 移댄뀒怨좊━
 * @param {boolean} isFavorite - 利먭꺼李얘린 ?щ?
 * @param {string} imageUrl - ?대?吏 URL
 * @returns {Promise<Template>} ?앹꽦???쒗뵆由?
 * @throws {Error} IndexedDB ?먮뒗 localStorage ????ㅽ뙣 ??
 * @sideEffects
 *   - IndexedDB???쒗뵆由????
 *   - localStorage??諛깆뾽
 *   - Firebase??鍮꾨룞湲??숆린??
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
  isFavorite?: boolean,
  imageUrl?: string
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
      imageUrl: imageUrl || '',
    };

    // 1. IndexedDB에 저장
    await db.templates.put(template);

    addSyncLog('dexie', 'save', 'Template created', {
      id: template.id,
      name: template.name,
      autoGenerate: template.autoGenerate
    });



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

    // 1. IndexedDB에 저장
    await db.templates.put(updatedTemplate);

    addSyncLog('dexie', 'save', 'Template updated', {
      id: updatedTemplate.id,
      name: updatedTemplate.name
    });



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
 */
export async function deleteTemplate(id: string): Promise<void> {
  try {
    // 1. IndexedDB에서 삭제
    await db.templates.delete(id);

    addSyncLog('dexie', 'save', 'Template deleted', { id });



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
    return template ? sanitizeTemplate(template) : undefined;
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

  // timeBlock이 설정되어 있으면 해당 블록의 첫 번째 시간(start hour)을 hourSlot으로 설정
  let hourSlot: number | undefined = undefined;
  if (template.timeBlock) {
    hourSlot = getBlockById(template.timeBlock)?.start;
  }

  return {
    id: generateId('task'),
    text: template.text,
    memo: template.memo,
    baseDuration: template.baseDuration,
    resistance: template.resistance,
    adjustedDuration,
    timeBlock: template.timeBlock,
    hourSlot, // ??꾨툝濡앹쓽 泥?踰덉㎏ ?쒓컙?濡??ㅼ젙
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
 * 저항도 배수 가져오기
 *
 * @param {Resistance} resistance - 저항도 레벨
 * @returns {number} 저항도에 따른 배수
 */
function getResistanceMultiplier(resistance: Resistance): number {
  return RESISTANCE_MULTIPLIERS[resistance] ?? 1.0;
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
    return templates.map(sanitizeTemplate);
  } catch (error) {
    console.error('Failed to get auto-generate templates:', error);
    return [];
  }
}

/**
 * 템플릿이 오늘 생성되어야 하는지 확인
 *
 * @param {Template} template - 템플릿 객체
 * @param {string} todayDateStr - 오늘 날짜 (YYYY-MM-DD)
 * @returns {boolean} 오늘 생성 여부
 */
function shouldGenerateToday(template: Template, today: string): boolean {
  const { recurrenceType, weeklyDays, intervalDays, lastGeneratedDate } = template;

  // 留ㅼ씪 ?앹꽦
  if (recurrenceType === 'daily') {
    // ?ㅻ뒛 ?대? ?앹꽦?덈떎硫??ㅽ궢
    return lastGeneratedDate !== today;
  }

  // 留ㅼ＜ ?뱀젙 ?붿씪
  if (recurrenceType === 'weekly' && weeklyDays && weeklyDays.length > 0) {
    const dayOfWeek = new Date(today).getDay(); // 0=?쇱슂?? 1=?붿슂?? ...
    const shouldGenerate = weeklyDays.includes(dayOfWeek);

    // ?대떦 ?붿씪?닿퀬 ?ㅻ뒛 ?꾩쭅 ?앹꽦?섏? ?딆븯?ㅻ㈃
    return shouldGenerate && lastGeneratedDate !== today;
  }

  // N??二쇨린
  if (recurrenceType === 'interval' && intervalDays) {
    // 留덉?留??앹꽦 ?좎쭨媛 ?놁쑝硫??앹꽦
    if (!lastGeneratedDate) return true;

    // 留덉?留??앹꽦 ?좎쭨濡쒕???N?쇱씠 吏?щ뒗吏 ?뺤씤
    const lastDate = new Date(lastGeneratedDate);
    const todayDate = new Date(today);
    const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    return daysDiff >= intervalDays;
  }

  // recurrenceType??'none'?대㈃ ?앹꽦?섏? ?딆쓬
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
    const today = getLocalDate();
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


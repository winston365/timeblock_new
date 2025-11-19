/**
 * Template Repository
 *
 * @role ?묒뾽 ?쒗뵆由??곗씠??愿由?諛??먮룞 ?앹꽦 ?묒뾽 泥섎━
 * @input Template 媛앹껜, ?쒗뵆由?ID, Task ?앹꽦 ?붿껌
 * @output Template 諛곗뿴, Template 媛앹껜, Task 媛앹껜
 * @external_dependencies
 *   - IndexedDB (db.templates): 硫붿씤 ??μ냼
 *   - localStorage (STORAGE_KEYS.TEMPLATES): 諛깆뾽 ??μ냼
 *   - Firebase: ?ㅼ떆媛??숆린??(syncToFirebase)
 *   - @/shared/types/domain: Template, Task, TimeBlockId, Resistance ???
 */

import { db } from '../db/dexieClient';
import type { Template, Task, TimeBlockId, Resistance, RecurrenceType } from '@/shared/types/domain';
import { TIME_BLOCKS, RESISTANCE_MULTIPLIERS } from '@/shared/types/domain';
import { generateId } from '@/shared/lib/utils';
import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';
import { fetchFromFirebase } from '@/shared/services/sync/firebase/syncCore';
import { templateStrategy } from '@/shared/services/sync/firebase/strategies';
import { addSyncLog } from '@/shared/services/sync/syncLogger';

// ============================================================================
// Template CRUD
// ============================================================================

/**
 * 紐⑤뱺 ?쒗뵆由?濡쒕뱶
 *
 * @returns {Promise<Template[]>} ?쒗뵆由?諛곗뿴
 * @throws ?놁쓬
 * @sideEffects
 *   - IndexedDB?먯꽌 ?곗씠??議고쉶
 *   - localStorage ?대갚 ??IndexedDB???곗씠??蹂듭썝
 *   - Firebase ?대갚 ??IndexedDB???곗씠??蹂듭썝
 */
export async function loadTemplates(): Promise<Template[]> {
  try {
    // 1. IndexedDB?먯꽌 議고쉶
    const templates = await db.templates.toArray();

    if (templates.length > 0) {
      // preparation ?꾨뱶??undefined瑜?鍮?臾몄옄?대줈 ?뺤젣, category? isFavorite 湲곕낯媛??ㅼ젙
      return templates.map(template => ({
        ...template,
        preparation1: template.preparation1 ?? '',
        preparation2: template.preparation2 ?? '',
        preparation3: template.preparation3 ?? '',
        category: template.category ?? '',
        isFavorite: template.isFavorite ?? false,
        imageUrl: template.imageUrl ?? '',
      }));
    }

    // 2. Firebase?먯꽌 議고쉶 (IndexedDB ?ㅽ뙣 ??
    if (isFirebaseInitialized()) {
      const firebaseTemplates = await fetchFromFirebase<Template[]>(templateStrategy);

      if (firebaseTemplates && firebaseTemplates.length > 0) {
        // preparation ?꾨뱶 ?뺤젣
        const sanitizedTemplates = firebaseTemplates.map(template => ({
          ...template,
          preparation1: template.preparation1 ?? '',
          preparation2: template.preparation2 ?? '',
          preparation3: template.preparation3 ?? '',
          category: template.category ?? '',
          isFavorite: template.isFavorite ?? false,
          imageUrl: template.imageUrl ?? '',
        }));

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

    // 1. IndexedDB?????
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
 * ?쒗뵆由??낅뜲?댄듃
 *
 * @param {string} id - ?쒗뵆由?ID
 * @param {Partial<Omit<Template, 'id'>>} updates - ?낅뜲?댄듃???꾨뱶
 * @returns {Promise<Template>} ?낅뜲?댄듃???쒗뵆由?
 * @throws {Error} ?쒗뵆由우씠 議댁옱?섏? ?딄굅??????ㅽ뙣 ??
 * @sideEffects
 *   - IndexedDB?먯꽌 ?쒗뵆由?議고쉶 諛??낅뜲?댄듃
 *   - localStorage??諛깆뾽
 *   - Firebase??鍮꾨룞湲??숆린??
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

    // 1. IndexedDB?????
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
 * ?쒗뵆由???젣
 *
 * @param {string} id - ??젣???쒗뵆由?ID
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB ??젣 ?ㅽ뙣 ??
 * @sideEffects
 *   - IndexedDB?먯꽌 ?쒗뵆由???젣
 *   - localStorage??蹂寃쎌궗??諛섏쁺
 *   - Firebase??鍮꾨룞湲??숆린??
 */
export async function deleteTemplate(id: string): Promise<void> {
  try {
    // 1. IndexedDB?먯꽌 ??젣
    await db.templates.delete(id);

    addSyncLog('dexie', 'save', 'Template deleted', { id });



  } catch (error) {
    console.error('Failed to delete template:', error);
    addSyncLog('dexie', 'error', 'Failed to delete template', undefined, error as Error);
    throw error;
  }
}

/**
 * ?뱀젙 ?쒗뵆由?議고쉶
 *
 * @param {string} id - ?쒗뵆由?ID
 * @returns {Promise<Template | undefined>} ?쒗뵆由?媛앹껜 ?먮뒗 undefined
 * @throws ?놁쓬
 * @sideEffects
 *   - IndexedDB?먯꽌 ?곗씠??議고쉶
 */
export async function getTemplate(id: string): Promise<Template | undefined> {
  try {
    const template = await db.templates.get(id);

    if (!template) {
      return undefined;
    }

    // preparation ?꾨뱶??undefined瑜?鍮?臾몄옄?대줈 ?뺤젣
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
// ?쒗뵆由우뿉???묒뾽 ?앹꽦
// ============================================================================

/**
 * ?쒗뵆由우뿉??Task ?앹꽦
 *
 * @param {Template} template - ?쒗뵆由?媛앹껜
 * @returns {Task} ?앹꽦???묒뾽 媛앹껜
 * @throws ?놁쓬
 * @sideEffects ?놁쓬 (?쒖닔 ?⑥닔)
 */
export function createTaskFromTemplate(template: Template): Task {
  const now = new Date().toISOString();
  const adjustedDuration = Math.round(template.baseDuration * getResistanceMultiplier(template.resistance));

  // timeBlock???ㅼ젙?섏뼱 ?덉쑝硫??대떦 釉붾줉??泥?踰덉㎏ ?쒓컙?(start hour)瑜?hourSlot?쇰줈 ?ㅼ젙
  let hourSlot: number | undefined = undefined;
  if (template.timeBlock) {
    const block = TIME_BLOCKS.find(b => b.id === template.timeBlock);
    if (block) {
      hourSlot = block.start;
    }
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
 * ?먮룞 ?앹꽦 ?쒗뵆由우뿉??Task ?앹꽦
 *
 * @param {Template} template - ?먮룞 ?앹꽦 ?쒗뵆由?媛앹껜
 * @returns {Task} fromAutoTemplate ?뚮옒洹멸? true???묒뾽 媛앹껜
 * @throws ?놁쓬
 * @sideEffects ?놁쓬 (?쒖닔 ?⑥닔)
 */
export function createTaskFromAutoTemplate(template: Template): Task {
  const task = createTaskFromTemplate(template);
  task.fromAutoTemplate = true;
  return task;
}

/**
 * ???룄 諛곗쑉 媛?몄삤湲?
 */
function getResistanceMultiplier(resistance: Resistance): number {
  return RESISTANCE_MULTIPLIERS[resistance] ?? 1.0;
}

// ============================================================================
// ?먮룞 ?앹꽦
// ============================================================================

/**
 * ?먮룞 ?앹꽦 ?쒗뵆由?議고쉶
 *
 * @returns {Promise<Template[]>} autoGenerate媛 true???쒗뵆由?諛곗뿴
 * @throws ?놁쓬
 * @sideEffects
 *   - IndexedDB?먯꽌 ?꾪꽣留곷맂 ?곗씠??議고쉶
 */
export async function getAutoGenerateTemplates(): Promise<Template[]> {
  try {
    const templates = await db.templates.where('autoGenerate').equals(1).toArray();

    // preparation ?꾨뱶??undefined瑜?鍮?臾몄옄?대줈 ?뺤젣
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
 * ?쒗뵆由우씠 ?ㅻ뒛 ?앹꽦?섏뼱???섎뒗吏 ?뺤씤
 *
 * @param {Template} template - ?쒗뵆由?媛앹껜
 * @param {string} today - ?ㅻ뒛 ?좎쭨 (YYYY-MM-DD)
 * @returns {boolean} ?ㅻ뒛 ?앹꽦 ?щ?
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
 * ?먮룞 ?앹꽦 ?쒗뵆由우뿉???묒뾽 ?앹꽦 (留ㅼ씪 00???ㅽ뻾)
 *
 * @returns {Promise<Task[]>} ?앹꽦???묒뾽 諛곗뿴
 * @throws ?놁쓬
 * @sideEffects
 *   - IndexedDB?먯꽌 ?먮룞 ?앹꽦 ?쒗뵆由?議고쉶
 *   - ?쒗뵆由우쓽 lastGeneratedDate ?낅뜲?댄듃
 */
export async function generateTasksFromAutoTemplates(): Promise<Task[]> {
  try {
    const autoTemplates = await getAutoGenerateTemplates();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tasksToGenerate: Task[] = [];

    for (const template of autoTemplates) {
      // 二쇨린???곕씪 ?ㅻ뒛 ?앹꽦?댁빞 ?섎뒗吏 ?뺤씤
      if (shouldGenerateToday(template, today)) {
        const task = createTaskFromAutoTemplate(template);
        tasksToGenerate.push(task);

        // ?쒗뵆由우쓽 lastGeneratedDate ?낅뜲?댄듃
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


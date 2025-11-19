/**
 * Template Repository
 *
 * @role ?‘ì—… ?œí”Œë¦??°ì´??ê´€ë¦?ë°??ë™ ?ì„± ?‘ì—… ì²˜ë¦¬
 * @input Template ê°ì²´, ?œí”Œë¦?ID, Task ?ì„± ?”ì²­
 * @output Template ë°°ì—´, Template ê°ì²´, Task ê°ì²´
 * @external_dependencies
 *   - IndexedDB (db.templates): ë©”ì¸ ?€?¥ì†Œ
 *   - localStorage (STORAGE_KEYS.TEMPLATES): ë°±ì—… ?€?¥ì†Œ
 *   - Firebase: ?¤ì‹œê°??™ê¸°??(syncToFirebase)
 *   - @/shared/types/domain: Template, Task, TimeBlockId, Resistance ?€??
 */

import { db } from '../db/dexieClient';
import type { Template, Task, TimeBlockId, Resistance, RecurrenceType } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { generateId } from '@/shared/lib/utils';
import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';
import { fetchFromFirebase } from '@/shared/services/sync/firebase/syncCore';
import { templateStrategy } from '@/shared/services/sync/firebase/strategies';
import { addSyncLog } from '@/shared/services/sync/syncLogger';

// ============================================================================
// Template CRUD
// ============================================================================

/**
 * ëª¨ë“  ?œí”Œë¦?ë¡œë“œ
 *
 * @returns {Promise<Template[]>} ?œí”Œë¦?ë°°ì—´
 * @throws ?†ìŒ
 * @sideEffects
 *   - IndexedDB?ì„œ ?°ì´??ì¡°íšŒ
 *   - localStorage ?´ë°± ??IndexedDB???°ì´??ë³µì›
 *   - Firebase ?´ë°± ??IndexedDB???°ì´??ë³µì›
 */
export async function loadTemplates(): Promise<Template[]> {
  try {
    // 1. IndexedDB?ì„œ ì¡°íšŒ
    const templates = await db.templates.toArray();

    if (templates.length > 0) {
      // preparation ?„ë“œ??undefinedë¥?ë¹?ë¬¸ì?´ë¡œ ?•ì œ, category?€ isFavorite ê¸°ë³¸ê°??¤ì •
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

    // 2. Firebase?ì„œ ì¡°íšŒ (IndexedDB ?¤íŒ¨ ??
    if (isFirebaseInitialized()) {
      const firebaseTemplates = await fetchFromFirebase<Template[]>(templateStrategy);

      if (firebaseTemplates && firebaseTemplates.length > 0) {
        // preparation ?„ë“œ ?•ì œ
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
 * ?œí”Œë¦??ì„±
 *
 * @param {string} name - ?œí”Œë¦??´ë¦„
 * @param {string} text - ?‘ì—… ?´ìš©
 * @param {string} memo - ë©”ëª¨
 * @param {number} baseDuration - ê¸°ë³¸ ?Œìš” ?œê°„ (ë¶?
 * @param {Resistance} resistance - ?€??„ (low, medium, high)
 * @param {TimeBlockId} timeBlock - ?€?„ë¸”ë¡?ID
 * @param {boolean} autoGenerate - ?ë™ ?ì„± ?¬ë?
 * @param {string} preparation1 - ì¤€ë¹??¬í•­ 1
 * @param {string} preparation2 - ì¤€ë¹??¬í•­ 2
 * @param {string} preparation3 - ì¤€ë¹??¬í•­ 3
 * @param {RecurrenceType} recurrenceType - ë°˜ë³µ ì£¼ê¸° ?€??
 * @param {number[]} weeklyDays - ë§¤ì£¼ ë°˜ë³µ ?”ì¼ (0=?¼ìš”?? ..., 6=? ìš”??
 * @param {number} intervalDays - N??ì£¼ê¸°
 * @param {string} category - ì¹´í…Œê³ ë¦¬
 * @param {boolean} isFavorite - ì¦ê²¨ì°¾ê¸° ?¬ë?
 * @param {string} imageUrl - ?´ë?ì§€ URL
 * @returns {Promise<Template>} ?ì„±???œí”Œë¦?
 * @throws {Error} IndexedDB ?ëŠ” localStorage ?€???¤íŒ¨ ??
 * @sideEffects
 *   - IndexedDB???œí”Œë¦??€??
 *   - localStorage??ë°±ì—…
 *   - Firebase??ë¹„ë™ê¸??™ê¸°??
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

    // 1. IndexedDB???€??
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
 * ?œí”Œë¦??…ë°?´íŠ¸
 *
 * @param {string} id - ?œí”Œë¦?ID
 * @param {Partial<Omit<Template, 'id'>>} updates - ?…ë°?´íŠ¸???„ë“œ
 * @returns {Promise<Template>} ?…ë°?´íŠ¸???œí”Œë¦?
 * @throws {Error} ?œí”Œë¦¿ì´ ì¡´ì¬?˜ì? ?Šê±°???€???¤íŒ¨ ??
 * @sideEffects
 *   - IndexedDB?ì„œ ?œí”Œë¦?ì¡°íšŒ ë°??…ë°?´íŠ¸
 *   - localStorage??ë°±ì—…
 *   - Firebase??ë¹„ë™ê¸??™ê¸°??
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

    // 1. IndexedDB???€??
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
 * ?œí”Œë¦??? œ
 *
 * @param {string} id - ?? œ???œí”Œë¦?ID
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB ?? œ ?¤íŒ¨ ??
 * @sideEffects
 *   - IndexedDB?ì„œ ?œí”Œë¦??? œ
 *   - localStorage??ë³€ê²½ì‚¬??ë°˜ì˜
 *   - Firebase??ë¹„ë™ê¸??™ê¸°??
 */
export async function deleteTemplate(id: string): Promise<void> {
  try {
    // 1. IndexedDB?ì„œ ?? œ
    await db.templates.delete(id);

    addSyncLog('dexie', 'save', 'Template deleted', { id });



  } catch (error) {
    console.error('Failed to delete template:', error);
    addSyncLog('dexie', 'error', 'Failed to delete template', undefined, error as Error);
    throw error;
  }
}

/**
 * ?¹ì • ?œí”Œë¦?ì¡°íšŒ
 *
 * @param {string} id - ?œí”Œë¦?ID
 * @returns {Promise<Template | undefined>} ?œí”Œë¦?ê°ì²´ ?ëŠ” undefined
 * @throws ?†ìŒ
 * @sideEffects
 *   - IndexedDB?ì„œ ?°ì´??ì¡°íšŒ
 */
export async function getTemplate(id: string): Promise<Template | undefined> {
  try {
    const template = await db.templates.get(id);

    if (!template) {
      return undefined;
    }

    // preparation ?„ë“œ??undefinedë¥?ë¹?ë¬¸ì?´ë¡œ ?•ì œ
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
// ?œí”Œë¦¿ì—???‘ì—… ?ì„±
// ============================================================================

/**
 * ?œí”Œë¦¿ì—??Task ?ì„±
 *
 * @param {Template} template - ?œí”Œë¦?ê°ì²´
 * @returns {Task} ?ì„±???‘ì—… ê°ì²´
 * @throws ?†ìŒ
 * @sideEffects ?†ìŒ (?œìˆ˜ ?¨ìˆ˜)
 */
export function createTaskFromTemplate(template: Template): Task {
  const now = new Date().toISOString();
  const adjustedDuration = Math.round(template.baseDuration * getResistanceMultiplier(template.resistance));

  // timeBlock???¤ì •?˜ì–´ ?ˆìœ¼ë©??´ë‹¹ ë¸”ë¡??ì²?ë²ˆì§¸ ?œê°„?€(start hour)ë¥?hourSlot?¼ë¡œ ?¤ì •
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
    hourSlot, // ?€?„ë¸”ë¡ì˜ ì²?ë²ˆì§¸ ?œê°„?€ë¡??¤ì •
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
 * ?ë™ ?ì„± ?œí”Œë¦¿ì—??Task ?ì„±
 *
 * @param {Template} template - ?ë™ ?ì„± ?œí”Œë¦?ê°ì²´
 * @returns {Task} fromAutoTemplate ?Œë˜ê·¸ê? true???‘ì—… ê°ì²´
 * @throws ?†ìŒ
 * @sideEffects ?†ìŒ (?œìˆ˜ ?¨ìˆ˜)
 */
export function createTaskFromAutoTemplate(template: Template): Task {
  const task = createTaskFromTemplate(template);
  task.fromAutoTemplate = true;
  return task;
}

/**
 * ?€??„ ë°°ìœ¨ ê°€?¸ì˜¤ê¸?
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
// ?ë™ ?ì„±
// ============================================================================

/**
 * ?ë™ ?ì„± ?œí”Œë¦?ì¡°íšŒ
 *
 * @returns {Promise<Template[]>} autoGenerateê°€ true???œí”Œë¦?ë°°ì—´
 * @throws ?†ìŒ
 * @sideEffects
 *   - IndexedDB?ì„œ ?„í„°ë§ëœ ?°ì´??ì¡°íšŒ
 */
export async function getAutoGenerateTemplates(): Promise<Template[]> {
  try {
    const templates = await db.templates.where('autoGenerate').equals(1).toArray();

    // preparation ?„ë“œ??undefinedë¥?ë¹?ë¬¸ì?´ë¡œ ?•ì œ
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
 * ?œí”Œë¦¿ì´ ?¤ëŠ˜ ?ì„±?˜ì–´???˜ëŠ”ì§€ ?•ì¸
 *
 * @param {Template} template - ?œí”Œë¦?ê°ì²´
 * @param {string} today - ?¤ëŠ˜ ? ì§œ (YYYY-MM-DD)
 * @returns {boolean} ?¤ëŠ˜ ?ì„± ?¬ë?
 */
function shouldGenerateToday(template: Template, today: string): boolean {
  const { recurrenceType, weeklyDays, intervalDays, lastGeneratedDate } = template;

  // ë§¤ì¼ ?ì„±
  if (recurrenceType === 'daily') {
    // ?¤ëŠ˜ ?´ë? ?ì„±?ˆë‹¤ë©??¤í‚µ
    return lastGeneratedDate !== today;
  }

  // ë§¤ì£¼ ?¹ì • ?”ì¼
  if (recurrenceType === 'weekly' && weeklyDays && weeklyDays.length > 0) {
    const dayOfWeek = new Date(today).getDay(); // 0=?¼ìš”?? 1=?”ìš”?? ...
    const shouldGenerate = weeklyDays.includes(dayOfWeek);

    // ?´ë‹¹ ?”ì¼?´ê³  ?¤ëŠ˜ ?„ì§ ?ì„±?˜ì? ?Šì•˜?¤ë©´
    return shouldGenerate && lastGeneratedDate !== today;
  }

  // N??ì£¼ê¸°
  if (recurrenceType === 'interval' && intervalDays) {
    // ë§ˆì?ë§??ì„± ? ì§œê°€ ?†ìœ¼ë©??ì„±
    if (!lastGeneratedDate) return true;

    // ë§ˆì?ë§??ì„± ? ì§œë¡œë???N?¼ì´ ì§€?¬ëŠ”ì§€ ?•ì¸
    const lastDate = new Date(lastGeneratedDate);
    const todayDate = new Date(today);
    const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    return daysDiff >= intervalDays;
  }

  // recurrenceType??'none'?´ë©´ ?ì„±?˜ì? ?ŠìŒ
  return false;
}

/**
 * ?ë™ ?ì„± ?œí”Œë¦¿ì—???‘ì—… ?ì„± (ë§¤ì¼ 00???¤í–‰)
 *
 * @returns {Promise<Task[]>} ?ì„±???‘ì—… ë°°ì—´
 * @throws ?†ìŒ
 * @sideEffects
 *   - IndexedDB?ì„œ ?ë™ ?ì„± ?œí”Œë¦?ì¡°íšŒ
 *   - ?œí”Œë¦¿ì˜ lastGeneratedDate ?…ë°?´íŠ¸
 */
export async function generateTasksFromAutoTemplates(): Promise<Task[]> {
  try {
    const autoTemplates = await getAutoGenerateTemplates();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tasksToGenerate: Task[] = [];

    for (const template of autoTemplates) {
      // ì£¼ê¸°???°ë¼ ?¤ëŠ˜ ?ì„±?´ì•¼ ?˜ëŠ”ì§€ ?•ì¸
      if (shouldGenerateToday(template, today)) {
        const task = createTaskFromAutoTemplate(template);
        tasksToGenerate.push(task);

        // ?œí”Œë¦¿ì˜ lastGeneratedDate ?…ë°?´íŠ¸
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

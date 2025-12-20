/**
 * Task Factory
 *
 * @role Task 객체 생성을 위한 중앙화된 팩토리 함수
 * @input 작업 텍스트, 옵션 (memo, baseDuration, resistance, timeBlock, hourSlot, goalId 등)
 * @output 완전한 Task 객체
 * @external_dependencies
 *   - @/shared/lib/utils: generateId, calculateAdjustedDuration
 *   - @/shared/types/domain: Task, Resistance, TimeBlockId
 */

import { generateId, calculateAdjustedDuration } from '@/shared/lib/utils';
import type { Task, Resistance, TimeBlockId } from '@/shared/types/domain';
import { TASK_DEFAULTS } from '@/shared/constants/defaults';
import { getBlockById } from '@/shared/utils/timeBlockUtils';

// ============================================================================
// Types
// ============================================================================

/**
 * Task 생성 옵션 (모든 필드 선택적)
 */
export interface CreateTaskOptions {
  /** 작업 메모 */
  memo?: string;
  /** 기본 소요 시간 (분) */
  baseDuration?: number;
  /** 심리적 저항도 */
  resistance?: Resistance;
  /** 할당된 타임블록 ID (null이면 인박스) */
  timeBlock?: TimeBlockId;
  /** 시간대 슬롯 (hour) */
  hourSlot?: number;
  /** 연결된 목표 ID */
  goalId?: string | null;
  /** 준비 항목 1 (예상 방해물) */
  preparation1?: string;
  /** 준비 항목 2 (예상 방해물) */
  preparation2?: string;
  /** 준비 항목 3 (대처 전략) */
  preparation3?: string;
  /** 정렬 순서 */
  order?: number;
  /** 데드라인 (YYYY-MM-DD) */
  deadline?: string;
}

/**
 * 부분 Task 데이터 (모달에서 전달되는 형태)
 */
export type PartialTaskData = Partial<Task>;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 기본 Task 객체 생성
 *
 * @param text - 작업 제목
 * @param options - 생성 옵션
 * @returns 완전한 Task 객체
 *
 * @example
 * ```ts
 * // 간단한 인박스 작업
 * const task = createNewTask('보고서 작성');
 *
 * // 타임블록에 배치된 작업
 * const task = createNewTask('회의 준비', {
 *   timeBlock: 'morning',
 *   hourSlot: 9,
 *   baseDuration: 30,
 *   resistance: 'medium'
 * });
 *
 * // 준비 항목이 포함된 작업
 * const task = createNewTask('집중 작업', {
 *   preparation1: '피로감',
 *   preparation2: '알림 방해',
 *   preparation3: '휴대폰 무음, 타이머 설정'
 * });
 * ```
 */
export function createNewTask(text: string, options: CreateTaskOptions = {}): Task {
  const baseDuration = options.baseDuration ?? TASK_DEFAULTS.baseDuration;
  const resistance = options.resistance ?? TASK_DEFAULTS.resistance;
  const timeBlock = options.timeBlock ?? null;

  // hourSlot 자동 설정: timeBlock이 있고 hourSlot이 없으면 블록의 첫 시간대
  let hourSlot = options.hourSlot;
  if (hourSlot === undefined && timeBlock) {
    hourSlot = getBlockById(timeBlock)?.start;
  }

  return {
    id: generateId('task'),
    text: text.trim(),
    memo: options.memo ?? '',
    baseDuration,
    resistance,
    adjustedDuration: calculateAdjustedDuration(baseDuration, resistance),
    order: options.order ?? Date.now(),
    timeBlock,
    hourSlot,
    completed: false,
    actualDuration: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    preparation1: options.preparation1 ?? '',
    preparation2: options.preparation2 ?? '',
    preparation3: options.preparation3 ?? '',
    goalId: options.goalId ?? null,
    deadline: options.deadline ?? TASK_DEFAULTS.getDefaultDeadline(),
  };
}

/**
 * 인박스용 Task 생성 (timeBlock이 항상 null)
 *
 * @param text - 작업 제목
 * @param options - 생성 옵션 (timeBlock 제외)
 * @returns 인박스에 배치된 Task 객체
 */
export function createInboxTask(
  text: string,
  options: Omit<CreateTaskOptions, 'timeBlock' | 'hourSlot'> = {}
): Task {
  return createNewTask(text, {
    ...options,
    timeBlock: null,
    hourSlot: undefined,
  });
}

/**
 * Partial<Task> 데이터를 완전한 Task로 변환
 * (모달에서 사용자 입력을 받아 Task 생성 시 사용)
 *
 * @param data - 부분 작업 데이터
 * @param defaults - 기본값 옵션
 * @returns 완전한 Task 객체
 *
 * @example
 * ```ts
 * // 모달에서 받은 데이터로 Task 생성
 * const task = createTaskFromPartial({
 *   text: '회의 준비',
 *   baseDuration: 30,
 *   resistance: 'medium',
 *   preparation1: '피로',
 *   preparation2: '방해'
 * }, { timeBlock: 'morning' });
 * ```
 */
export function createTaskFromPartial(
  data: PartialTaskData,
  defaults: CreateTaskOptions = {}
): Task {
  const text = data.text || '새 작업';
  const baseDuration = data.baseDuration ?? defaults.baseDuration ?? TASK_DEFAULTS.baseDuration;
  const resistance = data.resistance ?? defaults.resistance ?? TASK_DEFAULTS.resistance;
  const timeBlock = data.timeBlock ?? defaults.timeBlock ?? null;

  // hourSlot 결정
  let hourSlot = data.hourSlot ?? defaults.hourSlot;
  if (hourSlot === undefined && timeBlock) {
    hourSlot = getBlockById(timeBlock)?.start;
  }

  return {
    id: generateId('task'),
    text: text.trim(),
    memo: data.memo ?? defaults.memo ?? '',
    baseDuration,
    resistance,
    adjustedDuration: data.adjustedDuration ?? calculateAdjustedDuration(baseDuration, resistance),
    order: data.order ?? defaults.order ?? Date.now(),
    timeBlock,
    hourSlot,
    completed: false,
    actualDuration: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    preparation1: data.preparation1 ?? defaults.preparation1 ?? '',
    preparation2: data.preparation2 ?? defaults.preparation2 ?? '',
    preparation3: data.preparation3 ?? defaults.preparation3 ?? '',
    goalId: data.goalId ?? defaults.goalId ?? null,
    deadline: data.deadline ?? defaults.deadline ?? TASK_DEFAULTS.getDefaultDeadline(),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Task가 "준비된" 상태인지 확인
 * (preparation1, preparation2, preparation3이 모두 입력됨)
 *
 * @param task - 확인할 Task 또는 Partial<Task>
 * @returns 준비 완료 여부
 */
export function isTaskPrepared(task: Partial<Task>): boolean {
  return !!(task.preparation1 && task.preparation2 && task.preparation3);
}

/**
 * Task가 이전에 준비되지 않았다가 새로 준비되었는지 확인
 *
 * @param original - 원본 Task
 * @param updated - 업데이트된 Task 데이터
 * @returns 새로 준비 완료되었으면 true
 */
export function isNewlyPrepared(original: Task, updated: Partial<Task>): boolean {
  const wasPrepared = isTaskPrepared(original);
  const isNowPrepared = isTaskPrepared({
    preparation1: updated.preparation1 ?? original.preparation1,
    preparation2: updated.preparation2 ?? original.preparation2,
    preparation3: updated.preparation3 ?? original.preparation3,
  });
  return !wasPrepared && isNowPrepared;
}

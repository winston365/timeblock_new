/**
 * slotFinder.ts
 *
 * @role 인박스 → 스케줄 빠른 배치를 위한 슬롯 추천 유틸리티
 * @description Today/Tomorrow/NextSlot 버튼이 공유하는 계산 로직
 *
 * 정책:
 * - Today: 오늘 현재 시간 이후 가장 가까운 블록/슬롯
 * - Tomorrow: 내일 첫 유효 블록/슬롯
 * - Next: 오늘 남은 첫 유효 블록이 있으면 그쪽, 없으면 내일 첫 블록
 *
 * 엣지 케이스:
 * - 23시 이후: 오늘 더 이상 블록 없음 → 자동으로 내일로
 * - 잠금 블록: skipLockedBlocks=true일 때 스킵
 * - 충돌 회피: avoidHourSlotCollisions=true일 때 같은 hourSlot 피함
 *
 * @dependencies
 * - TIME_BLOCKS: 타임블록 상수
 * - Task, TimeBlockId, TimeBlockStates: 도메인 타입
 */

import { TIME_BLOCKS, type Task, type TimeBlockId, type TimeBlockStates } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';

// ============================================================================
// Types
// ============================================================================

/**
 * 슬롯 추천 모드
 */
export type SlotFindMode = 'today' | 'tomorrow' | 'next';

/**
 * 슬롯 추천 결과의 이유
 */
export type SlotSuggestionReason =
  | 'within-current-block'    // 현재 블록 내 슬롯
  | 'next-future-block'       // 다음 미래 블록
  | 'fallback-tomorrow'       // 내일로 폴백
  | 'skipped-locked'          // 잠금 블록 스킵됨
  | 'first-block-of-day';     // 해당 날의 첫 블록

/**
 * 슬롯 추천 결과
 */
export interface SlotSuggestion {
  /** 날짜 (YYYY-MM-DD) */
  readonly dateISO: string;
  /** 블록 ID */
  readonly blockId: TimeBlockId;
  /** 시간 슬롯 (시작 시간, 0-23) */
  readonly hourSlot: number;
  /** 사용자 친화 레이블 (예: "오늘 11-14 블록") */
  readonly label: string;
  /** 추천 이유 */
  readonly reason: SlotSuggestionReason;
}

/**
 * 하루치 데이터 입력
 */
export interface DayData {
  /** 해당 날의 작업 목록 */
  readonly tasks: readonly Task[];
  /** 블록 상태 (잠금 여부 등) */
  readonly timeBlockStates?: TimeBlockStates;
  /** 날짜 (YYYY-MM-DD) */
  readonly dateISO: string;
}

/**
 * slotFinder 입력
 */
export interface FindSlotInput {
  /** 현재 시간 */
  readonly now: Date;
  /** 추천 모드 */
  readonly mode: SlotFindMode;
  /** 오늘 데이터 */
  readonly today: DayData;
  /** 내일 데이터 (선택) */
  readonly tomorrow?: DayData;
  /** 옵션 */
  readonly options?: FindSlotOptions;
}

/**
 * slotFinder 옵션
 */
export interface FindSlotOptions {
  /** 잠금 블록 스킵 여부 (default: true) */
  readonly skipLockedBlocks?: boolean;
  /** 같은 hourSlot 충돌 회피 (default: false) */
  readonly avoidHourSlotCollisions?: boolean;
  /** 블록이 꽉 찼을 때 스택 허용 (default: true) */
  readonly allowStackingIfFull?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** TIME_BLOCKS 타입 */
type TimeBlock = (typeof TIME_BLOCKS)[number];

/** 블록 라벨 맵 (id → 한글 라벨) */
const BLOCK_LABELS: Record<string, string> = {
  dawn: '새벽(05-08)',
  morning: '오전(08-11)',
  noon: '점심(11-14)',
  afternoon: '오후(14-17)',
  evening: '저녁(17-20)',
  night: '밤(20-23)',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 특정 날짜의 내일 날짜 계산
 */
const getTomorrowDate = (today: Date): string => {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDate(tomorrow);
};

/**
 * 블록이 잠겨있는지 확인
 */
const isBlockLocked = (
  blockId: string,
  timeBlockStates?: TimeBlockStates,
): boolean => {
  return timeBlockStates?.[blockId]?.isLocked === true;
};

/**
 * 특정 hourSlot에 작업이 있는지 확인
 */
const hasTaskAtHourSlot = (
  tasks: readonly Task[],
  blockId: string,
  hourSlot: number,
): boolean => {
  return tasks.some(
    (t) => t.timeBlock === blockId && t.hourSlot === hourSlot,
  );
};

/**
 * 블록 내에서 사용 가능한 hourSlot 찾기
 */
const findAvailableHourSlot = (
  block: TimeBlock,
  tasks: readonly Task[],
  minHour: number,
  avoidCollisions: boolean,
): number | null => {
  const startHour = Math.max(block.start, minHour);

  for (let hour = startHour; hour < block.end; hour++) {
    if (!avoidCollisions || !hasTaskAtHourSlot(tasks, block.id, hour)) {
      return hour;
    }
  }

  return null;
};

/**
 * 블록 라벨 생성
 */
const createBlockLabel = (
  prefix: string,
  block: TimeBlock,
): string => {
  const label = BLOCK_LABELS[block.id] ?? `${block.start}-${block.end}`;
  return `${prefix} ${label}`;
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * 빠른 배치를 위한 슬롯 추천
 *
 * @param input - 입력 데이터 (현재 시간, 모드, 오늘/내일 데이터)
 * @returns 추천 슬롯 또는 null (추천 불가 시)
 *
 * @example
 * ```typescript
 * const suggestion = findSuggestedSlot({
 *   now: new Date(),
 *   mode: 'next',
 *   today: { tasks: todayTasks, timeBlockStates, dateISO: '2025-12-23' },
 *   tomorrow: { tasks: [], dateISO: '2025-12-24' },
 * });
 *
 * if (suggestion) {
 *   console.log(suggestion.label); // "오늘 오후(14-17)"
 * }
 * ```
 */
export const findSuggestedSlot = (input: FindSlotInput): SlotSuggestion | null => {
  const { now, mode, today, tomorrow, options } = input;
  const {
    skipLockedBlocks = true,
    avoidHourSlotCollisions = false,
    allowStackingIfFull = true,
  } = options ?? {};

  const currentHour = now.getHours();
  const todayDate = today.dateISO;
  const tomorrowDate = tomorrow?.dateISO ?? getTomorrowDate(now);

  // ------------------------------------------------------------------------
  // Tomorrow 모드: 내일 첫 블록
  // ------------------------------------------------------------------------
  if (mode === 'tomorrow') {
    return findFirstAvailableBlock({
      date: tomorrowDate,
      tasks: tomorrow?.tasks ?? [],
      timeBlockStates: tomorrow?.timeBlockStates,
      minHour: 0,
      prefix: '내일',
      skipLocked: skipLockedBlocks,
      avoidCollisions: avoidHourSlotCollisions,
      allowStacking: allowStackingIfFull,
    });
  }

  // ------------------------------------------------------------------------
  // Today 모드: 오늘 현재 시간 이후 블록
  // ------------------------------------------------------------------------
  if (mode === 'today') {
    const todayResult = findFirstAvailableBlock({
      date: todayDate,
      tasks: today.tasks,
      timeBlockStates: today.timeBlockStates,
      minHour: currentHour,
      prefix: '오늘',
      skipLocked: skipLockedBlocks,
      avoidCollisions: avoidHourSlotCollisions,
      allowStacking: allowStackingIfFull,
    });

    if (todayResult) {
      return todayResult;
    }

    // 오늘 더 이상 블록 없으면 내일로 폴백
    return findFirstAvailableBlock({
      date: tomorrowDate,
      tasks: tomorrow?.tasks ?? [],
      timeBlockStates: tomorrow?.timeBlockStates,
      minHour: 0,
      prefix: '내일',
      skipLocked: skipLockedBlocks,
      avoidCollisions: avoidHourSlotCollisions,
      allowStacking: allowStackingIfFull,
      reason: 'fallback-tomorrow',
    });
  }

  // ------------------------------------------------------------------------
  // Next 모드: 오늘 남은 첫 블록 → 없으면 내일
  // ------------------------------------------------------------------------
  const nextResult = findFirstAvailableBlock({
    date: todayDate,
    tasks: today.tasks,
    timeBlockStates: today.timeBlockStates,
    minHour: currentHour,
    prefix: '오늘',
    skipLocked: skipLockedBlocks,
    avoidCollisions: avoidHourSlotCollisions,
    allowStacking: allowStackingIfFull,
  });

  if (nextResult) {
    return nextResult;
  }

  // 내일로 폴백
  return findFirstAvailableBlock({
    date: tomorrowDate,
    tasks: tomorrow?.tasks ?? [],
    timeBlockStates: tomorrow?.timeBlockStates,
    minHour: 0,
    prefix: '내일',
    skipLocked: skipLockedBlocks,
    avoidCollisions: avoidHourSlotCollisions,
    allowStacking: allowStackingIfFull,
    reason: 'fallback-tomorrow',
  });
};

// ============================================================================
// Internal Helper
// ============================================================================

interface FindBlockParams {
  date: string;
  tasks: readonly Task[];
  timeBlockStates?: TimeBlockStates;
  minHour: number;
  prefix: string;
  skipLocked: boolean;
  avoidCollisions: boolean;
  allowStacking: boolean;
  reason?: SlotSuggestionReason;
}

/**
 * 조건에 맞는 첫 번째 블록/슬롯 찾기
 */
const findFirstAvailableBlock = (params: FindBlockParams): SlotSuggestion | null => {
  const {
    date,
    tasks,
    timeBlockStates,
    minHour,
    prefix,
    skipLocked,
    avoidCollisions,
    allowStacking,
    reason: overrideReason,
  } = params;

  for (const block of TIME_BLOCKS) {
    // 이미 지난 블록 스킵
    if (block.end <= minHour) continue;

    // 잠금 블록 스킵
    if (skipLocked && isBlockLocked(block.id, timeBlockStates)) {
      continue;
    }

    // 사용 가능한 hourSlot 찾기
    const hourSlot = findAvailableHourSlot(
      block,
      tasks,
      minHour,
      avoidCollisions,
    );

    if (hourSlot !== null) {
      const isCurrentBlock = minHour >= block.start && minHour < block.end;

      return {
        dateISO: date,
        blockId: block.id as TimeBlockId,
        hourSlot,
        label: createBlockLabel(prefix, block),
        reason: overrideReason ?? (isCurrentBlock ? 'within-current-block' : 'next-future-block'),
      };
    }

    // 충돌 회피 중이고 스택 허용이면, 블록 시작에 스택
    if (avoidCollisions && allowStacking) {
      const stackHour = Math.max(block.start, minHour);
      return {
        dateISO: date,
        blockId: block.id as TimeBlockId,
        hourSlot: stackHour,
        label: `${createBlockLabel(prefix, block)} (겹침)`,
        reason: overrideReason ?? 'next-future-block',
      };
    }
  }

  return null;
};

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * 슬롯 추천 결과가 내일인지 확인
 */
export const isTomorrowSlot = (
  suggestion: SlotSuggestion,
  todayDate: string,
): boolean => {
  return suggestion.dateISO !== todayDate;
};

/**
 * 슬롯 추천 결과를 간단한 문자열로 변환
 */
export const formatSlotLabel = (suggestion: SlotSuggestion): string => {
  return suggestion.label;
};

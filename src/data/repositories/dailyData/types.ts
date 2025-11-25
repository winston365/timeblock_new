/**
 * DailyData Repository - Types & Helpers
 * 
 * @role DailyData 관련 타입 정의 및 헬퍼 함수
 */

import type { TimeBlockState, TimeBlockStates } from '@/shared/types/domain';

/**
 * 기본 블록 상태 보장
 */
export function ensureBaseBlockState(state?: TimeBlockState): TimeBlockState {
  return {
    isLocked: state?.isLocked ?? false,
    isPerfect: state?.isPerfect ?? false,
    isFailed: state?.isFailed ?? false,
    lockTimerStartedAt: state?.lockTimerStartedAt,
    lockTimerDuration: state?.lockTimerDuration,
  };
}

/**
 * Firebase에서 가져온 timeBlockStates를 정규화
 * - `timeBlockStates.8-11.isLocked` 같은 평탄화된 키를 중첩 객체로 변환
 */
export function normalizeTimeBlockStates(record: any): { states: TimeBlockStates; mutated: boolean } {
  const baseStates: TimeBlockStates =
    record?.timeBlockStates && typeof record.timeBlockStates === 'object'
      ? { ...record.timeBlockStates }
      : {};

  let mutated = false;

  Object.keys(record || {}).forEach((key) => {
    if (!key.startsWith('timeBlockStates.')) return;

    const remainder = key.replace(/^timeBlockStates\./, '');
    const segments = remainder.split('.').filter(Boolean);
    if (segments.length < 2) return;

    const [blockId, ...rest] = segments;
    if (!blockId || rest.length === 0) return;

    const existingState = baseStates[blockId];
    const targetState: any = ensureBaseBlockState(existingState);
    let cursor: any = targetState;

    rest.forEach((segment, index) => {
      if (index === rest.length - 1) {
        cursor[segment] = record[key];
      } else {
        if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
          cursor[segment] = {};
        }
        cursor = cursor[segment];
      }
    });

    baseStates[blockId] = targetState;
    mutated = true;
  });

  return { states: baseStates, mutated };
}

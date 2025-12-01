/**
 * DailyData Repository - Types & Helpers
 * 
 * @role DailyData 관련 타입 정의 및 헬퍼 함수
 * @responsibilities
 *   - TimeBlockState 초기화 및 정규화
 *   - Firebase 데이터 평탄화 키 변환
 * @key_dependencies
 *   - @/shared/types/domain: TimeBlockState, TimeBlockStates 타입
 */

import type { TimeBlockState, TimeBlockStates } from '@/shared/types/domain';

/**
 * 기본 블록 상태 보장
 * @description 블록 상태 객체가 모든 필수 필드를 가지도록 보장
 * @param {TimeBlockState} [blockState] - 기존 블록 상태 (선택적)
 * @returns {TimeBlockState} 필수 필드가 보장된 블록 상태
 */
export function ensureBaseBlockState(blockState?: TimeBlockState): TimeBlockState {
  return {
    isLocked: blockState?.isLocked ?? false,
    isPerfect: blockState?.isPerfect ?? false,
    isFailed: blockState?.isFailed ?? false,
    lockTimerStartedAt: blockState?.lockTimerStartedAt,
    lockTimerDuration: blockState?.lockTimerDuration,
  };
}

/**
 * Firebase에서 가져온 timeBlockStates를 정규화
 * @description `timeBlockStates.8-11.isLocked` 같은 평탄화된 키를 중첩 객체로 변환
 * @param {object} dailyDataRecord - Firebase에서 가져온 DailyData 레코드 객체
 * @returns {{ states: TimeBlockStates; mutated: boolean }} 정규화된 상태와 변경 여부
 */
export function normalizeTimeBlockStates(dailyDataRecord: { timeBlockStates?: TimeBlockStates }): { states: TimeBlockStates; mutated: boolean } {
  const recordAsIndexable = dailyDataRecord as Record<string, unknown>;
  const baseStates: TimeBlockStates =
    dailyDataRecord?.timeBlockStates && typeof dailyDataRecord.timeBlockStates === 'object'
      ? { ...dailyDataRecord.timeBlockStates }
      : {};

  let mutated = false;

  Object.keys(recordAsIndexable || {}).forEach((flattenedKey) => {
    if (!flattenedKey.startsWith('timeBlockStates.')) return;

    const remainder = flattenedKey.replace(/^timeBlockStates\./, '');
    const pathSegments = remainder.split('.').filter(Boolean);
    if (pathSegments.length < 2) return;

    const [blockId, ...propertyPath] = pathSegments;
    if (!blockId || propertyPath.length === 0) return;

    const existingState = baseStates[blockId];
    const blockState = ensureBaseBlockState(existingState);
    let nestedCursor = blockState as unknown as Record<string, unknown>;

    propertyPath.forEach((pathSegment, depth) => {
      if (depth === propertyPath.length - 1) {
        nestedCursor[pathSegment] = recordAsIndexable[flattenedKey];
      } else {
        if (typeof nestedCursor[pathSegment] !== 'object' || nestedCursor[pathSegment] === null) {
          nestedCursor[pathSegment] = {};
        }
        nestedCursor = nestedCursor[pathSegment] as Record<string, unknown>;
      }
    });

    baseStates[blockId] = blockState;
    mutated = true;
  });

  return { states: baseStates, mutated };
}

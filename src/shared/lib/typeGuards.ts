/**
 * @fileoverview Type Guard 유틸리티 함수 모음
 *
 * 타입 안전성을 보장하는 범용 가드 함수들을 제공합니다.
 * 배열 filter, 조건부 로직 등에서 타입 narrowing을 지원합니다.
 *
 * @module shared/lib/typeGuards
 */

/**
 * 값이 null 또는 undefined가 아닌지 확인하는 타입 가드
 *
 * 배열 filter에서 null/undefined 값을 제거할 때 타입 narrowing을 지원합니다.
 *
 * @example
 * ```typescript
 * const items: (string | null | undefined)[] = ['a', null, 'b', undefined];
 * const filtered: string[] = items.filter(isNonNullish);
 * // filtered는 ['a', 'b']이며 타입은 string[]
 * ```
 *
 * @example
 * ```typescript
 * // 조건부 체크
 * const value: string | null = getValue();
 * if (isNonNullish(value)) {
 *   console.log(value.toUpperCase()); // value는 string 타입
 * }
 * ```
 *
 * @param value - 검사할 값
 * @returns 값이 null 또는 undefined가 아니면 true
 */
export function isNonNullish<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

/**
 * 배열이 존재하고 비어있지 않은지 확인하는 타입 가드
 *
 * null, undefined, 빈 배열을 모두 처리하며,
 * 통과 시 최소 하나의 요소가 있음을 타입 레벨에서 보장합니다.
 *
 * @example
 * ```typescript
 * const items: string[] | null = getItems();
 * if (isNonEmptyArray(items)) {
 *   const first = items[0]; // 안전하게 접근 가능
 * }
 * ```
 *
 * @example
 * ```typescript
 * // undefined 처리
 * const maybeItems: string[] | undefined = config?.items;
 * if (isNonEmptyArray(maybeItems)) {
 *   maybeItems.forEach(item => process(item));
 * }
 * ```
 *
 * @param arr - 검사할 배열 (null 또는 undefined 허용)
 * @returns 배열이 존재하고 최소 하나의 요소가 있으면 true
 */
export function isNonEmptyArray<T>(
  arr: T[] | null | undefined
): arr is [T, ...T[]] {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * 값이 배열인지 확인하는 assertion 함수
 *
 * 배열이 아닌 경우 Error를 throw합니다.
 * 런타임 검증이 필요한 외부 데이터 처리에 유용합니다.
 *
 * @example
 * ```typescript
 * function processData(input: unknown): void {
 *   assertArray(input, 'input');
 *   // 이후 input은 unknown[] 타입
 *   input.forEach(item => console.log(item));
 * }
 * ```
 *
 * @example
 * ```typescript
 * // API 응답 검증
 * const response = await fetchData();
 * assertArray(response.items, 'response.items');
 * ```
 *
 * @param value - 검사할 값
 * @param name - 에러 메시지에 표시할 필드명 (기본값: 'value')
 * @throws {Error} 값이 배열이 아닌 경우
 */
export function assertArray(
  value: unknown,
  name = 'value'
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`[TypeGuard] ${name} must be an array`);
  }
}

/**
 * 값이 일반 객체(Record)인지 확인하는 타입 가드
 *
 * null, 배열, 원시 타입을 제외한 순수 객체만 true를 반환합니다.
 * JSON 파싱 결과나 설정 객체 검증에 유용합니다.
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(jsonString);
 * if (isRecord(data)) {
 *   // data는 Record<string, unknown> 타입
 *   const value = data['key'];
 * }
 * ```
 *
 * @example
 * ```typescript
 * // 타입별 분기 처리
 * function process(input: unknown): void {
 *   if (isNonEmptyArray(input)) {
 *     // 배열 처리
 *   } else if (isRecord(input)) {
 *     // 객체 처리
 *   } else {
 *     // 원시값 처리
 *   }
 * }
 * ```
 *
 * @param value - 검사할 값
 * @returns 값이 null이 아닌 일반 객체이면 true (배열 제외)
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Firebase Sanitizer Utility
 *
 * @fileoverview Firebase에 저장하기 전에 데이터를 정제하는 유틸리티
 *
 * @role Firebase Realtime Database 호환성을 위한 데이터 정제
 * @responsibilities
 *   - undefined 값을 null로 변환
 *   - 유효하지 않은 Firebase 키 문자 (., #, $, /, [, ]) 처리
 *   - dotted path 키를 중첩 객체로 변환
 * @dependencies 없음 (standalone utility)
 *
 * @description
 *   Firebase Realtime Database는 `undefined` 값을 지원하지 않으므로,
 *   이를 `null`로 변환하거나 제거해야 합니다.
 */

/**
 * Firebase 키에서 유효하지 않은 문자를 밀줄로 치환합니다.
 *
 * @param keySegment - 정제할 키 세그먼트
 * @returns 정제된 키 세그먼트 (빈 문자열인 경우 'invalid_key' 반환)
 */
function sanitizeKeySegment(keySegment: string): string {
    const sanitizedKey = keySegment.replace(/[.#$/[\]]/g, '_');
    return sanitizedKey === '' ? 'invalid_key' : sanitizedKey;
}

/**
 * 중첩된 경로에 값을 설정합니다.
 *
 * dotted path를 중첩 객체 구조로 변환하여 값을 설정합니다.
 *
 * @param target - 값을 설정할 대상 객체
 * @param path - 경로 세그먼트 배열
 * @param value - 설정할 값
 */
function setDeepValue(target: Record<string, any>, path: string[], value: any) {
    if (path.length === 0) return;

    let currentNode = target;
    path.forEach((pathSegment, index) => {
        if (index === path.length - 1) {
            if (
                currentNode[pathSegment] &&
                typeof currentNode[pathSegment] === 'object' &&
                typeof value === 'object' &&
                !Array.isArray(currentNode[pathSegment]) &&
                !Array.isArray(value)
            ) {
                currentNode[pathSegment] = { ...currentNode[pathSegment], ...value };
            } else {
                currentNode[pathSegment] = value;
            }
            return;
        }

        if (!currentNode[pathSegment] || typeof currentNode[pathSegment] !== 'object') {
            currentNode[pathSegment] = {};
        }
        currentNode = currentNode[pathSegment];
    });
}

/**
 * 객체나 배열을 순회하며 Firebase 호환성을 위해 데이터를 정제합니다.
 *
 * - `undefined` 값을 `null`로 변환
 * - 유효하지 않은 키 문자 (., #, $, /, [, ])를 밀줄로 교체
 * - dotted path 키를 중첩 객체 구조로 변환
 *
 * @typeParam T - 입력 데이터 타입
 * @param inputData - 정제할 데이터
 * @param currentPath - 현재 경로 (디버깅 로그용, 내부 사용)
 * @returns 정제된 데이터 (undefined가 null로 변환됨)
 *
 * @example
 * ```ts
 * const cleanData = sanitizeForFirebase({ key: undefined, nested: { value: 'test' } });
 * // { key: null, nested: { value: 'test' } }
 * ```
 */
export function sanitizeForFirebase<T>(inputData: T, currentPath: string = ''): T {
    if (inputData === undefined) {
        return null as unknown as T;
    }

    if (inputData === null || typeof inputData !== 'object') {
        return inputData;
    }

    if (Array.isArray(inputData)) {
        return inputData.map((arrayItem, index) => sanitizeForFirebase(arrayItem, `${currentPath}[${index}]`)) as unknown as T;
    }

    // 객체인 경우
    const result: any = {};
    for (const key in inputData) {
        if (Object.prototype.hasOwnProperty.call(inputData, key)) {
            // Firebase Key Validation
            // Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"
            // IMPORTANT: We only check the IMMEDIATE key, not the accumulated path
            const hasInvalidChars = /[.#$/[\]]/.test(key);

            if (hasInvalidChars || key === '') {
                const fullPath = currentPath ? `${currentPath}.${key}` : key;

                // dotted path를 가진 키는 중첩 객체로 복원하여 동기화
                if (key.includes('.')) {
                    console.warn(
                        `[FirebaseSanitizer] Invalid key detected: "${fullPath}". ` +
                        'Converting dotted path to nested key structure.'
                    );
                    const segments = key.split('.').filter(Boolean).map(sanitizeKeySegment);
                    const fieldValue = (inputData as any)[key];
                    const sanitizedValue = sanitizeForFirebase(fieldValue, fullPath);
                    setDeepValue(result, segments, sanitizedValue);
                } else {
                    console.warn(
                        `[FirebaseSanitizer] Invalid key detected: "${fullPath}". ` +
                        `Key "${key}" contains invalid characters. Replacing with "_"`
                    );
                    const safeKey = sanitizeKeySegment(key);
                    const fieldValue = (inputData as any)[key];
                    result[safeKey] = sanitizeForFirebase(fieldValue, fullPath);
                }
            } else {
                // Valid key - proceed normally
                const fieldValue = (inputData as any)[key];
                const fullPath = currentPath ? `${currentPath}.${key}` : key;
                result[key] = sanitizeForFirebase(fieldValue, fullPath);
            }
        }
    }

    return result as T;
}

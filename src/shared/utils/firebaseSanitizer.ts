/**
 * Firebase Sanitizer Utility
 *
 * @role Firebase에 저장하기 전에 데이터를 정제하는 유틸리티
 * @description Firebase Realtime Database는 `undefined` 값을 지원하지 않으므로, 이를 `null`로 변환하거나 제거해야 합니다.
 */

/**
 * 객체나 배열을 순회하며 `undefined` 값을 `null`로 변환합니다.
 * Firebase는 `undefined`를 저장할 수 없으므로 이 변환이 필수적입니다.
 *
 * @param data - 정제할 데이터
 * @returns 정제된 데이터 (undefined가 null로 변환됨)
 */
export function sanitizeForFirebase<T>(data: T): T {
    if (data === undefined) {
        return null as unknown as T;
    }

    if (data === null || typeof data !== 'object') {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => sanitizeForFirebase(item)) as unknown as T;
    }

    // 객체인 경우
    const result: any = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            // Firebase Key Validation
            // Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"
            let safeKey = key;
            if (/[.#$/\[\]]/.test(key) || key === '') {
                console.warn(`[FirebaseSanitizer] Invalid key detected: "${key}". Replacing invalid characters with "_"`);
                safeKey = key.replace(/[.#$/\[\]]/g, '_');
                if (safeKey === '') safeKey = 'invalid_key';
            }

            const value = (data as any)[key];
            result[safeKey] = sanitizeForFirebase(value);
        }
    }

    return result as T;
}

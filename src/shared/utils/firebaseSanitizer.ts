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
 * @param currentPath - 현재 경로 (디버깅용, 내부 사용)
 * @returns 정제된 데이터 (undefined가 null로 변환됨)
 */
function sanitizeKeySegment(segment: string): string {
    const safe = segment.replace(/[.#$/\[\]]/g, '_');
    return safe === '' ? 'invalid_key' : safe;
}

function setDeepValue(target: Record<string, any>, path: string[], value: any) {
    if (path.length === 0) return;

    let node = target;
    path.forEach((segment, index) => {
        if (index === path.length - 1) {
            if (
                node[segment] &&
                typeof node[segment] === 'object' &&
                typeof value === 'object' &&
                !Array.isArray(node[segment]) &&
                !Array.isArray(value)
            ) {
                node[segment] = { ...node[segment], ...value };
            } else {
                node[segment] = value;
            }
            return;
        }

        if (!node[segment] || typeof node[segment] !== 'object') {
            node[segment] = {};
        }
        node = node[segment];
    });
}

export function sanitizeForFirebase<T>(data: T, currentPath: string = ''): T {
    if (data === undefined) {
        return null as unknown as T;
    }

    if (data === null || typeof data !== 'object') {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map((item, index) => sanitizeForFirebase(item, `${currentPath}[${index}]`)) as unknown as T;
    }

    // 객체인 경우
    const result: any = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            // Firebase Key Validation
            // Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"
            // IMPORTANT: We only check the IMMEDIATE key, not the accumulated path
            const hasInvalidChars = /[.#$/\[\]]/.test(key);

            if (hasInvalidChars || key === '') {
                const fullPath = currentPath ? `${currentPath}.${key}` : key;

                // dotted path를 가진 키는 중첩 객체로 복원하여 동기화
                if (key.includes('.')) {
                    console.warn(
                        `[FirebaseSanitizer] Invalid key detected: "${fullPath}". ` +
                        'Converting dotted path to nested key structure.'
                    );
                    const segments = key.split('.').filter(Boolean).map(sanitizeKeySegment);
                    const value = (data as any)[key];
                    const sanitizedValue = sanitizeForFirebase(value, fullPath);
                    setDeepValue(result, segments, sanitizedValue);
                } else {
                    console.warn(
                        `[FirebaseSanitizer] Invalid key detected: "${fullPath}". ` +
                        `Key "${key}" contains invalid characters. Replacing with "_"`
                    );
                    const safeKey = sanitizeKeySegment(key);
                    const value = (data as any)[key];
                    result[safeKey] = sanitizeForFirebase(value, fullPath);
                }
            } else {
                // Valid key - proceed normally
                const value = (data as any)[key];
                const fullPath = currentPath ? `${currentPath}.${key}` : key;
                result[key] = sanitizeForFirebase(value, fullPath);
            }
        }
    }

    return result as T;
}

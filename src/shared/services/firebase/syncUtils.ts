/**
 * 동기화 공통 유틸리티
 * R5: Pure 함수 - Side Effect 없음
 * R8: 중복 제거 - 여러 sync 모듈에서 공통으로 사용하는 유틸리티
 */

// ============================================================================
// Pure Utility Functions
// ============================================================================

/**
 * 데이터 해시 계산 (변경 감지용)
 */
export function getDataHash(data: unknown): string {
  return JSON.stringify(data);
}

/**
 * 서버 타임스탬프 생성
 */
export function getServerTimestamp(): number {
  return Date.now();
}

/**
 * 디바이스 ID 생성/가져오기 (브라우저 fingerprint)
 */
export function getDeviceId(): string {
  const DEVICE_ID_KEY = 'deviceId';
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

/**
 * Firebase 경로 생성 헬퍼
 */
export function getFirebasePath(userId: string, collection: string, key?: string): string {
  const basePath = `users/${userId}/${collection}`;
  return key ? `${basePath}/${key}` : basePath;
}

/**
 * Synchronization Utilities
 *
 * @role 동기화 모듈에서 공통으로 사용하는 순수 유틸리티 함수들을 제공합니다.
 *       데이터 해시, 타임스탬프, 디바이스 ID, Firebase 경로 생성 등을 담당합니다.
 * @input 데이터 객체, userId, collection 이름, key (선택적)
 * @output 해시 문자열, 타임스탬프, 디바이스 ID, Firebase 경로
 * @external_dependencies
 *   - localStorage: 디바이스 ID 저장 및 로드
 */

// ============================================================================
// Pure Utility Functions
// ============================================================================

/**
 * 데이터 해시를 계산합니다 (변경 감지용).
 * JSON 문자열화를 사용하여 데이터의 해시를 생성합니다.
 *
 * @param {unknown} data - 해시를 계산할 데이터
 * @returns {string} JSON 문자열 해시
 * @throws 없음 (JSON.stringify 실패 시 예외 발생 가능)
 * @sideEffects
 *   - 없음: 순수 함수
 */
export function getDataHash(data: unknown): string {
  return JSON.stringify(data);
}

/**
 * 현재 서버 타임스탬프를 생성합니다.
 *
 * @returns {number} 현재 시간의 Unix 타임스탬프 (밀리초)
 * @throws 없음
 * @sideEffects
 *   - 없음: 순수 함수
 */
export function getServerTimestamp(): number {
  return Date.now();
}

/**
 * 디바이스 ID를 생성하거나 가져옵니다 (브라우저 fingerprint).
 * localStorage에 저장된 ID가 있으면 반환하고, 없으면 새로 생성합니다.
 *
 * @returns {string} 디바이스 고유 ID
 * @throws 없음
 * @sideEffects
 *   - localStorage에서 디바이스 ID 읽기
 *   - 없으면 새 ID를 생성하여 localStorage에 저장
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
 * Firebase 경로를 생성합니다.
 * users/{userId}/{collection}/{key} 형식의 경로를 반환합니다.
 *
 * @param {string} userId - 사용자 ID
 * @param {string} collection - 컬렉션 이름 (예: 'dailyData', 'gameState')
 * @param {string} key - 데이터 키 (선택적, 없으면 컬렉션 루트)
 * @returns {string} Firebase 경로 문자열
 * @throws 없음
 * @sideEffects
 *   - 없음: 순수 함수
 */
export function getFirebasePath(userId: string, collection: string, key?: string): string {
  const basePath = `users/${userId}/${collection}`;
  return key ? `${basePath}/${key}` : basePath;
}

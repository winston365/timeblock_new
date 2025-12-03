/**
 * Synchronization Utilities
 *
 * @role 동기화 모듈에서 공통으로 사용하는 순수 유틸리티 함수들을 제공합니다.
 *       데이터 해시, 타임스탬프, 디바이스 ID, Firebase 경로 생성 등을 담당합니다.
 * @input 데이터 객체, userId, collection 이름, key (선택적)
 * @output 해시 문자열, 타임스탬프, 디바이스 ID, Firebase 경로
 * @external_dependencies
 *   - Dexie (systemState): 디바이스 ID 저장 및 로드
 * @note localStorage 대신 Dexie systemState 테이블 사용 (앱 전체 일관성)
 */

import { db } from '@/data/db/dexieClient';
import { generateId } from '@/shared/lib/utils';

// ============================================================================
// Device ID Management (Dexie-based)
// ============================================================================

const DEVICE_ID_KEY = 'deviceId';
let cachedDeviceId: string | null = null;

/**
 * 디바이스 ID 초기화 (앱 시작 시 호출 권장)
 * Dexie에서 deviceId를 로드하거나 새로 생성합니다.
 */
export async function initializeDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    const record = await db.systemState.get(DEVICE_ID_KEY);
    if (record?.value) {
      cachedDeviceId = record.value as string;
      return cachedDeviceId;
    }
  } catch (error) {
    console.warn('Failed to load deviceId from Dexie:', error);
  }

  // 새 ID 생성 및 저장
  cachedDeviceId = generateId('device');
  
  try {
    await db.systemState.put({ key: DEVICE_ID_KEY, value: cachedDeviceId });
  } catch (error) {
    console.warn('Failed to save deviceId to Dexie:', error);
  }

  return cachedDeviceId;
}

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
 * 디바이스 ID를 가져옵니다 (동기 버전, 캐시된 값 사용).
 * 초기화되지 않은 경우 임시 ID를 반환하고 비동기로 초기화합니다.
 *
 * @returns {string} 디바이스 고유 ID
 * @throws 없음
 * @sideEffects
 *   - 캐시가 없으면 비동기로 Dexie 초기화 시작
 * @note initializeDeviceId()를 앱 시작 시 먼저 호출하는 것을 권장합니다.
 */
export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;

  // 캐시가 없으면 임시 ID 생성 (비동기 초기화 시작)
  const tempId = generateId('device');
  
  // 비동기로 초기화 시도 (fire-and-forget)
  initializeDeviceId().catch(console.error);
  
  return cachedDeviceId || tempId;
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

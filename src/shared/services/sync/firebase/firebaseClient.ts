/**
 * Firebase Client Management
 *
 * @role Firebase 앱 초기화 및 연결 상태를 관리합니다.
 *       Realtime Database 인스턴스를 생성하고 앱 생명주기를 제어합니다.
 * @input Settings.firebaseConfig (API 키, 프로젝트 ID 등)
 * @output boolean (초기화 성공 여부), Database 인스턴스
 * @external_dependencies
 *   - firebase/app: Firebase App SDK (initializeApp, deleteApp)
 *   - firebase/database: Firebase Realtime Database SDK (getDatabase)
 *   - @/shared/types/domain: Settings 타입 정의
 */

import { initializeApp, FirebaseApp, deleteApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import type { Settings } from '@/shared/types/domain';
import { stopAllRtdbListeners } from './rtdbListenerRegistry';

// ============================================================================
// Firebase 상태 (Module-level State)
// ============================================================================

let firebaseApp: FirebaseApp | null = null;
let firebaseDatabase: Database | null = null;
let isInitialized = false;

// ============================================================================
// Public API
// ============================================================================

/**
 * Firebase databaseURL이 유효한 형식인지 검증합니다.
 * 
 * @param url - 검증할 databaseURL
 * @returns {boolean} URL이 유효한 Firebase RTDB URL인지 여부
 */
function isValidDatabaseURL(url: string | undefined): boolean {
  if (!url || url.trim() === '') return false;
  // Firebase RTDB URL 패턴: https://<project>.firebaseio.com 또는 지역별 URL
  return /^https:\/\/[\w-]+\.firebaseio\.com\/?$/.test(url) ||
         /^https:\/\/[\w-]+-default-rtdb\.[\w-]+\.firebasedatabase\.app\/?$/.test(url);
}

/**
 * Firebase config의 필수 필드가 모두 존재하고 유효한지 검증합니다.
 * 
 * @param config - 검증할 Firebase 설정 객체
 * @returns {{ valid: boolean; reason?: string }} 유효성 여부와 실패 사유
 */
function validateFirebaseConfig(config: Settings['firebaseConfig']): { valid: boolean; reason?: string } {
  if (!config) {
    return { valid: false, reason: 'Config is not provided' };
  }
  
  // 필수 필드 검증 (빈 문자열 체크)
  const requiredFields: (keyof NonNullable<typeof config>)[] = [
    'apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'
  ];
  
  for (const field of requiredFields) {
    const value = config[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return { valid: false, reason: `Required field '${field}' is empty` };
    }
  }
  
  // databaseURL 형식 검증
  if (!isValidDatabaseURL(config.databaseURL)) {
    return { 
      valid: false, 
      reason: `Invalid databaseURL format. Expected: https://<project>.firebaseio.com` 
    };
  }
  
  return { valid: true };
}

/**
 * Firebase 앱을 초기화합니다.
 * 기존 앱이 있으면 삭제 후 재초기화합니다.
 *
 * @param {Settings['firebaseConfig']} config - Firebase 설정 객체
 * @returns {boolean} 초기화 성공 여부
 * @throws 없음 (에러는 내부적으로 처리되며 false 반환)
 * @sideEffects
 *   - Firebase App 인스턴스 생성/재생성
 *   - Realtime Database 인스턴스 생성
 *   - 모듈 레벨 상태 변수 업데이트 (firebaseApp, firebaseDatabase, isInitialized)
 *   - 콘솔에 초기화 성공/실패 로그 출력
 */
export function initializeFirebase(config: Settings['firebaseConfig']): boolean {
  // 설정 유효성 검증
  const validation = validateFirebaseConfig(config);
  if (!validation.valid) {
    console.warn(`[Firebase Client] ${validation.reason}`);
    return false;
  }

  try {
    // 기존 앱이 있으면 삭제 후 재초기화
    if (firebaseApp) {
      // 리스너 누수 방지: Firebase App 재초기화 전에 RTDB 리스너 해제
      stopAllRtdbListeners();
      try {
        deleteApp(firebaseApp).catch(err =>
          console.warn('[Firebase Client] Failed to delete old app:', err)
        );
      } catch (e) {
        console.warn('[Firebase Client] Error during app deletion:', e);
      }
      firebaseApp = null;
      firebaseDatabase = null;
      isInitialized = false;
    }

    // Firebase 앱 초기화
    firebaseApp = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      databaseURL: config.databaseURL,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });

    // Realtime Database 초기화
    firebaseDatabase = getDatabase(firebaseApp);
    isInitialized = true;

    return true;
  } catch (error) {
    console.error('[Firebase Client] Initialization failed:', error);
    firebaseApp = null;
    firebaseDatabase = null;
    isInitialized = false;
    return false;
  }
}

/**
 * Firebase 초기화 상태를 확인합니다.
 *
 * @returns {boolean} Firebase가 초기화되어 사용 가능한지 여부
 * @throws 없음
 * @sideEffects
 *   - 없음: 읽기 전용 작업
 */
export function isFirebaseInitialized(): boolean {
  return isInitialized && firebaseDatabase !== null;
}

/**
 * Firebase Database 인스턴스를 가져옵니다.
 *
 * @returns {Database} Firebase Realtime Database 인스턴스
 * @throws {Error} Firebase가 초기화되지 않은 경우
 * @sideEffects
 *   - 없음: 읽기 전용 작업
 */
export function getFirebaseDatabase(): Database {
  if (!firebaseDatabase) {
    throw new Error('[Firebase Client] Firebase is not initialized');
  }
  return firebaseDatabase;
}

/**
 * Firebase 연결을 해제하고 앱을 종료합니다.
 *
 * @returns {void} 반환값 없음
 * @throws 없음 (에러는 내부적으로 처리)
 * @sideEffects
 *   - Firebase App 삭제
 *   - 모듈 레벨 상태 변수 초기화 (firebaseApp, firebaseDatabase, isInitialized)
 *   - 콘솔에 연결 해제 성공/실패 로그 출력
 */
export function disconnectFirebase(): void {
  if (firebaseApp) {
    // 리스너 누수 방지: 연결 해제 전에 RTDB 리스너 해제
    stopAllRtdbListeners();
    deleteApp(firebaseApp)
      .then(() => {
        firebaseApp = null;
        firebaseDatabase = null;
        isInitialized = false;
      })
      .catch(err => {
        console.error('[Firebase Client] Failed to disconnect:', err);
      });
  }
}

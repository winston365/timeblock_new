/**
 * Firebase 클라이언트 초기화 및 연결 관리
 * R5: Side Effects 격리 - Firebase 연결 상태 관리
 * R6: 명확한 문맥 - Client는 연결 관리만 담당
 */

import { initializeApp, FirebaseApp, deleteApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import type { Settings } from '@/shared/types/domain';

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
 * Firebase 앱 초기화
 * @returns 초기화 성공 여부
 */
export function initializeFirebase(config: Settings['firebaseConfig']): boolean {
  if (!config) {
    console.warn('[Firebase Client] Config is not provided');
    return false;
  }

  try {
    // 기존 앱이 있으면 삭제 후 재초기화
    if (firebaseApp) {
      console.log('[Firebase Client] Deleting old instance...');
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

    console.log('✅ Firebase initialized successfully');
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
 * Firebase 초기화 상태 확인
 */
export function isFirebaseInitialized(): boolean {
  return isInitialized && firebaseDatabase !== null;
}

/**
 * Firebase Database 인스턴스 가져오기
 * @throws {Error} Firebase가 초기화되지 않은 경우
 */
export function getFirebaseDatabase(): Database {
  if (!firebaseDatabase) {
    throw new Error('[Firebase Client] Firebase is not initialized');
  }
  return firebaseDatabase;
}

/**
 * Firebase 연결 해제
 */
export function disconnectFirebase(): void {
  if (firebaseApp) {
    deleteApp(firebaseApp)
      .then(() => {
        console.log('[Firebase Client] Disconnected successfully');
        firebaseApp = null;
        firebaseDatabase = null;
        isInitialized = false;
      })
      .catch(err => {
        console.error('[Firebase Client] Failed to disconnect:', err);
      });
  }
}

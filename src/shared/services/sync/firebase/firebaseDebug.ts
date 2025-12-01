/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Firebase Debug Utilities
 *
 * @role Firebase Realtime Database의 데이터를 검사하고 디버깅하는 기능을 제공합니다.
 *       개발자 콘솔에서 window.debugFirebase() 호출로 Firebase 데이터를 확인할 수 있습니다.
 * @input 없음 (사용자가 콘솔에서 직접 호출)
 * @output 콘솔에 Firebase 데이터 정보 출력
 * @external_dependencies
 *   - firebase/database: Firebase Realtime Database SDK (ref, get)
 *   - ./firebaseClient: Firebase 클라이언트 관리
 */

import { ref, get } from 'firebase/database';
import { getFirebaseDatabase } from './firebaseClient';

// ============================================================================
// Debug Functions
// ============================================================================

/**
 * Firebase 데이터를 확인합니다 (디버그용).
 * 콘솔에서 window.debugFirebase() 호출하여 사용합니다.
 *
 * @returns {Promise<void>} 완료 Promise
 * @throws 없음 (에러는 내부적으로 처리)
 * @sideEffects
 *   - Firebase Database에서 데이터 읽기
 *   - 콘솔에 상세한 디버그 정보 출력 (날짜 목록, 작업 수, 게임 상태, XP 히스토리 등)
 */
export async function debugFirebaseData(): Promise<void> {
  try {
    const db = getFirebaseDatabase();
    const userId = 'user';

    // DailyData 확인
    const dailyDataRef = ref(db, `users/${userId}/dailyData`);
    const dailyDataSnapshot = await get(dailyDataRef);
    const dailyDataValue = dailyDataSnapshot.val();

    // GameState 확인
    const gameStateRef = ref(db, `users/${userId}/gameState`);
    const gameStateSnapshot = await get(gameStateRef);
    const gameStateValue = gameStateSnapshot.val();

    console.log('🔍 Firebase Data Debug:');
    console.log('📍 Path: users/user');
    console.log('📅 DailyData dates:', dailyDataValue ? Object.keys(dailyDataValue) : 'empty');
    console.log('🎮 GameState exists:', !!gameStateValue);

    if (dailyDataValue) {
      Object.entries(dailyDataValue).forEach(([date, data]: [string, any]) => {
        const taskCount = data?.data?.tasks?.length ?? 0;
        console.log(`  - ${date}: ${taskCount} tasks, updatedAt: ${data?.updatedAt}`);
      });
    }

    if (gameStateValue) {
      const gs = gameStateValue.data;
      console.log('  GameState:', {
        totalXP: gs?.totalXP,
        dailyXP: gs?.dailyXP,
        lastLogin: gs?.lastLogin,
        streak: gs?.streak,
        updatedAt: gameStateValue.updatedAt
      });
      console.log('  XP History:', gs?.xpHistory ?? []);
      console.log('  TimeBlock XP History:', gs?.timeBlockXPHistory ?? []);
      console.log('  Completed Tasks History count:', gs?.completedTasksHistory?.length ?? 0);
    }

    console.log('🌐 Firebase Console: https://console.firebase.google.com/project/test1234-edcb6/database/test1234-edcb6-default-rtdb/data/users/user');

    // 원본 데이터 전체 출력 (JSON)
    console.log('📋 Raw Firebase Data:');
    console.log('DailyData:', dailyDataValue);
    console.log('GameState:', gameStateValue);
  } catch (error) {
    console.error('❌ Failed to debug Firebase data:', error);
  }
}

/**
 * window 객체에 디버그 함수를 노출합니다.
 * 개발자 콘솔에서 window.debugFirebase() 호출을 가능하게 합니다.
 *
 * @returns {void} 반환값 없음
 * @throws 없음
 * @sideEffects
 *   - window.debugFirebase에 debugFirebaseData 함수 할당
 *   - 콘솔에 사용 안내 메시지 출력
 */
export function exposeDebugToWindow(): void {
  if (typeof window !== 'undefined') {
    (window as any).debugFirebase = debugFirebaseData;
    console.log('💡 Debug: 콘솔에서 window.debugFirebase() 호출 가능');
  }
}

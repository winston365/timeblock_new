/**
 * Firebase 디버그 유틸리티
 * R7: 기능 분리 - 디버그 기능을 별도 모듈로 격리
 */

import { ref, get } from 'firebase/database';
import { getFirebaseDatabase } from './firebaseClient';

// ============================================================================
// Debug Functions
// ============================================================================

/**
 * Firebase 데이터 확인 (디버그용)
 * 콘솔에서 window.debugFirebase() 호출
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
        level: gs?.level,
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
 * window에 디버그 함수 노출
 */
export function exposeDebugToWindow(): void {
  if (typeof window !== 'undefined') {
    (window as any).debugFirebase = debugFirebaseData;
    console.log('💡 Debug: 콘솔에서 window.debugFirebase() 호출 가능');
  }
}

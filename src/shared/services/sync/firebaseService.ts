/**
 * Firebase Synchronization Service - Facade
 *
 * @role Firebase 동기화 기능에 대한 하위 호환성 인터페이스를 제공합니다.
 *       레거시 코드를 위한 Facade 패턴으로, 실제 구현은 firebase/ 디렉토리 모듈에 위임합니다.
 * @input DailyData, GameState, ChatHistory, DailyTokenUsage, 날짜 키
 * @output Promise<void> (동기화 완료), 구독 해제 함수, Firebase 데이터 객체
 * @external_dependencies
 *   - firebase/database: Firebase Realtime Database SDK
 *   - ./firebase/syncCore: 제네릭 동기화 코어 로직
 *   - ./firebase/strategies: 데이터 타입별 동기화 전략
 *   - ./firebase/firebaseClient: Firebase 클라이언트 관리
 */

// ============================================================================
// Re-export from new modules
// ============================================================================

export {
  initializeFirebase,
  isFirebaseInitialized,
  disconnectFirebase,
} from './firebase/firebaseClient';

export { debugFirebaseData } from './firebase/firebaseDebug';

export type { SyncData } from './firebase/conflictResolver';

import type { DailyData, Task, Settings, DailyTokenUsage, GameState, ShopItem, WaifuState, Template } from '@/shared/types/domain';
import { addSyncLog } from './syncLogger';



/**
 * Firebase에서 전체 데이터를 가져옵니다 (초기 로드용).
 *
 * @returns {Promise<{...}>} 모든 컬렉션 데이터
 * @throws {Error} Firebase 초기화 실패 또는 데이터 읽기 오류
 * @sideEffects
 *   - Firebase Database에서 데이터 읽기
 *   - 콘솔에 성공/실패 로그 출력
 */
export async function fetchDataFromFirebase(): Promise<{
  dailyData: Record<string, DailyData>;
  gameState: GameState | null;
  globalInbox: Task[] | null;
  completedInbox: Record<string, Task[]> | null;
  shopItems: ShopItem[] | null;
  waifuState: WaifuState | null;
  templates: Template[] | null;
  tokenUsage: Record<string, DailyTokenUsage>;
  settings: Settings | null;
}> {
  try {
    const { getFirebaseDatabase } = await import('./firebase/firebaseClient');
    const { ref, get } = await import('firebase/database');

    const db = getFirebaseDatabase();
    const userId = 'user';

    // 모든 컬렉션을 병렬로 가져오기
    const [
      dailyDataSnapshot,
      gameStateSnapshot,
      globalInboxSnapshot,
      completedInboxSnapshot,
      shopItemsSnapshot,
      waifuStateSnapshot,
      templatesSnapshot,
      tokenUsageSnapshot,
      settingsSnapshot,
    ] = await Promise.all([
      get(ref(db, `users/${userId}/dailyData`)),
      get(ref(db, `users/${userId}/gameState`)),
      get(ref(db, `users/${userId}/globalInbox`)),
      get(ref(db, `users/${userId}/completedInbox`)),
      get(ref(db, `users/${userId}/shopItems`)),
      get(ref(db, `users/${userId}/waifuState`)),
      get(ref(db, `users/${userId}/templates`)),
      get(ref(db, `users/${userId}/tokenUsage`)),
      get(ref(db, `users/${userId}/settings`)),
    ]);

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null;

    // DailyData 처리
    const dailyDataValueRaw: unknown = dailyDataSnapshot.val() ?? {};
    const dailyDataValue = isRecord(dailyDataValueRaw) ? dailyDataValueRaw : {};
    const dailyData: Record<string, DailyData> = {};
    for (const [date, syncDataRaw] of Object.entries(dailyDataValue)) {
      if (!isRecord(syncDataRaw)) continue;
      const data = syncDataRaw.data;
      if (data != null) {
        dailyData[date] = data as DailyData;
      }
    }

    // 각 컬렉션의 SyncData 래퍼 제거
    const gameStateValue = gameStateSnapshot.val();
    const gameState = gameStateValue?.data || null;

    const globalInboxValue = globalInboxSnapshot.val();
    const globalInbox =
      globalInboxValue?.data ||
      globalInboxValue?.all?.data ||
      null;

    // CompletedInbox (date-keyed)
    const completedInboxValueRaw: unknown = completedInboxSnapshot.val() ?? {};
    const completedInboxValue = isRecord(completedInboxValueRaw) ? completedInboxValueRaw : {};
    const completedInbox: Record<string, Task[]> = {};
    for (const [date, syncDataRaw] of Object.entries(completedInboxValue)) {
      if (!isRecord(syncDataRaw)) continue;
      const data = syncDataRaw.data;
      if (Array.isArray(data)) {
        completedInbox[date] = data as Task[];
      }
    }

    const shopItemsValue = shopItemsSnapshot.val();
    const shopItems = shopItemsValue?.data || null;

    const waifuStateValue = waifuStateSnapshot.val();
    const waifuState = waifuStateValue?.data || null;

    const templatesValue = templatesSnapshot.val();
    const templates = templatesValue?.data || null;

    const tokenUsageValueRaw: unknown = tokenUsageSnapshot.val() ?? {};
    const tokenUsageValue = isRecord(tokenUsageValueRaw) ? tokenUsageValueRaw : {};
    const tokenUsage: Record<string, DailyTokenUsage> = {};
    for (const [date, syncDataRaw] of Object.entries(tokenUsageValue)) {
      if (!isRecord(syncDataRaw)) continue;
      const data = syncDataRaw.data;
      if (data != null) {
        tokenUsage[date] = data as DailyTokenUsage;
      }
    }

    const settingsValue = settingsSnapshot.val();
    const settings = settingsValue?.data || null;

    addSyncLog('firebase', 'load', 'Fetched initial data from Firebase', {
      dailyData: Object.keys(dailyData).length,
      globalInbox: globalInbox?.length || 0,
      completedInbox: Object.keys(completedInbox).length,
      shopItems: shopItems?.length || 0,
      templates: templates?.length || 0,
      tokenUsage: Object.keys(tokenUsage).length,
      settings: !!settings,
    });

    return { dailyData, gameState, globalInbox, completedInbox, shopItems, waifuState, templates, tokenUsage, settings };
  } catch (error) {
    console.error('Failed to fetch data from Firebase:', error);
    addSyncLog('firebase', 'error', 'Failed to fetch initial data from Firebase', undefined, error as Error);
    throw error;
  }
}

/**
 * Firebase 실시간 동기화를 활성화합니다.
 * DailyData 컬렉션과 GameState를 실시간으로 감시합니다.
 *
 * @param {Function} onDailyDataUpdate - DailyData 업데이트 시 호출될 콜백 (날짜 키 전달)
 * @param {Function} onGameStateUpdate - GameState 업데이트 시 호출될 콜백
 * @returns {Function} 모든 리스너를 해제하는 함수
 * @throws 없음 (에러는 내부적으로 처리)
 * @sideEffects
 *   - Firebase onValue 리스너 2개 등록 (dailyData, gameState)
 *   - 다른 디바이스에서 변경 시 콜백 실행
 *   - 콘솔에 활성화 로그 출력
 */
export function enableFirebaseSync(
  onDailyDataUpdate: (date: string) => void,
  onGameStateUpdate: () => void
): () => void {
  void onDailyDataUpdate;
  void onGameStateUpdate;

  const message =
    '[FirebaseService] enableFirebaseSync is deprecated and disabled. Use SyncEngine.startListening() instead.';
  console.warn(message);
  throw new Error(message);
}

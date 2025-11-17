/**
 * Initial Firebase Sync
 *
 * @role 앱 시작 시 모든 로컬 데이터를 Firebase로 일괄 동기화
 * @description 새로 Firebase를 연결했을 때 기존 로컬 데이터를 업로드
 */

import { db } from '@/data/db/dexieClient';
import { syncToFirebase } from './syncCore';
import {
  dailyDataStrategy,
  gameStateStrategy,
  chatHistoryStrategy,
  tokenUsageStrategy,
  energyLevelsStrategy,
  templateStrategy,
  globalInboxStrategy,
  shopItemsStrategy,
  dailyGoalStrategy,
} from './strategies';
import { addSyncLog } from '../syncLogger';

/**
 * 모든 로컬 데이터를 Firebase로 동기화
 *
 * @returns {Promise<void>}
 * @sideEffects
 *   - IndexedDB의 모든 데이터를 Firebase로 업로드
 *   - syncLogger에 로그 기록
 */
export async function syncAllLocalDataToFirebase(): Promise<void> {
  try {
    addSyncLog('firebase', 'sync', 'Starting initial Firebase sync...');

    // 1. DailyData 동기화
    const dailyDataRecords = await db.dailyData.toArray();
    for (const record of dailyDataRecords) {
      const { date, tasks, goals, timeBlockStates, updatedAt } = record;
      await syncToFirebase(dailyDataStrategy, { tasks, goals: goals || [], timeBlockStates, updatedAt }, date);
    }
    addSyncLog('firebase', 'sync', `Synced ${dailyDataRecords.length} daily data records`);

    // 2. GameState 동기화
    const gameState = await db.gameState.get('current');
    if (gameState) {
      await syncToFirebase(gameStateStrategy, gameState, 'current');
      addSyncLog('firebase', 'sync', 'Synced game state');
    }

    // 3. ChatHistory 동기화
    const chatHistories = await db.chatHistory.toArray();
    for (const chat of chatHistories) {
      await syncToFirebase(chatHistoryStrategy, chat, chat.date);
    }
    addSyncLog('firebase', 'sync', `Synced ${chatHistories.length} chat histories`);

    // 4. TokenUsage 동기화
    const tokenUsages = await db.dailyTokenUsage.toArray();
    for (const usage of tokenUsages) {
      await syncToFirebase(tokenUsageStrategy, usage, usage.date);
    }
    addSyncLog('firebase', 'sync', `Synced ${tokenUsages.length} token usage records`);

    // 5. EnergyLevels 동기화 (날짜별로 그룹화)
    const energyLevels = await db.energyLevels.toArray();
    const energyByDate = energyLevels.reduce((acc, level) => {
      if (!acc[level.date]) {
        acc[level.date] = [];
      }
      acc[level.date].push(level);
      return acc;
    }, {} as Record<string, typeof energyLevels>);

    for (const [date, levels] of Object.entries(energyByDate)) {
      await syncToFirebase(energyLevelsStrategy, levels, date);
    }
    addSyncLog('firebase', 'sync', `Synced energy levels for ${Object.keys(energyByDate).length} dates`);

    // 6. Templates 동기화
    const templates = await db.templates.toArray();
    if (templates.length > 0) {
      await syncToFirebase(templateStrategy, templates, 'all');
      addSyncLog('firebase', 'sync', `Synced ${templates.length} templates`);
    }

    // 7. GlobalInbox 동기화
    const inboxTasks = await db.globalInbox.toArray();
    if (inboxTasks.length > 0) {
      await syncToFirebase(globalInboxStrategy, inboxTasks, 'all');
      addSyncLog('firebase', 'sync', `Synced ${inboxTasks.length} inbox tasks`);
    }

    // 8. ShopItems 동기화
    const shopItems = await db.shopItems.toArray();
    if (shopItems.length > 0) {
      await syncToFirebase(shopItemsStrategy, shopItems, 'all');
      addSyncLog('firebase', 'sync', `Synced ${shopItems.length} shop items`);
    }

    addSyncLog('firebase', 'sync', '✅ Initial Firebase sync completed successfully');
    console.log('✅ All local data synced to Firebase');
  } catch (error) {
    console.error('Failed to sync local data to Firebase:', error);
    addSyncLog('firebase', 'error', 'Initial sync failed', undefined, error as Error);
  }
}

/**
 * Synchronization Strategies
 *
 * @role 각 데이터 타입별 동기화 전략을 정의합니다.
 *       DailyData, GameState, ChatHistory, TokenUsage의 충돌 해결 및 로그 메시지를 설정합니다.
 * @input 없음 (전략 상수 정의 파일)
 * @output SyncStrategy<T> 객체들 (dailyDataStrategy, gameStateStrategy, chatHistoryStrategy, tokenUsageStrategy)
 * @external_dependencies
 *   - ./syncCore: SyncStrategy 타입 정의
 *   - ./conflictResolver: mergeGameState 충돌 해결 함수
 *   - @/shared/types/domain: 도메인 타입 정의
 */

import type { SyncStrategy } from './syncCore';
import type { ItemSyncStrategy } from './types';
import { mergeGameState, mergeTaskArray } from './conflictResolver';
import type {
  DailyData,
  GameState,
  ChatHistory,
  DailyTokenUsage,
  Template,
  Task,
  ShopItem,
  WarmupPresetItem,
  Settings,
  BattleMission,
  BattleSettings,
  BossImageSettings,
  WeeklyGoal,
} from '@/shared/types/domain';

// ============================================================================
// DailyData 전략 (Last-Write-Wins)
// ============================================================================

/**
 * DailyData 동기화 전략 (Last-Write-Wins)
 * 일일 스케줄 데이터를 Firebase와 동기화합니다.
 * @type {SyncStrategy<DailyData>}
 */
export const dailyDataStrategy: SyncStrategy<DailyData> = {
  collection: 'dailyData',
  getSuccessMessage: (data, key) =>
    `DailyData synced: ${key} (${data.tasks.length} tasks, ${data.tasks.filter(t => t.completed).length} completed)`,
};

// ============================================================================
// GameState 전략 (Delta-based Merge)
// ============================================================================

/**
 * GameState 동기화 전략 (Delta-based Merge)
 * 게임 상태(XP, 퀘스트, 히스토리)를 병합 알고리즘으로 동기화합니다.
 * @type {SyncStrategy<GameState>}
 */
export const gameStateStrategy: SyncStrategy<GameState> = {
  collection: 'gameState',
  resolveConflict: mergeGameState,
  getSuccessMessage: (data) =>
    `GameState synced (XP ${data.totalXP})`,
};

// ============================================================================
// ChatHistory 전략 (Last-Write-Wins)
// ============================================================================

/**
 * ChatHistory 동기화 전략 (Last-Write-Wins)
 * 와이프 대화 기록을 Firebase와 동기화합니다.
 * @type {SyncStrategy<ChatHistory>}
 */
export const chatHistoryStrategy: SyncStrategy<ChatHistory> = {
  collection: 'chatHistory',
  getSuccessMessage: (data, key) =>
    `ChatHistory synced: ${key} (${data.messages.length} messages)`,
};

// ============================================================================
// TokenUsage 전략 (Last-Write-Wins)
// ============================================================================

/**
 * TokenUsage 동기화 전략 (Last-Write-Wins)
 * 일일 토큰 사용량을 Firebase와 동기화합니다.
 * @type {SyncStrategy<DailyTokenUsage>}
 */
export const tokenUsageStrategy: SyncStrategy<DailyTokenUsage> = {
  collection: 'tokenUsage',
  getSuccessMessage: (data, key) =>
    `TokenUsage synced: ${key} (${data.totalTokens} tokens)`,
};

// ============================================================================
// Templates 전략 (Last-Write-Wins)
// ============================================================================

/**
 * Template 동기화 전략 (Last-Write-Wins)
 * 스케줄 템플릿을 Firebase와 동기화합니다.
 * @type {SyncStrategy<Template[]>}
 */
export const templateStrategy: SyncStrategy<Template[]> = {
  collection: 'templates',
  getSuccessMessage: (data) =>
    `Templates synced (${data.length} templates, ${data.filter(t => t.autoGenerate).length} auto-generate)`,
};

// ============================================================================
// GlobalInbox 전략 (ID-based Merge)
// ============================================================================

/**
 * GlobalInbox 동기화 전략 (ID-based Merge)
 * 스케줄되지 않은 대기 작업들을 ID 기반 병합으로 동기화합니다.
 * @type {SyncStrategy<Task[]>}
 */
export const globalInboxStrategy: SyncStrategy<Task[]> = {
  collection: 'globalInbox',
  resolveConflict: mergeTaskArray,
  getSuccessMessage: (data) =>
    `GlobalInbox synced (${data.length} tasks, ${data.filter(t => !t.completed).length} uncompleted)`,
};

// ============================================================================
// CompletedInbox (date-keyed) Sync
// ============================================================================

/**
 * CompletedInbox 동기화 전략 (Last-Write-Wins)
 * 완료된 인박스 작업을 날짜별로 Firebase와 동기화합니다.
 * @type {SyncStrategy<Task[]>}
 */
export const completedInboxStrategy: SyncStrategy<Task[]> = {
  collection: 'completedInbox',
  getSuccessMessage: (data, key) =>
    `CompletedInbox synced for ${key || 'unknown-date'} (${data.length} tasks)`,
};

// ============================================================================
// ShopItems 전략 (Last-Write-Wins)
// ============================================================================

/**
 * ShopItems 동기화 전략 (Last-Write-Wins)
 * 상점 아이템 및 인벤토리를 Firebase와 동기화합니다.
 * @type {SyncStrategy<ShopItem[]>}
 */
export const shopItemsStrategy: SyncStrategy<ShopItem[]> = {
  collection: 'shopItems',
  getSuccessMessage: (data) =>
    `ShopItems synced (${data.length} items, total quantity: ${data.reduce((sum, item) => sum + (item.quantity || 0), 0)})`,
};

// ============================================================================
// WarmupPreset 전략 (Last-Write-Wins)
// ============================================================================

/**
 * WarmupPreset 동기화 전략 (Last-Write-Wins)
 * 워밍업 프리셋 아이템을 Firebase와 동기화합니다.
 * @type {SyncStrategy<WarmupPresetItem[]>}
 */
export const warmupPresetStrategy: SyncStrategy<WarmupPresetItem[]> = {
  collection: 'warmupPreset',
  getSuccessMessage: (data) => `Warmup preset synced (${data.length} items)`,
};

// ============================================================================
// Settings 전략 (Last-Write-Wins)
// ============================================================================

/**
 * Settings 동기화 전략 (Last-Write-Wins)
 * 앱 설정을 Firebase와 동기화합니다. (민감 정보 제외)
 * @type {SyncStrategy<Settings>}
 */
export const settingsStrategy: SyncStrategy<Settings> = {
  collection: 'settings',
  getSuccessMessage: (data) =>
    `Settings synced (Auto-msg: ${data.autoMessageEnabled}, Waifu: ${data.waifuMode})`,
  serialize: (data) => {
    // 민감한 정보(API Key, Firebase Config)는 동기화에서 제외
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { geminiApiKey: _apiKey, firebaseConfig: _config, ...rest } = data;
    return rest;
  },
};

// ============================================================================
// Battle Missions 전략 (Last-Write-Wins)
// ============================================================================

/**
 * BattleMissions 동기화 전략 (Last-Write-Wins)
 * 전투 미션 목록을 Firebase와 동기화합니다.
 * @type {SyncStrategy<BattleMission[]>}
 */
export const battleMissionsStrategy: SyncStrategy<BattleMission[]> = {
  collection: 'battleMissions',
  getSuccessMessage: (data) =>
    `Battle missions synced (${data.length} missions, ${data.filter(m => m.enabled).length} enabled)`,
};

// ============================================================================
// Battle Settings 전략 (Last-Write-Wins)
// ============================================================================

/**
 * BattleSettings 동기화 전략 (Last-Write-Wins)
 * 전투 설정을 Firebase와 동기화합니다.
 * @type {SyncStrategy<BattleSettings>}
 */
export const battleSettingsStrategy: SyncStrategy<BattleSettings> = {
  collection: 'battleSettings',
  getSuccessMessage: (data) =>
    `Battle settings synced (${data.dailyBossCount} bosses/day, ${data.bossBaseHP}min HP)`,
};

// ============================================================================
// Boss Image Settings 전략 (Last-Write-Wins)
// ============================================================================

/**
 * BossImageSettings 동기화 전략 (Last-Write-Wins)
 * 보스별 이미지 위치/스케일 설정을 Firebase와 동기화합니다.
 * @type {SyncStrategy<BossImageSettings>}
 */
export const bossImageSettingsStrategy: SyncStrategy<BossImageSettings> = {
  collection: 'bossImageSettings',
  getSuccessMessage: (data) =>
    `Boss image settings synced (${Object.keys(data).length} bosses configured)`,
};

// ============================================================================
// Weekly Goals 전략 (Last-Write-Wins)
// ============================================================================

/**
 * WeeklyGoals 동기화 전략 (Last-Write-Wins)
 * 주간 장기목표를 Firebase와 동기화합니다.
 * @type {SyncStrategy<WeeklyGoal[]>}
 */
export const weeklyGoalStrategy: SyncStrategy<WeeklyGoal[]> = {
  collection: 'weeklyGoals',
  getSuccessMessage: (data) =>
    `WeeklyGoals synced (${data.length} goals, ${data.filter(g => g.currentProgress >= g.target).length} completed)`,
};

// ============================================================================
// Item Sync Strategies (Phase B)
// ============================================================================

/**
 * WeeklyGoal 개별 아이템 동기화 전략
 * 목표 추가/수정/삭제 시 개별 아이템만 Firebase에 동기화합니다.
 * @type {ItemSyncStrategy<WeeklyGoal>}
 */
export const weeklyGoalItemStrategy: ItemSyncStrategy<WeeklyGoal> = {
  collection: 'weeklyGoals',
  getItemId: (goal) => goal.id,
  getBasePath: (uid) => `users/${uid}/weeklyGoals`,
};

/**
 * GlobalInbox Task 개별 아이템 동기화 전략
 * 인박스 작업 추가/수정/삭제 시 개별 아이템만 Firebase에 동기화합니다.
 * @type {ItemSyncStrategy<Task>}
 */
export const globalInboxItemStrategy: ItemSyncStrategy<Task> = {
  collection: 'globalInbox',
  getItemId: (task) => task.id,
  getBasePath: (uid) => `users/${uid}/globalInbox`,
};

/**
 * Template 개별 아이템 동기화 전략
 * 템플릿 추가/수정/삭제 시 개별 아이템만 Firebase에 동기화합니다.
 * @type {ItemSyncStrategy<Template>}
 */
export const templateItemStrategy: ItemSyncStrategy<Template> = {
  collection: 'templates',
  getItemId: (template) => template.id,
  getBasePath: (uid) => `users/${uid}/templates`,
};

/**
 * ShopItem 개별 아이템 동기화 전략
 * 상점 아이템 추가/수정/삭제 시 개별 아이템만 Firebase에 동기화합니다.
 * @type {ItemSyncStrategy<ShopItem>}
 */
export const shopItemsItemStrategy: ItemSyncStrategy<ShopItem> = {
  collection: 'shopItems',
  getItemId: (item) => item.id,
  getBasePath: (uid) => `users/${uid}/shopItems`,
};

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
import { mergeGameState, mergeTaskArray } from './conflictResolver';
import type {
  DailyData,
  DailyGoal,
  GameState,
  ChatHistory,
  DailyTokenUsage,
  EnergyLevel,
  Template,
  Task,
  ShopItem,
  WarmupPresetItem,
  Settings,
  BingoProgress,
} from '@/shared/types/domain';

// ============================================================================
// DailyData 전략 (Last-Write-Wins)
// ============================================================================

export const dailyDataStrategy: SyncStrategy<DailyData> = {
  collection: 'dailyData',
  getSuccessMessage: (data, key) =>
    `DailyData synced: ${key} (${data.tasks.length} tasks, ${data.tasks.filter(t => t.completed).length} completed)`,
};

// ============================================================================
// GameState 전략 (Delta-based Merge)
// ============================================================================

export const gameStateStrategy: SyncStrategy<GameState> = {
  collection: 'gameState',
  resolveConflict: mergeGameState,
  getSuccessMessage: (data) =>
    `GameState synced (XP ${data.totalXP})`,
};

// ============================================================================
// ChatHistory 전략 (Last-Write-Wins)
// ============================================================================

export const chatHistoryStrategy: SyncStrategy<ChatHistory> = {
  collection: 'chatHistory',
  getSuccessMessage: (data, key) =>
    `ChatHistory synced: ${key} (${data.messages.length} messages)`,
};

// ============================================================================
// TokenUsage 전략 (Last-Write-Wins)
// ============================================================================

export const tokenUsageStrategy: SyncStrategy<DailyTokenUsage> = {
  collection: 'tokenUsage',
  getSuccessMessage: (data, key) =>
    `TokenUsage synced: ${key} (${data.totalTokens} tokens)`,
};

// ============================================================================
// EnergyLevels 전략 (Last-Write-Wins)
// ============================================================================

export const energyLevelsStrategy: SyncStrategy<EnergyLevel[]> = {
  collection: 'energyLevels',
  getSuccessMessage: (data, key) =>
    `EnergyLevels synced: ${key} (${data.length} records)`,
};

// ============================================================================
// Templates 전략 (Last-Write-Wins)
// ============================================================================

export const templateStrategy: SyncStrategy<Template[]> = {
  collection: 'templates',
  getSuccessMessage: (data) =>
    `Templates synced (${data.length} templates, ${data.filter(t => t.autoGenerate).length} auto-generate)`,
};

// ============================================================================
// GlobalInbox 전략 (ID-based Merge)
// ============================================================================

export const globalInboxStrategy: SyncStrategy<Task[]> = {
  collection: 'globalInbox',
  resolveConflict: mergeTaskArray,
  getSuccessMessage: (data) =>
    `GlobalInbox synced (${data.length} tasks, ${data.filter(t => !t.completed).length} uncompleted)`,
};

// ============================================================================
// CompletedInbox (date-keyed) Sync
// ============================================================================

export const completedInboxStrategy: SyncStrategy<Task[]> = {
  collection: 'completedInbox',
  getSuccessMessage: (data, key) =>
    `CompletedInbox synced for ${key || 'unknown-date'} (${data.length} tasks)`,
};

// ============================================================================
// ShopItems 전략 (Last-Write-Wins)
// ============================================================================

export const shopItemsStrategy: SyncStrategy<ShopItem[]> = {
  collection: 'shopItems',
  getSuccessMessage: (data) =>
    `ShopItems synced (${data.length} items, total quantity: ${data.reduce((sum, item) => sum + (item.quantity || 0), 0)})`,
};

// ============================================================================
// DailyGoals 전략 (Last-Write-Wins) - DEPRECATED
// ============================================================================

export const dailyGoalStrategy: SyncStrategy<DailyGoal[]> = {
  collection: 'dailyGoals',
  getSuccessMessage: (data, key) =>
    `DailyGoals synced: ${key} (${data.length} goals, ${data.reduce((sum, g) => sum + g.completedMinutes, 0)}m completed)`,
};

// ============================================================================
// GlobalGoals 전략 (Last-Write-Wins)
// ============================================================================

export const globalGoalStrategy: SyncStrategy<DailyGoal[]> = {
  collection: 'globalGoals',
  getSuccessMessage: (data) =>
    `GlobalGoals synced (${data.length} goals, ${data.reduce((sum, g) => sum + g.completedMinutes, 0)}m completed)`,
};

// ============================================================================
// WarmupPreset 전략 (Last-Write-Wins)
// ============================================================================

export const warmupPresetStrategy: SyncStrategy<WarmupPresetItem[]> = {
  collection: 'warmupPreset',
  getSuccessMessage: (data) => `Warmup preset synced (${data.length} items)`,
};

// ============================================================================
// Settings 전략 (Last-Write-Wins)
// ============================================================================

export const settingsStrategy: SyncStrategy<Settings> = {
  collection: 'settings',
  getSuccessMessage: (data) =>
    `Settings synced (Auto-msg: ${data.autoMessageEnabled}, Waifu: ${data.waifuMode})`,
  serialize: (data) => {
    // 민감한 정보(API Key, Firebase Config)는 동기화에서 제외
    const { geminiApiKey, firebaseConfig, ...rest } = data;
    return rest;
  },
};

// ============================================================================
// Bingo Progress 전략 (Last-Write-Wins)
// ============================================================================

export const bingoProgressStrategy: SyncStrategy<BingoProgress> = {
  collection: 'bingoProgress',
  getSuccessMessage: (_, key) => `Bingo progress synced (${key || 'today'})`,
};

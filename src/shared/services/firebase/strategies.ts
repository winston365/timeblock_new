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
import { mergeGameState } from './conflictResolver';
import type { DailyData, GameState, ChatHistory, DailyTokenUsage, EnergyLevel, Template, Task, ShopItem } from '@/shared/types/domain';

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
    `GameState synced (Level ${data.level}, XP ${data.totalXP})`,
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
// GlobalInbox 전략 (Last-Write-Wins)
// ============================================================================

export const globalInboxStrategy: SyncStrategy<Task[]> = {
  collection: 'globalInbox',
  getSuccessMessage: (data) =>
    `GlobalInbox synced (${data.length} tasks, ${data.filter(t => !t.completed).length} uncompleted)`,
};

// ============================================================================
// ShopItems 전략 (Last-Write-Wins)
// ============================================================================

export const shopItemsStrategy: SyncStrategy<ShopItem[]> = {
  collection: 'shopItems',
  getSuccessMessage: (data) =>
    `ShopItems synced (${data.length} items, total quantity: ${data.reduce((sum, item) => sum + (item.quantity || 0), 0)})`,
};

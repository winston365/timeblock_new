/**
 * 데이터 타입별 동기화 전략 정의
 * R8: 중복 제거 - 각 데이터 타입의 전략을 한 곳에서 관리
 */

import type { SyncStrategy } from './syncCore';
import { mergeGameState } from './conflictResolver';
import type { DailyData, GameState, ChatHistory, DailyTokenUsage } from '@/shared/types/domain';

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

/**
 * T80-04: Sync Strategies Contract Tests
 *
 * @role strategies.ts 전략 매핑/직렬화 계약 검증
 * @note Firebase 실제 호출 없이 순수 계약 테스트
 */
import { describe, expect, it } from 'vitest';

import {
  dailyDataStrategy,
  gameStateStrategy,
  chatHistoryStrategy,
  tokenUsageStrategy,
  templateStrategy,
  globalInboxStrategy,
  completedInboxStrategy,
  shopItemsStrategy,
  warmupPresetStrategy,
  settingsStrategy,
  battleMissionsStrategy,
  battleSettingsStrategy,
  bossImageSettingsStrategy,
  weeklyGoalStrategy,
} from '@/shared/services/sync/firebase/strategies';

import type {
  DailyData,
  GameState,
  ChatHistory,
  DailyTokenUsage,
  Template,
  Task,
  Settings,
  BattleMission,
  WeeklyGoal,
} from '@/shared/types/domain';

// ============================================================================
// Collection Name Mapping Tests
// ============================================================================
describe('Sync Strategies - Collection Name Mapping', () => {
  it('dailyDataStrategy has correct collection name', () => {
    expect(dailyDataStrategy.collection).toBe('dailyData');
  });

  it('gameStateStrategy has correct collection name', () => {
    expect(gameStateStrategy.collection).toBe('gameState');
  });

  it('chatHistoryStrategy has correct collection name', () => {
    expect(chatHistoryStrategy.collection).toBe('chatHistory');
  });

  it('tokenUsageStrategy has correct collection name', () => {
    expect(tokenUsageStrategy.collection).toBe('tokenUsage');
  });

  it('templateStrategy has correct collection name', () => {
    expect(templateStrategy.collection).toBe('templates');
  });

  it('globalInboxStrategy has correct collection name', () => {
    expect(globalInboxStrategy.collection).toBe('globalInbox');
  });

  it('completedInboxStrategy has correct collection name', () => {
    expect(completedInboxStrategy.collection).toBe('completedInbox');
  });

  it('shopItemsStrategy has correct collection name', () => {
    expect(shopItemsStrategy.collection).toBe('shopItems');
  });

  it('warmupPresetStrategy has correct collection name', () => {
    expect(warmupPresetStrategy.collection).toBe('warmupPreset');
  });

  it('settingsStrategy has correct collection name', () => {
    expect(settingsStrategy.collection).toBe('settings');
  });

  it('battleMissionsStrategy has correct collection name', () => {
    expect(battleMissionsStrategy.collection).toBe('battleMissions');
  });

  it('battleSettingsStrategy has correct collection name', () => {
    expect(battleSettingsStrategy.collection).toBe('battleSettings');
  });

  it('bossImageSettingsStrategy has correct collection name', () => {
    expect(bossImageSettingsStrategy.collection).toBe('bossImageSettings');
  });

  it('weeklyGoalStrategy has correct collection name', () => {
    expect(weeklyGoalStrategy.collection).toBe('weeklyGoals');
  });

  it('all strategy collections are unique', () => {
    const collections = [
      dailyDataStrategy.collection,
      gameStateStrategy.collection,
      chatHistoryStrategy.collection,
      tokenUsageStrategy.collection,
      templateStrategy.collection,
      globalInboxStrategy.collection,
      completedInboxStrategy.collection,
      shopItemsStrategy.collection,
      warmupPresetStrategy.collection,
      settingsStrategy.collection,
      battleMissionsStrategy.collection,
      battleSettingsStrategy.collection,
      bossImageSettingsStrategy.collection,
      weeklyGoalStrategy.collection,
    ];

    const uniqueCollections = new Set(collections);
    expect(uniqueCollections.size).toBe(collections.length);
  });
});

// ============================================================================
// Conflict Resolution Strategy Tests
// ============================================================================
describe('Sync Strategies - Conflict Resolution', () => {
  it('gameStateStrategy has custom resolveConflict (mergeGameState)', () => {
    expect(gameStateStrategy.resolveConflict).toBeDefined();
    expect(typeof gameStateStrategy.resolveConflict).toBe('function');
  });

  it('globalInboxStrategy has custom resolveConflict (mergeTaskArray)', () => {
    expect(globalInboxStrategy.resolveConflict).toBeDefined();
    expect(typeof globalInboxStrategy.resolveConflict).toBe('function');
  });

  it('LWW strategies have no custom resolveConflict (uses default)', () => {
    expect(dailyDataStrategy.resolveConflict).toBeUndefined();
    expect(chatHistoryStrategy.resolveConflict).toBeUndefined();
    expect(tokenUsageStrategy.resolveConflict).toBeUndefined();
    expect(templateStrategy.resolveConflict).toBeUndefined();
    expect(completedInboxStrategy.resolveConflict).toBeUndefined();
    expect(shopItemsStrategy.resolveConflict).toBeUndefined();
    expect(warmupPresetStrategy.resolveConflict).toBeUndefined();
    expect(settingsStrategy.resolveConflict).toBeUndefined();
    expect(battleMissionsStrategy.resolveConflict).toBeUndefined();
    expect(battleSettingsStrategy.resolveConflict).toBeUndefined();
    expect(bossImageSettingsStrategy.resolveConflict).toBeUndefined();
    expect(weeklyGoalStrategy.resolveConflict).toBeUndefined();
  });
});

// ============================================================================
// Serialize Contract Tests
// ============================================================================
describe('Sync Strategies - Serialize Contract', () => {
  it('settingsStrategy.serialize excludes sensitive fields (geminiApiKey, firebaseConfig)', () => {
    expect(settingsStrategy.serialize).toBeDefined();

    const mockSettings: Settings = {
      geminiApiKey: 'secret-api-key-12345',
      firebaseConfig: {
        apiKey: 'firebase-secret',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test.appspot.com',
        messagingSenderId: '123456',
        appId: '1:123456:web:abcdef',
        databaseURL: 'https://test.firebaseio.com',
      },
      autoMessageEnabled: true,
      waifuMode: 'tsundere',
      soundEnabled: true,
      focusTimerMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      pomodorosBeforeLongBreak: 4,
      autoStartBreaks: false,
      autoStartPomodoros: false,
      showNotifications: true,
      currentWaifuId: 'eunha',
      selectedBgm: 'lofi',
      bgmVolume: 0.5,
      language: 'ko',
      showCompletedTasks: true,
      defaultTaskDuration: 15,
    } as unknown as Settings;

    const serialized = settingsStrategy.serialize!(mockSettings);

    // 민감 정보 제외 확인
    expect(serialized.geminiApiKey).toBeUndefined();
    expect(serialized.firebaseConfig).toBeUndefined();

    // 다른 필드는 유지
    expect(serialized.autoMessageEnabled).toBe(true);
    expect(serialized.waifuMode).toBe('tsundere');
    expect(serialized.soundEnabled).toBe(true);
  });

  it('settingsStrategy.serialize preserves all non-sensitive fields', () => {
    const mockSettings = {
      geminiApiKey: 'to-be-removed',
      firebaseConfig: { apiKey: 'to-be-removed' },
      autoMessageEnabled: false,
      waifuMode: 'kuudere',
      focusTimerMinutes: 30,
      shortBreakMinutes: 10,
    } as unknown as Settings;

    const serialized = settingsStrategy.serialize!(mockSettings);

    expect(serialized.autoMessageEnabled).toBe(false);
    expect(serialized.waifuMode).toBe('kuudere');
    expect(serialized.focusTimerMinutes).toBe(30);
    expect(serialized.shortBreakMinutes).toBe(10);
  });

  it('other strategies do not have serialize (sync as-is)', () => {
    expect(dailyDataStrategy.serialize).toBeUndefined();
    expect(gameStateStrategy.serialize).toBeUndefined();
    expect(chatHistoryStrategy.serialize).toBeUndefined();
    expect(tokenUsageStrategy.serialize).toBeUndefined();
    expect(templateStrategy.serialize).toBeUndefined();
    expect(globalInboxStrategy.serialize).toBeUndefined();
    expect(completedInboxStrategy.serialize).toBeUndefined();
    expect(shopItemsStrategy.serialize).toBeUndefined();
    expect(warmupPresetStrategy.serialize).toBeUndefined();
    expect(battleMissionsStrategy.serialize).toBeUndefined();
    expect(battleSettingsStrategy.serialize).toBeUndefined();
    expect(bossImageSettingsStrategy.serialize).toBeUndefined();
    expect(weeklyGoalStrategy.serialize).toBeUndefined();
  });
});

// ============================================================================
// Success Message Contract Tests
// ============================================================================
describe('Sync Strategies - Success Message Contract', () => {
  it('dailyDataStrategy.getSuccessMessage includes task count', () => {
    expect(dailyDataStrategy.getSuccessMessage).toBeDefined();

    const mockDailyData = {
      tasks: [
        { id: 't1', text: 'Task 1', completed: true } as Task,
        { id: 't2', text: 'Task 2', completed: false } as Task,
      ],
      goals: [],
      timeBlockStates: {},
      updatedAt: Date.now(),
    } as DailyData;

    const message = dailyDataStrategy.getSuccessMessage!(mockDailyData, '2024-01-15');

    expect(message).toContain('2024-01-15');
    expect(message).toContain('2 tasks');
    expect(message).toContain('1 completed');
  });

  it('gameStateStrategy.getSuccessMessage includes XP', () => {
    expect(gameStateStrategy.getSuccessMessage).toBeDefined();

    const mockGameState: GameState = {
      totalXP: 1500,
      dailyXP: 100,
      availableXP: 50,
      streak: 5,
      lastLogin: '2024-01-15',
      dailyQuests: [],
      questBonusClaimed: false,
      xpHistory: [],
      timeBlockXP: {},
      timeBlockXPHistory: [],
      completedTasksHistory: [],
      dailyTimerCount: 3,
      inventory: {},
    };

    const message = gameStateStrategy.getSuccessMessage!(mockGameState);

    expect(message).toContain('1500');
    expect(message.toLowerCase()).toContain('xp');
  });

  it('chatHistoryStrategy.getSuccessMessage includes message count', () => {
    expect(chatHistoryStrategy.getSuccessMessage).toBeDefined();

    const mockChatHistory = {
      date: '2024-01-15',
      messages: [
        { id: 'm1', text: 'Hello', role: 'user' as const, timestamp: 0, category: 'qa' as const },
        { id: 'm2', text: 'Hi!', role: 'model' as const, timestamp: 1, category: 'qa' as const },
      ],
      updatedAt: Date.now(),
    } as ChatHistory;

    const message = chatHistoryStrategy.getSuccessMessage!(mockChatHistory, 'eunha');

    expect(message).toContain('eunha');
    expect(message).toContain('2 messages');
  });

  it('tokenUsageStrategy.getSuccessMessage includes token count', () => {
    expect(tokenUsageStrategy.getSuccessMessage).toBeDefined();

    const mockTokenUsage = {
      date: '2024-01-15',
      totalTokens: 5000,
      promptTokens: 3000,
      candidatesTokens: 2000,
    } as DailyTokenUsage;

    const message = tokenUsageStrategy.getSuccessMessage!(mockTokenUsage, '2024-01-15');

    expect(message).toContain('2024-01-15');
    expect(message).toContain('5000');
    expect(message.toLowerCase()).toContain('token');
  });

  it('templateStrategy.getSuccessMessage includes template count and auto-generate count', () => {
    expect(templateStrategy.getSuccessMessage).toBeDefined();

    const mockTemplates = [
      { id: 't1', name: 'Work', text: 'Work task', memo: '', baseDuration: 30, resistance: 'low' as const, timeBlock: 'morning' as const, autoGenerate: true, recurrenceType: 'daily' as const },
      { id: 't2', name: 'Weekend', text: 'Weekend task', memo: '', baseDuration: 60, resistance: 'medium' as const, timeBlock: 'afternoon' as const, autoGenerate: false, recurrenceType: 'none' as const },
      { id: 't3', name: 'Daily', text: 'Daily task', memo: '', baseDuration: 15, resistance: 'low' as const, timeBlock: 'dawn' as const, autoGenerate: true, recurrenceType: 'daily' as const },
    ] as Template[];

    const message = templateStrategy.getSuccessMessage!(mockTemplates);

    expect(message).toContain('3 templates');
    expect(message).toContain('2 auto-generate');
  });

  it('globalInboxStrategy.getSuccessMessage includes task and uncompleted count', () => {
    expect(globalInboxStrategy.getSuccessMessage).toBeDefined();

    const mockTasks: Task[] = [
      { id: 't1', text: 'Task 1', completed: false } as Task,
      { id: 't2', text: 'Task 2', completed: true } as Task,
      { id: 't3', text: 'Task 3', completed: false } as Task,
    ];

    const message = globalInboxStrategy.getSuccessMessage!(mockTasks);

    expect(message).toContain('3 tasks');
    expect(message).toContain('2 uncompleted');
  });

  it('weeklyGoalStrategy.getSuccessMessage includes goal and completed count', () => {
    expect(weeklyGoalStrategy.getSuccessMessage).toBeDefined();

    const mockGoals = [
      { id: 'g1', title: 'Goal 1', target: 5, currentProgress: 5, unit: '개', order: 0, weekStartDate: '2024-01-15', history: [], createdAt: '', updatedAt: '' },
      { id: 'g2', title: 'Goal 2', target: 10, currentProgress: 3, unit: '분', order: 1, weekStartDate: '2024-01-15', history: [], createdAt: '', updatedAt: '' },
    ] as WeeklyGoal[];

    const message = weeklyGoalStrategy.getSuccessMessage!(mockGoals);

    expect(message).toContain('2 goals');
    expect(message).toContain('1 completed');
  });

  it('battleMissionsStrategy.getSuccessMessage includes mission and enabled count', () => {
    expect(battleMissionsStrategy.getSuccessMessage).toBeDefined();

    const mockMissions = [
      { id: 'm1', text: 'Mission 1', damage: 15, order: 0, enabled: true, cooldownMinutes: 0, createdAt: '', updatedAt: '' },
      { id: 'm2', text: 'Mission 2', damage: 15, order: 1, enabled: false, cooldownMinutes: 0, createdAt: '', updatedAt: '' },
      { id: 'm3', text: 'Mission 3', damage: 20, order: 2, enabled: true, cooldownMinutes: 30, createdAt: '', updatedAt: '' },
    ] as BattleMission[];

    const message = battleMissionsStrategy.getSuccessMessage!(mockMissions);

    expect(message).toContain('3 missions');
    expect(message).toContain('2 enabled');
  });
});

// ============================================================================
// Strategy Type Consistency Tests
// ============================================================================
describe('Sync Strategies - Type Consistency', () => {
  it('all strategies have required collection property', () => {
    const strategies = [
      dailyDataStrategy,
      gameStateStrategy,
      chatHistoryStrategy,
      tokenUsageStrategy,
      templateStrategy,
      globalInboxStrategy,
      completedInboxStrategy,
      shopItemsStrategy,
      warmupPresetStrategy,
      settingsStrategy,
      battleMissionsStrategy,
      battleSettingsStrategy,
      bossImageSettingsStrategy,
      weeklyGoalStrategy,
    ];

    strategies.forEach((strategy, index) => {
      expect(strategy.collection, `Strategy ${index} missing collection`).toBeDefined();
      expect(typeof strategy.collection).toBe('string');
      expect(strategy.collection.length).toBeGreaterThan(0);
    });
  });

  it('getUserId is optional and defaults to undefined', () => {
    // 모든 전략에서 getUserId가 정의되지 않음 (기본값 'user' 사용)
    expect(dailyDataStrategy.getUserId).toBeUndefined();
    expect(gameStateStrategy.getUserId).toBeUndefined();
    expect(settingsStrategy.getUserId).toBeUndefined();
  });
});


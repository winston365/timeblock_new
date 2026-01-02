/**
 * weekly-goals-utils.test.ts
 *
 * @file Weekly Goals 유틸리티 테스트
 * @description
 *   - T04: weekUtils 테스트
 *   - T28: themeGroupUtils 테스트  
 *   - T29-T30: historyInsightUtils 테스트
 */

import { describe, it, expect } from 'vitest';

// weekUtils
import {
  getWeekLabel,
  getWeekStartDate,
  getWeekProgressRatio,
  getWeekLabelKorean,
  getWeekLabelKoreanShort,
  parseWeekLabel,
  isSameWeek,
  getDayOfWeekIndex,
  getRemainingDays,
} from '@/features/goals/utils/weekUtils';

// themeGroupUtils
import {
  groupGoalsByTheme,
  filterGoalsByTheme,
  getUsedThemes,
  getThemeInfo,
} from '@/features/goals/utils/themeGroupUtils';

// historyInsightUtils
import {
  calculateGoalInsight,
  calculateOverallInsight,
} from '@/features/goals/utils/historyInsightUtils';

import type { WeeklyGoal, WeeklyGoalHistory } from '@/shared/types/domain';

// ============================================================================
// weekUtils Tests
// ============================================================================

describe('weekUtils', () => {
  describe('getWeekLabel', () => {
    it('should return YYYY-WW format', () => {
      const label = getWeekLabel();
      expect(label).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should accept a custom date', () => {
      const date = new Date('2025-01-06'); // Known Monday of week 02
      const label = getWeekLabel(date);
      expect(label).toBe('2025-W02');
    });
  });

  describe('getWeekStartDate', () => {
    it('should return Monday of the current week as YYYY-MM-DD', () => {
      const today = new Date('2025-01-08'); // Wednesday
      const start = getWeekStartDate(today);
      expect(start).toBe('2025-01-06');
    });

    it('should handle Sunday correctly (returns previous Monday)', () => {
      const sunday = new Date('2025-01-12'); // Sunday
      const start = getWeekStartDate(sunday);
      expect(start).toBe('2025-01-06');
    });
  });

  describe('parseWeekLabel', () => {
    it('should parse valid week label to Monday Date', () => {
      const result = parseWeekLabel('2025-W02');
      expect(result).not.toBeNull();
      expect(result?.getDay()).toBe(1); // Monday
    });

    it('should return null for invalid format', () => {
      expect(parseWeekLabel('invalid')).toBeNull();
      expect(parseWeekLabel('2025-02')).toBeNull();
    });
  });

  describe('getWeekProgressRatio', () => {
    it('should return progress between 0 and 1', () => {
      const progress = getWeekProgressRatio();
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    });

    it('should return correct ratio for day index', () => {
      expect(getWeekProgressRatio(0)).toBeCloseTo(1 / 7); // Monday
      expect(getWeekProgressRatio(6)).toBeCloseTo(1); // Sunday
    });
  });

  describe('getWeekLabelKorean', () => {
    it('should format as Korean week label', () => {
      const date = new Date('2025-01-06'); // Week 02
      const result = getWeekLabelKorean(date);
      expect(result).toBe('2025년 2주차');
    });
  });

  describe('getWeekLabelKoreanShort', () => {
    it('should return short Korean format for current year', () => {
      const result = getWeekLabelKoreanShort();
      expect(result).toMatch(/^\d+주차$/);
    });
  });

  describe('isSameWeek', () => {
    it('should return true for same week', () => {
      const monday = new Date('2025-01-06');
      const friday = new Date('2025-01-10');
      expect(isSameWeek(monday, friday)).toBe(true);
    });

    it('should return false for different weeks', () => {
      const week1 = new Date('2025-01-06');
      const week2 = new Date('2025-01-13');
      expect(isSameWeek(week1, week2)).toBe(false);
    });
  });

  describe('getDayOfWeekIndex', () => {
    it('should return 0 for Monday', () => {
      const monday = new Date('2025-01-06');
      expect(getDayOfWeekIndex(monday)).toBe(0);
    });

    it('should return 6 for Sunday', () => {
      const sunday = new Date('2025-01-12');
      expect(getDayOfWeekIndex(sunday)).toBe(6);
    });
  });

  describe('getRemainingDays', () => {
    it('should return 7 for Monday (day 0)', () => {
      expect(getRemainingDays(0)).toBe(7);
    });

    it('should return 1 for Sunday (day 6)', () => {
      expect(getRemainingDays(6)).toBe(1);
    });
  });
});

// ============================================================================
// themeGroupUtils Tests
// ============================================================================

describe('themeGroupUtils', () => {
  const createMockGoal = (id: string, theme?: string): WeeklyGoal => ({
    id,
    title: `Goal ${id}`,
    target: 100,
    currentProgress: 50,
    unit: '개',
    order: parseInt(id, 10) || 0,
    weekStartDate: '2025-01-06',
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    theme,
  });

  describe('groupGoalsByTheme', () => {
    it('should group goals by theme', () => {
      const goals = [
        createMockGoal('1', 'study'),
        createMockGoal('2', 'study'),
        createMockGoal('3', 'health'),
        createMockGoal('4'), // no theme
      ];

      const groups = groupGoalsByTheme(goals);

      expect(groups.length).toBe(3); // study, health, uncategorized
      
      const studyGroup = groups.find(g => g.themeId === 'study');
      expect(studyGroup?.goals.length).toBe(2);
      
      const healthGroup = groups.find(g => g.themeId === 'health');
      expect(healthGroup?.goals.length).toBe(1);
      
      const uncategorized = groups.find(g => g.themeId === 'uncategorized');
      expect(uncategorized?.goals.length).toBe(1);
    });

    it('should handle custom themes', () => {
      const goals = [createMockGoal('1', 'my-custom-theme')];
      const groups = groupGoalsByTheme(goals);

      expect(groups.length).toBe(1);
      expect(groups[0].themeId).toBe('my-custom-theme');
    });

    it('should sort uncategorized to last', () => {
      const goals = [
        createMockGoal('1'), // no theme
        createMockGoal('2', 'study'),
      ];
      const groups = groupGoalsByTheme(goals);

      expect(groups[groups.length - 1].themeId).toBe('uncategorized');
    });
  });

  describe('filterGoalsByTheme', () => {
    it('should return all goals when themeId is null', () => {
      const goals = [
        createMockGoal('1', 'study'),
        createMockGoal('2', 'health'),
      ];
      const filtered = filterGoalsByTheme(goals, null);
      expect(filtered.length).toBe(2);
    });

    it('should filter by specific theme', () => {
      const goals = [
        createMockGoal('1', 'study'),
        createMockGoal('2', 'health'),
        createMockGoal('3', 'study'),
      ];
      const filtered = filterGoalsByTheme(goals, 'study');
      expect(filtered.length).toBe(2);
    });

    it('should filter uncategorized goals', () => {
      const goals = [
        createMockGoal('1'),
        createMockGoal('2', 'study'),
        createMockGoal('3'),
      ];
      const filtered = filterGoalsByTheme(goals, 'uncategorized');
      expect(filtered.length).toBe(2);
    });
  });

  describe('getUsedThemes', () => {
    it('should return unique themes', () => {
      const goals = [
        createMockGoal('1', 'study'),
        createMockGoal('2', 'study'),
        createMockGoal('3', 'health'),
        createMockGoal('4'), // uncategorized
      ];
      const themes = getUsedThemes(goals);
      expect(themes).toContain('study');
      expect(themes).toContain('health');
      expect(themes).toContain('uncategorized');
      expect(themes.length).toBe(3);
    });
  });

  describe('getThemeInfo', () => {
    it('should return preset theme info', () => {
      const info = getThemeInfo('study');
      expect(info.label).toBe('📚 학습');
      expect(info.color).toBe('#6366f1');
    });

    it('should return uncategorized theme info', () => {
      const info = getThemeInfo('uncategorized');
      expect(info.label).toBe('📁 기타');
    });

    it('should return custom theme info', () => {
      const info = getThemeInfo('my-custom');
      expect(info.label).toBe('🏷️ my-custom');
    });
  });
});

// ============================================================================
// historyInsightUtils Tests
// ============================================================================

describe('historyInsightUtils', () => {
  const createMockHistory = (
    weekStartDate: string,
    finalProgress: number,
    target: number,
    completed: boolean
  ): WeeklyGoalHistory => ({
    weekStartDate,
    finalProgress,
    target,
    completed,
    dailyProgress: [],
  });

  const createMockGoalWithHistory = (
    id: string,
    histories: WeeklyGoalHistory[]
  ): WeeklyGoal => ({
    id,
    title: `Goal ${id}`,
    target: 100,
    currentProgress: 50,
    unit: '개',
    order: parseInt(id, 10) || 0,
    weekStartDate: '2025-01-06',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: histories,
  });

  describe('calculateGoalInsight', () => {
    it('should return default insight for goal without history', () => {
      const goal = createMockGoalWithHistory('1', []);
      const insight = calculateGoalInsight(goal);

      expect(insight.totalWeeks).toBe(0);
      expect(insight.lines.length).toBe(3);
      expect(insight.lines[0].message).toContain('첫 도전');
    });

    it('should calculate correct achievement rate', () => {
      const histories = [
        createMockHistory('2025-01-06', 100, 100, true),
        createMockHistory('2024-12-30', 80, 100, false),
        createMockHistory('2024-12-23', 100, 100, true),
      ];
      const goal = createMockGoalWithHistory('1', histories);
      const insight = calculateGoalInsight(goal);

      expect(insight.totalWeeks).toBe(3);
      expect(insight.completedWeeks).toBe(2);
      expect(insight.overallAchievementRate).toBe(67); // 2/3 = 66.67%
    });

    it('should calculate current streak correctly', () => {
      const histories = [
        createMockHistory('2025-01-06', 100, 100, true),
        createMockHistory('2024-12-30', 100, 100, true),
        createMockHistory('2024-12-23', 50, 100, false),
      ];
      const goal = createMockGoalWithHistory('1', histories);
      const insight = calculateGoalInsight(goal);

      expect(insight.currentStreak).toBe(2);
    });

    it('should calculate longest streak correctly', () => {
      const histories = [
        createMockHistory('2025-01-06', 50, 100, false), // break
        createMockHistory('2024-12-30', 100, 100, true),
        createMockHistory('2024-12-23', 100, 100, true),
        createMockHistory('2024-12-16', 100, 100, true),
      ];
      const goal = createMockGoalWithHistory('1', histories);
      const insight = calculateGoalInsight(goal);

      expect(insight.currentStreak).toBe(0);
      expect(insight.longestStreak).toBe(3);
    });

    it('should return 3 insight lines', () => {
      const histories = [createMockHistory('2025-01-06', 100, 100, true)];
      const goal = createMockGoalWithHistory('1', histories);
      const insight = calculateGoalInsight(goal);

      expect(insight.lines.length).toBe(3);
      insight.lines.forEach(line => {
        expect(line.icon).toBeTruthy();
        expect(line.message).toBeTruthy();
        expect(['positive', 'neutral', 'improvement']).toContain(line.tone);
      });
    });

    it('should detect improving trend', () => {
      const histories = [
        createMockHistory('2025-01-06', 100, 100, true), // 100%
        createMockHistory('2024-12-30', 50, 100, false), // 50%
        createMockHistory('2024-12-23', 30, 100, false), // 30%
      ];
      const goal = createMockGoalWithHistory('1', histories);
      const insight = calculateGoalInsight(goal);

      expect(insight.trend).toBe('improving');
    });

    it('should detect declining trend', () => {
      const histories = [
        createMockHistory('2025-01-06', 30, 100, false), // 30%
        createMockHistory('2024-12-30', 100, 100, true), // 100%
        createMockHistory('2024-12-23', 100, 100, true), // 100%
      ];
      const goal = createMockGoalWithHistory('1', histories);
      const insight = calculateGoalInsight(goal);

      expect(insight.trend).toBe('declining');
    });
  });

  describe('calculateOverallInsight', () => {
    it('should return empty insights for goals without history', () => {
      const goals = [createMockGoalWithHistory('1', [])];
      const insight = calculateOverallInsight(goals);

      expect(insight.totalGoals).toBe(1);
      expect(insight.goalsWithHistory).toBe(0);
      expect(insight.overallAvgRate).toBe(0);
    });

    it('should calculate overall average rate', () => {
      const goals = [
        createMockGoalWithHistory('1', [
          createMockHistory('2025-01-06', 100, 100, true),
          createMockHistory('2024-12-30', 100, 100, true),
        ]), // 100% rate
        createMockGoalWithHistory('2', [
          createMockHistory('2025-01-06', 50, 100, false),
          createMockHistory('2024-12-30', 50, 100, false),
        ]), // 0% rate
      ];
      const insight = calculateOverallInsight(goals);

      expect(insight.overallAvgRate).toBe(50); // (100 + 0) / 2
    });

    it('should identify best performing goal', () => {
      const goals = [
        createMockGoalWithHistory('1', [
          createMockHistory('2025-01-06', 100, 100, true),
        ]),
        createMockGoalWithHistory('2', [
          createMockHistory('2025-01-06', 50, 100, false),
        ]),
      ];
      goals[0].title = 'Best Goal';
      goals[1].title = 'Average Goal';

      const insight = calculateOverallInsight(goals);

      expect(insight.bestGoal?.title).toBe('Best Goal');
      expect(insight.bestGoal?.rate).toBe(100);
    });

    it('should identify goal needing attention', () => {
      const goals = [
        createMockGoalWithHistory('1', [
          createMockHistory('2025-01-06', 100, 100, true),
        ]),
        createMockGoalWithHistory('2', [
          createMockHistory('2025-01-06', 20, 100, false),
        ]),
      ];
      goals[0].title = 'Good Goal';
      goals[1].title = 'Needs Help';

      const insight = calculateOverallInsight(goals);

      expect(insight.needsAttention?.title).toBe('Needs Help');
    });
  });
});

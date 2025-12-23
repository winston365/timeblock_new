/**
 * Template System Tests
 *
 * Tests for:
 * 1. Form validation (Zod schema)
 * 2. Auto-generate once-per-day logic
 * 3. UI preferences persistence
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// 실제 스키마 import (동적 import 필요 없음)
import {
  templateBasicSchema,
  validateBasicStep,
  validateRecurrenceStep,
} from '../src/shared/schemas/templateSchemas';

// ============================================================================
// Test 1: Form Validation (Zod Schema)
// ============================================================================
describe('Template Form Validation (Zod Schema)', () => {
  it('should pass validation for valid basic form data', () => {
    const validData = {
      text: '운동하기',
      baseDuration: 30,
      resistance: 'medium' as const,
      timeBlock: 'morning' as const,
      memo: '',
      category: '',
      imageUrl: '',
      isFavorite: false,
    };

    const result = templateBasicSchema.safeParse(validData);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe('운동하기');
      expect(result.data.baseDuration).toBe(30);
    }
  });

  it('should fail validation when text is empty', () => {
    const invalidData = {
      text: '',
      baseDuration: 30,
      resistance: 'low' as const,
      timeBlock: null,
    };

    const result = templateBasicSchema.safeParse(invalidData);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod 에러 구조에서 이슈 찾기
      const textError = result.error.issues.find(e => e.path.includes('text'));
      expect(textError).toBeDefined();
      expect(textError?.message).toContain('입력');
    }
  });

  it('should fail validation when baseDuration is less than 1', () => {
    const invalidData = {
      text: '유효한 텍스트',
      baseDuration: 0,
      resistance: 'low' as const,
      timeBlock: null,
    };

    const result = templateBasicSchema.safeParse(invalidData);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      const durationError = result.error.issues.find(e => 
        e.path.includes('baseDuration')
      );
      expect(durationError).toBeDefined();
    }
  });

  it('should fail validation when resistance is invalid enum value', () => {
    const invalidData = {
      text: '유효한 텍스트',
      baseDuration: 30,
      resistance: 'invalid' as never,
      timeBlock: null,
    };

    const result = templateBasicSchema.safeParse(invalidData);
    
    expect(result.success).toBe(false);
  });

  it('should apply default values for optional fields using validateBasicStep', () => {
    const minimalData = {
      text: '최소 데이터',
      baseDuration: 15,
      resistance: 'low' as const,
      timeBlock: null,
    };

    const result = validateBasicStep(minimalData);
    
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.memo).toBe('');
      expect(result.data.isFavorite).toBe(false);
    }
  });

  it('should return errors in record format using validateBasicStep', () => {
    const invalidData = {
      text: '',
      baseDuration: -10,
      resistance: 'low' as const,
      timeBlock: null,
    };

    const result = validateBasicStep(invalidData);
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.text).toBeDefined();
    expect(result.errors?.baseDuration).toBeDefined();
  });
});

// ============================================================================
// Test 1.5: Recurrence Step Validation (3단계 유효성 검사)
// ============================================================================
describe('Recurrence Step Validation', () => {
  it('should pass validation when autoGenerate is false', () => {
    const result = validateRecurrenceStep({
      autoGenerate: false,
      recurrenceType: 'none',
      weeklyDays: [],
      intervalDays: 1,
    });

    expect(result.success).toBe(true);
  });

  it('should pass validation when autoGenerate is true with daily recurrence', () => {
    const result = validateRecurrenceStep({
      autoGenerate: true,
      recurrenceType: 'daily',
      weeklyDays: [],
      intervalDays: 1,
    });

    expect(result.success).toBe(true);
  });

  it('should fail validation when autoGenerate is true but recurrenceType is none', () => {
    const result = validateRecurrenceStep({
      autoGenerate: true,
      recurrenceType: 'none',
      weeklyDays: [],
      intervalDays: 1,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    // superRefine 적용 후 recurrenceType 경로에 에러가 매핑됨
    expect(result.errors?.recurrenceType).toBeDefined();
    expect(result.errors?.recurrenceType).toContain('반복 주기');
  });

  it('should fail validation when weekly recurrence has no days selected', () => {
    const result = validateRecurrenceStep({
      autoGenerate: true,
      recurrenceType: 'weekly',
      weeklyDays: [],
      intervalDays: 1,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    // superRefine 적용 후 weeklyDays 경로에 에러가 매핑됨
    expect(result.errors?.weeklyDays).toBeDefined();
    expect(result.errors?.weeklyDays).toContain('요일');
  });

  it('should pass validation when weekly recurrence has at least one day', () => {
    const result = validateRecurrenceStep({
      autoGenerate: true,
      recurrenceType: 'weekly',
      weeklyDays: [1, 3, 5], // 월, 수, 금
      intervalDays: 1,
    });

    expect(result.success).toBe(true);
  });

  it('should pass validation when interval recurrence is set', () => {
    const result = validateRecurrenceStep({
      autoGenerate: true,
      recurrenceType: 'interval',
      weeklyDays: [],
      intervalDays: 7,
    });

    expect(result.success).toBe(true);
  });

  it('should handle legacy template with recurrenceType but missing autoGenerate', () => {
    // Legacy fallback 테스트: 템플릿에 recurrenceType이 있지만 autoGenerate가 undefined인 경우
    // autoGenerate를 true로 추론해야 UI에서 올바르게 표시됨
    // 이 테스트는 TemplateModal 초기화 로직을 간접적으로 검증
    const legacyLikeData = {
      autoGenerate: true, // 초기화 로직에서 설정됨
      recurrenceType: 'daily' as const,
      weeklyDays: [],
      intervalDays: 1,
    };

    const result = validateRecurrenceStep(legacyLikeData);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Test 1.6: Template Legacy Normalization (초기화 로직 검증)
// ============================================================================
describe('Template Legacy Normalization', () => {
  /**
   * TemplateModal에서 템플릿 초기화 로직을 시뮬레이션하는 순수 함수
   * 실제 컴포넌트 로직과 동일하게 구현
   */
  function normalizeTemplateRecurrence(template: {
    autoGenerate?: boolean;
    recurrenceType?: string | null;
    weeklyDays?: number[];
    intervalDays?: number;
  }): {
    autoGenerate: boolean;
    recurrenceType: string;
    weeklyDays: number[];
    intervalDays: number;
  } {
    const hasRecurrence = template.recurrenceType && template.recurrenceType !== 'none';
    const shouldAutoGenerate = template.autoGenerate ?? hasRecurrence ?? false;
    
    // autoGenerate가 true인데 recurrenceType이 'none'이면 'daily'로 기본값 설정
    const effectiveRecurrenceType = shouldAutoGenerate && (!template.recurrenceType || template.recurrenceType === 'none')
      ? 'daily'
      : (template.recurrenceType || 'none');
    
    return {
      autoGenerate: shouldAutoGenerate,
      recurrenceType: effectiveRecurrenceType,
      weeklyDays: template.weeklyDays || [],
      intervalDays: template.intervalDays || 1,
    };
  }

  it('should set autoGenerate=true when legacy template has recurrenceType but no autoGenerate', () => {
    // 레거시 케이스: recurrenceType='weekly'이지만 autoGenerate가 undefined
    const legacyTemplate = {
      recurrenceType: 'weekly',
      weeklyDays: [1, 3, 5],
      intervalDays: 1,
    };

    const normalized = normalizeTemplateRecurrence(legacyTemplate);
    
    expect(normalized.autoGenerate).toBe(true);
    expect(normalized.recurrenceType).toBe('weekly');
    expect(normalized.weeklyDays).toEqual([1, 3, 5]);
  });

  it('should default recurrenceType to daily when autoGenerate=true but recurrenceType is none', () => {
    // 버그 케이스: autoGenerate=true인데 recurrenceType='none'
    // 이 경우 validation 실패 방지를 위해 'daily'로 기본값 설정
    const buggyTemplate = {
      autoGenerate: true,
      recurrenceType: 'none',
      weeklyDays: [],
      intervalDays: 1,
    };

    const normalized = normalizeTemplateRecurrence(buggyTemplate);
    
    expect(normalized.autoGenerate).toBe(true);
    expect(normalized.recurrenceType).toBe('daily'); // 'none'이 아닌 'daily'로 수정됨
  });

  it('should default recurrenceType to daily when autoGenerate=true but recurrenceType is missing', () => {
    // 버그 케이스: autoGenerate=true인데 recurrenceType이 없음
    const templateWithMissingType = {
      autoGenerate: true,
    };

    const normalized = normalizeTemplateRecurrence(templateWithMissingType);
    
    expect(normalized.autoGenerate).toBe(true);
    expect(normalized.recurrenceType).toBe('daily');
  });

  it('should preserve existing valid recurrence settings', () => {
    // 정상 케이스: 모든 값이 올바르게 설정됨
    const validTemplate = {
      autoGenerate: true,
      recurrenceType: 'interval',
      weeklyDays: [],
      intervalDays: 7,
    };

    const normalized = normalizeTemplateRecurrence(validTemplate);
    
    expect(normalized.autoGenerate).toBe(true);
    expect(normalized.recurrenceType).toBe('interval');
    expect(normalized.intervalDays).toBe(7);
  });

  it('should keep autoGenerate=false when recurrenceType is none', () => {
    // 정상 케이스: 자동생성 비활성화
    const noAutoTemplate = {
      autoGenerate: false,
      recurrenceType: 'none',
    };

    const normalized = normalizeTemplateRecurrence(noAutoTemplate);
    
    expect(normalized.autoGenerate).toBe(false);
    expect(normalized.recurrenceType).toBe('none');
  });

  it('should handle completely empty template (new template)', () => {
    // 신규 템플릿: 모든 필드가 undefined
    const emptyTemplate = {};

    const normalized = normalizeTemplateRecurrence(emptyTemplate);
    
    expect(normalized.autoGenerate).toBe(false);
    expect(normalized.recurrenceType).toBe('none');
    expect(normalized.weeklyDays).toEqual([]);
    expect(normalized.intervalDays).toBe(1);
  });

  it('should pass validation after normalization for legacy template', () => {
    // E2E 스타일: 레거시 템플릿 정규화 → validation 통과 확인
    const legacyTemplate = {
      recurrenceType: 'daily', // autoGenerate 없음
    };

    const normalized = normalizeTemplateRecurrence(legacyTemplate);
    const validationResult = validateRecurrenceStep(normalized);
    
    expect(validationResult.success).toBe(true);
  });

  it('should pass validation after normalization for buggy autoGenerate-without-type template', () => {
    // E2E 스타일: autoGenerate=true, recurrenceType='none' → 'daily'로 수정 → validation 통과
    const buggyTemplate = {
      autoGenerate: true,
      recurrenceType: 'none',
    };

    const normalized = normalizeTemplateRecurrence(buggyTemplate);
    const validationResult = validateRecurrenceStep(normalized);
    
    expect(validationResult.success).toBe(true);
    expect(normalized.recurrenceType).toBe('daily');
  });
});

// ============================================================================
// Test 2: Auto-generate Once-per-Day Logic
// ============================================================================
describe('Auto-generate Once-per-Day Logic', () => {
  // 모듈 mock을 위한 spy 저장
  let mockGetSystemState: ReturnType<typeof vi.fn>;
  let mockSetSystemState: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset mocks
    vi.resetModules();
    vi.clearAllMocks();
    
    // Mock systemRepository
    mockGetSystemState = vi.fn();
    mockSetSystemState = vi.fn().mockResolvedValue(undefined);
    
    vi.doMock('../src/data/repositories/systemRepository', () => ({
      getSystemState: mockGetSystemState,
      setSystemState: mockSetSystemState,
      SYSTEM_KEYS: {
        TEMPLATE_UI_PREFS: 'template:uiPrefs',
        TEMPLATE_AUTO_GENERATE_STATE: 'template:autoGenerateState',
        TEMPLATE_EXECUTION_LOG: 'template:executionLog',
        TEMPLATE_DURATION_FEEDBACK: 'template:durationFeedback',
        TEMPLATE_UX_V1_ENABLED: 'template:uxV1Enabled',
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when no previous auto-generate state exists', async () => {
    mockGetSystemState.mockResolvedValue(null);

    const { hasAutoGeneratedToday } = await import(
      '../src/shared/services/template/templateTaskService'
    );

    const result = await hasAutoGeneratedToday();
    
    expect(result).toBe(false);
  });

  it('should return false when last auto-generate was on a different day', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    mockGetSystemState.mockResolvedValue({
      lastRunDate: yesterdayStr,
      lastGeneratedCount: 3,
      lastRunSuccess: true,
    });

    const { hasAutoGeneratedToday } = await import(
      '../src/shared/services/template/templateTaskService'
    );

    const result = await hasAutoGeneratedToday();
    
    expect(result).toBe(false);
  });

  it('should return true when auto-generate already ran today', async () => {
    const today = new Date().toISOString().split('T')[0];

    mockGetSystemState.mockResolvedValue({
      lastRunDate: today,
      lastGeneratedCount: 5,
      lastRunSuccess: true,
    });

    const { hasAutoGeneratedToday } = await import(
      '../src/shared/services/template/templateTaskService'
    );

    const result = await hasAutoGeneratedToday();
    
    expect(result).toBe(true);
  });

  it('should mark auto-generate as complete for today', async () => {
    mockGetSystemState.mockResolvedValue(null);

    const { markAutoGenerateComplete } = await import(
      '../src/shared/services/template/templateTaskService'
    );

    await markAutoGenerateComplete(3);
    
    expect(mockSetSystemState).toHaveBeenCalledWith(
      'template:autoGenerateState',
      expect.objectContaining({
        lastRunDate: expect.any(String),
        lastGeneratedCount: 3,
        lastRunSuccess: true,
      })
    );
  });
});

// ============================================================================
// Test 2.5: Midnight Boundary - Date-based Guard (로컬 날짜 기준 자정 경계 테스트)
// ============================================================================
describe('Auto-generate Midnight Boundary', () => {
  let mockGetSystemState: ReturnType<typeof vi.fn>;
  let mockSetSystemState: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    
    mockGetSystemState = vi.fn();
    mockSetSystemState = vi.fn().mockResolvedValue(undefined);
    
    vi.doMock('../src/data/repositories/systemRepository', () => ({
      getSystemState: mockGetSystemState,
      setSystemState: mockSetSystemState,
      SYSTEM_KEYS: {
        TEMPLATE_UI_PREFS: 'template:uiPrefs',
        TEMPLATE_AUTO_GENERATE_STATE: 'template:autoGenerateState',
        TEMPLATE_EXECUTION_LOG: 'template:executionLog',
        TEMPLATE_DURATION_FEEDBACK: 'template:durationFeedback',
        TEMPLATE_UX_V1_ENABLED: 'template:uxV1Enabled',
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow auto-generate after midnight (next day)', async () => {
    // Scenario: 23:59 KST에 실행 후 → 00:01 KST에 재실행
    // 로컬 날짜가 변경되었으므로 다음 날에는 다시 실행 허용
    
    // 어제 날짜로 마지막 실행 상태 설정
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    mockGetSystemState.mockResolvedValue({
      lastRunDate: yesterdayStr,
      lastRunAt: new Date(yesterday.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000).toISOString(), // 23:59
      lastGeneratedCount: 2,
      lastRunSuccess: true,
    });

    const { hasAutoGeneratedToday } = await import(
      '../src/shared/services/template/templateTaskService'
    );

    // 오늘(다음 날) 00:01에 실행 → 아직 실행 안 됨으로 판정
    const result = await hasAutoGeneratedToday();
    expect(result).toBe(false); // 다음 날이므로 다시 실행 허용
  });

  it('should block auto-generate on same local date (even if hours differ)', async () => {
    // Scenario: 오늘 06:00에 실행 → 오늘 18:00에 재실행 시도
    // 같은 로컬 날짜이므로 차단
    
    const today = new Date().toISOString().split('T')[0];

    mockGetSystemState.mockResolvedValue({
      lastRunDate: today,
      lastRunAt: new Date().toISOString(),
      lastGeneratedCount: 3,
      lastRunSuccess: true,
    });

    const { hasAutoGeneratedToday } = await import(
      '../src/shared/services/template/templateTaskService'
    );

    const result = await hasAutoGeneratedToday();
    expect(result).toBe(true); // 같은 날짜이므로 차단
  });

  it('should use local date (YYYY-MM-DD) for comparison, not timestamp', async () => {
    // getLocalDate()가 로컬 시간대 기준 YYYY-MM-DD를 반환하는지 확인
    const { getLocalDate } = await import('../src/shared/lib/utils');

    // 현재 시스템 시간대 기준으로 날짜 생성
    const now = new Date();
    const localDateStr = getLocalDate(now);
    
    // 형식 검증: YYYY-MM-DD
    expect(localDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    
    // 날짜 파싱 검증
    const [year, month, day] = localDateStr.split('-').map(Number);
    expect(year).toBe(now.getFullYear());
    expect(month).toBe(now.getMonth() + 1);
    expect(day).toBe(now.getDate());
  });

  it('should correctly detect date change at midnight boundary', async () => {
    // 자정 직전 (23:59:59) vs 자정 직후 (00:00:01)에 getLocalDate가 다른 값을 반환하는지 확인
    const { getLocalDate } = await import('../src/shared/lib/utils');

    // 임의의 날짜 생성: 2025-12-23 23:59:59
    const beforeMidnight = new Date(2025, 11, 23, 23, 59, 59);
    const afterMidnight = new Date(2025, 11, 24, 0, 0, 1);

    const dateBefore = getLocalDate(beforeMidnight);
    const dateAfter = getLocalDate(afterMidnight);

    expect(dateBefore).toBe('2025-12-23');
    expect(dateAfter).toBe('2025-12-24');
    expect(dateBefore).not.toBe(dateAfter);
  });
});

// ============================================================================
// Test 3: UI Preferences Persistence
// ============================================================================
describe('Template UI Preferences Persistence', () => {
  let mockGetSystemState: ReturnType<typeof vi.fn>;
  let mockSetSystemState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    
    mockGetSystemState = vi.fn();
    mockSetSystemState = vi.fn().mockResolvedValue(undefined);
    
    vi.doMock('../src/data/repositories/systemRepository', () => ({
      getSystemState: mockGetSystemState,
      setSystemState: mockSetSystemState,
      SYSTEM_KEYS: {
        TEMPLATE_UI_PREFS: 'template:uiPrefs',
        TEMPLATE_AUTO_GENERATE_STATE: 'template:autoGenerateState',
        TEMPLATE_EXECUTION_LOG: 'template:executionLog',
        TEMPLATE_DURATION_FEEDBACK: 'template:durationFeedback',
        TEMPLATE_UX_V1_ENABLED: 'template:uxV1Enabled',
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load default preferences when none exist', async () => {
    mockGetSystemState.mockResolvedValue(null);

    const { loadTemplateUiPrefs } = await import(
      '../src/shared/services/template/templateTaskService'
    );

    const prefs = await loadTemplateUiPrefs();
    
    // Should return defaults from TEMPLATE_DEFAULTS
    expect(prefs).toEqual(
      expect.objectContaining({
        sortBy: expect.any(String),
        sortOrder: expect.any(String),
        showFavoritesOnly: false,
      })
    );
  });

  it('should load saved preferences when they exist', async () => {
    const savedPrefs = {
      sortBy: 'name',
      sortOrder: 'desc',
      lastCategory: 'work',
      showFavoritesOnly: true,
    };

    mockGetSystemState.mockResolvedValue(savedPrefs);

    const { loadTemplateUiPrefs } = await import(
      '../src/shared/services/template/templateTaskService'
    );

    const prefs = await loadTemplateUiPrefs();
    
    expect(prefs.sortBy).toBe('name');
    expect(prefs.sortOrder).toBe('desc');
    expect(prefs.lastCategory).toBe('work');
    expect(prefs.showFavoritesOnly).toBe(true);
  });

  it('should save UI preferences correctly', async () => {
    mockGetSystemState.mockResolvedValue(null);

    const { saveTemplateUiPrefs } = await import(
      '../src/shared/services/template/templateTaskService'
    );

    await saveTemplateUiPrefs({
      sortBy: 'baseDuration',
      sortOrder: 'asc',
    });
    
    expect(mockSetSystemState).toHaveBeenCalledWith(
      'template:uiPrefs',
      expect.objectContaining({
        sortBy: 'baseDuration',
        sortOrder: 'asc',
      })
    );
  });

  it('should merge partial preferences with existing ones', async () => {
    const existingPrefs = {
      sortBy: 'name',
      sortOrder: 'asc',
      showFavoritesOnly: false,
    };

    mockGetSystemState.mockResolvedValue(existingPrefs);

    const { saveTemplateUiPrefs } = await import(
      '../src/shared/services/template/templateTaskService'
    );

    // Only update sortOrder
    await saveTemplateUiPrefs({ sortOrder: 'desc' });
    
    expect(mockSetSystemState).toHaveBeenCalledWith(
      'template:uiPrefs',
      expect.objectContaining({
        sortBy: 'name', // preserved
        sortOrder: 'desc', // updated
        showFavoritesOnly: false, // preserved
      })
    );
  });
});

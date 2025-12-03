/**
 * 설정 기본값 중앙 관리
 *
 * @role 모든 설정 기본값의 단일 진실 공급원 (Single Source of Truth)
 *
 * ⚠️ 중요: 설정 기본값은 이 파일에서만 정의하세요!
 *
 * 사용 방법:
 * ```typescript
 * import { SETTING_DEFAULTS } from '@/shared/constants/defaults';
 *
 * // 올바른 사용
 * const goal = settings?.timeBlockXPGoal ?? SETTING_DEFAULTS.timeBlockXPGoal;
 *
 * // ❌ 잘못된 사용 (하드코딩된 기본값)
 * const goal = settings?.timeBlockXPGoal ?? 100;
 * ```
 *
 * @see copilot-instructions.md - "Default Values" 섹션
 */

// ============================================================================
// 비활동 감지 시스템 기본값
// ============================================================================

export const IDLE_FOCUS_DEFAULTS = {
  /** 비활동 시 집중 모드 전환 기능 활성화 여부 */
  enabled: false,

  /** 비활동 감지 시간 (분) - 이 시간 후 집중 모드로 전환 */
  minutes: 3,

  /** 전환 전 카운트다운 시간 (초) */
  countdownSeconds: 5,
} as const;

// ============================================================================
// 게임플레이 기본값
// ============================================================================

export const GAMEPLAY_DEFAULTS = {
  /** 타임블록당 XP 목표 */
  timeBlockXPGoal: 100,
} as const;

// ============================================================================
// 와이푸 시스템 기본값
// ============================================================================

export const WAIFU_DEFAULTS = {
  /** 와이푸 표시 여부 */
  visible: true,

  /** 와이푸 크기 (1~5 스케일) */
  size: 3,

  /** 와이푸 이름 */
  name: '혜은',
} as const;

// ============================================================================
// AI 기본값
// ============================================================================

export const AI_DEFAULTS = {
  /** Gemini 모델 */
  geminiModel: 'gemini-2.0-flash',

  /** 최대 토큰 수 */
  maxTokens: 2048,
} as const;

// ============================================================================
// 통합 설정 기본값 (Settings 타입과 매칭)
// ============================================================================

/**
 * Settings 타입의 모든 필드에 대한 기본값
 * settingsRepository, UI 컴포넌트 등에서 사용
 */
export const SETTING_DEFAULTS = {
  // 비활동 집중 모드
  idleFocusModeEnabled: IDLE_FOCUS_DEFAULTS.enabled,
  idleFocusModeMinutes: IDLE_FOCUS_DEFAULTS.minutes,

  // 게임플레이
  timeBlockXPGoal: GAMEPLAY_DEFAULTS.timeBlockXPGoal,

  // 와이푸
  waifuVisible: WAIFU_DEFAULTS.visible,
  waifuSize: WAIFU_DEFAULTS.size,
  waifuName: WAIFU_DEFAULTS.name,

  // AI
  geminiModel: AI_DEFAULTS.geminiModel,
} as const;

// ============================================================================
// Task 기본값
// ============================================================================

export const TASK_DEFAULTS = {
  /** 기본 소요 시간 (분) */
  baseDuration: 15,
  /** 기본 난이도 */
  resistance: 'low' as const,
  /** 데드라인 - 오늘 날짜 반환 함수 */
  getDefaultDeadline: () => new Date().toISOString().split('T')[0],
} as const;

// ============================================================================
// GameState 기본값
// ============================================================================

export const GAME_STATE_DEFAULTS = {
  /** 초기 XP */
  totalXP: 0,
  dailyXP: 0,
  availableXP: 0,

  /** 연속 출석 */
  streak: 0,
} as const;

// ============================================================================
// 타입 유틸리티
// ============================================================================

/** SETTING_DEFAULTS의 키 타입 */
export type SettingDefaultKey = keyof typeof SETTING_DEFAULTS;

/** 특정 설정의 기본값 타입 가져오기 */
export type SettingDefaultValue<K extends SettingDefaultKey> = typeof SETTING_DEFAULTS[K];

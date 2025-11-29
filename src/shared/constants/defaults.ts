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
 * const cooldown = settings?.ignitionCooldownMinutes ?? SETTING_DEFAULTS.ignitionCooldownMinutes;
 *
 * // ❌ 잘못된 사용 (하드코딩된 기본값)
 * const cooldown = settings?.ignitionCooldownMinutes ?? 5;
 * ```
 *
 * @see copilot-instructions.md - "Default Values" 섹션
 */

// ============================================================================
// 점화(Ignition) 시스템 기본값
// ============================================================================

export const IGNITION_DEFAULTS = {
  /** 일반 점화 쿨다운 (분) */
  cooldownMinutes: 5,

  /** '뭐라도 하자' 보너스 점화 쿨다운 (분) */
  justDoItCooldownMinutes: 15,

  /** 비활동 감지 시간 - 이 시간 후 '뭐라도 하자' 버튼 표시 (분) */
  inactivityMinutes: 45,

  /** 점화 타이머 기본 시간 (분) */
  durationMinutes: 3,

  /** 무료 횟수 소진 후 XP 비용 */
  xpCost: 50,

  /** 일일 무료 점화 횟수 */
  dailyFreeIgnitions: 3,
} as const;

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
  /** 빙고 라인당 보상 XP */
  bingoLineRewardXP: 100,
  /** 인정 가능한 최대 빙고 라인 수 */
  bingoMaxLines: 4,
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
  // 점화 시스템
  ignitionCooldownMinutes: IGNITION_DEFAULTS.cooldownMinutes,
  justDoItCooldownMinutes: IGNITION_DEFAULTS.justDoItCooldownMinutes,
  ignitionInactivityMinutes: IGNITION_DEFAULTS.inactivityMinutes,
  ignitionDurationMinutes: IGNITION_DEFAULTS.durationMinutes,
  ignitionXPCost: IGNITION_DEFAULTS.xpCost,

  // 비활동 집중 모드
  idleFocusModeEnabled: IDLE_FOCUS_DEFAULTS.enabled,
  idleFocusModeMinutes: IDLE_FOCUS_DEFAULTS.minutes,

  // 게임플레이
  timeBlockXPGoal: GAMEPLAY_DEFAULTS.timeBlockXPGoal,
  bingoLineRewardXP: GAMEPLAY_DEFAULTS.bingoLineRewardXP,
  bingoMaxLines: GAMEPLAY_DEFAULTS.bingoMaxLines,

  // 와이푸
  waifuVisible: WAIFU_DEFAULTS.visible,
  waifuSize: WAIFU_DEFAULTS.size,
  waifuName: WAIFU_DEFAULTS.name,

  // AI
  geminiModel: AI_DEFAULTS.geminiModel,
} as const;

// ============================================================================
// GameState 기본값
// ============================================================================

export const GAME_STATE_DEFAULTS = {
  /** 일일 무료 점화 횟수 */
  dailyFreeIgnitions: IGNITION_DEFAULTS.dailyFreeIgnitions,

  /** 초기 XP */
  totalXP: 0,
  dailyXP: 0,
  availableXP: 0,

  /** 연속 출석 */
  streak: 0,
} as const;

// ============================================================================
// Bingo 기본값
// ============================================================================

export const DEFAULT_BINGO_CELLS = [
  { id: 'b1', text: '물 한 컵 마시기', xp: 10 },
  { id: 'b2', text: '5분 스트레칭', xp: 10 },
  { id: 'b3', text: '할 일 1개 정리', xp: 10 },
  { id: 'b4', text: '깊은 호흡 5회', xp: 10 },
  { id: 'b5', text: '책상 정리 3분', xp: 10 },
  { id: 'b6', text: '눈 운동 1분', xp: 10 },
  { id: 'b7', text: '가벼운 산책 3분', xp: 10 },
  { id: 'b8', text: '감사 1가지 적기', xp: 10 },
  { id: 'b9', text: '알림 끄기', xp: 10 },
] as const;

// ============================================================================
// 타입 유틸리티
// ============================================================================

/** SETTING_DEFAULTS의 키 타입 */
export type SettingDefaultKey = keyof typeof SETTING_DEFAULTS;

/** 특정 설정의 기본값 타입 가져오기 */
export type SettingDefaultValue<K extends SettingDefaultKey> = typeof SETTING_DEFAULTS[K];

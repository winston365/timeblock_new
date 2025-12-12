/**
 * Battle System Constants
 *
 * @role 전투 시스템 관련 상수 중앙 관리
 * @description
 *   - 매직 넘버 제거로 유지보수성 향상
 *   - 타이밍, 애니메이션, UI 관련 상수 정의
 */

// ============================================================================
// 타이밍 상수 (밀리초)
// ============================================================================

/** 데미지 표시 지속 시간 */
export const DAMAGE_DISPLAY_DURATION_MS = 1000;

/** 보스 처치 후 사운드 재생 지연 */
export const BOSS_DEFEAT_SOUND_DELAY_MS = 200;

/** 쿨다운 타이머 갱신 주기 */
export const COOLDOWN_REFRESH_INTERVAL_MS = 60_000;

/** 미션 카드 애니메이션 지연 (카드당) */
export const MISSION_CARD_ANIMATION_DELAY_MS = 30;

/** 공격 애니메이션 지속 시간 */
export const ATTACK_ANIMATION_DURATION_MS = 200;

// ============================================================================
// 미션 관련 상수
// ============================================================================

/** 미션 데미지 최소값 (분) */
export const MISSION_DAMAGE_MIN = 5;

/** 미션 데미지 최대값 (분) */
export const MISSION_DAMAGE_MAX = 120;

/** 미션 기본 데미지 (분) */
export const MISSION_DAMAGE_DEFAULT = 15;

/** 미션 시간대 최대 설정 개수 */
export const MISSION_TIME_SLOTS_MAX = 3;

/** 미션 등급(tier) 최소값 */
export const MISSION_TIER_MIN = 1;

/** 미션 등급(tier) 최대값 */
export const MISSION_TIER_MAX = 10;

/** 미션 등급(tier) 기본값 (미설정 시 가장 낮은 우선순위) */
export const MISSION_TIER_DEFAULT = 10;

// ============================================================================
// 보스 관련 상수
// ============================================================================

/** HP 계산 배율 (XP × 이 값 = HP) */
export const BOSS_HP_XP_MULTIPLIER = 0.5;

/** 보스 난이도별 XP 기본값 */
export const BOSS_DIFFICULTY_XP_DEFAULTS: Record<string, number> = {
  easy: 20,
  normal: 40,
  hard: 80,
  epic: 120,
};

/** 보스 난이도별 총 수 */
export const BOSS_COUNT_BY_DIFFICULTY: Record<string, number> = {
  easy: 2,
  normal: 7,
  hard: 7,
  epic: 7,
};

// ============================================================================
// 미션 카드 등급 (데미지 기준)
// ============================================================================

/** 미션 등급 경계값 */
export const MISSION_GRADE_THRESHOLDS = {
  EPIC: 30,
  RARE: 20,
  GOOD: 15,
} as const;

/** 미션 등급별 스타일 정보 */
export const MISSION_GRADE_STYLES = {
  epic: {
    border: 'border-purple-500',
    glow: 'shadow-purple-500/30',
    label: 'EPIC',
    labelBg: 'bg-purple-500',
  },
  rare: {
    border: 'border-orange-500',
    glow: 'shadow-orange-500/30',
    label: 'RARE',
    labelBg: 'bg-orange-500',
  },
  good: {
    border: 'border-blue-500',
    glow: 'shadow-blue-500/30',
    label: 'GOOD',
    labelBg: 'bg-blue-500',
  },
  common: {
    border: 'border-gray-500',
    glow: 'shadow-gray-500/20',
    label: '',
    labelBg: '',
  },
} as const;

// ============================================================================
// HP 바 관련 상수
// ============================================================================

/** HP 위험 수준 (%) */
export const HP_LOW_THRESHOLD_PERCENT = 30;

/** HP 치명적 수준 (%) */
export const HP_CRITICAL_THRESHOLD_PERCENT = 15;

// ============================================================================
// 쿨다운 프리셋 (BattleMissionsSection용)
// ============================================================================

/** 쿨다운 프리셋 옵션 */
export const COOLDOWN_PRESETS = [
  { value: 0, label: '하루 1회' },
  { value: 5, label: '5분' },
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 120, label: '2시간' },
  { value: 180, label: '3시간' },
  { value: 240, label: '4시간' },
  { value: 360, label: '6시간' },
] as const;

// ============================================================================
// 난이도 색상 스타일
// ============================================================================

/** 난이도별 색상 클래스 */
export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'text-green-400 bg-green-500/20 border-green-500/50',
  normal: 'text-blue-400 bg-blue-500/20 border-blue-500/50',
  hard: 'text-orange-400 bg-orange-500/20 border-orange-500/50',
  epic: 'text-purple-400 bg-purple-500/20 border-purple-500/50',
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 데미지 값으로 미션 등급 결정
 *
 * @param damage - 미션 데미지 값 (분)
 * @returns 등급 스타일 객체
 */
export function getMissionGradeStyle(damage: number) {
  if (damage >= MISSION_GRADE_THRESHOLDS.EPIC) return MISSION_GRADE_STYLES.epic;
  if (damage >= MISSION_GRADE_THRESHOLDS.RARE) return MISSION_GRADE_STYLES.rare;
  if (damage >= MISSION_GRADE_THRESHOLDS.GOOD) return MISSION_GRADE_STYLES.good;
  return MISSION_GRADE_STYLES.common;
}

/**
 * 쿨다운 시간 포맷팅
 *
 * @param minutes - 남은 쿨다운 (분)
 * @returns 포맷된 문자열
 */
export function formatCooldownTime(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

/**
 * 시간대 문자열 파싱
 *
 * @param timeSlot - "HH:MM-HH:MM" 형식의 시간대 문자열
 * @returns { startHour, startMinute, endHour, endMinute } 또는 null
 */
export function parseTimeSlot(timeSlot: string): {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
} | null {
  const match = timeSlot.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, sh, sm, eh, em] = match;
  return {
    startHour: parseInt(sh, 10),
    startMinute: parseInt(sm, 10),
    endHour: parseInt(eh, 10),
    endMinute: parseInt(em, 10),
  };
}

/**
 * 현재 시간이 시간대 내에 있는지 확인
 *
 * @param timeSlot - "HH:MM-HH:MM" 형식의 시간대 문자열
 * @param now - 비교할 시간 (기본: 현재 시간)
 * @returns 시간대 내에 있으면 true
 */
export function isWithinTimeSlot(timeSlot: string, now: Date = new Date()): boolean {
  const parsed = parseTimeSlot(timeSlot);
  if (!parsed) return true; // 파싱 실패 시 항상 표시

  const { startHour, startMinute, endHour, endMinute } = parsed;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // 자정을 넘어가는 경우 처리 (예: 23:00-01:00)
  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * 미션이 현재 시간대에 표시되어야 하는지 확인
 *
 * @param timeSlots - 미션의 시간대 배열 (비어있으면 항상 표시)
 * @param now - 비교할 시간 (기본: 현재 시간)
 * @returns 표시해야 하면 true
 */
export function shouldShowMissionByTime(
  timeSlots: string[] | undefined,
  now: Date = new Date(),
): boolean {
  // 시간대 설정이 없으면 항상 표시
  if (!timeSlots || timeSlots.length === 0) return true;

  // 하나라도 해당하는 시간대가 있으면 표시
  return timeSlots.some((slot) => isWithinTimeSlot(slot, now));
}

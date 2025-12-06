/**
 * goalConstants.ts
 *
 * @file 장기목표 관련 상수
 * @description
 *   - 만회 알림 심각도 레벨 임계값
 *   - UI 색상 및 아이콘 설정
 *   - 기타 목표 관련 상수
 */

/**
 * 만회 심각도 레벨 타입
 * - safe: 목표량 달성 중
 * - warning: 약간 뒤처짐 (노란색)
 * - danger: 심각하게 뒤처짐 (빨간색)
 */
export type CatchUpSeverity = 'safe' | 'warning' | 'danger';

/**
 * 만회 심각도 판정 기준
 * - 뒤처진 양 / 하루 목표량 비율로 계산
 * - 예: 하루 목표 10, 뒤처진 양 15면 ratio = 1.5
 */
export const CATCH_UP_THRESHOLDS = {
  /** 경고 레벨: 뒤처진 양이 하루치 미만 */
  WARNING_RATIO: 1.0,
  /** 위험 레벨: 뒤처진 양이 하루치의 2배 이상 */
  DANGER_RATIO: 2.0,
} as const;

/**
 * 심각도별 UI 설정
 */
export const CATCH_UP_SEVERITY_CONFIG: Record<
  CatchUpSeverity,
  {
    icon: string;
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    description: string;
  }
> = {
  safe: {
    icon: '🟢',
    label: '순항 중',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-400/30',
    description: '잘하고 있어요! 이 페이스를 유지해주세요.',
  },
  warning: {
    icon: '🟡',
    label: '약간 뒤처짐',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-400/30',
    description: '오늘 조금만 더 하면 만회할 수 있어요!',
  },
  danger: {
    icon: '🔴',
    label: '심각하게 뒤처짐',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-300',
    borderClass: 'border-red-400/30',
    description: '집중적인 만회가 필요해요. 작은 것부터 시작해봐요!',
  },
};

/**
 * 히스토리 관련 상수
 */
export const GOAL_HISTORY = {
  /** 저장할 최대 주 수 */
  MAX_WEEKS: 5,
} as const;

/**
 * 빠른 조절 버튼 설정
 */
export const QUICK_UPDATE_BUTTONS = {
  NORMAL: [
    { label: '-10', delta: -10 },
    { label: '-5', delta: -5 },
    { label: '-1', delta: -1 },
    { label: '+1', delta: 1 },
    { label: '+5', delta: 5 },
    { label: '+10', delta: 10 },
  ],
  COMPACT: [
    { label: '-5', delta: -5 },
    { label: '-1', delta: -1 },
    { label: '+1', delta: 1 },
    { label: '+5', delta: 5 },
  ],
} as const;

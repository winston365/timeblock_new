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
 * - 색상 의존 제거: 텍스트 배지로 심각도 표시 (accessibleLabel)
 * - aria-label 포함
 */
export const CATCH_UP_SEVERITY_CONFIG: Record<
  CatchUpSeverity,
  {
    icon: string;
    label: string;
    /** 접근성을 위한 텍스트 배지 (색 의존 제거) */
    accessibleLabel: string;
    /** aria-label용 전체 설명 */
    ariaLabel: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    description: string;
  }
> = {
  safe: {
    icon: '🟢',
    label: '순항 중',
    accessibleLabel: 'OK',
    ariaLabel: '순조롭게 진행 중, 목표 달성 순항 중',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-400/30',
    description: '잘하고 있어요! 이 페이스를 유지해주세요.',
  },
  warning: {
    icon: '🟡',
    label: '약간 뒤처짐',
    accessibleLabel: '주의',
    ariaLabel: '약간 뒤처짐, 오늘 조금만 더 하면 만회 가능',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-400/30',
    description: '오늘 조금만 더 하면 만회할 수 있어요!',
  },
  danger: {
    icon: '🔴',
    label: '심각하게 뒤처짐',
    accessibleLabel: '위험',
    ariaLabel: '심각하게 뒤처짐, 집중적인 만회가 필요',
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

// ============================================================================
// T05: Catch-up 배너 액션 인터페이스
// ============================================================================

/**
 * Catch-up 액션 타입
 * 배너에서 사용자가 선택할 수 있는 액션들
 */
export type CatchUpAction = 
  | 'view'       // 상세 보기
  | 'snooze'     // 나중에 (스누즈)
  | 'dismiss'    // 오늘 닫기
  | 'restart'    // 0.5x로 재시작 (권장 페이스)
  | 'reopen';    // 재오픈 (숨긴 배너 다시 열기)

/**
 * Catch-up 액션 설정
 */
export const CATCH_UP_ACTION_CONFIG: Record<
  CatchUpAction,
  {
    icon: string;
    label: string;
    description: string;
    shortcut?: string;
  }
> = {
  view: {
    icon: '👀',
    label: '보기',
    description: '뒤처진 목표 상세 보기',
    shortcut: 'V',
  },
  snooze: {
    icon: '⏰',
    label: '나중에',
    description: '일정 시간 후 다시 알림',
  },
  dismiss: {
    icon: '✕',
    label: '닫기',
    description: '오늘 더 이상 표시 안 함',
    shortcut: 'ESC',
  },
  restart: {
    icon: '🔄',
    label: '재시작',
    description: '0.5x 페이스로 목표 재설정',
    shortcut: 'R',
  },
  reopen: {
    icon: '🔔',
    label: '다시 열기',
    description: '숨긴 알림 다시 표시',
  },
};

// ============================================================================
// T06: 진행도 Guard/Undo 동작 정의
// ============================================================================

/**
 * 진행도 변경 Guard 설정
 * 큰 폭의 변경 시 확인 요청
 */
export const PROGRESS_GUARD = {
  /** 확인 필요 임계값 (한 번에 이 이상 변경 시 경고) */
  CONFIRM_THRESHOLD: 50,
  /** 최대 허용 변경량 (한 번에 이 이상 변경 불가) */
  MAX_SINGLE_CHANGE: 1000,
  /** Guard 활성화 여부 기본값 */
  ENABLED_BY_DEFAULT: true,
} as const;

/**
 * Undo 설정
 * 진행도 변경 후 5초 내 Undo 가능
 */
export const PROGRESS_UNDO = {
  /** Undo 가능 시간 (밀리초) */
  TIMEOUT_MS: 5000,
  /** Undo 토스트 지속 시간 (밀리초) */
  TOAST_DURATION_MS: 5000,
} as const;

/**
 * 권장 페이스 재시작 설정
 * 뒤처진 목표를 0.5x 페이스로 재시작
 */
export const RECOMMENDED_PACE = {
  /** 재시작 페이스 배율 (현재 진행도 기준 0.5x) */
  RESTART_MULTIPLIER: 0.5,
  /** 최소 재시작 목표 (0보다 작아지지 않도록) */
  MIN_TARGET: 1,
} as const;

// ============================================================================
// T07: 테마 프리셋
// ============================================================================

/**
 * 목표 테마 프리셋
 * 목표를 카테고리별로 그룹화하기 위한 테마
 */
export const GOAL_THEME_PRESETS = [
  { id: 'study', label: '📚 학습', color: '#6366f1' },
  { id: 'health', label: '💪 건강', color: '#22c55e' },
  { id: 'work', label: '💼 업무', color: '#f59e0b' },
  { id: 'hobby', label: '🎨 취미', color: '#ec4899' },
  { id: 'social', label: '👥 사회', color: '#06b6d4' },
  { id: 'finance', label: '💰 재정', color: '#84cc16' },
  { id: 'personal', label: '🌟 개인', color: '#8b5cf6' },
] as const;

/**
 * 테마 타입
 */
export type GoalTheme = typeof GOAL_THEME_PRESETS[number]['id'] | string;


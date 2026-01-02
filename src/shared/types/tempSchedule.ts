/**
 * 임시 스케줄 시스템 타입 정의
 *
 * @role 임시 스케줄 시스템의 타입 정의 (TempScheduleTask, RecurrenceRule 등)
 * @description 기존 작업 시스템(Task)과 독립적으로 운영되는 가상 스케줄 시스템
 * @dependencies 없음
 */

// ============================================================================
// 반복 규칙 (Recurrence Rule)
// ============================================================================

/**
 * 반복 주기 타입
 */
export type TempScheduleRecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

/**
 * 반복 규칙
 * @description 반복 일정 패턴 정의 (매주 월-금, 매일 등)
 */
export interface RecurrenceRule {
  /** 반복 타입 */
  type: TempScheduleRecurrenceType;
  /** 매주 반복 요일 (0=일요일, 1=월요일, ..., 6=토요일) */
  weeklyDays?: number[];
  /** N일 주기 (예: 3일마다) */
  intervalDays?: number;
  /** 반복 종료 날짜 (YYYY-MM-DD) - null이면 무한 반복 */
  endDate?: string | null;
}

// ============================================================================
// 임시 스케줄 작업 (Temp Schedule Task)
// ============================================================================

/**
 * 임시 스케줄 작업
 * @description 기존 Task와 독립적인 가상 스케줄 블록
 */
export interface TempScheduleTask {
  /** 고유 ID */
  id: string;
  /** 작업 이름 */
  name: string;
  /** 시작 시간 (0~1439 분) */
  startTime: number;
  /** 종료 시간 (0~1439 분) */
  endTime: number;
  /** 예정 날짜 (YYYY-MM-DD) - null이면 매일 표시 */
  scheduledDate: string | null;
  /** 블록 색상 (CSS color) */
  color: string;
  /** 부모 작업 ID (중첩 블록용) */
  parentId?: string | null;
  /** 반복 규칙 */
  recurrence: RecurrenceRule;
  /** 정렬 순서 (같은 시간대에서) */
  order: number;
  /** 메모 */
  memo?: string;
  /** 생성 시각 (ISO 8601) */
  createdAt: string;
  /** 수정 시각 (ISO 8601) */
  updatedAt: string;
  /** 즐겨찾기 여부 */
  favorite?: boolean;
  /** 아카이브(보관함) 여부 - 승격 후 처리에 사용 */
  isArchived?: boolean;
}

// ============================================================================
// 승격 후 처리 옵션 (A1)
// ============================================================================

/**
 * 승격 후 처리 옵션 타입
 * @description Promote 후 원본 temp task 처리 방식
 */
export type PromotePostAction = 'delete' | 'archive' | 'keep';

/**
 * 승격 결과
 * @description promoteToRealTask 함수의 반환 타입
 */
export interface PromoteResult {
  /** 성공 여부 */
  success: boolean;
  /** 원본 temp task ID */
  tempTaskId: string;
  /** 생성된 실제 task ID (성공 시) */
  realTaskId?: string;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

// ============================================================================
// 상태/의미 배지 (C4)
// ============================================================================

/**
 * 작업 상태 배지 타입
 * @description 색상 외 추가 시각적 표시 정보
 */
export type TempScheduleBadgeType = 
  | 'recurring'    // 반복 일정
  | 'favorite'     // 즐겨찾기
  | 'archived'     // 아카이브됨
  | 'duration'     // 소요 시간
  | 'imminent'     // 임박
  | 'inProgress';  // 진행 중

/**
 * 배지 정보
 */
export interface TempScheduleBadge {
  /** 배지 타입 */
  type: TempScheduleBadgeType;
  /** 표시 텍스트 */
  label: string;
  /** 아이콘 (이모지 또는 lucide 아이콘명) */
  icon: string;
  /** 색상 클래스 (Tailwind) */
  colorClass: string;
}

// ============================================================================
// 뷰 모드 타입
// ============================================================================

/**
 * 스케줄 뷰 모드
 */
export type TempScheduleViewMode = 'day' | 'week' | 'month';

// ============================================================================
// 그리드 스냅 설정
// ============================================================================

/**
 * 그리드 스냅 간격 (분)
 */
export type GridSnapInterval = 5 | 15 | 30 | 60;

// ============================================================================
// 드래그 상태
// ============================================================================

/**
 * 드래그 상태 타입
 */
export type DragMode = 'move' | 'resize-top' | 'resize-bottom' | 'create';

/**
 * 드래그 상태
 */
export interface TempScheduleDragState {
  /** 드래그 모드 */
  mode: DragMode;
  /** 드래그 중인 작업 ID (생성 중일 때는 null) */
  taskId: string | null;
  /** 시작 Y 좌표 (픽셀) */
  startY: number;
  /** 현재 Y 좌표 (픽셀) */
  currentY: number;
  /** 원본 시작 시간 (분) */
  originalStartTime?: number;
  /** 원본 종료 시간 (분) */
  originalEndTime?: number;
  /** 드래그 시작 시간 (분) */
  startTimeAtDrag?: number;
}

// ============================================================================
// 툴팁 상태
// ============================================================================

/**
 * 드래그 툴팁 정보
 */
export interface DragTooltipInfo {
  /** 시작 시간 (분) */
  startTime: number;
  /** 종료 시간 (분) */
  endTime: number;
  /** 기간 (분) */
  durationMinutes: number;
  /** 툴팁 위치 X */
  x: number;
  /** 툴팁 위치 Y */
  y: number;
}

// ============================================================================
// 기본 색상
// ============================================================================

/**
 * 블록 기본 색상 팔레트 (이름 포함)
 */
export const TEMP_SCHEDULE_COLOR_PALETTE = [
  { hex: '#3b82f6', name: '파랑' },
  { hex: '#22c55e', name: '초록' },
  { hex: '#f59e0b', name: '황금' },
  { hex: '#ef4444', name: '빨강' },
  { hex: '#8b5cf6', name: '보라' },
  { hex: '#06b6d4', name: '청록' },
  { hex: '#ec4899', name: '분홍' },
  { hex: '#84cc16', name: '연두' },
  { hex: '#f97316', name: '주황' },
  { hex: '#6366f1', name: '남색' },
  { hex: '#14b8a6', name: '민트' },
  { hex: '#a855f7', name: '자주' },
] as const;

/**
 * 블록 기본 색상 팔레트 (hex 배열 - 호환용)
 */
export const TEMP_SCHEDULE_COLORS = TEMP_SCHEDULE_COLOR_PALETTE.map(c => c.hex);

// ============================================================================
// 기본값
// ============================================================================

/**
 * 임시 스케줄 기본값
 */
export const TEMP_SCHEDULE_DEFAULTS = {
  /** 기본 그리드 스냅 간격 (분) */
  gridSnapInterval: 15 as GridSnapInterval,
  /** 기본 블록 색상 */
  defaultColor: '#3b82f6',
  /** 최소 블록 기간 (분) */
  minBlockDuration: 15,
  /** 타임라인 시작 시간 */
  timelineStartHour: 5,
  /** 타임라인 종료 시간 */
  timelineEndHour: 24,
  /** 시간당 픽셀 높이 */
  hourHeight: 60,
} as const;

// ============================================================================
// 유틸리티 타입
// ============================================================================

/**
 * 시간 범위
 */
export interface TimeRange {
  startTime: number;
  endTime: number;
}

/**
 * 날짜별 작업 그룹
 */
export interface TempScheduleTasksByDate {
  [date: string]: TempScheduleTask[];
}

// ============================================================================
// 스케줄 템플릿
// ============================================================================

/**
 * 스케줄 템플릿 (저장된 일일 패턴)
 */
export interface TempScheduleTemplate {
  /** 고유 ID */
  id: string;
  /** 템플릿 이름 */
  name: string;
  /** 템플릿에 포함된 작업들 (날짜 독립적) */
  tasks: Omit<TempScheduleTask, 'id' | 'scheduledDate' | 'createdAt' | 'updatedAt'>[];
  /** 생성 시각 */
  createdAt: string;
  /** 수정 시각 */
  updatedAt: string;
  /** 고정(핀) 여부 - 상단에 우선 표시 */
  isPinned?: boolean;
}

// ============================================================================
// 배지 유틸리티 상수 (C4)
// ============================================================================

/**
 * 소요 시간 구간 임계값 (분)
 */
export const DURATION_THRESHOLDS = {
  /** 짧음 (30분 이하) */
  SHORT: 30,
  /** 중간 (90분 이하) */
  MEDIUM: 90,
  /** 김 (180분 이하) */
  LONG: 180,
  // 그 이상은 '매우 김'
} as const;

/**
 * 소요 시간에 따른 배지 정보 반환
 * @param durationMinutes - 소요 시간 (분)
 * @returns 배지 정보
 */
export const getDurationBadge = (durationMinutes: number): TempScheduleBadge => {
  if (durationMinutes <= DURATION_THRESHOLDS.SHORT) {
    return {
      type: 'duration',
      label: `${durationMinutes}분`,
      icon: '⚡',
      colorClass: 'bg-emerald-500/20 text-emerald-400',
    };
  }
  if (durationMinutes <= DURATION_THRESHOLDS.MEDIUM) {
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    return {
      type: 'duration',
      label: mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`,
      icon: '⏱️',
      colorClass: 'bg-blue-500/20 text-blue-400',
    };
  }
  if (durationMinutes <= DURATION_THRESHOLDS.LONG) {
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    return {
      type: 'duration',
      label: mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`,
      icon: '📊',
      colorClass: 'bg-amber-500/20 text-amber-400',
    };
  }
  // 매우 김
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  return {
    type: 'duration',
    label: mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`,
    icon: '🔥',
    colorClass: 'bg-rose-500/20 text-rose-400',
  };
};

/**
 * 작업의 모든 배지 정보 수집
 * @param task - 임시 스케줄 작업
 * @param options - 추가 옵션 (현재 시간 등)
 * @returns 배지 배열
 */
export const getTaskBadges = (
  task: TempScheduleTask,
  options?: {
    currentMinutes?: number;
    isImminent?: boolean;
    isInProgress?: boolean;
  }
): TempScheduleBadge[] => {
  const badges: TempScheduleBadge[] = [];

  // 진행 중
  if (options?.isInProgress) {
    badges.push({
      type: 'inProgress',
      label: '진행 중',
      icon: '▶️',
      colorClass: 'bg-green-500/30 text-green-400',
    });
  }

  // 임박
  if (options?.isImminent && !options?.isInProgress) {
    badges.push({
      type: 'imminent',
      label: '곧 시작',
      icon: '🔥',
      colorClass: 'bg-orange-500/30 text-orange-400',
    });
  }

  // 반복
  if (task.recurrence.type !== 'none') {
    badges.push({
      type: 'recurring',
      label: '반복',
      icon: '🔄',
      colorClass: 'bg-purple-500/20 text-purple-400',
    });
  }

  // 즐겨찾기
  if (task.favorite) {
    badges.push({
      type: 'favorite',
      label: '즐겨찾기',
      icon: '⭐',
      colorClass: 'bg-amber-500/20 text-amber-400',
    });
  }

  // 아카이브
  if (task.isArchived) {
    badges.push({
      type: 'archived',
      label: '보관됨',
      icon: '📦',
      colorClass: 'bg-gray-500/20 text-gray-400',
    });
  }

  // 소요 시간
  const duration = task.endTime - task.startTime;
  if (duration > 0) {
    badges.push(getDurationBadge(duration));
  }

  return badges;
};

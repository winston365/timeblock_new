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
  /** 시작 시간 (HH:MM 형식, 예: "08:00") */
  startTime: string;
  /** 종료 시간 (HH:MM 형식, 예: "17:00") */
  endTime: string;
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
  /** 원본 시작 시간 */
  originalStartTime?: string;
  /** 원본 종료 시간 */
  originalEndTime?: string;
  /** 드래그 시작 시간 (HH:MM) */
  startTimeAtDrag?: string;
}

// ============================================================================
// 툴팁 상태
// ============================================================================

/**
 * 드래그 툴팁 정보
 */
export interface DragTooltipInfo {
  /** 시작 시간 (HH:MM) */
  startTime: string;
  /** 종료 시간 (HH:MM) */
  endTime: string;
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
 * 블록 기본 색상 팔레트
 */
export const TEMP_SCHEDULE_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
] as const;

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
  startTime: string;
  endTime: string;
}

/**
 * 날짜별 작업 그룹
 */
export interface TempScheduleTasksByDate {
  [date: string]: TempScheduleTask[];
}

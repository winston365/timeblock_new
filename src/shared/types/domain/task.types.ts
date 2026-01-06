/**
 * Task domain types.
 *
 * @role Task/TimeBlock 관련 핵심 타입과 상수 정의
 */

/**
 * 작업의 심리적 저항도 (난이도)
 */
export type Resistance = 'low' | 'medium' | 'high';

/**
 * 타임블록 ID (5시간 단위)
 */
export type TimeBlockId =
  | 'dawn'
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'evening'
  | 'night'
  // Legacy IDs (기존 저장 데이터 호환)
  | '5-8'
  | '8-11'
  | '11-14'
  | '14-17'
  | '17-20'
  | '20-23'
  | null;

/**
 * 워밍업 프리셋 항목 (짧은 준비 작업)
 */
export interface WarmupPresetItem {
  text: string;
  baseDuration: number;
  resistance: Resistance;
}

/**
 * 시간대 속성 템플릿 (헤더 배지에 사용)
 */
export interface TimeSlotTagTemplate {
  id: string;
  label: string;
  color: string;
  icon?: string;
  note?: string;
}

/**
 * 하지않기 체크리스트 항목
 */
export interface DontDoChecklistItem {
  id: string;
  label: string;
  xpReward: number;
  order: number;
}

/**
 * 작업 (Task) 타입
 */
export interface Task {
  id: string;
  text: string;
  memo: string;
  baseDuration: number;
  resistance: Resistance;
  adjustedDuration: number;
  timeBlock: TimeBlockId;
  hourSlot?: number;
  order?: number;
  emoji?: string;
  completed: boolean;
  actualDuration: number;
  createdAt: string;
  completedAt: string | null;
  updatedAt?: string;
  scheduledDate?: string;
  fromAutoTemplate?: boolean;
  preparation1?: string;
  preparation2?: string;
  preparation3?: string;
  timerUsed?: boolean;
  goalId?: string | null;
  deadline?: string;
  isPinned?: boolean;
  deferredUntil?: string | null;
}

/**
 * 타임블록 상태
 */
export interface TimeBlockState {
  isLocked: boolean;
  isPerfect: boolean;
  isFailed: boolean;
  lockTimerStartedAt?: number | null;
  lockTimerDuration?: number;
}

/**
 * 블록 ID별 상태 매핑
 */
export type TimeBlockStates = Record<string, TimeBlockState>;

export const TIME_BLOCKS = [
  { id: 'dawn', label: '05:00 - 08:00', start: 5, end: 8 },
  { id: 'morning', label: '08:00 - 11:00', start: 8, end: 11 },
  { id: 'noon', label: '11:00 - 14:00', start: 11, end: 14 },
  { id: 'afternoon', label: '14:00 - 17:00', start: 14, end: 17 },
  { id: 'evening', label: '17:00 - 20:00', start: 17, end: 20 },
  { id: 'night', label: '20:00 - 23:00', start: 20, end: 23 },
] as const;

export const RESISTANCE_MULTIPLIERS: Record<Resistance, number> = {
  low: 1.0,
  medium: 1.3,
  high: 1.6,
};

export const RESISTANCE_LABELS: Record<Resistance, string> = {
  low: '🟢 쉬움',
  medium: '🟡 보통',
  high: '🔴 어려움',
};

/**
 * 타임블록 정보 (블록 + 작업 + 상태 통합)
 */
export interface TimeBlockInfo {
  id: string;
  label: string;
  start: number;
  end: number;
  tasks: Task[];
  state: TimeBlockState;
  totalDuration: number;
  completedDuration: number;
  xp: number;
}

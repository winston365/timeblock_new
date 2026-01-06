/**
 * Goal domain types.
 *
 * @role Daily/Weekly goal 관련 타입 정의
 */

/**
 * 일일 목표
 */
export interface DailyGoal {
  id: string;
  title: string;
  targetMinutes: number;
  plannedMinutes: number;
  completedMinutes: number;
  color?: string;
  icon?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 일별 진행 기록 (히스토리용)
 */
export interface WeeklyGoalDailyProgress {
  date: string;
  progress: number;
  dayOfWeek: number;
}

/**
 * 주간 목표 기록 (히스토리)
 */
export interface WeeklyGoalHistory {
  weekStartDate: string;
  target: number;
  finalProgress: number;
  completed: boolean;
  dailyProgress: WeeklyGoalDailyProgress[];
}

/**
 * 장기목표 (주간 목표)
 */
export interface WeeklyGoal {
  id: string;
  title: string;
  target: number;
  unit: string;
  currentProgress: number;
  icon?: string;
  color?: string;
  order: number;
  priority?: number;
  theme?: string;
  weekStartDate: string;
  history: WeeklyGoalHistory[];
  createdAt: string;
  updatedAt: string;
}

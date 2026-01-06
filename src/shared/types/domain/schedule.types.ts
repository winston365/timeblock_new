/**
 * Schedule/recurrence domain types.
 *
 * @role 일일 데이터/템플릿 반복(Recurrence) 관련 타입 정의
 */

import type { DailyGoal } from './goal.types';
import type { Resistance, Task, TimeBlockId, TimeBlockStates } from './task.types';

/**
 * 템플릿 반복 주기 타입
 */
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'interval';

/**
 * 작업 템플릿 (반복 작업용)
 */
export interface Template {
  id: string;
  name: string;
  text: string;
  memo: string;
  baseDuration: number;
  resistance: Resistance;
  timeBlock: TimeBlockId;
  autoGenerate: boolean;
  recurrenceType: RecurrenceType;
  weeklyDays?: number[];
  intervalDays?: number;
  lastGeneratedDate?: string;
  preparation1?: string;
  preparation2?: string;
  preparation3?: string;
  category?: string;
  isFavorite?: boolean;
  imageUrl?: string;
}

/**
 * 일일 데이터 (작업 목록, 블록 상태, 목표)
 */
export interface DailyData {
  tasks: Task[];
  goals: DailyGoal[];
  timeBlockStates: TimeBlockStates;
  hourSlotTags?: Record<number, string | null>;
  timeBlockDontDoStatus?: Record<string, Record<string, boolean>>;
  updatedAt: number;
}

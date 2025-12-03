/**
 * 임시 스케줄 feature 모듈
 *
 * @role 임시 스케줄 시스템의 public API
 */

// 메인 모달
export { TempScheduleModal } from './TempScheduleModal';

// Store
export { useTempScheduleStore } from './stores/tempScheduleStore';

// 컴포넌트
export { TempScheduleTimelineView } from './components/TempScheduleTimelineView';
export { TempScheduleTaskList } from './components/TempScheduleTaskList';
export { AddTempScheduleTaskModal } from './components/AddTempScheduleTaskModal';
export { WeeklyScheduleView } from './components/WeeklyScheduleView';
export { MonthlyScheduleView } from './components/MonthlyScheduleView';

// 타입 re-export
export type {
  TempScheduleTask,
  TempScheduleViewMode,
  GridSnapInterval,
  RecurrenceRule,
  TempScheduleRecurrenceType,
} from '@/shared/types/tempSchedule';

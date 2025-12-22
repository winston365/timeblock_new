/**
 * 저장소 계층 통합 export
 * 
 * @note Task가 dailyData와 globalInbox에 분리 저장됨
 *       저장소 위치를 신경쓰지 않는 통합 API가 필요하면:
 *       @see {@link @/shared/services/task/unifiedTaskService}
 */

export * from './baseRepository';
export * from './dailyDataRepository';
export * from './gameStateRepository';
export * from './settingsRepository';
export * from './waifuRepository';
export * from './templateRepository';
export * from './shopRepository';
export * from './chatHistoryRepository';
export * from './inboxRepository';
export * from './systemRepository';
export * from './tempScheduleRepository';

// 통합 Task 서비스 (dailyData + inbox 자동 감지)
export {
  updateAnyTask,
  deleteAnyTask,
  toggleAnyTaskCompletion,
  getAnyTask,
  getAllActiveTasks,
  getUncompletedTasks,
  findTaskLocation,
  type TaskLocation,
  type UpdateAnyTaskOptions,
} from '@/shared/services/task/unifiedTaskService';

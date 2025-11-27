/**
 * Task Service - 통합 Task API
 * 
 * Task가 dailyData와 globalInbox 중 어디에 저장되었는지 자동 감지합니다.
 * Store도 함께 갱신하여 UI가 실시간 반영됩니다.
 * 
 * @example
 * ```typescript
 * import { updateAnyTask, getAnyTask } from '@/shared/services/task';
 * 
 * await updateAnyTask(taskId, { text: 'updated' });
 * const task = await getAnyTask(taskId);
 * ```
 */

export {
  // Location Detection
  findTaskLocation,
  type TaskLocation,
  
  // Options
  type UpdateAnyTaskOptions,
  
  // Unified CRUD
  updateAnyTask,
  deleteAnyTask,
  toggleAnyTaskCompletion,
  getAnyTask,
  
  // Bulk Operations
  getAllActiveTasks,
  getUncompletedTasks,
} from './unifiedTaskService';

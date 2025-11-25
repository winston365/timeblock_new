/**
 * DailyData Repository
 *
 * @role 일일 작업 데이터 및 타임블록 상태 관리
 * @input DailyData 객체, Task 객체, TimeBlockState 객체, 날짜 문자열
 * @output DailyData 객체, Task 배열, TimeBlockState 객체
 * @external_dependencies
 *   - IndexedDB (db.dailyData): 메인 저장소
 *   - localStorage (STORAGE_KEYS.DAILY_PLANS): 백업 저장소
 *   - Firebase: 실시간 동기화 (syncToFirebase)
 *   - @/shared/types/domain: DailyData, Task, TimeBlockStates 타입
 * 
 * @refactored 2024-11 - 모듈 분리
 *   - types.ts: 타입 및 헬퍼 함수
 *   - coreOperations.ts: DailyData CRUD
 *   - taskOperations.ts: Task CRUD
 *   - blockOperations.ts: TimeBlockState 관리
 *   - queryHelpers.ts: 조회 전용 함수
 */

// Re-export all from submodules
export { ensureBaseBlockState, normalizeTimeBlockStates } from './types';
export { createEmptyDailyData, loadDailyData, saveDailyData, deleteDailyData } from './coreOperations';
export { addTask, updateTask, deleteTask, toggleTaskCompletion } from './taskOperations';
export { updateBlockState, toggleBlockLock } from './blockOperations';
export {
  getInboxTasks,
  getCompletedTasks,
  getBlockTasks,
  getRecentDailyData,
  getRecentCompletedTasks,
  getRecentUncompletedInboxTasks,
} from './queryHelpers';

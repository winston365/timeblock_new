/**
 * DailyData Repository
 *
 * @role 일일 작업 데이터 및 타임블록 상태 관리
 * @responsibilities
 *   - DailyData CRUD (coreOperations)
 *   - Task CRUD 및 Global Inbox 연동 (taskOperations)
 *   - TimeBlockState 상태 관리 (blockOperations)
 *   - 조회 헬퍼 함수 (queryHelpers)
 * @key_dependencies
 *   - IndexedDB (db.dailyData): 메인 저장소
 *   - Firebase: 실시간 동기화 (syncToFirebase)
 *   - @/shared/types/domain: DailyData, Task, TimeBlockStates 타입
 * @input DailyData 객체, Task 객체, TimeBlockState 객체, 날짜 문자열
 * @output DailyData 객체, Task 배열, TimeBlockState 객체
 * 
 * @note Task가 dailyData와 inbox 중 어디에 있는지 모를 때:
 *       @see {@link @/shared/services/task/unifiedTaskService} - 통합 Task API
 *       updateAnyTask(), deleteAnyTask(), getAnyTask() 등 사용
 * 
 * @refactored 2024-11 - 모듈 분리 (./dailyData/ 폴더)
 *   - types.ts: 타입 및 헬퍼 함수
 *   - coreOperations.ts: DailyData CRUD
 *   - taskOperations.ts: Task CRUD
 *   - blockOperations.ts: TimeBlockState 관리
 *   - queryHelpers.ts: 조회 전용 함수
 * 
 * 이 파일은 하위 호환성을 위해 모든 함수를 re-export합니다.
 */

export {
  // Types & Helpers
  ensureBaseBlockState,
  normalizeTimeBlockStates,
  // Core Operations
  createEmptyDailyData,
  loadDailyData,
  saveDailyData,
  deleteDailyData,
  // Task Operations
  addTask,
  updateTask,
  deleteTask,
  toggleTaskCompletion,
  // Block Operations
  updateBlockState,
  toggleBlockLock,
  // Query Helpers
  getInboxTasks,
  getCompletedTasks,
  getBlockTasks,
  getRecentDailyData,
  getRecentCompletedTasks,
  getRecentUncompletedInboxTasks,
} from './dailyData';

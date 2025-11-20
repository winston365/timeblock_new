/**
 * Inbox Zustand Store
 *
 * @role 전역 인박스 작업(날짜 독립적)의 전역 상태 관리
 * @input Task CRUD 요청, 완료 토글 요청
 * @output 인박스 작업 상태, 완료된 작업 상태, CRUD 함수, 로딩/에러 상태
 * @external_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 *   - repositories: 인박스 작업 레포지토리
 */

import { create } from 'zustand';
import type { Task } from '../types/domain';
import {
  loadInboxTasks as loadInboxTasksFromRepo,
  loadCompletedInboxTasks as loadCompletedInboxTasksFromRepo,
  addInboxTask as addInboxTaskToRepo,
  updateInboxTask as updateInboxTaskInRepo,
  deleteInboxTask as deleteInboxTaskFromRepo,
  toggleInboxTaskCompletion as toggleInboxTaskCompletionInRepo,
  moveInboxTaskToBlock as moveInboxTaskToBlockInRepo,
  moveTaskToInbox as moveTaskToInboxInRepo,
} from '@/data/repositories/inboxRepository';
import { db } from '@/data/db/dexieClient';

interface InboxStore {
  // 상태
  inboxTasks: Task[];
  completedTasks: Task[];
  loading: boolean;
  error: Error | null;

  // 액션
  loadInboxTasks: () => Promise<void>;
  loadCompletedTasks: () => Promise<void>;
  addInboxTask: (task: Task) => Promise<void>;
  updateInboxTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteInboxTask: (taskId: string) => Promise<void>;
  toggleInboxTaskCompletion: (taskId: string) => Promise<Task>;
  moveInboxTaskToBlock: (taskId: string) => Promise<Task | null>;
  moveTaskToInbox: (task: Task) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * 인박스 Zustand 스토어
 *
 * @returns {InboxStore} 인박스 상태 및 관리 함수
 * @sideEffects
 *   - IndexedDB/Firebase에 인박스 작업 저장
 *   - 작업 완료 시 테이블 간 이동 (globalInbox ↔ completedInbox)
 *   - 자동 UI 동기화
 *
 * @example
 * ```tsx
 * const { inboxTasks, addInboxTask, toggleInboxTaskCompletion } = useInboxStore();
 * await addInboxTask({ id: '1', text: '작업', timeBlock: null, completed: false });
 * await toggleInboxTaskCompletion('1');
 * ```
 */
export const useInboxStore = create<InboxStore>((set, get) => ({
  // 초기 상태
  inboxTasks: [],
  completedTasks: [],
  loading: false,
  error: null,

  // ============================================================================
  // 데이터 로드
  // ============================================================================

  /**
   * 미완료 인박스 작업 로드
   */
  loadInboxTasks: async () => {
    const { loading } = get();

    // 이미 로딩 중이면 스킵
    if (loading) {
      console.log('[InboxStore] Already loading, skipping...');
      return;
    }

    try {
      set({ loading: true, error: null });
      console.log('[InboxStore] Loading inbox tasks...');

      const tasks = await loadInboxTasksFromRepo();

      // Repository에서 이미 미완료 작업만 반환하지만, 방어적으로 한 번 더 필터링
      const uncompletedTasks = tasks.filter(task => !task.completed);

      console.log(`[InboxStore] ✅ Loaded ${uncompletedTasks.length} inbox tasks`);
      set({ inboxTasks: uncompletedTasks, loading: false });
    } catch (err) {
      console.error('[InboxStore] ❌ Failed to load inbox tasks:', err);
      set({ error: err as Error, loading: false });
    }
  },

  /**
   * 완료된 인박스 작업 로드
   */
  loadCompletedTasks: async () => {
    try {
      set({ loading: true, error: null });
      const tasks = await loadCompletedInboxTasksFromRepo();
      set({ completedTasks: tasks, loading: false });
    } catch (err) {
      console.error('[InboxStore] ❌ Failed to load completed tasks:', err);
      set({ error: err as Error, loading: false });
    }
  },

  // ============================================================================
  // Task CRUD (Optimistic Update 패턴)
  // ============================================================================

  /**
   * 인박스 작업 추가
   */
  addInboxTask: async (task: Task) => {
    const { inboxTasks } = get();

    console.log(`[InboxStore] Adding inbox task: "${task.text}" (${task.id})`);
    console.log('[InboxStore] Current inbox tasks:', inboxTasks.length);

    // ✅ Optimistic Update
    const optimisticTasks = [...inboxTasks, task];
    set({ inboxTasks: optimisticTasks });
    console.log('[InboxStore] Optimistic update applied, new count:', optimisticTasks.length);

    try {
      // ✅ Repository 호출
      await addInboxTaskToRepo(task);
      console.log('[InboxStore] ✅ Task successfully saved to repository');
    } catch (err) {
      console.error('[InboxStore] ❌ Failed to add inbox task, rolling back:', err);
      // ❌ Rollback
      set({ inboxTasks, error: err as Error });
      throw err;
    }
  },

  /**
   * 인박스 작업 업데이트
   */
  updateInboxTask: async (taskId: string, updates: Partial<Task>) => {
    const { inboxTasks } = get();

    // 원본 백업
    const originalTasks = inboxTasks;

    // ✅ Optimistic Update
    const optimisticTasks = inboxTasks.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    );
    set({ inboxTasks: optimisticTasks });

    try {
      // ✅ Repository 호출
      await updateInboxTaskInRepo(taskId, updates);
    } catch (err) {
      console.error('[InboxStore] Failed to update inbox task, rolling back:', err);
      // ❌ Rollback
      set({ inboxTasks: originalTasks, error: err as Error });
      throw err;
    }
  },

  /**
   * 인박스 작업 삭제
   */
  deleteInboxTask: async (taskId: string) => {
    const { inboxTasks } = get();

    // 원본 백업
    const originalTasks = inboxTasks;

    // ✅ Optimistic Update
    const optimisticTasks = inboxTasks.filter(task => task.id !== taskId);
    set({ inboxTasks: optimisticTasks });

    try {
      // ✅ Repository 호출
      await deleteInboxTaskFromRepo(taskId);
    } catch (err) {
      console.error('[InboxStore] Failed to delete inbox task, rolling back:', err);
      // ❌ Rollback
      set({ inboxTasks: originalTasks, error: err as Error });
      throw err;
    }
  },

  /**
   * 인박스 작업 완료 토글
   *
   * ✅ 완료 시: inboxTasks → completedTasks
   * ✅ 미완료 시: completedTasks → inboxTasks
   */
  toggleInboxTaskCompletion: async (taskId: string) => {
    const { inboxTasks, completedTasks } = get();

    // 원본 백업
    const originalInboxTasks = inboxTasks;
    const originalCompletedTasks = completedTasks;

    // 어느 목록에 있는지 확인
    const taskInInbox = inboxTasks.find(t => t.id === taskId);
    const taskInCompleted = completedTasks.find(t => t.id === taskId);

    let updatedTask: Task;

    if (taskInInbox) {
      // 미완료 → 완료
      updatedTask = {
        ...taskInInbox,
        completed: true,
        completedAt: new Date().toISOString(),
      };

      // ✅ Optimistic Update
      set({
        inboxTasks: inboxTasks.filter(t => t.id !== taskId),
        completedTasks: [...completedTasks, updatedTask],
      });
    } else if (taskInCompleted) {
      // 완료 → 미완료
      updatedTask = {
        ...taskInCompleted,
        completed: false,
        completedAt: null,
      };

      // ✅ Optimistic Update
      set({
        completedTasks: completedTasks.filter(t => t.id !== taskId),
        inboxTasks: [...inboxTasks, updatedTask],
      });
    } else {
      throw new Error(`Inbox task not found: ${taskId}`);
    }

    try {
      // ✅ Repository 호출
      const result = await toggleInboxTaskCompletionInRepo(taskId);
      return result;
    } catch (err) {
      console.error('[InboxStore] Failed to toggle inbox task completion, rolling back:', err);
      // ❌ Rollback
      set({
        inboxTasks: originalInboxTasks,
        completedTasks: originalCompletedTasks,
        error: err as Error,
      });
      throw err;
    }
  },

  /**
   * 인박스 작업을 타임블록으로 이동
   * (전역 인박스에서 제거, dailyData에 추가는 dailyDataStore에서 처리)
   */
  moveInboxTaskToBlock: async (taskId: string) => {
    const { inboxTasks } = get();

    // 원본 백업
    const originalTasks = inboxTasks;

    // ✅ Optimistic Update
    const optimisticTasks = inboxTasks.filter(task => task.id !== taskId);
    set({ inboxTasks: optimisticTasks });

    try {
      // ✅ Repository 호출
      const movedTask = await moveInboxTaskToBlockInRepo(taskId);
      return movedTask;
    } catch (err) {
      console.error('[InboxStore] Failed to move inbox task to block, rolling back:', err);
      // ❌ Rollback
      set({ inboxTasks: originalTasks, error: err as Error });
      throw err;
    }
  },

  /**
   * 타임블록 작업을 전역 인박스로 이동
   */
  moveTaskToInbox: async (task: Task) => {
    const { inboxTasks } = get();

    // ✅ Optimistic Update
    const taskWithNullBlock = { ...task, timeBlock: null };
    set({ inboxTasks: [...inboxTasks, taskWithNullBlock] });

    try {
      // ✅ Repository 호출
      await moveTaskToInboxInRepo(taskWithNullBlock);
    } catch (err) {
      console.error('[InboxStore] Failed to move task to inbox, rolling back:', err);
      // ❌ Rollback
      set({ inboxTasks, error: err as Error });
      throw err;
    }
  },

  // ============================================================================
  // 유틸리티
  // ============================================================================

  /**
   * 수동 갱신 (강제 리로드)
   */
  refresh: async () => {
    await Promise.all([
      get().loadInboxTasks(),
      get().loadCompletedTasks(),
    ]);
  },

  /**
   * 상태 초기화
   */
  reset: () => {
    set({
      inboxTasks: [],
      completedTasks: [],
      loading: false,
      error: null,
    });
  },
}));

// ============================================================================
// 🔍 디버깅 헬퍼 (브라우저 콘솔에서 사용 가능)
// ============================================================================

if (typeof window !== 'undefined') {
  (window as any).debugInbox = {
    // Store 상태 확인
    getStoreState: () => {
      const state = useInboxStore.getState();
      console.log('📊 InboxStore State:', {
        inboxTasks: state.inboxTasks.length,
        completedTasks: state.completedTasks.length,
        loading: state.loading,
        error: state.error,
      });
      console.log('📋 Inbox Tasks:', state.inboxTasks);
      console.log('✅ Completed Tasks:', state.completedTasks);
      return state;
    },

    // IndexedDB 직접 확인
    checkIndexedDB: async () => {
      console.log('🔍 Checking IndexedDB...');
      const globalInboxTasks = await db.globalInbox.toArray();
      const completedInboxTasks = await db.completedInbox.toArray();

      console.log(`📥 globalInbox table: ${globalInboxTasks.length} tasks`);
      console.log(globalInboxTasks);

      console.log(`✅ completedInbox table: ${completedInboxTasks.length} tasks`);
      console.log(completedInboxTasks);

      return { globalInboxTasks, completedInboxTasks };
    },

    // 강제 새로고침
    forceRefresh: async () => {
      console.log('🔄 Force refreshing inbox store...');
      await useInboxStore.getState().refresh();
      console.log('✅ Refresh complete');
      return useInboxStore.getState();
    },

    // 도움말
    help: () => {
      console.log(`
🔍 Inbox Debug Helper Commands:

debugInbox.getStoreState()     - Store 상태 확인
debugInbox.checkIndexedDB()    - IndexedDB 직접 확인
debugInbox.forceRefresh()      - 강제 새로고침
debugInbox.help()              - 이 도움말 표시

예제:
  await debugInbox.checkIndexedDB()
  debugInbox.getStoreState()
      `);
    },
  };

  console.log('🔧 Inbox debug helper loaded. Type "debugInbox.help()" for commands.');
}

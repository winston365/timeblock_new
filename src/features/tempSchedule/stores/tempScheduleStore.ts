/**
 * 임시 스케줄 Store (Zustand)
 *
 * @role 임시 스케줄 시스템의 전역 상태 관리
 * @responsibilities
 *   - 임시 스케줄 작업 목록 관리
 *   - 뷰 모드 (일간/주간/월간) 관리
 *   - 선택된 날짜 관리
 *   - 그리드 스냅 설정 관리
 *   - 드래그 상태 관리
 * @key_dependencies
 *   - tempScheduleRepository: 데이터 영속성
 *   - TempScheduleTask 타입
 */

import { create } from 'zustand';
import type {
  TempScheduleTask,
  TempScheduleViewMode,
  GridSnapInterval,
  TempScheduleDragState,
} from '@/shared/types/tempSchedule';
import { TEMP_SCHEDULE_DEFAULTS } from '@/shared/types/tempSchedule';
import {
  loadTempScheduleTasks,
  addTempScheduleTask,
  updateTempScheduleTask,
  deleteTempScheduleTask,
  shouldShowOnDate,
} from '@/data/repositories/tempScheduleRepository';
import { getLocalDate } from '@/shared/lib/utils';

// ============================================================================
// Store Interface
// ============================================================================

interface TempScheduleState {
  // === 데이터 ===
  /** 모든 임시 스케줄 작업 */
  tasks: TempScheduleTask[];
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 상태 */
  error: string | null;

  // === 뷰 설정 ===
  /** 현재 뷰 모드 */
  viewMode: TempScheduleViewMode;
  /** 선택된 날짜 (YYYY-MM-DD) */
  selectedDate: string;
  /** 그리드 스냅 간격 */
  gridSnapInterval: GridSnapInterval;

  // === 드래그 상태 ===
  /** 드래그 상태 */
  dragState: TempScheduleDragState | null;

  // === 모달 상태 ===
  /** 메인 모달 열림 여부 */
  isModalOpen: boolean;
  /** 작업 추가/편집 모달 열림 여부 */
  isTaskModalOpen: boolean;
  /** 편집 중인 작업 */
  editingTask: TempScheduleTask | null;

  // === Actions ===
  /** 데이터 로드 */
  loadData: () => Promise<void>;
  /** 특정 날짜의 작업 가져오기 */
  getTasksForDate: (date: string) => TempScheduleTask[];
  /** 작업 추가 */
  addTask: (task: Omit<TempScheduleTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TempScheduleTask>;
  /** 작업 업데이트 */
  updateTask: (id: string, updates: Partial<TempScheduleTask>) => Promise<void>;
  /** 작업 삭제 */
  deleteTask: (id: string) => Promise<void>;
  
  // === View Actions ===
  /** 뷰 모드 변경 */
  setViewMode: (mode: TempScheduleViewMode) => void;
  /** 선택된 날짜 변경 */
  setSelectedDate: (date: string) => void;
  /** 그리드 스냅 간격 변경 */
  setGridSnapInterval: (interval: GridSnapInterval) => void;
  /** 이전 날짜로 이동 */
  goToPrevious: () => void;
  /** 다음 날짜로 이동 */
  goToNext: () => void;
  /** 오늘로 이동 */
  goToToday: () => void;

  // === Drag Actions ===
  /** 드래그 시작 */
  startDrag: (state: TempScheduleDragState) => void;
  /** 드래그 업데이트 */
  updateDrag: (currentY: number) => void;
  /** 드래그 종료 */
  endDrag: () => void;

  // === Modal Actions ===
  /** 메인 모달 열기 */
  openModal: () => void;
  /** 메인 모달 닫기 */
  closeModal: () => void;
  /** 작업 추가 모달 열기 */
  openTaskModal: (task?: TempScheduleTask) => void;
  /** 작업 모달 닫기 */
  closeTaskModal: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useTempScheduleStore = create<TempScheduleState>((set, get) => ({
  // === 초기 상태 ===
  tasks: [],
  isLoading: false,
  error: null,
  viewMode: 'day',
  selectedDate: getLocalDate(),
  gridSnapInterval: TEMP_SCHEDULE_DEFAULTS.gridSnapInterval,
  dragState: null,
  isModalOpen: false,
  isTaskModalOpen: false,
  editingTask: null,

  // === Data Actions ===
  loadData: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await loadTempScheduleTasks();
      set({ tasks, isLoading: false });
    } catch (error) {
      console.error('Failed to load temp schedule tasks:', error);
      set({ error: '데이터를 불러오는데 실패했습니다.', isLoading: false });
    }
  },

  getTasksForDate: (date: string) => {
    const { tasks } = get();
    return tasks.filter(task => shouldShowOnDate(task, date));
  },

  addTask: async (taskData) => {
    try {
      const newTask = await addTempScheduleTask(taskData);
      set(state => ({ tasks: [...state.tasks, newTask] }));
      return newTask;
    } catch (error) {
      console.error('Failed to add temp schedule task:', error);
      throw error;
    }
  },

  updateTask: async (id, updates) => {
    try {
      const updatedTask = await updateTempScheduleTask(id, updates);
      if (updatedTask) {
        set(state => ({
          tasks: state.tasks.map(t => t.id === id ? updatedTask : t),
        }));
      }
    } catch (error) {
      console.error('Failed to update temp schedule task:', error);
      throw error;
    }
  },

  deleteTask: async (id) => {
    try {
      await deleteTempScheduleTask(id);
      set(state => ({
        tasks: state.tasks.filter(t => t.id !== id && t.parentId !== id),
      }));
    } catch (error) {
      console.error('Failed to delete temp schedule task:', error);
      throw error;
    }
  },

  // === View Actions ===
  setViewMode: (mode) => set({ viewMode: mode }),

  setSelectedDate: (date) => set({ selectedDate: date }),

  setGridSnapInterval: (interval) => set({ gridSnapInterval: interval }),

  goToPrevious: () => {
    const { viewMode, selectedDate } = get();
    const current = new Date(selectedDate);

    switch (viewMode) {
      case 'day':
        current.setDate(current.getDate() - 1);
        break;
      case 'week':
        current.setDate(current.getDate() - 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() - 1);
        break;
    }

    set({ selectedDate: current.toISOString().split('T')[0] });
  },

  goToNext: () => {
    const { viewMode, selectedDate } = get();
    const current = new Date(selectedDate);

    switch (viewMode) {
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
    }

    set({ selectedDate: current.toISOString().split('T')[0] });
  },

  goToToday: () => {
    set({ selectedDate: getLocalDate() });
  },

  // === Drag Actions ===
  startDrag: (state) => set({ dragState: state }),

  updateDrag: (currentY) => {
    const { dragState } = get();
    if (dragState) {
      set({ dragState: { ...dragState, currentY } });
    }
  },

  endDrag: () => set({ dragState: null }),

  // === Modal Actions ===
  openModal: () => set({ isModalOpen: true }),

  closeModal: () => set({ isModalOpen: false, isTaskModalOpen: false, editingTask: null }),

  openTaskModal: (task) => set({ 
    isTaskModalOpen: true, 
    editingTask: task || null,
  }),

  closeTaskModal: () => set({ isTaskModalOpen: false, editingTask: null }),
}));

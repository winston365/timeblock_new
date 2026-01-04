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
import {
  TEMP_SCHEDULE_DEFAULTS,
  type TempScheduleTask,
  type TempScheduleViewMode,
  type GridSnapInterval,
  type TempScheduleDragState,
  type TempScheduleTemplate,
  type PromoteResult,
  type PromotePostAction,
} from '@/shared/types/tempSchedule';
import {
  loadTempScheduleTasks,
  addTempScheduleTask,
  updateTempScheduleTask,
  deleteTempScheduleTask,
  shouldShowOnDate,
  loadTempScheduleTemplates,
  saveTemplate,
  deleteTempScheduleTemplate,
  applyTemplate,
  loadPinnedTemplateIds,
  savePinnedTemplateIds,
} from '@/data/repositories/tempScheduleRepository';
import { getLocalDate } from '@/shared/lib/utils';
import { notify } from '@/shared/lib/notify';

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
  /** 아카이브 보기 여부 */
  showArchived: boolean;

  // === 템플릿 ===
  /** 저장된 템플릿 목록 */
  templates: TempScheduleTemplate[];
  /** 템플릿 모달 열림 여부 */
  isTemplateModalOpen: boolean;
  /** 고정된 템플릿 ID 목록 */
  pinnedTemplateIds: string[];

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
  /** 커맨드 팔레트 열림 여부 */
  isCommandPaletteOpen: boolean;

  // === Actions ===
  /** 데이터 로드 */
  loadData: () => Promise<void>;
  /** 특정 날짜의 작업 가져오기 (아카이브 필터 적용) */
  getTasksForDate: (date: string) => TempScheduleTask[];
  /** 작업 추가 */
  addTask: (task: Omit<TempScheduleTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TempScheduleTask>;
  /** 작업 업데이트 */
  updateTask: (id: string, updates: Partial<TempScheduleTask>) => Promise<void>;
  /** 작업 삭제 */
  deleteTask: (id: string) => Promise<void>;
  /** 작업 복제 */
  duplicateTask: (task: TempScheduleTask) => Promise<void>;
  /** 실제 작업으로 변환 (레거시 - 결과 반환 없음) */
  promoteToRealTask: (task: TempScheduleTask) => Promise<void>;
  /** 실제 작업으로 변환 + 후처리 (A1) */
  promoteWithPostAction: (task: TempScheduleTask, postAction: PromotePostAction) => Promise<PromoteResult>;
  /** 작업 아카이브 */
  archiveTask: (id: string) => Promise<void>;
  /** 아카이브 해제 */
  unarchiveTask: (id: string) => Promise<void>;
  /** 아카이브 보기 토글 */
  toggleShowArchived: () => void;

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
  /** 커맨드 팔레트 열기 */
  openCommandPalette: () => void;
  /** 커맨드 팔레트 닫기 */
  closeCommandPalette: () => void;

  // === Template Actions ===
  /** 템플릿 모달 열기 */
  openTemplateModal: () => void;
  /** 템플릿 모달 닫기 */
  closeTemplateModal: () => void;
  /** 현재 날짜 스케줄을 템플릿으로 저장 */
  saveAsTemplate: (name: string) => Promise<void>;
  /** 템플릿 삭제 */
  removeTemplate: (id: string) => Promise<void>;
  /** 템플릿 적용 */
  applyTemplateToDate: (template: TempScheduleTemplate, date?: string) => Promise<void>;
  /** 템플릿 핀 토글 (A7) */
  toggleTemplatePin: (templateId: string) => Promise<void>;
  /** 정렬된 템플릿 목록 (pinned 우선) */
  getSortedTemplates: () => TempScheduleTemplate[];
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useTempScheduleStore = create<TempScheduleState>((set, get) => ({
  // === 초기 상태 ===
  tasks: [],
  isLoading: false,
  error: null,
  showArchived: false,
  templates: [],
  isTemplateModalOpen: false,
  pinnedTemplateIds: [],
  viewMode: 'day',
  selectedDate: getLocalDate(),
  gridSnapInterval: TEMP_SCHEDULE_DEFAULTS.gridSnapInterval,
  dragState: null,
  isModalOpen: false,
  isTaskModalOpen: false,
  editingTask: null,
  isCommandPaletteOpen: false,

  // === Data Actions ===
  loadData: async () => {
    set({ isLoading: true, error: null });
    try {
      // 병렬 로드 (템플릿 + 핀 목록 포함)
      const [tasks, templates, pinnedIds, settings] = await Promise.all([
        loadTempScheduleTasks(),
        loadTempScheduleTemplates(),
        loadPinnedTemplateIds(),
        import('@/data/repositories/settingsRepository').then(m => m.loadSettings())
      ]);

      set({
        tasks,
        templates,
        pinnedTemplateIds: pinnedIds,
        isLoading: false,
        gridSnapInterval: (settings.tempScheduleGridSnapInterval as GridSnapInterval) || TEMP_SCHEDULE_DEFAULTS.gridSnapInterval
      });
    } catch (error) {
      console.error('Failed to load temp schedule tasks:', error);
      set({ error: '데이터를 불러오는데 실패했습니다.', isLoading: false });
    }
  },

  getTasksForDate: (date: string) => {
    const { tasks, showArchived } = get();
    return tasks.filter(task => {
      // 아카이브 필터
      if (!showArchived && task.isArchived) return false;
      return shouldShowOnDate(task, date);
    });
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

  duplicateTask: async (task) => {
    try {
      const { addTask } = get();
      await addTask({
        ...task,
        name: `${task.name} (복사됨)`,
      });
    } catch (error) {
      console.error('Failed to duplicate temp schedule task:', error);
      throw error;
    }
  },

  promoteToRealTask: async (task) => {
    try {
      // 동적 import로 순환 참조 방지
      const { useDailyDataStore } = await import('@/shared/stores/dailyDataStore');
      const { generateId } = await import('@/shared/lib/utils');

      const realTask = {
        id: generateId('task'),
        text: task.name,
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeBlock: null, // 인박스로 보낼지, 특정 시간 블록으로 보낼지 결정 필요. 일단 인박스(null)로.
        goalId: null,
        emoji: '📅',
        duration: 30, // 기본값
        adjustedDuration: 30,
        memo: task.memo || '',
        baseDuration: 30,
        resistance: 'low' as const,
        actualDuration: 0,
      };

      // 시간 정보가 있으면 메모에 추가하거나, 적절히 변환 로직 추가 가능
      // 여기서는 단순히 인박스에 추가하는 것으로 구현
      await useDailyDataStore.getState().addTask(realTask);

      // 선택 사항: 변환 후 임시 스케줄 삭제? 
      // await get().deleteTask(task.id); 
      // -> 유저가 명시적으로 삭제하는게 나을 수 있음. 일단 유지.
    } catch (error) {
      console.error('Failed to promote temp schedule task:', error);
      throw error;
    }
  },

  /**
   * 실제 작업으로 승격 + 후처리 (A1)
   * @description 승격 후 원본 temp task를 어떻게 처리할지 선택
   */
  promoteWithPostAction: async (task, postAction): Promise<PromoteResult> => {
    try {
      const { useDailyDataStore } = await import('@/shared/stores/dailyDataStore');
      const { generateId } = await import('@/shared/lib/utils');

      const realTaskId = generateId('task');
      const realTask = {
        id: realTaskId,
        text: task.name,
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeBlock: null,
        goalId: null,
        emoji: '📅',
        duration: task.endTime - task.startTime,
        adjustedDuration: task.endTime - task.startTime,
        memo: task.memo || '',
        baseDuration: task.endTime - task.startTime,
        resistance: 'low' as const,
        actualDuration: 0,
      };

      await useDailyDataStore.getState().addTask(realTask);

      // 후처리
      switch (postAction) {
        case 'delete':
          await get().deleteTask(task.id);
          notify.success(`'${task.name}' 승격 완료 (원본 삭제됨)`);
          break;
        case 'archive':
          await get().archiveTask(task.id);
          notify.success(`'${task.name}' 승격 완료 (보관함으로 이동)`);
          break;
        case 'keep':
        default:
          notify.success(`'${task.name}' 승격 완료 (원본 유지)`);
          break;
      }

      return {
        success: true,
        tempTaskId: task.id,
        realTaskId,
      };
    } catch (error) {
      console.error('Failed to promote temp schedule task:', error);
      notify.error('승격 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
      return {
        success: false,
        tempTaskId: task.id,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  },

  /**
   * 작업 아카이브 (보관함으로 이동)
   */
  archiveTask: async (id) => {
    try {
      await get().updateTask(id, { isArchived: true });
    } catch (error) {
      console.error('Failed to archive temp schedule task:', error);
      throw error;
    }
  },

  /**
   * 아카이브 해제
   */
  unarchiveTask: async (id) => {
    try {
      await get().updateTask(id, { isArchived: false });
    } catch (error) {
      console.error('Failed to unarchive temp schedule task:', error);
      throw error;
    }
  },

  /**
   * 아카이브 보기 토글
   */
  toggleShowArchived: () => {
    set(state => ({ showArchived: !state.showArchived }));
  },

  // === View Actions ===
  setViewMode: (mode) => set({ viewMode: mode }),

  setSelectedDate: (date) => set({ selectedDate: date }),

  setGridSnapInterval: async (interval) => {
    set({ gridSnapInterval: interval });
    try {
      const { updateSettings } = await import('@/data/repositories/settingsRepository');
      await updateSettings({ tempScheduleGridSnapInterval: interval });
    } catch (error) {
      console.error('Failed to save grid snap interval:', error);
    }
  },

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

    set({ selectedDate: getLocalDate(current) });
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

    set({ selectedDate: getLocalDate(current) });
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

  closeModal: () => set({ isModalOpen: false, isTaskModalOpen: false, editingTask: null, isCommandPaletteOpen: false }),

  openTaskModal: (task) => set({
    isTaskModalOpen: true,
    editingTask: task || null,
  }),

  closeTaskModal: () => set({ isTaskModalOpen: false, editingTask: null }),

  openCommandPalette: () => set({ isCommandPaletteOpen: true }),

  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

  // === Template Actions ===
  openTemplateModal: () => set({ isTemplateModalOpen: true }),

  closeTemplateModal: () => set({ isTemplateModalOpen: false }),

  saveAsTemplate: async (name: string) => {
    const { selectedDate, getTasksForDate } = get();
    const tasksForDate = getTasksForDate(selectedDate);

    if (tasksForDate.length === 0) {
      throw new Error('저장할 스케줄이 없습니다.');
    }

    try {
      const newTemplate = await saveTemplate(name, tasksForDate);
      set(state => ({
        templates: [...state.templates, newTemplate],
      }));
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error;
    }
  },

  removeTemplate: async (id: string) => {
    try {
      await deleteTempScheduleTemplate(id);
      set(state => ({
        templates: state.templates.filter(t => t.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error;
    }
  },

  applyTemplateToDate: async (template: TempScheduleTemplate, date?: string) => {
    const targetDate = date || get().selectedDate;

    try {
      const newTasks = await applyTemplate(template, targetDate);
      set(state => ({
        tasks: [...state.tasks, ...newTasks],
      }));
    } catch (error) {
      console.error('Failed to apply template:', error);
      throw error;
    }
  },

  /**
   * 템플릿 핀 토글 (A7)
   */
  toggleTemplatePin: async (templateId: string) => {
    const { pinnedTemplateIds } = get();
    const isPinned = pinnedTemplateIds.includes(templateId);
    
    const newPinnedIds = isPinned
      ? pinnedTemplateIds.filter(id => id !== templateId)
      : [...pinnedTemplateIds, templateId];

    try {
      await savePinnedTemplateIds(newPinnedIds);
      set({ pinnedTemplateIds: newPinnedIds });
    } catch (error) {
      console.error('Failed to toggle template pin:', error);
      throw error;
    }
  },

  /**
   * 정렬된 템플릿 목록 (pinned 우선)
   */
  getSortedTemplates: () => {
    const { templates, pinnedTemplateIds } = get();
    
    const pinned = templates.filter(t => pinnedTemplateIds.includes(t.id));
    const unpinned = templates.filter(t => !pinnedTemplateIds.includes(t.id));
    
    // pinned를 먼저, 그 다음 unpinned (각각 최신순)
    return [
      ...pinned.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      ...unpinned.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    ];
  },
}));

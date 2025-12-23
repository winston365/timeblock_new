/**
 * @file InboxTab.tsx
 * 
 * Role: 시간 블록에 배치되지 않은 작업들을 관리하는 인박스 탭 컴포넌트
 * 
 * Responsibilities:
 * - 인박스 작업 목록 표시 (전체/최근/난이도별 필터링)
 * - 인라인 빠른 추가 및 모달을 통한 작업 추가/편집/삭제
 * - 타임블록에서 드래그앤드롭으로 작업을 인박스로 이동
 * - 퀘스트 진행 (prepare_tasks) 업데이트
 * - Triage 모드 (키보드 중심 루프)
 * - 정리 진행도 미니 HUD
 * - Today/Tomorrow/NextSlot 원탭 배치
 * 
 * Key Dependencies:
 * - useInboxStore: 인박스 작업 CRUD 및 상태 관리
 * - useInboxHotkeys: 키보드 단축키 처리
 * - TaskCard: 개별 작업 카드 UI
 * - TaskModal: 작업 추가/편집 모달
 * - useDragDropManager: 드래그앤드롭 데이터 관리
 * - slotFinder: 빠른 배치 슬롯 계산
 * - notify: 토스트 알림
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGameState } from '@/shared/hooks/useGameState';
import { useDailyData } from '@/shared/hooks/useDailyData';
import { TIME_BLOCKS, type Task, type TimeBlockId } from '@/shared/types/domain';
import { createInboxTask, createTaskFromPartial, isTaskPrepared, isNewlyPrepared } from '@/shared/utils/taskFactory';
import TaskCard from '@/features/schedule/TaskCard';
import TaskModal from '@/features/schedule/TaskModal';
import { useDragDropManager } from '@/features/schedule/hooks/useDragDropManager';
import { useInboxStore } from '@/shared/stores/inboxStore';
import { useInboxHotkeys } from '@/features/tasks/hooks/useInboxHotkeys';
import { findSuggestedSlot, type SlotFindMode } from '@/shared/services/schedule/slotFinder';
import { notify } from '@/shared/lib/notify';
import { getLocalDate } from '@/shared/lib/utils';
import { TASK_DEFAULTS } from '@/shared/constants/defaults';
import { eventBus } from '@/shared/lib/eventBus';

/**
 * 인박스 탭 컴포넌트
 *
 * @returns {JSX.Element} 인박스 탭 UI
 * @sideEffects
 *   - 작업 추가/수정/삭제 시 Firebase 동기화
 *   - 드래그앤드롭으로 작업을 인박스로 이동 가능
 */
export default function InboxTab() {
  const { updateQuestProgress } = useGameState();
  const { updateTask: updateDailyTask, dailyData } = useDailyData();
  const todayTasks = dailyData?.tasks ?? [];
  const timeBlockStates = dailyData?.timeBlockStates;
  const { getDragData } = useDragDropManager();

  // Store Hooks
  const {
    inboxTasks,
    loading,
    loadData,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    // Triage 상태
    triageEnabled,
    setTriageEnabled,
    setTriageFocusedTaskId,
    // HUD 상태
    hudCollapsed,
    dailyGoalCount,
    todayProcessedCount,
    setHudCollapsed,
    setDailyGoalCount,
    // 빠른 배치
    placeTaskToSlot,
    setLastUsedSlot,
    incrementProcessedCount,
  } = useInboxStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'pinned' | 'deferred' | 'high' | 'medium' | 'low'>('all');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const stats = useMemo(() => {
    const todayISO = getLocalDate();
    const pinned = inboxTasks.filter((t) => t.isPinned).length;
    const deferred = inboxTasks.filter((t) => (t.deferredUntil ?? null) !== null && (t.deferredUntil ?? '') > todayISO).length;
    const actionable = inboxTasks.length - deferred;
    return {
      total: inboxTasks.length,
      pinned,
      deferred,
      actionable,
      todayISO,
    };
  }, [inboxTasks]);

  // Triage 모드 핫키 훅
  const { focusedTaskId } = useInboxHotkeys({
    triageEnabled,
    onEditTask: (taskId) => {
      const task = inboxTasks.find((t) => t.id === taskId);
      if (task) {
        setEditingTask(task);
        setIsModalOpen(true);
      }
    },
    onDeleteTask: async (taskId) => {
      // Undo 지원 삭제
      const task = inboxTasks.find((t) => t.id === taskId);
      if (!task) return;

      await deleteTask(taskId);

      notify.undo(`"${task.text}" 삭제됨`, {
        label: '되돌리기',
        onAction: async () => {
          await addTask(task);
          notify.success('복원되었습니다');
        },
      });
    },
    disabled: isInputFocused || isModalOpen,
  });

  // 초기 데이터 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 목표 달성 최소 피드백 (정확히 1회)
  useEffect(() => {
    const off = eventBus.on('inbox:dailyGoalAchieved', ({ goalCount }) => {
      notify.goalAchieved(`오늘 목표 ${goalCount}개 달성!`);
    });
    return () => {
      off();
    };
  }, []);

  // ========================================================================
  // 빠른 배치 핸들러
  // ========================================================================

  /**
   * Today/Tomorrow/NextSlot 빠른 배치
   */
  const handleQuickPlace = useCallback(
    async (taskId: string, mode: SlotFindMode) => {
      const task = inboxTasks.find((t) => t.id === taskId);
      if (!task) return;

      try {
        const today = getLocalDate();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = getLocalDate(tomorrow);

        const suggestion = findSuggestedSlot({
          now: new Date(),
          mode,
          today: {
            tasks: todayTasks,
            timeBlockStates,
            dateISO: today,
          },
          tomorrow: {
            tasks: [],
            dateISO: tomorrowISO,
          },
          options: {
            skipLockedBlocks: true,
            avoidHourSlotCollisions: true,
          },
        });

        if (!suggestion) {
          notify.error('배치 가능한 슬롯이 없습니다');
          return;
        }

        await placeTaskToSlot(
          taskId,
          suggestion.dateISO,
          suggestion.blockId as TimeBlockId,
          suggestion.hourSlot,
        );

        await setLastUsedSlot({
          mode,
          date: suggestion.dateISO,
          blockId: suggestion.blockId as string,
          hourSlot: suggestion.hourSlot,
        });

        notify.placement(suggestion.label);
      } catch (error) {
        console.error('Quick place failed:', error);
        notify.error('배치에 실패했습니다');
      }
    },
    [inboxTasks, todayTasks, timeBlockStates, placeTaskToSlot, setLastUsedSlot],
  );

  const handleInlineInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inlineInputValue.trim()) {
      e.preventDefault();
      const trimmedText = inlineInputValue.trim();
      try {
        const newTask = createInboxTask(trimmedText, {
          baseDuration: TASK_DEFAULTS.baseDuration,
          resistance: TASK_DEFAULTS.resistance,
        });
        await addTask(newTask);
        setInlineInputValue('');
        notify.success('작업이 추가되었습니다');

        // 키보드-only 흐름: 추가 후 바로 Triage 처리 가능하게 포커스 이동
        if (triageEnabled) {
          setTriageFocusedTaskId(newTask.id);
          (e.currentTarget as HTMLInputElement).blur();
        }
      } catch (error) {
        console.error('Failed to add inline task:', error);
        notify.error('작업 추가에 실패했습니다');
      }
    } else if (e.key === 'Escape') {
      setInlineInputValue('');
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData);

        // 수정 후에도 준비된 작업인지 확인 (이전에 준비되지 않았다면 퀘스트 진행)
        if (isNewlyPrepared(editingTask, taskData)) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      } else {
        const newTask = createTaskFromPartial(taskData, {
          timeBlock: null,
          baseDuration: TASK_DEFAULTS.baseDuration,
        });
        await addTask(newTask);

        // 준비된 작업이면 퀘스트 진행
        if (isTaskPrepared(taskData)) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      }

      setIsModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to save task:', error);
      notify.error('작업 저장에 실패했습니다');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const task = inboxTasks.find((t) => t.id === taskId);
      await deleteTask(taskId);

      // Undo 지원
      if (task) {
        notify.undo(`"${task.text}" 삭제됨`, {
          label: '되돌리기',
          onAction: async () => {
            await addTask(task);
            notify.success('복원되었습니다');
          },
        });
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      notify.error('작업 삭제에 실패했습니다');
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      await toggleTaskCompletion(taskId);
    } catch (error) {
      console.error('Failed to toggle task:', error);
      notify.error('작업 상태 변경에 실패했습니다');
    }
  };

  // 드래그 앤 드롭 핸들러 (시간대 블록 → 인박스)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent?.stopPropagation) {
      e.nativeEvent.stopPropagation();
    }
    setIsDragOver(false);

    // Phase 2 통합 드래그 시스템 사용 (JSON 파싱)
    const dragData = getDragData(e);
    if (!dragData) {
      console.warn('No drag data found in drop event');
      return;
    }

    try {
      // 타임블록에 있던 작업을 인박스로 이동
      // useDailyData의 updateTask를 사용하여 timeBlock을 null로 설정하면
      // 로직에 따라 인박스로 이동되어야 함.
      // 하지만 현재 구조상 dailyDataStore와 inboxStore가 분리되어 있을 수 있음.
      // updateDailyTask가 repository를 호출한다면, repository 레벨에서 처리될 것.
      // 여기서는 updateDailyTask를 호출하여 처리.
      await updateDailyTask(dragData.taskId, {
        timeBlock: null,
        hourSlot: undefined
      });

      // 인박스를 다시 로드 (인박스 상태 업데이트)
      await loadData();
    } catch (error) {
      console.error('Failed to move task to inbox:', error);
      notify.error(error instanceof Error ? error.message : '작업을 인박스로 이동하는데 실패했습니다.');
    }
  };

  // 여러 작업 일괄 추가
  const handleSaveMultipleTasks = async (tasks: Partial<Task>[]) => {
    try {
      for (const taskData of tasks) {
        const newTask = createTaskFromPartial(taskData, {
          timeBlock: null,
          baseDuration: TASK_DEFAULTS.baseDuration,
        });
        await addTask(newTask);

        // 퀘스트 진행 체크
        if (isTaskPrepared(newTask)) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      }
      setIsModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to save multiple tasks:', error);
      notify.error('작업 일괄 추가에 실패했습니다');
    }
  };

  if (loading && inboxTasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-6 text-sm text-[var(--color-text-secondary)]">
        로딩 중...
      </div>
    );
  }

  const tabContentClass = [
    'flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 transition-all',
    isDragOver
      ? 'bg-[var(--color-primary)]/5 ring-2 ring-inset ring-[var(--color-primary)]/50'
      : '',
  ].join(' ');

  const counts = {
    all: inboxTasks.length,
    recent: Math.min(inboxTasks.length, 3),
    pinned: stats.pinned,
    deferred: stats.deferred,
    high: inboxTasks.filter(inboxTask => inboxTask.resistance === 'high').length,
    medium: inboxTasks.filter(inboxTask => inboxTask.resistance === 'medium').length,
    low: inboxTasks.filter(inboxTask => inboxTask.resistance === 'low').length,
  };

  const filteredTasks = (() => {
    switch (activeTab) {
      case 'recent':
        return [...inboxTasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);
      case 'pinned':
        return inboxTasks.filter((t) => t.isPinned);
      case 'deferred':
        return inboxTasks.filter((t) => (t.deferredUntil ?? null) !== null && (t.deferredUntil ?? '') > stats.todayISO);
      case 'high':
        return inboxTasks.filter(inboxTask => inboxTask.resistance === 'high');
      case 'medium':
        return inboxTasks.filter(inboxTask => inboxTask.resistance === 'medium');
      case 'low':
        return inboxTasks.filter(inboxTask => inboxTask.resistance === 'low');
      default:
        return [...inboxTasks].sort((a, b) => {
          const aPinned = a.isPinned === true;
          const bPinned = b.isPinned === true;
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;

          const aDeferred = (a.deferredUntil ?? null) !== null && (a.deferredUntil ?? '') > stats.todayISO;
          const bDeferred = (b.deferredUntil ?? null) !== null && (b.deferredUntil ?? '') > stats.todayISO;
          if (!aDeferred && bDeferred) return -1;
          if (aDeferred && !bDeferred) return 1;

          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }
  })();

  // HUD 진행률 계산
  const progressPercent = dailyGoalCount > 0 
    ? Math.min(100, Math.round((todayProcessedCount / dailyGoalCount) * 100)) 
    : 0;
  const isGoalAchieved = todayProcessedCount >= dailyGoalCount;

  const renderTabs = () => {
    const tabs: Array<{ id: typeof activeTab; label: string }> = [
      { id: 'all', label: '전체' },
      { id: 'recent', label: '최근' },
      { id: 'pinned', label: '고정' },
      { id: 'deferred', label: '보류' },
      { id: 'high', label: 'High' },
      { id: 'medium', label: 'Medium' },
      { id: 'low', label: 'Low' },
    ];
    return (
      <div className="flex items-center gap-1 px-1 py-1 text-[11px] overflow-x-auto whitespace-nowrap scrollbar-none">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold transition ${
              activeTab === tab.id
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>{tab.label}</span>
            <span className="rounded-full bg-[var(--color-bg-elevated)] px-1 py-0.5 text-[10px] font-bold text-[var(--color-text)]">
              {counts[tab.id]}
            </span>
          </button>
        ))}
      </div>
    );
  };

  // ========================================================================
  // 미니 HUD 렌더링
  // ========================================================================
  const renderHUD = () => (
    <div className="mx-3 mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setHudCollapsed(!hudCollapsed)}
          className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
        >
          <span className={`transition-transform ${hudCollapsed ? '' : 'rotate-90'}`}>▶</span>
          <span>정리 진행도</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px]">
            {stats.pinned > 0 && (
              <span className="text-amber-500" title="고정">
                📌 {stats.pinned}
              </span>
            )}
            {stats.deferred > 0 && (
              <span className="text-[var(--color-text-quaternary)]" title="보류">
                ⏸️ {stats.deferred}
              </span>
            )}
            <span className="text-[var(--color-text-tertiary)]" title="처리 대기">
              📥 {stats.actionable}
            </span>
          </div>
          {isGoalAchieved && <span className="text-[10px] text-emerald-500 font-medium">달성!</span>}
        </div>
      </div>

      {!hudCollapsed && (
        <div className="mt-2 space-y-2">
          {/* 진행률 바 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${isGoalAchieved ? 'bg-emerald-500' : 'bg-[var(--color-primary)]'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-medium text-[var(--color-text-secondary)] min-w-[40px] text-right">
              {todayProcessedCount}/{dailyGoalCount}
            </span>
          </div>

          {/* 목표 설정 */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-text-tertiary)]">오늘 목표</span>
            <div className="flex items-center gap-1">
              {[3, 5, 10, 15].map((goal) => (
                <button
                  key={goal}
                  onClick={() => setDailyGoalCount(goal)}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                    dailyGoalCount === goal
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                  }`}
                >
                  {goal}개
                </button>
              ))}
            </div>
          </div>

          {/* Triage 모드 토글 */}
          <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              Triage 모드 <span className="text-[var(--color-text-quaternary)]">(키보드 루프)</span>
            </span>
            <button
              onClick={() => setTriageEnabled(!triageEnabled)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                triageEnabled
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
              }`}
            >
              {triageEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ========================================================================
  // Today/Tomorrow/NextSlot 버튼 렌더링
  // ========================================================================
  const renderQuickPlaceButtons = (taskId: string) => (
    <div className="flex items-center gap-1 px-1">
      <span className="text-[10px] text-[var(--color-text-tertiary)] mr-1">⚡</span>
      <button
        onClick={() => handleQuickPlace(taskId, 'today')}
        className="rounded px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)] bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-600 transition-colors"
        title="오늘 배치 (T)"
      >
        Today
      </button>
      <button
        onClick={() => handleQuickPlace(taskId, 'tomorrow')}
        className="rounded px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)] bg-purple-500/10 hover:bg-purple-500/20 hover:text-purple-600 transition-colors"
        title="내일 배치 (O)"
      >
        Tomorrow
      </button>
      <button
        onClick={() => handleQuickPlace(taskId, 'next')}
        className="rounded px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)] bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-600 transition-colors"
        title="다음 슬롯 배치 (N)"
      >
        Next
      </button>
    </div>
  );

  // ========================================================================
  // Pin / 보류 버튼 렌더링
  // ========================================================================
  const renderTriageButtons = (task: Task) => {
    const isDeferred = (task.deferredUntil ?? null) !== null && (task.deferredUntil ?? '') > stats.todayISO;

    return (
      <div className="flex items-center gap-1 px-1">
        <span className="text-[10px] text-[var(--color-text-tertiary)] mr-1">🏷️</span>
        <button
          onClick={async () => {
            try {
              await updateTask(task.id, { isPinned: !task.isPinned });
              notify.info(task.isPinned ? '고정 해제됨' : '📌 고정됨');
            } catch (error) {
              console.error('Failed to toggle pin:', error);
              notify.error('고정 변경에 실패했습니다');
            }
          }}
          className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
            task.isPinned
              ? 'bg-amber-500/20 text-amber-600'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-amber-500/10 hover:text-amber-600'
          }`}
          title={task.isPinned ? '고정 해제 (P)' : '고정 (P)'}
        >
          {task.isPinned ? '📌 고정' : '고정'}
        </button>
        <button
          onClick={async () => {
            try {
              if (isDeferred) {
                await updateTask(task.id, { deferredUntil: null });
                notify.info('보류 해제됨');
                return;
              }

              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              await updateTask(task.id, { deferredUntil: getLocalDate(tomorrow) });
              notify.info('⏸️ 내일까지 보류');
            } catch (error) {
              console.error('Failed to toggle defer:', error);
              notify.error('보류 변경에 실패했습니다');
            }
          }}
          className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
            isDeferred
              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-quaternary)]'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
          }`}
          title={isDeferred ? '보류 해제 (H)' : '내일까지 보류 (H)'}
        >
          {isDeferred ? '⏸️ 보류' : '보류'}
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-base)]">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-[var(--color-text)]">📥 인박스</h3>
          <span className="rounded-full bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
            {inboxTasks.length}
          </span>
        </div>
        <button
          className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-md active:scale-95"
          onClick={handleAddTask}
        >
          <span>+</span>
          <span>추가</span>
        </button>
      </div>

      <div
        className={tabContentClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 미니 HUD - 정리 진행도 */}
        {renderHUD()}

        {renderTabs()}

        {/* 인라인 빠른 추가 입력창 */}
        <div className="mb-3">
          <input
            type="text"
            value={inlineInputValue}
            onChange={(e) => setInlineInputValue(e.target.value)}
            onKeyDown={handleInlineInputKeyDown}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="작업을 입력하고 Enter로 추가하세요 (기본 15분)"
            className="w-full rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-[var(--color-bg-elevated)] focus:shadow-sm"
          />
        </div>

        {/* Triage 모드 안내 */}
        {triageEnabled && inboxTasks.length > 0 && (
          <div className="mx-0 mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-400">
            <div className="flex items-center gap-2">
              <span>⌨️</span>
              <span>
                <strong>Triage 모드</strong>: ↑↓ 이동 | T/O/N 배치 | P 고정 | H 보류 | d 삭제 | Enter 편집 | ESC 종료
              </span>
            </div>
          </div>
        )}

        {inboxTasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-2xl">
              📭
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">인박스가 비어있습니다</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                할 일을 추가하거나<br />시간표에서 드래그하여 보관하세요
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {filteredTasks.map(task => {
              const isFocused = triageEnabled && focusedTaskId === task.id;

              return (
                <div 
                  key={task.id} 
                  className={`space-y-1 rounded-lg transition-all ${
                    isFocused 
                      ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-[var(--color-bg-base)] bg-emerald-500/5' 
                      : ''
                  }`}
                >
                  <TaskCard
                    task={task}
                    onEdit={() => handleEditTask(task)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onToggle={() => handleToggleTask(task.id)}
                    onUpdateTask={(updates) => updateTask(task.id, updates)}
                    onDragEnd={() => {
                      setTimeout(() => loadData(), 300);
                    }}
                    compact
                  />
                  {/* Today/Tomorrow/Next 빠른 배치 버튼 */}
                  {renderQuickPlaceButtons(task.id)}
                  {/* 고정/보류 상태 버튼 */}
                  {renderTriageButtons(task)}
                  {/* 기존 시간대 빠른 배치 버튼 */}
                  <div className="flex items-center gap-1 px-1">
                    <span className="text-[10px] text-[var(--color-text-tertiary)] mr-1">⏰</span>
                    {TIME_BLOCKS.map(block => (
                      <button
                        key={block.id}
                        onClick={async () => {
                          try {
                            await placeTaskToSlot(task.id, getLocalDate(), block.id as TimeBlockId, block.start);
                            notify.placement(`${block.label}에 배치됨`);
                          } catch (err) {
                            console.error('Failed to assign to block:', err);
                            notify.error('시간대 배치 실패');
                          }
                        }}
                        className="rounded px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-primary)]/20 hover:text-[var(--color-primary)] transition-colors"
                        title={`${block.label}에 배치`}
                      >
                        {block.start}-{block.end}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <TaskModal
          task={editingTask}
          initialBlockId={null} // Inbox tasks don't have a specific block initially
          onSave={handleSaveTask}
          onSaveMultiple={handleSaveMultipleTasks}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTask(null);
          }}
          source="inbox"
        />
      )}
    </div>
  );
}

// 섹션별 렌더링 (최근/난이도)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function renderGroupedTasks(
  tasks: Task[],
  onEdit: (task: Task) => void,
  onDelete: (id: string) => void,
  onToggle: (id: string) => void,
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>,
  refresh: () => Promise<void>
) {
  if (tasks.length === 0) return null;

  const sorted = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recent = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const byResistance = rest.reduce<Record<'high' | 'medium' | 'low', Task[]>>((groupedTasks, task) => {
    groupedTasks[task.resistance]?.push(task);
    return groupedTasks;
  }, { high: [], medium: [], low: [] });

  const section = (title: string, list: Task[]) => (
    list.length > 0 && (
      <div key={title} className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.08em] px-1">
          <span className="h-px w-6 bg-[var(--color-border)]" />
          <span>{title}</span>
        </div>
        <div className="flex flex-col gap-3">
          {list.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task.id)}
              onToggle={() => onToggle(task.id)}
              onUpdateTask={(updates) => onUpdateTask(task.id, updates)}
              onDragEnd={() => {
                setTimeout(() => refresh(), 300);
              }}
              compact
            />
          ))}
        </div>
      </div>
    )
  );

  return (
    <>
      {section('최근 추가', recent)}
      {section('High 난이도', byResistance.high)}
      {section('Medium 난이도', byResistance.medium)}
      {section('Low 난이도', byResistance.low)}
    </>
  );
}

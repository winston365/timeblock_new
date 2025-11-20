/**
 * ScheduleView
 *
 * @role 타임블록 기반 일일 스케줄러 메인 화면. 시간대별 작업 관리
 * @input 없음 (훅으로 데이터 로드)
 * @output 타임블록 그리드, 작업 모달
 * @external_dependencies
 *   - useDailyData: 일일 데이터 및 CRUD 훅
 *   - TimeBlock: 개별 타임블록 컴포넌트
 *   - TaskModal: 작업 추가/수정 모달
 */

import { useState, useEffect } from 'react';
import { useDailyData } from '@/shared/hooks';
import { useGameState } from '@/shared/hooks/useGameState';
import { TIME_BLOCKS } from '@/shared/types/domain';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { useFocusModeStore } from './stores/focusModeStore';
import { generateId } from '@/shared/lib/utils';
import { db } from '@/data/db/dexieClient';
import TimeBlock from './TimeBlock';
import TaskModal from './TaskModal';
import { FocusView } from './components/FocusView';

/**
 * 타임블록 스케줄러 메인 화면
 *
 * @returns {JSX.Element} 스케줄 뷰
 * @sideEffects
 *   - 1분마다 현재 시간 업데이트
 *   - 지난 블록의 미완료 작업 자동 인박스 이동
 */
export default function ScheduleView() {
  const { dailyData, loading, addTask, updateTask, deleteTask, toggleTaskCompletion, toggleBlockLock, updateBlockState } = useDailyData();
  const { updateQuestProgress } = useGameState();
  const { show: showWaifu } = useWaifuCompanionStore();
  const { isFocusMode, toggleFocusMode } = useFocusModeStore();
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<TimeBlockId>(null);

  // 1시간 단위로 현재 시간 업데이트 (블록 활성화 상태용)
  useEffect(() => {
    const updateTime = () => {
      setCurrentHour(new Date().getHours());
    };

    updateTime(); // 초기 실행
    const interval = setInterval(updateTime, 60 * 1000); // 1분 (시간 변경 감지)

    return () => clearInterval(interval);
  }, []);

  // 현재 시간대 블록 감지
  const getCurrentBlockId = (): TimeBlockId => {
    const hour = currentHour;
    const block = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
    return block ? (block.id as TimeBlockId) : null;
  };

  const currentBlockId = getCurrentBlockId();

  // 활성 블록 강조 표시 업데이트
  // 지난 블록의 미완료 작업을 인박스로 이동
  useEffect(() => {
    const movePastIncompleteTasks = async () => {
      if (!dailyData) return;

      const currentTime = new Date();
      const currentHourValue = currentTime.getHours();

      // 지난 블록 찾기 (현재 시간보다 종료 시간이 이전인 블록)
      const pastBlocks = TIME_BLOCKS.filter(block => currentHourValue >= block.end);

      // 지난 블록의 미완료 작업 찾기 및 실패 플래그 설정
      const tasksToMove: Task[] = [];
      for (const block of pastBlocks) {
        const incompleteTasks = dailyData.tasks.filter(
          task => task.timeBlock === block.id && !task.completed
        );

        // 잠긴 블록에 미완료 작업이 있으면 실패 플래그 설정
        const blockState = dailyData.timeBlockStates[block.id];
        if (blockState?.isLocked && incompleteTasks.length > 0 && !blockState.isFailed) {
          try {
            // 실패 플래그 직접 설정
            const { updateBlockState } = await import('@/data/repositories/dailyDataRepository');
            await updateBlockState(block.id, { isFailed: true });
          } catch (error) {
            console.error(`Failed to set isFailed for block ${block.id}:`, error);
          }
        }

        tasksToMove.push(...incompleteTasks);
      }

      // 미완료 작업을 인박스로 이동 (timeBlock을 null로 설정)
      for (const task of tasksToMove) {
        try {
          await updateTask(task.id, { timeBlock: null }, { skipBehaviorTracking: true });
        } catch (error) {
          console.error(`Failed to move task ${task.id} to inbox:`, error);
        }
      }
    };

    movePastIncompleteTasks();
  }, [currentHour, dailyData, updateTask]);

  useEffect(() => {
    if (!dailyData) return;
    const missingBlocks = TIME_BLOCKS.filter(block => !dailyData.timeBlockStates[block.id]);
    if (missingBlocks.length === 0) return;

    (async () => {
      for (const block of missingBlocks) {
        try {
          await updateBlockState(block.id as TimeBlockId, {
            isLocked: false,
            isPerfect: false,
            isFailed: false,
          });
        } catch (error) {
          console.error('Failed to initialize block state:', error);
        }
      }
    })();
  }, [dailyData, updateBlockState]);

  // 작업 추가 모달 열기
  const handleAddTask = (blockId: TimeBlockId) => {
    setSelectedBlockId(blockId);
    setEditingTask(null);
    setIsModalOpen(true);
  };

  // 인라인 작업 생성 (기본값: 15분, 쉬움)
  const handleCreateTask = async (text: string, blockId: TimeBlockId, hourSlot?: number) => {
    try {
      // hourSlot이 지정되지 않으면 블록의 첫 번째 시간대 사용
      const block = TIME_BLOCKS.find(b => b.id === blockId);
      const targetHour = hourSlot ?? (block ? block.start : undefined);

      const newTask: Task = {
        id: generateId('task'),
        text: text.trim(),
        memo: '',
        baseDuration: 15,  // 30분 -> 15분으로 변경
        resistance: 'low',
        adjustedDuration: 15,  // 30분 -> 15분으로 변경
        timeBlock: blockId,
        hourSlot: targetHour, // 지정된 시간대 또는 첫 번째 시간대에 배치
        completed: false,
        actualDuration: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      await addTask(newTask);

      // 와이푸 반응: 작업 추가
      showWaifu(`"${text.trim()}" 추가했어! 화이팅! 💪`);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  };

  // 작업 편집 모달 열기
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setSelectedBlockId(task.timeBlock);
    setIsModalOpen(true);
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    setSelectedBlockId(null);
  };

  // 작업 저장 (추가 또는 수정)
  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        // 수정
        await updateTask(editingTask.id, taskData);

        // 수정 후에도 준비된 작업인지 확인 (이전에 준비되지 않았다면 퀘스트 진행)
        const wasPrepared = !!(editingTask.preparation1 && editingTask.preparation2 && editingTask.preparation3);
        const isNowPrepared = !!(taskData.preparation1 && taskData.preparation2 && taskData.preparation3);

        if (!wasPrepared && isNowPrepared) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      } else {
        // 추가 - 블록의 첫 번째 시간대 찾기
        const block = TIME_BLOCKS.find(b => b.id === selectedBlockId);
        const firstHour = block ? block.start : undefined;

        const newTask: Task = {
          id: generateId('task'),
          text: taskData.text || '',
          memo: taskData.memo || '',
          baseDuration: taskData.baseDuration || 30,
          resistance: taskData.resistance || 'low',
          adjustedDuration: taskData.adjustedDuration || 30,
          timeBlock: selectedBlockId,
          hourSlot: firstHour, // 첫 번째 시간대에 배치
          completed: false,
          actualDuration: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
          preparation1: taskData.preparation1 || '',
          preparation2: taskData.preparation2 || '',
          preparation3: taskData.preparation3 || '',
          goalId: taskData.goalId || null,
        };
        await addTask(newTask);

        // 준비된 작업이면 퀘스트 진행
        const isPrepared = !!(taskData.preparation1 && taskData.preparation2 && taskData.preparation3);
        if (isPrepared) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      }
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('작업 저장에 실패했습니다.');
    }
  };

  // 작업 삭제
  const handleDeleteTask = async (taskId: string) => {
    try {
      // 삭제할 작업 정보 가져오기
      const task = dailyData?.tasks.find(t => t.id === taskId);
      const taskName = task?.text || '작업';

      await deleteTask(taskId);

      // 와이푸 반응: 작업 삭제
      showWaifu(`"${taskName}" 삭제했어. 괜찮아? 🤔`);
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert(error instanceof Error ? error.message : '작업 삭제에 실패했습니다.');
    }
  };

  // 작업 완료 토글
  const handleToggleTask = async (taskId: string) => {
    try {
      await toggleTaskCompletion(taskId);
    } catch (error) {
      console.error('Failed to toggle task:', error);
      alert('작업 상태 변경에 실패했습니다.');
    }
  };

  // 작업 인라인 업데이트 (난이도, 시간 등)
  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask(taskId, updates);
    } catch (error) {
      console.error('Failed to update task:', error);
      alert(error instanceof Error ? error.message : '작업 수정에 실패했습니다.');
    }
  };

  // 블록 잠금 토글
  const handleToggleLock = async (blockId: string) => {
    if (!dailyData) return;

    try {
      await toggleBlockLock(blockId);
    } catch (error) {
      console.error('Failed to toggle lock:', error);
      alert(error instanceof Error ? error.message : '블록 잠금 상태 변경에 실패했습니다.');
    }
  };

  // 작업 이동 (드래그 앤 드롭)
  const handleDropTask = async (taskId: string, targetBlockId: TimeBlockId) => {
    if (!dailyData) return;

    try {
      // 1. dailyData에서 작업 찾기
      let task = dailyData.tasks.find((t) => t.id === taskId);

      // 2. dailyData에 없으면 globalInbox에서 찾기
      if (!task) {
        task = await db.globalInbox.get(taskId);
      }

      if (!task) {
        console.error('Task not found:', taskId);
        return;
      }

      // 같은 블록이면 무시
      if (task.timeBlock === targetBlockId) {
        return;
      }

      // 블록의 첫 번째 시간대 찾기
      const block = TIME_BLOCKS.find(b => b.id === targetBlockId);
      if (!block) {
        console.error('Target block not found:', targetBlockId);
        return;
      }

      // 작업 이동 (updateTask가 자동으로 inbox↔timeblock 이동 처리 + refresh)
      // ✅ hourSlot을 명시적으로 블록의 첫 시간대로 설정 (UI 표시 보장)
      await updateTask(taskId, { timeBlock: targetBlockId, hourSlot: block.start });
    } catch (error) {
      console.error('Failed to move task:', error);
      alert('작업 이동에 실패했습니다.');
    }
  };

  // 여러 작업 일괄 추가
  const handleSaveMultipleTasks = async (tasks: Partial<Task>[]) => {
    if (!selectedBlockId) return;

    try {
      // 순차적으로 작업 추가
      for (const taskData of tasks) {
        const block = TIME_BLOCKS.find(b => b.id === selectedBlockId);
        const firstHour = block ? block.start : undefined;

        const newTask: Task = {
          id: generateId('task'),
          text: taskData.text || '새 작업',
          memo: taskData.memo || '',
          baseDuration: taskData.baseDuration || 15,
          resistance: taskData.resistance || 'low',
          adjustedDuration: taskData.adjustedDuration || 15,
          timeBlock: selectedBlockId,
          hourSlot: firstHour,
          completed: false,
          actualDuration: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
          preparation1: taskData.preparation1 || '',
          preparation2: taskData.preparation2 || '',
          preparation3: taskData.preparation3 || '',
          goalId: taskData.goalId || null,
        };
        await addTask(newTask);

        // 준비된 작업이면 퀘스트 진행
        const isPrepared = !!(newTask.preparation1 && newTask.preparation2 && newTask.preparation3);
        if (isPrepared) {
          await updateQuestProgress('prepare_tasks', 1);
        }
      }
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save multiple tasks:', error);
      alert('작업 일괄 추가에 실패했습니다.');
    }
  };

  // 첫 로딩 시에만 로딩 메시지 표시 (데이터 업데이트 시에는 UI 유지)
  if (loading && !dailyData) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)]">
          데이터 로딩 중...
        </div>
      </div>
    );
  }

  if (!dailyData) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)]">
          데이터를 불러오지 못했습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 pb-24">
      {/* Toggle button */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">
          {isFocusMode ? '🎯 지금 집중' : '오늘의 타임블록'}
        </h2>
        <div className="flex items-center gap-4">
          {!isFocusMode && (
            <div className="flex gap-4 text-sm text-[var(--color-text-secondary)]">
              <span>전체 {dailyData.tasks.length}개</span>
              <span>완료 {dailyData.tasks.filter(t => t.completed).length}개</span>
            </div>
          )}
          <button
            onClick={toggleFocusMode}
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-all ${isFocusMode
                ? 'bg-[var(--color-primary)] text-white shadow-lg'
                : 'border-2 border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)]'
              }`}
          >
            {isFocusMode ? (
              <>
                <span>📅</span>
                <span>전체 보기</span>
              </>
            ) : (
              <>
                <span>🎯</span>
                <span>지금 모드</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Conditional rendering: Focus Mode or Full Grid */}
      {isFocusMode ? (
        currentBlockId ? (
          <FocusView
            currentBlockId={currentBlockId}
            tasks={dailyData.tasks.filter(t => t.timeBlock === currentBlockId)}
            onEditTask={handleEditTask}
            onToggleTask={handleToggleTask}
            onToggleLock={() => handleToggleLock(currentBlockId)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)] p-12">
            <div className="text-center">
              <div className="text-6xl">⏰</div>
              <h3 className="mt-4 text-2xl font-bold text-[var(--color-text-primary)]">
                블록 외 시간
              </h3>
              <p className="mt-2 text-lg text-[var(--color-text-secondary)]">
                타임블록 시간대가 아닙니다
              </p>
              <button
                onClick={toggleFocusMode}
                className="mt-6 rounded-full bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-all hover:scale-105"
              >
                📅 전체 보기로 전환
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {TIME_BLOCKS.map(block => {
            const blockTasks = dailyData.tasks.filter(task => task.timeBlock === block.id);
            const blockState = dailyData.timeBlockStates[block.id];
            const isCurrentBlock = block.id === currentBlockId;
            const isPastBlock = currentHour >= block.end;

            return (
              <TimeBlock
                key={block.id}
                block={block}
                tasks={blockTasks}
                state={blockState}
                isCurrentBlock={isCurrentBlock}
                isPastBlock={isPastBlock}
                onAddTask={() => handleAddTask(block.id as TimeBlockId)}
                onCreateTask={handleCreateTask}
                onEditTask={handleEditTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onToggleTask={handleToggleTask}
                onToggleLock={() => handleToggleLock(block.id)}
                onUpdateBlockState={updateBlockState}
                onDropTask={handleDropTask}
              />
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <TaskModal
          task={editingTask}
          initialBlockId={selectedBlockId}
          onSave={handleSaveTask}
          onSaveMultiple={handleSaveMultipleTasks}
          onClose={handleCloseModal}
          source="schedule"
        />
      )}
    </div>
  );
}

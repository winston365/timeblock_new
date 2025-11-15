/**
 * ScheduleView
 *
 * @role 타임블록 기반 일일 스케줄러 메인 화면. 시간대별 작업 관리 및 현재 시간 인디케이터 표시
 * @input 없음 (훅으로 데이터 로드)
 * @output 타임블록 그리드, 현재 시간 인디케이터, 작업 모달
 * @external_dependencies
 *   - useDailyData: 일일 데이터 및 CRUD 훅
 *   - TimeBlock: 개별 타임블록 컴포넌트
 *   - TaskModal: 작업 추가/수정 모달
 */

import { useState, useEffect, useRef } from 'react';
import { useDailyData } from '@/shared/hooks';
import { TIME_BLOCKS } from '@/shared/types/domain';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import TimeBlock from './TimeBlock';
import TaskModal from './TaskModal';
import './schedule.css';

/**
 * 타임블록 스케줄러 메인 화면
 *
 * @returns {JSX.Element} 스케줄 뷰
 * @sideEffects
 *   - 1분마다 현재 시간 업데이트
 *   - 현재 시간 인디케이터 위치 계산 및 표시
 *   - 지난 블록의 미완료 작업 자동 인박스 이동
 *   - ResizeObserver로 블록 크기 변화 감지
 */
export default function ScheduleView() {
  const { dailyData, loading, addTask, updateTask, deleteTask, toggleTaskCompletion, toggleBlockLock } = useDailyData();
  const { show: showWaifu } = useWaifuCompanionStore();
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [currentMinute, setCurrentMinute] = useState(new Date().getMinutes());
  const [indicatorPosition, setIndicatorPosition] = useState<number | null>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<TimeBlockId>(null);

  // 1분 단위로 현재 시간 업데이트
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentHour(now.getHours());
      setCurrentMinute(now.getMinutes());
    };

    updateTime(); // 초기 실행
    const interval = setInterval(updateTime, 60 * 1000); // 1분

    return () => clearInterval(interval);
  }, []);

  // 현재 시간대 블록 감지
  const getCurrentBlockId = (): TimeBlockId => {
    const hour = currentHour;
    const block = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
    return block ? (block.id as TimeBlockId) : null;
  };

  const currentBlockId = getCurrentBlockId();

  // 현재 시간 인디케이터 위치 계산
  useEffect(() => {
    const calculateIndicatorPosition = () => {
      if (!scheduleRef.current) return null;

      const now = new Date();
      const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

      // 현재 시간대 블록 찾기
      const currentBlock = TIME_BLOCKS.find(
        b => currentTotalMinutes >= b.start * 60 && currentTotalMinutes < b.end * 60
      );

      if (!currentBlock) {
        setIndicatorPosition(null);
        return;
      }

      // 현재 블록의 DOM 요소 찾기
      const blockElement = scheduleRef.current.querySelector(
        `.time-block[data-block-id="${currentBlock.id}"]`
      ) as HTMLElement;

      if (!blockElement) {
        setIndicatorPosition(null);
        return;
      }

      // 블록 시작/종료 시간 (분 단위)
      const blockStartMinutes = currentBlock.start * 60;
      const blockEndMinutes = currentBlock.end * 60;

      // 블록 내 경과 시간 비율
      const elapsedMinutes = currentTotalMinutes - blockStartMinutes;
      const totalBlockMinutes = blockEndMinutes - blockStartMinutes;
      const progressRatio = elapsedMinutes / totalBlockMinutes;

      // 블록의 위치와 높이
      const scheduleTop = scheduleRef.current.getBoundingClientRect().top;
      const blockTop = blockElement.getBoundingClientRect().top;
      const blockHeight = blockElement.offsetHeight;

      // 스케줄 영역 기준 상대 위치
      const relativeBlockTop = blockTop - scheduleTop;

      // 최종 인디케이터 위치 (스케줄 영역 상단 기준)
      const position = relativeBlockTop + (blockHeight * progressRatio);

      setIndicatorPosition(position);
    };

    calculateIndicatorPosition();

    // ResizeObserver로 블록 크기 변화 감지
    const resizeObserver = new ResizeObserver(() => {
      calculateIndicatorPosition();
    });

    if (scheduleRef.current) {
      const blocks = scheduleRef.current.querySelectorAll('.time-block');
      blocks.forEach(block => resizeObserver.observe(block));
    }

    return () => resizeObserver.disconnect();
  }, [currentHour, currentMinute, dailyData]);

  // 활성 블록 강조 표시 업데이트
  useEffect(() => {
    const updateActiveBlock = (hour: number) => {
      const allActiveBlocks = document.querySelectorAll('.time-block.active-block');
      allActiveBlocks.forEach(blockElement => {
        blockElement.classList.remove('active-block');
      });

      const activeBlock = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);

      if (activeBlock) {
        const targetElement = document.querySelector(`.time-block[data-block-id="${activeBlock.id}"]`);
        if (targetElement) {
          targetElement.classList.add('active-block');
        }
      }
    };

    updateActiveBlock(currentHour);
  }, [currentHour]);

  // 지난 블록의 미완료 작업을 인박스로 이동
  useEffect(() => {
    const movePastIncompleteTasks = async () => {
      if (!dailyData) return;

      const currentTime = new Date();
      const currentHourValue = currentTime.getHours();

      // 지난 블록 찾기 (현재 시간보다 종료 시간이 이전인 블록)
      const pastBlocks = TIME_BLOCKS.filter(block => currentHourValue >= block.end);

      // 지난 블록의 미완료 작업 찾기
      const tasksToMove: Task[] = [];
      for (const block of pastBlocks) {
        const incompleteTasks = dailyData.tasks.filter(
          task => task.timeBlock === block.id && !task.completed
        );
        tasksToMove.push(...incompleteTasks);
      }

      // 미완료 작업을 인박스로 이동 (timeBlock을 null로 설정)
      for (const task of tasksToMove) {
        try {
          await updateTask(task.id, { timeBlock: null });
        } catch (error) {
          console.error(`Failed to move task ${task.id} to inbox:`, error);
        }
      }
    };

    movePastIncompleteTasks();
  }, [currentHour, dailyData, updateTask]);

  // 작업 추가 모달 열기
  const handleAddTask = (blockId: TimeBlockId) => {
    setSelectedBlockId(blockId);
    setEditingTask(null);
    setIsModalOpen(true);
  };

  // 인라인 작업 생성 (기본값: 15분, 쉬움)
  const handleCreateTask = async (text: string, blockId: TimeBlockId) => {
    try {
      const newTask: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: text.trim(),
        memo: '',
        baseDuration: 15,  // 30분 -> 15분으로 변경
        resistance: 'low',
        adjustedDuration: 15,  // 30분 -> 15분으로 변경
        timeBlock: blockId,
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
      } else {
        // 추가
        const newTask: Task = {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: taskData.text || '',
          memo: taskData.memo || '',
          baseDuration: taskData.baseDuration || 30,
          resistance: taskData.resistance || 'low',
          adjustedDuration: taskData.adjustedDuration || 30,
          timeBlock: selectedBlockId,
          completed: false,
          actualDuration: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
        };
        await addTask(newTask);
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
      alert('작업 삭제에 실패했습니다.');
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
      alert('작업 수정에 실패했습니다.');
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
      // 작업 찾기
      const task = dailyData.tasks.find((t) => t.id === taskId);
      if (!task) {
        console.error('Task not found:', taskId);
        return;
      }

      // 같은 블록이면 무시
      if (task.timeBlock === targetBlockId) {
        return;
      }

      // 작업 이동
      await updateTask(taskId, { timeBlock: targetBlockId });
    } catch (error) {
      console.error('Failed to move task:', error);
      alert('작업 이동에 실패했습니다.');
    }
  };

  // 첫 로딩 시에만 로딩 메시지 표시 (데이터 업데이트 시에는 UI 유지)
  if (loading && !dailyData) {
    return (
      <div className="schedule-view">
        <div className="loading-message">데이터 로딩 중...</div>
      </div>
    );
  }

  if (!dailyData) {
    return (
      <div className="schedule-view">
        <div className="error-message">데이터를 불러올 수 없습니다.</div>
      </div>
    );
  }

  // 현재 시간 포맷팅 (HH:MM)
  const formatCurrentTime = () => {
    const hour = currentHour.toString().padStart(2, '0');
    const minute = currentMinute.toString().padStart(2, '0');
    return `${hour}:${minute}`;
  };

  return (
    <div className="schedule-view">
      <div className="schedule-header">
        <h2>📅 오늘의 타임블럭</h2>
        <div className="schedule-stats">
          <span>전체 {dailyData.tasks.length}개</span>
          <span>완료 {dailyData.tasks.filter(t => t.completed).length}개</span>
        </div>
      </div>

      <div className="timeblocks-grid" ref={scheduleRef}>
        {/* 현재 시간 인디케이터 */}
        {indicatorPosition !== null && (
          <div
            className="global-time-indicator"
            style={{
              top: `${indicatorPosition}px`,
            }}
          >
            <div className="time-indicator-line" />
            <div className="time-indicator-label">
              <span className="time-text">{formatCurrentTime()}</span>
            </div>
          </div>
        )}
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
              onDropTask={handleDropTask}
            />
          );
        })}
      </div>

      {isModalOpen && (
        <TaskModal
          task={editingTask}
          initialBlockId={selectedBlockId}
          onSave={handleSaveTask}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

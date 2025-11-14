/**
 * src/features/schedule/ScheduleView.tsx
 * 메인 타임블럭 스케줄러 화면
 */

import { useState, useEffect } from 'react';
import { useDailyData } from '@/shared/hooks';
import { TIME_BLOCKS } from '@/shared/types/domain';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import TimeBlock from './TimeBlock';
import TaskModal from './TaskModal';
import './schedule.css';

export default function ScheduleView() {
  const { dailyData, loading, addTask, updateTask, deleteTask, toggleTaskCompletion } = useDailyData();
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<TimeBlockId>(null);

  // 5분 단위로 현재 시간 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 5 * 60 * 1000); // 5분

    return () => clearInterval(interval);
  }, []);

  // 현재 시간대 블록 감지
  const getCurrentBlockId = (): TimeBlockId => {
    const hour = currentHour;
    const block = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
    return block ? (block.id as TimeBlockId) : null;
  };

  const currentBlockId = getCurrentBlockId();

  // 작업 추가 모달 열기
  const handleAddTask = (blockId: TimeBlockId) => {
    setSelectedBlockId(blockId);
    setEditingTask(null);
    setIsModalOpen(true);
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
    if (!confirm('이 작업을 삭제하시겠습니까?')) return;

    try {
      await deleteTask(taskId);
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

  // 블록 잠금 토글
  const handleToggleLock = async (blockId: string) => {
    if (!dailyData) return;

    // TODO: updateTimeBlockState 기능 구현 필요
    console.log('Toggle lock for block:', blockId);
    // try {
    //   const currentState = dailyData.timeBlockStates[blockId] || {
    //     isLocked: false,
    //     isPerfect: false,
    //     isFailed: false,
    //   };

    //   await updateTimeBlockState?.(blockId, {
    //     ...currentState,
    //     isLocked: !currentState.isLocked,
    //   });
    // } catch (error) {
    //   console.error('Failed to toggle lock:', error);
    //   alert('블록 잠금 상태 변경에 실패했습니다.');
    // }
  };

  if (loading) {
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

  return (
    <div className="schedule-view">
      <div className="schedule-header">
        <h2>📅 오늘의 타임블럭</h2>
        <div className="schedule-stats">
          <span>전체 {dailyData.tasks.length}개</span>
          <span>완료 {dailyData.tasks.filter(t => t.completed).length}개</span>
        </div>
      </div>

      <div className="timeblocks-grid">
        {TIME_BLOCKS.map(block => {
          const blockTasks = dailyData.tasks.filter(task => task.timeBlock === block.id);
          const blockState = dailyData.timeBlockStates[block.id];
          const isCurrentBlock = block.id === currentBlockId;

          return (
            <TimeBlock
              key={block.id}
              block={block}
              tasks={blockTasks}
              state={blockState}
              isCurrentBlock={isCurrentBlock}
              onAddTask={() => handleAddTask(block.id as TimeBlockId)}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onToggleTask={handleToggleTask}
              onToggleLock={() => handleToggleLock(block.id)}
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

/**
 * TimeBlock
 *
 * @role 시간대별 작업 목록을 표시하고 관리하는 타임블록 컴포넌트. 드래그앤드롭, 인라인 작업 생성, 잠금 기능 제공
 * @input block (시간대 정보), tasks (작업 목록), state (블록 상태), 각종 핸들러 함수들
 * @output 시간대 헤더, 작업 카드 목록, 인라인 입력 필드, 진행률 바를 포함한 블록 UI
 * @external_dependencies
 *   - TaskCard: 개별 작업 표시
 *   - utils: XP 계산 함수
 */

import { useState, memo } from 'react';
import type { Task, TimeBlockState, TimeBlockId } from '@/shared/types/domain';
import { useDragDrop } from './hooks/useDragDrop';
import { useFocusStore } from '@/shared/stores/focusStore';
import { useTimeBlockStats } from './hooks/useTimeBlockStats';
import { useTimeBlockCalculations } from './hooks/useTimeBlockCalculations';
import { useTimeBlockTimer } from './hooks/useTimeBlockTimer';
import { TimeBlockHeader } from './components/TimeBlockHeader';
import { TimeBlockStatus } from './components/TimeBlockStatus';
import { TimeBlockContent } from './components/TimeBlockContent';

interface TimeBlockProps {
  block: {
    id: string;
    label: string;
    start: number;
    end: number;
  };
  tasks: Task[];
  state: TimeBlockState;
  isCurrentBlock: boolean;
  isPastBlock?: boolean;
  onAddTask: () => void;
  onCreateTask?: (text: string, blockId: TimeBlockId, hourSlot?: number) => Promise<void>;
  onEditTask: (task: Task) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onToggleLock?: () => void;
  onUpdateBlockState?: (blockId: string, updates: Partial<TimeBlockState>) => Promise<void>;
  onDropTask?: (taskId: string, targetBlockId: TimeBlockId) => void;
}

/**
 * 타임블록 컴포넌트
 */
const TimeBlock = memo(function TimeBlock({
  block,
  tasks,
  state,
  isCurrentBlock,
  isPastBlock = false,
  onAddTask: _onAddTask,
  onCreateTask,
  onEditTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
  onToggleLock,
  onUpdateBlockState,
  onDropTask: _onDropTask,
}: TimeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentBlock);

  // 통합 드래그 앤 드롭 훅 사용
  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useDragDrop(
    block.id as TimeBlockId,
    undefined
  );

  const { toggleFocusMode } = useFocusStore();

  // Custom Hooks
  const { maxXP, totalDuration, completedDuration, pendingDuration } = useTimeBlockStats(tasks);

  const {
    timeRemaining,
    remainingMinutes,
    timeStatus,
    formatMinutesToHM
  } = useTimeBlockCalculations({
    block,
    isCurrentBlock,
    pendingDuration
  });

  const timer = useTimeBlockTimer({
    state,
    blockId: block.id,
    isLocked: state?.isLocked || false,
    onToggleLock,
    onUpdateBlockState,
    tasksCount: tasks.length
  });

  const handleTaskToggle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.completed) {
      if (!state?.isLocked) {
        alert('⚠️ 블록을 먼저 잠궈야 작업을 완료할 수 있습니다!\n\n블록 잠금 버튼(⚠️)을 눌러주세요. (비용: 15 XP)');
        return;
      }
    }
    onToggleTask(taskId);
  };

  const handleDropWrapper = async (e: React.DragEvent) => {
    if (!onUpdateTask) return;
    await handleDrop(e, async (taskId, updates) => {
      onUpdateTask(taskId, updates);
    });
  };

  const completionPercentage = totalDuration > 0 ? (completedDuration / totalDuration) * 100 : 0;

  // Solid & Minimal Design Classes
  const blockClassName = [
    'relative flex min-h-[72px] flex-col overflow-hidden rounded-xl border transition-all duration-300',
    // Solid Background
    'bg-[var(--color-bg-surface)]',
    // Border & Accent
    isCurrentBlock
      ? 'border-[var(--color-primary)] border-l-4 shadow-md'
      : 'border-[var(--color-border)] hover:border-[var(--color-border-light)]',
    // Past State
    isPastBlock ? 'opacity-60 grayscale-[0.5]' : '',
    // Drag State
    isDragOver ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-bg-base)]' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={blockClassName}
      data-block-id={block.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropWrapper}
    >
      <div className="relative z-10 flex flex-col">
        <TimeBlockHeader
          block={block}
          isCurrentBlock={isCurrentBlock}
          isPastBlock={isPastBlock}
          tasksCount={tasks.length}
          maxXP={maxXP}
          state={state}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onToggleLock={onToggleLock}
          toggleFocusMode={toggleFocusMode}
          timer={timer}
        >
          {isCurrentBlock && timeRemaining && (
            <TimeBlockStatus
              timeStatus={timeStatus}
              remainingMinutes={remainingMinutes}
              pendingDuration={pendingDuration}
              formatMinutesToHM={formatMinutesToHM}
            />
          )}
        </TimeBlockHeader>

        {/* Completion Bar (Thin Line) */}
        <div className="h-[2px] w-full bg-[var(--color-bg-tertiary)]">
          <div
            className="h-full bg-[var(--color-primary)] transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        <TimeBlockContent
          isExpanded={isExpanded}
          block={block}
          tasks={tasks}
          isPastBlock={isPastBlock}
          state={state}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onCreateTask={onCreateTask}
          onEditTask={onEditTask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onToggleTask={handleTaskToggle}
        />
      </div>
    </div>
  );
});

export default TimeBlock;

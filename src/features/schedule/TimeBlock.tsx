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

import { useState, useEffect, memo, useMemo } from 'react';
import type { Task, TimeBlockState, TimeBlockId, TimeSlotTagTemplate } from '@/shared/types/domain';
import { useDragDrop } from './hooks/useDragDrop';
import { useTimeBlockStats } from './hooks/useTimeBlockStats';
import { useTimeBlockCalculations } from './hooks/useTimeBlockCalculations';
import { useTimeBlockTimer } from './hooks/useTimeBlockTimer';
import { toast } from 'react-hot-toast';
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
  hourSlotTags?: Record<number, string | null>;
  tagTemplates?: TimeSlotTagTemplate[];
  recentTagIds?: string[];
  onSelectHourTag?: (hour: number, tagId: string | null) => void;
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
  onAddTask,
  onCreateTask,
  onEditTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
  onToggleLock,
  onUpdateBlockState,
  onDropTask: _onDropTask,
  hourSlotTags,
  tagTemplates,
  recentTagIds,
  onSelectHourTag,
}: TimeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentBlock);

  // 지난 블록은 자동으로 접어서 공간을 줄임
  useEffect(() => {
    if (isPastBlock) {
      setIsExpanded(false);
    }
  }, [isPastBlock]);

  // Perfect Plan Toast
  useEffect(() => {
    if (state?.isPerfect) {
      toast.custom((t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'
            } pointer-events-auto flex w-full max-w-md rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 text-white shadow-2xl ring-1 ring-black/5`}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl animate-bounce">👑</div>
            <div className="flex flex-col">
              <div className="text-lg font-bold text-white drop-shadow-md">
                Perfect Plan!
              </div>
              <div className="text-sm font-medium text-amber-100">
                완벽한 계획을 달성했습니다! (+40 XP)
              </div>
            </div>
          </div>
        </div>
      ), {
        duration: 4000,
        position: 'top-center',
        id: `perfect-plan-${block.id}`,
      });
    }
  }, [state?.isPerfect]);

  // 통합 드래그 앤 드롭 훅 사용
  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useDragDrop(
    block.id as TimeBlockId,
    undefined
  );

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
        toast('블록을 먼저 잠궈야 작업을 완료할 수 있습니다! (잠금 버튼 🔒 클릭)', {
          icon: '🔒',
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        });
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
  const blockDurationMinutes = Math.max((block.end - block.start) * 60, 1);
  const completedPortion = Math.min(completedDuration, blockDurationMinutes);
  const plannedPortion = Math.min(Math.max(pendingDuration, 0), blockDurationMinutes - completedPortion);
  const idlePortion = Math.max(blockDurationMinutes - (completedPortion + plannedPortion), 0);
  const completionSegments = [
    { key: 'completed', value: completedPortion, className: 'bg-[var(--color-primary)]', label: '완료' },
    { key: 'planned', value: plannedPortion, className: 'bg-amber-400/80', label: '진행 중' },
    { key: 'idle', value: idlePortion, className: 'bg-[var(--color-bg-tertiary)]/60', label: '대기' }
  ]
    .filter(segment => segment.value > 0)
    .map(segment => ({
      ...segment,
      width: `${(segment.value / blockDurationMinutes) * 100}%`
    }));
  const completionTooltip = `완료 ${formatMinutesToHM(completedDuration)} / 전체 ${formatMinutesToHM(blockDurationMinutes)}`;
  const timeRemainingLabel = timeRemaining?.text ?? formatMinutesToHM(remainingMinutes);
  const showAlertProgress = isCurrentBlock && (timeStatus === 'tight' || timeStatus === 'critical');
  const planLoadRatio = remainingMinutes > 0 ? pendingDuration / remainingMinutes : 0;
  const needsPlanBoost = planLoadRatio >= 1.6;
  const statusAccent = useMemo(() => ({
    plan_light: {
      spine: 'bg-sky-400',
      gradient: 'from-sky-400/25 via-sky-400/8 to-transparent'
    },
    comfortable: {
      spine: 'bg-emerald-400',
      gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent'
    },
    balanced: {
      spine: 'bg-indigo-400',
      gradient: 'from-indigo-500/20 via-indigo-500/5 to-transparent'
    },
    tight: {
      spine: 'bg-amber-400',
      gradient: 'from-amber-400/25 via-amber-400/5 to-transparent'
    },
    critical: {
      spine: 'bg-rose-500',
      gradient: 'from-rose-500/25 via-rose-500/5 to-transparent'
    }
  }), []);

  const accent = statusAccent[timeStatus] ?? statusAccent.balanced;

  // Updated container styles: subtle gradient glow + status spine
  const blockClassName = [
    'relative flex min-h-[72px] flex-col overflow-hidden rounded-2xl border transition-all duration-300',
    'bg-[var(--color-bg-surface)]',
    isCurrentBlock
      ? 'border-transparent shadow-[0_10px_30px_rgba(0,0,0,0.3)]'
      : 'border-[var(--color-border)] hover:border-[var(--color-border-light)]',
    isPastBlock ? 'pointer-events-none opacity-80 saturate-75' : 'hover:-translate-y-[1px]',
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
      {isCurrentBlock && (
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${accent.gradient}`} />
      )}
      <div
        className={`absolute inset-y-3 left-0 w-1 rounded-full ${isCurrentBlock ? accent.spine : 'bg-[var(--color-border)]'
          } ${isPastBlock ? 'opacity-40' : ''}`}
      />
      <div className="relative z-10 flex flex-col">
        <TimeBlockHeader
          block={block}
          isCurrentBlock={isCurrentBlock}
          isPastBlock={isPastBlock}
          tasksCount={tasks.length}
          maxXP={maxXP}
          state={state}
          timeStatus={timeStatus}
          timeRemainingLabel={timeRemainingLabel}
          completionPercentage={completionPercentage}
          needsPlanBoost={needsPlanBoost}
          planLoadRatio={planLoadRatio}
          onRequestAddTask={() => onAddTask()}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onToggleLock={onToggleLock}
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

        {showAlertProgress && (
          <div className="px-5 pb-3 pt-2">
            <div
              className="flex items-center gap-3"
              title={completionTooltip}
              aria-label={completionTooltip}
            >
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]/40">
                <div className="flex h-full w-full">
                  {completionSegments.length > 0 ? (
                    completionSegments.map(segment => (
                      <div
                        key={segment.key}
                        className={`h-full transition-all duration-500 ${segment.className}`}
                        style={{ width: segment.width }}
                        aria-label={`${segment.label} ${segment.width}`}
                      />
                    ))
                  ) : (
                    <div className="h-full w-full bg-transparent" />
                  )}
                </div>
              </div>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">
                {Math.round(completionPercentage) || 0}%
              </span>
            </div>
          </div>
        )}

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
        hourSlotTags={hourSlotTags}
        tagTemplates={tagTemplates}
        recentTagIds={recentTagIds}
        onSelectHourTag={onSelectHourTag}
      />
      </div>
    </div>
  );
});

export default TimeBlock;

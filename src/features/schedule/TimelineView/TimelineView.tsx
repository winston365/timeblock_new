/**
 * @file TimelineView.tsx
 * @role 하루 스케줄 타임라인 뷰 메인 컴포넌트
 * @responsibilities
 *   - 05:00~23:00 세로 타임라인 표시
 *   - 3시간 단위 구분선 (TIME_BLOCKS 경계)
 *   - 작업 블록 렌더링 (duration 기반 높이)
 *   - 현재 시간 빨간 마커 표시
 *   - 지난 블록 표시/숨기기 토글
 *   - 작업 클릭 시 TaskModal 열기
 *   - 드래그 앤 드롭으로 시간대 이동
 *   - 빈 시간대 클릭으로 작업 추가
 *   - 목표 연결 표시
 * @dependencies useTimelineData, TimelineTaskBlock, TaskModal, useDragDropManager
 */

import { memo, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  useTimelineData,
  TIMELINE_END_HOUR,
  HOUR_HEIGHT,
  BLOCK_BOUNDARIES,
  PIXELS_PER_MINUTE,
} from './useTimelineData';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useDragDropManager } from '@/features/schedule/hooks/useDragDropManager';
import { TIME_BLOCKS, type Task, type TimeBlockId } from '@/shared/types/domain';
import { generateId, getLocalDate } from '@/shared/lib/utils';
import { TASK_DEFAULTS } from '@/shared/constants/defaults';
import TimelineTaskBlock from './TimelineTaskBlock';
import TaskModal from '@/features/schedule/TaskModal';
import { useTempScheduleStore } from '@/features/tempSchedule/stores/tempScheduleStore';
import { getBlockById, getBlockDurationMinutes, getBlockIdFromHour as getBlockIdFromHourCore } from '@/shared/utils/timeBlockUtils';
import {
  clampHourSlotToBlock,
  formatBucketRangeLabel,
  getBucketStartHour,
  getSuggestedHourSlotForBlock,
  isBucketAtCapacity,
  MAX_TASKS_PER_BLOCK,
  normalizeDropTargetHourSlot,
} from '../utils/timeBlockBucket';

/** TIME_BLOCKS 블록 배경색 */
const BLOCK_BACKGROUND_COLORS: Record<number, string> = {
  5: 'bg-blue-500/5',
  8: 'bg-amber-500/5',
  11: 'bg-orange-500/5',
  14: 'bg-purple-500/5',
  17: 'bg-indigo-500/5',
  20: 'bg-blue-500/5',
};

/** 컨텍스트 메뉴 상태 */
interface ContextMenuState {
  x: number;
  y: number;
  task: Task;
}

/**
 * 타임라인 뷰 컴포넌트
 * 왼쪽 사이드바와 스케줄뷰 사이에 배치되는 하루 스케줄 시각화
 */
function TimelineViewComponent() {
  const { timelineItems, bucketGroups, totalHeight, visibleStartHour, showPastBlocks, toggleShowPastBlocks } = useTimelineData();
  const { updateTask, addTask, deleteTask } = useDailyDataStore();
  const dailyTasks = useDailyDataStore((state) => state.dailyData?.tasks ?? []);
  const { setDragData, getDragData } = useDragDropManager();

  const [currentTimePosition, setCurrentTimePosition] = useState<number | null>(null);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedHourSlot, setSelectedHourSlot] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<TimeBlockId>(null);

  // 드래그 상태
  const [dragOverBucketStart, setDragOverBucketStart] = useState<number | null>(null);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 임시 스케줄 데이터 가져오기 (오버레이용)
  const {
    loadData: loadTempData,
    getTasksForDate: getTempTasksForDate
  } = useTempScheduleStore();

  // 현재 날짜의 임시 스케줄 로드
  useEffect(() => {
    loadTempData();
  }, [loadTempData]);

  // 임시 스케줄 고스트 블록 계산
  // NOTE: UTC(toISOString) 기반 날짜 키는 로컬 기준과 어긋날 수 있어, 로컬 YYYY-MM-DD를 사용한다.
  const today = getLocalDate();
  // TODO: TimelineView가 날짜를 prop으로 받게 되면 수정 필요. 현재는 오늘 기준.

  const tempTasksForToday = getTempTasksForDate?.(today) ?? [];
  const tempScheduleBlocks = tempTasksForToday
    .map(t => {
      const startMinutes = t.startTime;
      const endMinutes = t.endTime;

      // TimelineView는 visibleStartHour부터 시작함
      const top = (startMinutes - visibleStartHour * 60) * PIXELS_PER_MINUTE;
      const height = (endMinutes - startMinutes) * PIXELS_PER_MINUTE;

      return {
        id: `temp-${t.id}`,
        name: t.name,
        top,
        height,
        color: t.color,
      };
    })
    .filter(b => b.height > 0);

  // 시간대별 초과 여부 계산
  const overtimeBuckets = useMemo(() => {
    const overtime = new Set<number>();
    bucketGroups.forEach((group) => {
      const blockId = getBlockIdFromHourCore(group.bucketStartHour);
      const capacityMinutes = getBlockDurationMinutes(blockId);
      if (group.totalDuration > capacityMinutes) overtime.add(group.bucketStartHour);
    });
    return overtime;
  }, [bucketGroups]);

  // 컨텍스트 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  // 현재 시간 위치 업데이트 (1분마다)
  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      if (hour < visibleStartHour || hour >= TIMELINE_END_HOUR) {
        setCurrentTimePosition(null);
      } else {
        const position = (hour - visibleStartHour) * HOUR_HEIGHT + minute * PIXELS_PER_MINUTE;
        setCurrentTimePosition(position);
      }
    };

    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 60000);

    return () => clearInterval(interval);
  }, [visibleStartHour]);

  // 버킷 레이블 생성 (TIME_BLOCKS 시작 시각 기준)
  const bucketStartHours = useMemo(() => {
    return TIME_BLOCKS
      .map((b) => b.start)
      .filter((start) => start >= visibleStartHour && start < TIMELINE_END_HOUR);
  }, [visibleStartHour]);

  // 작업 클릭 핸들러 (TaskModal 열기)
  const handleTaskClick = useCallback((task: Task) => {
    setEditingTask(task);
    setSelectedBlockId(task.timeBlock);
    setSelectedHourSlot(typeof task.hourSlot === 'number' ? task.hourSlot : null);
    setIsModalOpen(true);
  }, []);

  // 빈 버킷 클릭 핸들러
  const handleEmptyBucketClick = useCallback((bucketStartHour: number) => {
    const blockId = getBlockIdFromHourCore(bucketStartHour);
    setEditingTask(null);
    setSelectedBlockId(blockId);
    setSelectedHourSlot(bucketStartHour);
    setIsModalOpen(true);
  }, []);

  // 모달 닫기
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTask(null);
    setSelectedBlockId(null);
    setSelectedHourSlot(null);
  }, []);

  // 작업 저장
  const handleSaveTask = useCallback(async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData);
      } else {
        const normalizedHourSlot = normalizeDropTargetHourSlot(selectedHourSlot);

        const blockStartHour = selectedBlockId ? (getBlockById(selectedBlockId)?.start ?? undefined) : undefined;
        if (blockStartHour !== undefined && selectedBlockId) {
          const tasksInBlock = dailyTasks.filter((t) => t.timeBlock === selectedBlockId);
          if (isBucketAtCapacity(tasksInBlock.length)) {
            toast.error(`${formatBucketRangeLabel(blockStartHour)}에는 최대 ${MAX_TASKS_PER_BLOCK}개의 작업만 추가할 수 있습니다.`);
            return;
          }
        }

        const baseDuration = taskData.baseDuration ?? TASK_DEFAULTS.baseDuration;
        const resistance = taskData.resistance ?? TASK_DEFAULTS.resistance;
        const adjustedDuration = taskData.adjustedDuration ?? baseDuration;

        // 새 작업 생성
        const nextHourSlot =
          (selectedBlockId ? clampHourSlotToBlock(normalizedHourSlot ?? undefined, selectedBlockId) : undefined) ??
          (selectedBlockId ? getSuggestedHourSlotForBlock(selectedBlockId, selectedHourSlot) : undefined) ??
          blockStartHour;

        const newTask: Task = {
          id: generateId('task'),
          text: taskData.text || '',
          memo: taskData.memo || '',
          baseDuration,
          resistance,
          adjustedDuration,
          timeBlock: selectedBlockId,
          hourSlot: nextHourSlot,
          completed: false,
          actualDuration: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
          goalId: null,
          preparation1: taskData.preparation1,
          preparation2: taskData.preparation2,
          preparation3: taskData.preparation3,
          emoji: taskData.emoji,
        };
        await addTask(newTask);
      }
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  }, [editingTask, selectedBlockId, selectedHourSlot, updateTask, addTask, handleCloseModal, dailyTasks]);

  // 드래그 시작 핸들러
  const handleDragStart = useCallback((task: Task, e: React.DragEvent) => {
    const sourceBucketStart =
      (task.timeBlock ? getBlockById(task.timeBlock)?.start : undefined) ??
      (typeof task.hourSlot === 'number' ? getBucketStartHour(task.hourSlot) : undefined);
    setDragData({
      taskId: task.id,
      sourceBlockId: task.timeBlock,
      sourceHourSlot: task.hourSlot,
      sourceBucketStart,
      taskData: task,
    }, e);
  }, [setDragData]);

  // 드래그 오버 핸들러
  const handleDragOver = useCallback((e: React.DragEvent, bucketStartHour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBucketStart(bucketStartHour);
  }, []);

  // 드래그 리브 핸들러
  const handleDragLeave = useCallback(() => {
    setDragOverBucketStart(null);
  }, []);

  // 드롭 핸들러
  const handleDrop = useCallback(async (e: React.DragEvent, targetBucketStartHour: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBucketStart(null);

    const dragData = getDragData(e);
    if (!dragData) return;

    const targetBlockId = getBlockIdFromHourCore(targetBucketStartHour);
    if (!targetBlockId) return;

    const normalizedTargetBucketStart = normalizeDropTargetHourSlot(targetBucketStartHour);
    if (normalizedTargetBucketStart === undefined) return;

    const nextHourSlot =
      clampHourSlotToBlock(dragData.sourceHourSlot ?? undefined, targetBlockId) ??
      getSuggestedHourSlotForBlock(targetBlockId, targetBucketStartHour) ??
      targetBucketStartHour;

    const normalizedSourceHourSlot =
      dragData.sourceBucketStart ?? normalizeDropTargetHourSlot(dragData.sourceHourSlot ?? undefined);

    // 같은 위치(같은 블록 + 같은 버킷)이면 무시
    if (dragData.sourceBlockId === targetBlockId && normalizedSourceHourSlot === normalizedTargetBucketStart) {
      return;
    }

    // TIME_BLOCK(=버킷)당 최대 작업 수 제한
    const tasksInTargetBlock = (dailyTasks ?? [])
      .filter((t) => t.timeBlock === targetBlockId)
      .filter((t) => t.id !== dragData.taskId);
    if (isBucketAtCapacity(tasksInTargetBlock.length)) {
      toast.error(`${formatBucketRangeLabel(targetBucketStartHour)}에는 최대 ${MAX_TASKS_PER_BLOCK}개의 작업만 배치할 수 있습니다.`);
      return;
    }

    try {
      await updateTask(dragData.taskId, {
        timeBlock: targetBlockId,
        hourSlot: nextHourSlot,
      });
    } catch (error) {
      console.error('Failed to move task:', error);
    }
  }, [getDragData, updateTask, dailyTasks]);


  // 컨텍스트 메뉴 열기
  const handleContextMenu = useCallback((task: Task, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      task,
    });
  }, []);

  // 작업 삭제
  const handleDeleteTask = useCallback(async () => {
    if (!contextMenu) return;
    try {
      await deleteTask(contextMenu.task.id);
      setContextMenu(null);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }, [contextMenu, deleteTask]);

  // 작업 복제
  const handleDuplicateTask = useCallback(async () => {
    if (!contextMenu) return;
    const originalTask = contextMenu.task;

    try {
      const newTask: Task = {
        ...originalTask,
        id: generateId('task'),
        completed: false,
        actualDuration: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        text: `${originalTask.text} (복사본)`,
      };
      await addTask(newTask);
      setContextMenu(null);
    } catch (error) {
      console.error('Failed to duplicate task:', error);
    }
  }, [contextMenu, addTask]);

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-base)]">
      {/* 헤더 */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-2">
        <h3 className="text-xs font-semibold text-[var(--color-text-secondary)]">
          📅 하루 일정
        </h3>
        <button
          type="button"
          onClick={toggleShowPastBlocks}
          className={`rounded px-1.5 py-0.5 text-[10px] transition-all duration-200 ${showPastBlocks
            ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
            : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
          title={showPastBlocks ? '지난 블록 숨기기' : '지난 블록 보기'}
        >
          {showPastBlocks ? '📜' : '📜'}
        </button>
      </div>

      {/* 타임라인 본문 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="relative" style={{ height: `${totalHeight}px`, minHeight: '100%' }}>
          {/* 타임블럭 눈금 및 구분선 + 빈 타임블럭 클릭 영역 */}
          {bucketStartHours.map((bucketStartHour) => {
            const isBlockBoundary = BLOCK_BOUNDARIES.includes(bucketStartHour);
            const top = (bucketStartHour - visibleStartHour) * HOUR_HEIGHT;
            const blockId = getBlockIdFromHourCore(bucketStartHour);
            const block = getBlockById(blockId);
            const blockHours = (block?.end ?? (bucketStartHour + 3)) - (block?.start ?? bucketStartHour);
            const height = Math.max(0, blockHours) * HOUR_HEIGHT;
            const isDragOver = dragOverBucketStart === bucketStartHour;

            const bucketGroup = bucketGroups.find((g) => g.bucketStartHour === bucketStartHour);
            const isOvertime = overtimeBuckets.has(bucketStartHour);
            const capacityMinutes = getBlockDurationMinutes(blockId);
            const overtimeMinutes = bucketGroup ? bucketGroup.totalDuration - capacityMinutes : 0;
            const hasNoTasks = !bucketGroup || bucketGroup.tasks.length === 0;

            const blockBgColor = BLOCK_BACKGROUND_COLORS[bucketStartHour] || '';

            return (
              <div
                key={bucketStartHour}
                className={`absolute left-0 right-0 transition-colors duration-150 ${blockBgColor} ${isDragOver ? 'bg-[var(--color-primary)]/15' : ''
                  } ${isOvertime ? 'bg-red-500/15' : ''}`}
                style={{ top: `${top}px`, height: `${height}px` }}
                onDragOver={(e) => handleDragOver(e, bucketStartHour)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, bucketStartHour)}
              >
                {/* 시간 구분선 */}
                <div
                  className={`absolute left-0 right-0 top-0 ${isBlockBoundary
                    ? 'border-t-2 border-[var(--color-text-tertiary)]/40'
                    : 'border-t border-[var(--color-border)]/40'
                    }`}
                />
                {/* 블록 내부 1시간 보조선 */}
                {Array.from({ length: Math.max(0, blockHours - 1) }).map((_, i) => (
                  <div
                    key={`subline-${bucketStartHour}-${i}`}
                    className="absolute left-6 right-0 border-t border-dashed border-[var(--color-border)]/20"
                    style={{ top: `${HOUR_HEIGHT * (i + 1)}px` }}
                  />
                ))}

                {/* 버킷 레이블 */}
                <div
                  className={`absolute left-0.5 top-0.5 text-[10px] font-semibold ${isBlockBoundary
                    ? 'text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)]'
                    }`}
                >
                  {formatBucketRangeLabel(bucketStartHour)}
                </div>
                {/* 시간 초과 경고 표시 */}
                {isOvertime && overtimeMinutes > 0 && (
                  <div
                    className="absolute right-1 top-0.5 text-[9px] text-red-400 font-medium flex items-center gap-0.5 animate-pulse"
                    title={`${bucketGroup?.totalDuration}분 계획됨 (+${overtimeMinutes}분 초과)`}
                  >
                    <span>⚠️</span>
                    <span>+{overtimeMinutes}분</span>
                  </div>
                )}
                {/* 빈 버킷 표시 및 클릭 영역 */}
                <div
                  className="absolute left-6 right-0 top-0 bottom-0 cursor-pointer group transition-colors duration-150"
                  onClick={() => handleEmptyBucketClick(bucketStartHour)}
                  title={`${formatBucketRangeLabel(bucketStartHour)}에 작업 추가`}
                >
                  {/* 빈 시간대 힌트 */}
                  {hasNoTasks && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)]/80 px-2 py-1 rounded-md">
                        <span className="text-[var(--color-primary)]">+</span>
                        <span>작업 추가</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 스플릿 뷰 구분선 (85% 지점) */}
          <div className="absolute top-0 bottom-0 border-r border-[var(--color-border)]" style={{ left: '85%' }} />

          {/* 임시 스케줄 (오른쪽 15%) - 점선 테두리 + 예정 라벨 */}
          <div className="absolute top-0 right-0 bottom-0 w-[15%] pointer-events-none">
            {/* 영역 라벨 */}
            <div className="absolute top-1 right-1 left-1 text-center">
              <span className="text-[8px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)]/80 px-1 py-0.5 rounded">
                예정
              </span>
            </div>
            {tempScheduleBlocks.map(block => (
              <div
                key={block.id}
                className="absolute left-1 right-1 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-[9px] font-medium opacity-80 hover:opacity-100 transition-opacity"
                style={{
                  top: `${block.top}px`,
                  height: `${Math.max(block.height, 24)}px`,
                  backgroundColor: block.color + '15',
                  borderColor: block.color,
                  color: block.color,
                }}
                title={`임시 스케줄: ${block.name}`}
              >
                {/* 예정 뱃지 (높이가 충분할 때만) */}
                {block.height >= 30 && (
                  <span className="text-[7px] font-bold opacity-70 bg-white/20 px-1 rounded mb-0.5">
                    예정
                  </span>
                )}
                <div className="truncate px-0.5 text-center leading-tight font-semibold">
                  {block.name}
                </div>
              </div>
            ))}
          </div>

          {/* 작업 블록들 (왼쪽 85%) */}
          <div className="absolute top-0 left-6 right-[15%] bottom-0 pointer-events-none">
            {timelineItems.map(item => (
              <div key={item.task.id} className="pointer-events-auto">
                <TimelineTaskBlock
                  task={item.task}
                  top={item.top}
                  height={item.height}
                  onTaskClick={handleTaskClick}
                  onDragStart={handleDragStart}
                  onContextMenu={handleContextMenu}
                />
              </div>
            ))}
          </div>

          {/* 현재 시간 마커 (빨간 가로선) */}
          {currentTimePosition !== null && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none transition-all duration-1000"
              style={{ top: `${currentTimePosition}px` }}
            >
              {/* 빨간 원 (시간 레이블 옆) */}
              <div className="absolute left-0 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 shadow-sm animate-pulse" />
              {/* 빨간 가로선 */}
              <div className="absolute left-2 right-0 h-[2px] bg-red-500/80 shadow-sm" />
            </div>
          )}
        </div>
      </div>

      {/* TaskModal */}
      {isModalOpen && (
        <TaskModal
          task={editingTask}
          initialBlockId={selectedBlockId}
          onSave={handleSaveTask}
          onClose={handleCloseModal}
          source="schedule"
          zIndex={2000}
        />
      )}

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[3000] bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-tertiary)] border-b border-[var(--color-border)] truncate max-w-[180px]">
            {contextMenu.task.text}
          </div>
          <button
            type="button"
            onClick={handleDuplicateTask}
            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)] flex items-center gap-2 transition-colors"
          >
            <span>📋</span>
            <span>복제</span>
          </button>
          <button
            type="button"
            onClick={handleDeleteTask}
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-500/10 text-red-500 flex items-center gap-2 transition-colors"
          >
            <span>🗑️</span>
            <span>삭제</span>
          </button>
        </div>
      )}
    </div>
  );
}

export const TimelineView = memo(TimelineViewComponent);
export default TimelineView;

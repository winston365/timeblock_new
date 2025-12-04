/**
 * 임시 스케줄 타임라인 뷰
 *
 * @role 하루 스케줄을 세로 타임라인으로 표시
 * @responsibilities
 *   - 05:00~24:00 세로 타임라인 표시
 *   - 드래그로 블록 생성/이동/리사이즈
 *   - 중첩 블록 가로 분할 표시
 *   - 정밀 드래그 툴팁 표시
 *   - 그리드 스냅 지원
 * @dependencies useTempScheduleStore
 */

import { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import { TEMP_SCHEDULE_DEFAULTS, type TempScheduleTask, type DragTooltipInfo } from '@/shared/types/tempSchedule';
import { timeToMinutes, minutesToTime } from '@/data/repositories/tempScheduleRepository';
import { TempScheduleContextMenu } from './TempScheduleContextMenu';
import { Repeat } from 'lucide-react';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { TIME_BLOCKS } from '@/shared/types/domain';

// ============================================================================
// Constants
// ============================================================================

const { timelineStartHour, timelineEndHour, hourHeight } = TEMP_SCHEDULE_DEFAULTS;
const TOTAL_HOURS = timelineEndHour - timelineStartHour;
const TIMELINE_HEIGHT = TOTAL_HOURS * hourHeight;
const PIXELS_PER_MINUTE = hourHeight / 60;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 중첩 블록 그룹화 및 열 할당
 */
interface BlockPosition {
  task: TempScheduleTask;
  column: number;
  totalColumns: number;
  top: number;
  height: number;
}

function calculateBlockPositions(tasks: TempScheduleTask[]): BlockPosition[] {
  if (tasks.length === 0) return [];

  // 시작 시간 순으로 정렬
  const sorted = [...tasks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const positions: BlockPosition[] = [];
  const columns: { endTime: number }[] = [];

  for (const task of sorted) {
    const startMinutes = timeToMinutes(task.startTime);
    const endMinutes = timeToMinutes(task.endTime);
    const top = (startMinutes - timelineStartHour * 60) * PIXELS_PER_MINUTE;
    const height = Math.max((endMinutes - startMinutes) * PIXELS_PER_MINUTE, 20);

    // 사용 가능한 열 찾기
    let columnIndex = columns.findIndex(col => col.endTime <= startMinutes);

    if (columnIndex === -1) {
      // 새 열 추가
      columnIndex = columns.length;
      columns.push({ endTime: endMinutes });
    } else {
      columns[columnIndex].endTime = endMinutes;
    }

    positions.push({
      task,
      column: columnIndex,
      totalColumns: 1, // 나중에 업데이트
      top,
      height,
    });
  }

  // totalColumns 업데이트 (같은 시간대에 겹치는 블록들의 최대 열 수)
  for (const pos of positions) {
    const startMinutes = timeToMinutes(pos.task.startTime);
    const endMinutes = timeToMinutes(pos.task.endTime);

    const overlapping = positions.filter(other => {
      const otherStart = timeToMinutes(other.task.startTime);
      const otherEnd = timeToMinutes(other.task.endTime);
      return !(endMinutes <= otherStart || startMinutes >= otherEnd);
    });

    pos.totalColumns = Math.max(...overlapping.map(p => p.column + 1));
  }

  return positions;
}

// ============================================================================
// Sub Components
// ============================================================================

interface TimelineBlockProps {
  position: BlockPosition;
  onEdit: (task: TempScheduleTask) => void;
  onDelete: (id: string) => void;
  onDragStart: (task: TempScheduleTask, mode: 'move' | 'resize-top' | 'resize-bottom', e: React.MouseEvent) => void;
  onContextMenu: (task: TempScheduleTask, e: React.MouseEvent) => void;
}

const TimelineBlock = memo(function TimelineBlock({ position, onEdit, onDelete, onDragStart, onContextMenu }: TimelineBlockProps) {
  const { task, column, totalColumns, top, height } = position;
  const widthPercent = 100 / totalColumns;
  const leftPercent = column * widthPercent;
  const isRecurring = task.recurrence.type !== 'none';

  return (
    <div
      className="absolute rounded-lg shadow-sm cursor-move transition-shadow hover:shadow-md group border border-white/10"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${leftPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
        backgroundColor: task.color, // Solid color
        zIndex: 10,
      }}
      onDoubleClick={() => onEdit(task)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(task, e);
      }}
      onMouseDown={(e) => {
        if (e.button === 0) {
          onDragStart(task, 'move', e);
        }
      }}
    >
      {/* 상단 리사이즈 핸들 */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-n-resize opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragStart(task, 'resize-top', e);
        }}
      />

      {/* 내용 */}
      <div className="px-2 py-1 overflow-hidden h-full flex flex-col text-white">
        <div className="flex items-center gap-1 min-w-0">
          {isRecurring && <Repeat size={10} className="flex-shrink-0 opacity-80" />}
          <div className="text-xs font-bold truncate drop-shadow-md">
            {task.name}
          </div>
        </div>
        <div className="text-[10px] opacity-90 font-medium">
          {task.startTime} - {task.endTime}
        </div>
      </div>

      {/* 하단 리사이즈 핸들 */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragStart(task, 'resize-bottom', e);
        }}
      />
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

interface TempScheduleTimelineViewProps {
  selectedDate: string;
}

function TempScheduleTimelineViewComponent({ selectedDate }: TempScheduleTimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    tasks: allTasks,
    getTasksForDate,
    gridSnapInterval,
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    addTask,
    updateTask,
    deleteTask,
    openTaskModal,
  } = useTempScheduleStore();

  const [tooltip, setTooltip] = useState<DragTooltipInfo | null>(null);

  // 메인 스케줄 데이터 가져오기 (오버레이용)
  const { dailyData, loadData: loadDailyData } = useDailyDataStore();

  // 날짜 변경 시 메인 스케줄 데이터 로드
  useEffect(() => {
    loadDailyData(selectedDate);
  }, [loadDailyData, selectedDate]);

  // 메인 스케줄 블록 계산
  const mainScheduleBlocks = useMemo(() => {
    if (!dailyData || !dailyData.tasks) return [];

    return dailyData.tasks
      .filter(t => t.timeBlock !== null)
      .map(t => {
        const blockInfo = TIME_BLOCKS.find(b => b.id === t.timeBlock);
        if (!blockInfo) return null;

        const startHour = blockInfo.start;
        const endHour = blockInfo.end;

        const top = (startHour * 60 - timelineStartHour * 60) * PIXELS_PER_MINUTE;
        const height = (endHour - startHour) * 60 * PIXELS_PER_MINUTE;

        return {
          id: `main-${t.id}`,
          name: t.text,
          top,
          height,
          timeBlock: t.timeBlock,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }, [dailyData]);

  // 중복 제거 (같은 타임블록에 여러 작업이 있을 경우 겹쳐서 진하게 보이는 문제 방지)
  const uniqueMainBlocks = useMemo(() => {
    const uniqueMap = new Map();
    mainScheduleBlocks.forEach(b => {
      if (!uniqueMap.has(b.timeBlock)) {
        uniqueMap.set(b.timeBlock, b);
      } else {
        const existing = uniqueMap.get(b.timeBlock);
        existing.name += `, ${b.name}`;
      }
    });
    return Array.from(uniqueMap.values());
  }, [mainScheduleBlocks]);
  const [createPreview, setCreatePreview] = useState<{ top: number; height: number; startTime: string; endTime: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ task: TempScheduleTask; x: number; y: number } | null>(null);

  const tasks = useMemo(() => getTasksForDate(selectedDate), [getTasksForDate, selectedDate, allTasks]);
  const blockPositions = useMemo(() => calculateBlockPositions(tasks), [tasks]);

  // 현재 시간 마커
  const [currentTimeTop, setCurrentTimeTop] = useState<number | null>(null);

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      if (hour < timelineStartHour || hour >= timelineEndHour) {
        setCurrentTimeTop(null);
      } else {
        const minutes = hour * 60 + minute;
        setCurrentTimeTop((minutes - timelineStartHour * 60) * PIXELS_PER_MINUTE);
      }
    };

    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Y 좌표를 시간으로 변환
  const yToTime = useCallback((y: number): string => {
    const minutes = (y / PIXELS_PER_MINUTE) + (timelineStartHour * 60);
    const snapped = Math.round(minutes / gridSnapInterval) * gridSnapInterval;
    return minutesToTime(Math.max(timelineStartHour * 60, Math.min(timelineEndHour * 60 - 1, snapped)));
  }, [gridSnapInterval]);

  // 드래그 시작 핸들러
  const handleDragStart = useCallback((task: TempScheduleTask, mode: 'move' | 'resize-top' | 'resize-bottom', e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu(null); // 드래그 시작 시 메뉴 닫기
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    startDrag({
      mode,
      taskId: task.id,
      startY: e.clientY - rect.top,
      currentY: e.clientY - rect.top,
      originalStartTime: task.startTime,
      originalEndTime: task.endTime,
    });
  }, [startDrag]);

  // 새 블록 생성 드래그 시작
  const handleCreateStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setContextMenu(null); // 생성 시작 시 메뉴 닫기
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const y = e.clientY - rect.top;
    const startTime = yToTime(y);

    startDrag({
      mode: 'create',
      taskId: null,
      startY: y,
      currentY: y,
      startTimeAtDrag: startTime,
    });

    setCreatePreview({
      top: y,
      height: 0,
      startTime,
      endTime: startTime,
    });
  }, [startDrag, yToTime]);

  // 마우스 이동 핸들러
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentY = Math.max(0, Math.min(TIMELINE_HEIGHT, e.clientY - rect.top));
    updateDrag(currentY);

    const currentTime = yToTime(currentY);

    if (dragState.mode === 'create') {
      const startTime = dragState.startTimeAtDrag!;
      const startMinutes = timeToMinutes(startTime);
      const currentMinutes = timeToMinutes(currentTime);

      const [finalStart, finalEnd] = startMinutes <= currentMinutes
        ? [startTime, currentTime]
        : [currentTime, startTime];

      const top = (timeToMinutes(finalStart) - timelineStartHour * 60) * PIXELS_PER_MINUTE;
      const height = Math.max((timeToMinutes(finalEnd) - timeToMinutes(finalStart)) * PIXELS_PER_MINUTE, 10);

      setCreatePreview({
        top,
        height,
        startTime: finalStart,
        endTime: finalEnd,
      });

      setTooltip({
        startTime: finalStart,
        endTime: finalEnd,
        durationMinutes: timeToMinutes(finalEnd) - timeToMinutes(finalStart),
        x: e.clientX,
        y: e.clientY,
      });
    } else if (dragState.taskId) {
      // 기존 블록 이동/리사이즈
      let newStartTime = dragState.originalStartTime!;
      let newEndTime = dragState.originalEndTime!;
      const delta = (currentY - dragState.startY) / PIXELS_PER_MINUTE;
      const snappedDelta = Math.round(delta / gridSnapInterval) * gridSnapInterval;

      switch (dragState.mode) {
        case 'move':
          newStartTime = minutesToTime(timeToMinutes(dragState.originalStartTime!) + snappedDelta);
          newEndTime = minutesToTime(timeToMinutes(dragState.originalEndTime!) + snappedDelta);
          break;
        case 'resize-top':
          newStartTime = minutesToTime(Math.min(
            timeToMinutes(dragState.originalStartTime!) + snappedDelta,
            timeToMinutes(dragState.originalEndTime!) - gridSnapInterval
          ));
          break;
        case 'resize-bottom':
          newEndTime = minutesToTime(Math.max(
            timeToMinutes(dragState.originalEndTime!) + snappedDelta,
            timeToMinutes(dragState.originalStartTime!) + gridSnapInterval
          ));
          break;
      }

      setTooltip({
        startTime: newStartTime,
        endTime: newEndTime,
        durationMinutes: timeToMinutes(newEndTime) - timeToMinutes(newStartTime),
        x: e.clientX,
        y: e.clientY,
      });
    }
  }, [dragState, updateDrag, yToTime, gridSnapInterval]);

  // 마우스 업 핸들러
  const handleMouseUp = useCallback(async () => {
    if (!dragState) return;

    if (dragState.mode === 'create' && createPreview) {
      const duration = timeToMinutes(createPreview.endTime) - timeToMinutes(createPreview.startTime);
      if (duration >= TEMP_SCHEDULE_DEFAULTS.minBlockDuration) {
        await addTask({
          name: '새 스케줄',
          startTime: createPreview.startTime,
          endTime: createPreview.endTime,
          scheduledDate: selectedDate,
          color: TEMP_SCHEDULE_DEFAULTS.defaultColor,
          parentId: null,
          recurrence: { type: 'none', weeklyDays: [], intervalDays: 1, endDate: null },
          order: tasks.length,
          memo: '',
        });
      }
    } else if (dragState.taskId && tooltip) {
      await updateTask(dragState.taskId, {
        startTime: tooltip.startTime,
        endTime: tooltip.endTime,
      });
    }

    endDrag();
    setTooltip(null);
    setCreatePreview(null);
  }, [dragState, createPreview, tooltip, addTask, updateTask, endDrag, selectedDate, tasks.length]);

  // 작업 삭제
  const handleDelete = useCallback(async (id: string) => {
    if (confirm('이 스케줄을 삭제하시겠습니까?')) {
      await deleteTask(id);
    }
  }, [deleteTask]);

  // 컨텍스트 메뉴 핸들러
  const handleContextMenu = useCallback((task: TempScheduleTask, e: React.MouseEvent) => {
    setContextMenu({
      task,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  // 시간 레이블 생성
  const hourLabels = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => timelineStartHour + i);

  return (
    <div className="flex h-full flex-col">
      {/* 타임라인 본문 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div
          ref={containerRef}
          className="relative select-none"
          style={{ height: `${TIMELINE_HEIGHT}px`, minHeight: '100%' }}
          onMouseDown={handleCreateStart}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* 시간 눈금 */}
          {hourLabels.map((hour, index) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-[var(--color-border)]/40"
              style={{ top: `${index * hourHeight}px` }}
            >
              <div className="absolute left-1 top-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                {String(hour).padStart(2, '0')}:00
              </div>
              {/* 30분 보조선 */}
              {index < TOTAL_HOURS && (
                <div
                  className="absolute left-8 right-0 border-t border-dashed border-[var(--color-border)]/20"
                  style={{ top: `${hourHeight / 2}px` }}
                />
              )}
            </div>
          ))}

          {/* 스플릿 뷰 구분선 (15% 지점) */}
          <div className="absolute top-0 bottom-0 border-r border-[var(--color-border)]" style={{ left: '15%' }} />

          {/* 메인 스케줄 (왼쪽 15%) */}
          <div className="absolute top-0 left-0 bottom-0 w-[15%] pointer-events-none bg-black/5">
            {uniqueMainBlocks.map(block => (
              <div
                key={block.id}
                className="absolute left-1 right-1 rounded bg-gray-500/20 border border-gray-500/30 flex items-center justify-center text-[9px] text-gray-500 font-medium"
                style={{
                  top: `${block.top}px`,
                  height: `${block.height}px`,
                }}
              >
                <div className="truncate px-0.5 text-center leading-tight">
                  {block.name}
                </div>
              </div>
            ))}
          </div>

          {/* 임시 스케줄 (오른쪽 85%) */}
          <div className="absolute top-0 left-[15%] right-2 bottom-0">
            {blockPositions.map(pos => (
              <TimelineBlock
                key={pos.task.id}
                position={pos}
                onEdit={openTaskModal}
                onDelete={handleDelete}
                onDragStart={handleDragStart}
                onContextMenu={handleContextMenu}
              />
            ))}

            {/* 생성 프리뷰 */}
            {createPreview && createPreview.height > 0 && (
              <div
                className="absolute left-0 right-0 rounded-lg border-2 border-dashed pointer-events-none"
                style={{
                  top: `${createPreview.top}px`,
                  height: `${createPreview.height}px`,
                  backgroundColor: TEMP_SCHEDULE_DEFAULTS.defaultColor + '20',
                  borderColor: TEMP_SCHEDULE_DEFAULTS.defaultColor,
                }}
              />
            )}
          </div>

          {/* 현재 시간 마커 */}
          {currentTimeTop !== null && selectedDate === new Date().toISOString().split('T')[0] && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: `${currentTimeTop}px` }}
            >
              <div className="absolute left-0 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500" />
              <div className="absolute left-2 right-0 h-[2px] bg-red-500/80" />
            </div>
          )}
        </div>
      </div>

      {/* 드래그 툴팁 */}
      {tooltip && (
        <div
          className="fixed z-[9999] px-3 py-2 rounded-lg bg-black/90 text-white text-xs font-semibold shadow-lg pointer-events-none"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y - 40}px`,
          }}
        >
          <div>{tooltip.startTime} - {tooltip.endTime}</div>
          <div className="text-[10px] text-white/70">
            {Math.floor(tooltip.durationMinutes / 60)}시간 {tooltip.durationMinutes % 60}분
          </div>
        </div>
      )}

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <TempScheduleContextMenu
          task={contextMenu.task}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export const TempScheduleTimelineView = memo(TempScheduleTimelineViewComponent);
export default TempScheduleTimelineView;

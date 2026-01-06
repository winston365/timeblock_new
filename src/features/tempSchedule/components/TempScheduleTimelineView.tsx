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
import { getLocalDate, minutesToTimeStr } from '@/shared/lib/utils';
import { TempScheduleContextMenu } from './TempScheduleContextMenu';
import { InlineEditPopover } from './InlineEditPopover';
import { PromotePostActionPopup } from './PromotePostActionPopup';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { notify } from '@/shared/lib/notify';
import {
  calculateBlockPositions,
  deriveMainSnapshotPosition,
  yToSnappedTimeMinutes,
  type MainSnapshotPosition,
} from '../utils/timelinePositioning';
import {
  clampTimelineY,
  computeCreatePreview,
  computeDraggedTimeRange,
  computePreviewRectFromTimeRange,
  type TimelineCreatePreview,
  type TimelineDragPreview,
} from '../utils/timelineCalculations';
import { useTimelineSelection } from '../hooks/useTimelineSelection';
import { TimelineBlock } from './timeline/TimelineBlock';
import { TimelineHeader } from './timeline/TimelineHeader';

// ============================================================================
// Constants
// ============================================================================

const { timelineStartHour, timelineEndHour, hourHeight } = TEMP_SCHEDULE_DEFAULTS;
const TOTAL_HOURS = timelineEndHour - timelineStartHour;
const TIMELINE_HEIGHT = TOTAL_HOURS * hourHeight;
const PIXELS_PER_MINUTE = hourHeight / 60;
const MAIN_SNAPSHOT_WIDTH_PERCENT = 12;
const MIN_MAIN_SNAPSHOT_HEIGHT = 10;

// ============================================================================
// Main Component
// ============================================================================

interface TempScheduleTimelineViewProps {
  selectedDate: string;
}

function TempScheduleTimelineViewComponent({ selectedDate }: TempScheduleTimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    getTasksForDate,
    gridSnapInterval,
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    addTask,
    updateTask,
    deleteTask,
    archiveTask,
    openTaskModal,
  } = useTempScheduleStore();

  const [tooltip, setTooltip] = useState<DragTooltipInfo | null>(null);

  const {
    contextMenu,
    inlineEditState,
    promotePopupState,
    openContextMenu,
    closeContextMenu,
    openInlineEdit,
    closeInlineEdit,
    openPromotePopupCentered,
    closePromotePopup,
  } = useTimelineSelection();

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
      .map(task =>
        deriveMainSnapshotPosition(
          task,
          {
            timelineStartHour,
            timelineEndHour,
            pixelsPerMinute: PIXELS_PER_MINUTE,
            minHeightPx: MIN_MAIN_SNAPSHOT_HEIGHT,
          },
          TIME_BLOCKS
        )
      )
      .filter((b): b is MainSnapshotPosition => b !== null);
  }, [dailyData]);

  const [createPreview, setCreatePreview] = useState<TimelineCreatePreview | null>(null);
  const [dragPreview, setDragPreview] = useState<TimelineDragPreview | null>(null);

  const tasks = getTasksForDate(selectedDate);
  const blockPositions = useMemo(
    () =>
      calculateBlockPositions(tasks, {
        timelineStartHour,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        minBlockHeightPx: 20,
      }),
    [tasks]
  );

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
  const yToTime = useCallback((y: number): number => {
    return yToSnappedTimeMinutes(y, {
      timelineStartHour,
      timelineEndHour,
      pixelsPerMinute: PIXELS_PER_MINUTE,
      gridSnapInterval,
    });
  }, [gridSnapInterval]);

  // 드래그 시작 핸들러
  const handleDragStart = useCallback((task: TempScheduleTask, mode: 'move' | 'resize-top' | 'resize-bottom', e: React.MouseEvent) => {
    e.preventDefault();
    closeContextMenu(); // 드래그 시작 시 메뉴 닫기
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
  }, [closeContextMenu, startDrag]);

  // 새 블록 생성 드래그 시작
  const handleCreateStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // 이미 드래그 중이면 무시 (블록 이동 중일 수 있음)
    if (dragState) return;
    closeContextMenu(); // 생성 시작 시 메뉴 닫기
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

    setCreatePreview(
      computeCreatePreview({
        startTimeMinutes: startTime,
        currentTimeMinutes: startTime,
        timelineStartMinutes: timelineStartHour * 60,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        minHeightPx: 0,
      })
    );
  }, [closeContextMenu, startDrag, yToTime, dragState]);

  // 마우스 이동 핸들러
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentY = clampTimelineY(e.clientY - rect.top, TIMELINE_HEIGHT);
    updateDrag(currentY);

    const currentTime = yToTime(currentY);

    if (dragState.mode === 'create') {
      const startTimeAtDrag = dragState.startTimeAtDrag;
      if (startTimeAtDrag === undefined) return;

      const preview = computeCreatePreview({
        startTimeMinutes: startTimeAtDrag,
        currentTimeMinutes: currentTime,
        timelineStartMinutes: timelineStartHour * 60,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        minHeightPx: 10,
      });

      setCreatePreview(preview);

      setTooltip({
        startTime: preview.startTime,
        endTime: preview.endTime,
        durationMinutes: preview.endTime - preview.startTime,
        x: e.clientX,
        y: e.clientY,
      });
    } else if (dragState.taskId) {
      const originalStartTime = dragState.originalStartTime;
      const originalEndTime = dragState.originalEndTime;
      if (originalStartTime === undefined || originalEndTime === undefined) return;

      const range = computeDraggedTimeRange({
        mode: dragState.mode,
        originalStartTime,
        originalEndTime,
        deltaYPx: currentY - dragState.startY,
        pixelsPerMinute: PIXELS_PER_MINUTE,
        gridSnapInterval,
        timelineStartMinutes: timelineStartHour * 60,
        timelineEndMinutes: timelineEndHour * 60,
      });

      setTooltip({
        startTime: range.startTime,
        endTime: range.endTime,
        durationMinutes: range.endTime - range.startTime,
        x: e.clientX,
        y: e.clientY,
      });

      const task = tasks.find(t => t.id === dragState.taskId);
      if (task) {
        const rect = computePreviewRectFromTimeRange(range, {
          timelineStartMinutes: timelineStartHour * 60,
          pixelsPerMinute: PIXELS_PER_MINUTE,
          minHeightPx: 10,
        });
        setDragPreview({
          top: rect.top,
          height: rect.height,
          color: task.color,
          name: task.name,
          startTime: range.startTime,
          endTime: range.endTime,
        });
      }
    }
  }, [dragState, updateDrag, yToTime, gridSnapInterval, tasks]);

  // 마우스 업 핸들러
  const handleMouseUp = useCallback(async () => {
    if (!dragState) return;

    if (dragState.mode === 'create' && createPreview) {
      const duration = createPreview.endTime - createPreview.startTime;
      if (duration >= TEMP_SCHEDULE_DEFAULTS.minBlockDuration) {
        // 블록 생성 후 바로 편집 모달 열기
        const newTask = await addTask({
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
        // 생성된 작업으로 편집 모달 열기
        openTaskModal(newTask);
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
    setDragPreview(null);
  }, [dragState, createPreview, tooltip, addTask, updateTask, endDrag, selectedDate, tasks.length, openTaskModal]);

  // 삭제 핸들러
  const handleDelete = useCallback(async (task: TempScheduleTask) => {
    await deleteTask(task.id);
    notify.success(`"${task.name}" 삭제됨`);
  }, [deleteTask]);

  // 보관함 이동 핸들러
  const handleArchive = useCallback(async (task: TempScheduleTask) => {
    await archiveTask(task.id);
    notify.info(`"${task.name}" 보관함으로 이동됨`);
  }, [archiveTask]);

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
          <TimelineHeader
            hourLabels={hourLabels}
            hourHeight={hourHeight}
            totalHours={TOTAL_HOURS}
            mainSnapshotWidthPercent={MAIN_SNAPSHOT_WIDTH_PERCENT}
          />

          {/* 메인 스케줄 (좌측 스냅샷) */}
          <div
            className="absolute top-0 left-0 bottom-0 pointer-events-none bg-transparent"
            style={{ width: `${MAIN_SNAPSHOT_WIDTH_PERCENT}%` }}
          >
            <div className="absolute top-2 left-2 px-2 py-1 rounded-md text-[10px] font-semibold text-blue-50 bg-blue-500/30 border border-blue-400/50 shadow-sm">
              메인 일정
            </div>
            {mainScheduleBlocks.map(block => (
              <div
                key={block.id}
                className="absolute left-1 right-1 rounded bg-blue-500/30 border border-blue-300/50 flex items-center justify-center text-[9px] text-blue-50 font-semibold shadow-sm"
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

          {/* 임시 스케줄 (오른쪽 가용 영역) */}
          <div
            className="absolute top-0 right-2 bottom-0 bg-emerald-500/5 rounded-l-xl pl-2"
            style={{ left: `${MAIN_SNAPSHOT_WIDTH_PERCENT}%` }}
          >
            <div className="absolute top-2 right-3 px-2 py-1 rounded-md text-[10px] font-semibold text-emerald-50 bg-emerald-500/30 border border-emerald-400/40 shadow-sm pointer-events-none">
              임시 스케줄
            </div>
            {blockPositions.map(pos => (
              <TimelineBlock
                key={pos.task.id}
                position={pos}
                onEdit={openTaskModal}
                onDoubleClick={openInlineEdit}
                onDragStart={handleDragStart}
                onContextMenu={openContextMenu}
                onDelete={handleDelete}
                onPromote={openPromotePopupCentered}
                onArchive={handleArchive}
              />
            ))}

            {/* 드래그 미리보기 (기존 블록 이동/리사이즈) */}
            {dragPreview && (
              <div
                className="absolute left-0 right-0 rounded-lg border-2 border-dashed border-white/30 bg-white/10 pointer-events-none shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                style={{
                  top: `${dragPreview.top}px`,
                  height: `${dragPreview.height}px`,
                }}
              >
                <div className="flex items-center justify-between px-2 py-1 text-[10px] text-white/80">
                  <span className="font-semibold">{dragPreview.name}</span>
                  <span className="font-mono">
                    {minutesToTimeStr(dragPreview.startTime)} - {minutesToTimeStr(dragPreview.endTime)}
                  </span>
                </div>
              </div>
            )}

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

          {/* 현재 시간까지 지난 영역 음영 처리 */}
          {currentTimeTop !== null && selectedDate === getLocalDate() && (
            <div
              className="absolute left-0 right-0 top-0 pointer-events-none z-[5]"
              style={{
                height: `${currentTimeTop}px`,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.08) 100%)',
              }}
            />
          )}

          {/* 현재 시간 마커 */}
          {currentTimeTop !== null && selectedDate === getLocalDate() && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: `${currentTimeTop}px` }}
            >
              <div className="absolute left-0 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
              <div className="absolute left-2 right-0 h-[2px] bg-red-500/80 shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
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
          <div>{minutesToTimeStr(tooltip.startTime)} - {minutesToTimeStr(tooltip.endTime)}</div>
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
          onClose={closeContextMenu}
        />
      )}

      {/* A3: 인라인 편집 팝오버 */}
      {inlineEditState && (
        <InlineEditPopover
          task={inlineEditState.task}
          position={inlineEditState.position}
          onClose={closeInlineEdit}
          onSaved={closeInlineEdit}
        />
      )}

      {/* A1: 프로모션 후 처리 팝업 */}
      {promotePopupState && (
        <PromotePostActionPopup
          task={promotePopupState.task}
          position={promotePopupState.position}
          onClose={closePromotePopup}
          onComplete={closePromotePopup}
        />
      )}
    </div>
  );
}

export const TempScheduleTimelineView = memo(TempScheduleTimelineViewComponent);
export default TempScheduleTimelineView;

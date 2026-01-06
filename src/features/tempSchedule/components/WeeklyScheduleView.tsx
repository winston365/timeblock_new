/* eslint-disable react-refresh/only-export-components */
/**
 * 주간 스케줄 뷰
 *
 * @role 7일간의 스케줄을 캘린더 형식으로 표시
 * @responsibilities
 *   - 월~일 7일 가로 배열
 *   - 각 날짜별 스케줄 블록 표시
 *   - 클릭 시 해당 날짜로 이동
 *   - 드래그&드롭으로 블록 이동
 * @dependencies useTempScheduleStore
 */

import { memo, useMemo, useCallback, useLayoutEffect, useRef, useState, useEffect } from 'react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { shouldShowOnDate } from '@/data/repositories/tempScheduleRepository';
import { getLocalDate } from '@/shared/lib/utils';
import { InlineEditPopover } from './InlineEditPopover';
import { WeekRecurrenceMoveDialog, type RecurrenceMoveScope } from './WeekRecurrenceMoveDialog';
import { PromotePostActionPopup } from './PromotePostActionPopup';
import { notify } from '@/shared/lib/notify';
import { parseYmdToLocalDate, snapToPixel } from '../utils/weeklyScheduleUtils';
import { WeeklyDayColumn } from './weekly/WeeklyDayColumn';
import { WeeklyTimeRail } from './weekly/WeeklyTimeRail';

// ============================================================================
// Helper: Calculate Week Dates
// ============================================================================

export function calculateWeekDates(selectedDate: string | null | undefined): string[] {
  const parsed = typeof selectedDate === 'string' ? parseYmdToLocalDate(selectedDate) : null;
  if (typeof selectedDate === 'string' && !parsed) return [];

  const date = parsed ?? new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 월요일 시작
  const monday = new Date(date);
  monday.setDate(diff);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(getLocalDate(d));
  }

  return dates;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_HOUR_HEIGHT = 24; // 시간당 기본 높이 (픽셀)
const HEADER_HEIGHT = 52; // 요일 헤더 높이 (px) - CSS에서도 h-[52px]로 고정
const START_HOUR = 5;
const END_HOUR = 24;
const TIME_RAIL_WIDTH = 48; // 시간 레일 너비 (px)
const CURRENT_TIME_REFRESH_INTERVAL = 60_000; // 현재 시간 갱신 간격 (1분)

// ============================================================================
// Drag State Type
// ============================================================================

interface DragState {
  taskId: string;
  taskName: string;
  taskColor: string;
  sourceDate: string;
}

// ============================================================================
// Main Component
// ============================================================================

function WeeklyScheduleViewComponent() {
  const tasks = useTempScheduleStore(state => state.tasks);
  const selectedDate = useTempScheduleStore(state => state.selectedDate);
  const setSelectedDate = useTempScheduleStore(state => state.setSelectedDate);
  const setViewMode = useTempScheduleStore(state => state.setViewMode);
  const updateTask = useTempScheduleStore(state => state.updateTask);
  const deleteTask = useTempScheduleStore(state => state.deleteTask);
  const archiveTask = useTempScheduleStore(state => state.archiveTask);
  const openTaskModal = useTempScheduleStore(state => state.openTaskModal);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  
  // A3: 인라인 편집 팝오버 상태
  const [inlineEditState, setInlineEditState] = useState<{
    task: TempScheduleTask;
    position: { x: number; y: number };
  } | null>(null);
  
  // A6: 반복 일정 이동 대화상자 상태
  const [recurrenceMoveState, setRecurrenceMoveState] = useState<{
    task: TempScheduleTask;
    targetDate: string;
  } | null>(null);
  
  // B2: 프로모션 후 처리 팝업 상태
  const [promotePopupState, setPromotePopupState] = useState<{
    task: TempScheduleTask;
    position: { x: number; y: number };
  } | null>(null);
  
  // 현재 시간 상태 (분 단위, 자동 갱신)
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  
  // 1분마다 현재 시간 갱신
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    };
    
    const interval = setInterval(updateTime, CURRENT_TIME_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);
  
  // 오늘 날짜
  const today = useMemo(() => getLocalDate(), []);

  // 주간 날짜 계산 (selectedDate가 변경될 때만 재계산)
  const weekDates = useMemo(() => calculateWeekDates(selectedDate), [selectedDate]);

  // 각 날짜별 작업 계산
  const tasksByDate = useMemo(() => {
    const result: Record<string, TempScheduleTask[]> = {};
    for (const date of weekDates) {
      result[date] = tasks.filter(task => shouldShowOnDate(task, date));
    }
    return result;
  }, [tasks, weekDates]);

  // 빈 공간 클릭 시 해당 날짜로 일간 뷰 전환 + 신규 생성 모달
  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(date);
    setViewMode('day');
    // 약간의 딜레이 후 신규 작업 모달 열기 (뷰 전환 후)
    setTimeout(() => {
      openTaskModal();
    }, 100);
  }, [setSelectedDate, setViewMode, openTaskModal]);

  // 작업 편집 (호버 미리보기에서 클릭 시)
  const handleTaskEdit = useCallback((task: TempScheduleTask) => {
    openTaskModal(task);
  }, [openTaskModal]);

  /** A3: 더블클릭 시 인라인 편집 팝오버 표시 */
  const handleDoubleClick = useCallback((task: TempScheduleTask, position: { x: number; y: number }) => {
    setInlineEditState({ task, position });
  }, []);

  /** A3: 인라인 편집 팝오버 닫기 */
  const handleInlineEditClose = useCallback(() => {
    setInlineEditState(null);
  }, []);

  /** B2: 퀵 액션 - 삭제 핸들러 */
  const handleDelete = useCallback(async (task: TempScheduleTask) => {
    await deleteTask(task.id);
    notify.success(`"${task.name}" 삭제됨`);
  }, [deleteTask]);

  /** B2: 퀵 액션 - 프로모션 핸들러 (팝업 표시) */
  const handlePromote = useCallback((task: TempScheduleTask, position: { x: number; y: number }) => {
    setPromotePopupState({ task, position });
  }, []);

  /** B2: 프로모션 팝업 닫기 */
  const handlePromotePopupClose = useCallback(() => {
    setPromotePopupState(null);
  }, []);

  /** B2: 퀵 액션 - 보관 핸들러 */
  const handleArchive = useCallback(async (task: TempScheduleTask) => {
    await archiveTask(task.id);
    notify.info(`"${task.name}" 보관함으로 이동됨`);
  }, [archiveTask]);

  // 드래그 시작
  const handleDragStart = useCallback((task: TempScheduleTask, e: React.DragEvent) => {
    e.stopPropagation();
    setDragState({
      taskId: task.id,
      taskName: task.name,
      taskColor: task.color,
      sourceDate: task.scheduledDate || '',
    });

    // 드래그 이미지 설정
    const dragImage = document.createElement('div');
    dragImage.className = 'px-2 py-1 rounded text-xs font-semibold text-white shadow-lg';
    dragImage.style.backgroundColor = task.color;
    dragImage.textContent = task.name;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  }, []);

  // 드래그 오버
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // 드롭
  const handleDrop = useCallback(async (targetDate: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!dragState) return;

    // 같은 날짜면 무시
    if (dragState.sourceDate === targetDate) {
      setDragState(null);
      setDragOverDate(null);
      return;
    }

    // A6: 반복 일정인지 확인
    const draggedTask = tasks.find(t => t.id === dragState.taskId);
    if (draggedTask && draggedTask.recurrence?.type !== 'none') {
      // 반복 일정이면 대화상자 표시
      setRecurrenceMoveState({ task: draggedTask, targetDate });
      setDragState(null);
      setDragOverDate(null);
      return;
    }

    // 일반 일정: 직접 이동
    try {
      await updateTask(dragState.taskId, {
        scheduledDate: targetDate,
      });
      notify.success(`"${dragState.taskName}" 이동 완료`);
    } catch (error) {
      console.error('Failed to move task:', error);
      notify.error('작업 이동 실패');
    }

    setDragState(null);
    setDragOverDate(null);
  }, [dragState, tasks, updateTask]);

  /** A6: 반복 일정 이동 대화상자 핸들러 */
  const handleRecurrenceMoveSelect = useCallback(async (scope: RecurrenceMoveScope) => {
    if (!recurrenceMoveState) return;

    const { task, targetDate } = recurrenceMoveState;

    try {
      if (scope === 'this') {
        // 이 항목만: 반복 해제하고 해당 날짜로 이동
        await updateTask(task.id, {
          scheduledDate: targetDate,
          recurrence: { type: 'none', weeklyDays: [], intervalDays: 1, endDate: null },
        });
      } else {
        // 이후 모든 항목: 반복 유지하며 이동 (기준 날짜 변경)
        await updateTask(task.id, {
          scheduledDate: targetDate,
        });
      }
    } catch (error) {
      console.error('Failed to move recurring task:', error);
      notify.error('반복 일정 이동 실패');
    }

    setRecurrenceMoveState(null);
  }, [recurrenceMoveState, updateTask]);

  /** A6: 반복 일정 이동 취소 */
  const handleRecurrenceMoveCancel = useCallback(() => {
    setRecurrenceMoveState(null);
    notify.info('이동이 취소되었습니다');
  }, []);

  // 드래그 엔터/리브
  const handleDragEnter = useCallback((date: string) => {
    setDragOverDate(date);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDragOverDate(null);
  }, []);

  // 가용 높이에 맞춰 시간 축을 늘려 24시 이후 빈공간 제거
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const available = el.clientHeight - HEADER_HEIGHT;
      const base = (END_HOUR - START_HOUR) * DEFAULT_HOUR_HEIGHT;
      const targetHeight = Math.max(available, base);
      setHourHeight(targetHeight / (END_HOUR - START_HOUR));
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-full flex-col" ref={containerRef} onDragEnd={handleDragEnd}>
      {/* 드래그 중 안내 */}
      {dragState && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold shadow-lg pointer-events-none">
          "{dragState.taskName}" 이동 중 · 원하는 날짜에 드롭하세요
        </div>
      )}

      {/* 시간 라벨 + 7일 열 */}
      <div className="flex flex-1 overflow-hidden">
        <WeeklyTimeRail
          widthPx={TIME_RAIL_WIDTH}
          startHour={START_HOUR}
          endHour={END_HOUR}
          hourHeight={hourHeight}
          currentTimeMinutes={currentTimeMinutes}
        />

        {/* 7일 열 */}
        <div className="flex flex-1 overflow-y-auto relative">
          {/* 현재 시간선 (7일 전체에 걸쳐) - offsetY에만 snapToPixel 적용하여 시간 구분선과 동일한 rounding */}
          {weekDates.includes(today) && currentTimeMinutes >= START_HOUR * 60 && currentTimeMinutes <= END_HOUR * 60 && (
            <div
              className="absolute left-0 right-0 z-[15] pointer-events-none"
              style={{ 
                top: `${HEADER_HEIGHT + snapToPixel((currentTimeMinutes - START_HOUR * 60) / 60 * hourHeight)}px`,
              }}
            >
              {/* 빨간 선 */}
              <div className="h-[2px] bg-red-500 shadow-sm shadow-red-500/50" />
              {/* 현재 시간 점 - 선과 수직 중앙 정렬 */}
              <div className="absolute w-2 h-2 bg-red-500 rounded-full shadow-sm shadow-red-500/50 -top-[3px] -left-1" />
            </div>
          )}
          
          {weekDates.map((date, index) => (
            <div
              key={date}
              className="flex-1 min-w-0"
              onDragEnter={() => handleDragEnter(date)}
              onDragLeave={handleDragLeave}
            >
              <WeeklyDayColumn
                date={date}
                dayIndex={index}
                tasks={tasksByDate[date] || []}
                onDayClick={handleDayClick}
                hourHeight={hourHeight}
                startHour={START_HOUR}
                endHour={END_HOUR}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragOver={dragOverDate === date && dragState?.sourceDate !== date}
                onTaskEdit={handleTaskEdit}
                onDoubleClick={handleDoubleClick}
                onDelete={handleDelete}
                onPromote={handlePromote}
                onArchive={handleArchive}
              />
            </div>
          ))}
        </div>
      </div>

      {/* A3: 인라인 편집 팝오버 */}
      {inlineEditState && (
        <InlineEditPopover
          task={inlineEditState.task}
          position={inlineEditState.position}
          onClose={handleInlineEditClose}
          onSaved={handleInlineEditClose}
        />
      )}

      {/* A6: 반복 일정 이동 대화상자 */}
      {recurrenceMoveState && (
        <WeekRecurrenceMoveDialog
          taskName={recurrenceMoveState.task.name}
          targetDate={recurrenceMoveState.targetDate}
          onSelect={handleRecurrenceMoveSelect}
          onCancel={handleRecurrenceMoveCancel}
        />
      )}

      {/* B2: 프로모션 후 처리 팝업 */}
      {promotePopupState && (
        <PromotePostActionPopup
          task={promotePopupState.task}
          position={promotePopupState.position}
          onClose={handlePromotePopupClose}
          onComplete={handlePromotePopupClose}
        />
      )}
    </div>
  );
}

export const WeeklyScheduleView = memo(WeeklyScheduleViewComponent);
export default WeeklyScheduleView;

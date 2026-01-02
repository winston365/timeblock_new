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
import { Trash2, ArrowUpRight, Archive } from 'lucide-react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { shouldShowOnDate } from '@/data/repositories/tempScheduleRepository';
import { getLocalDate, minutesToTimeStr } from '@/shared/lib/utils';
import { RecurringBadge, FavoriteBadge, ArchivedBadge } from './StatusBadges';
import { InlineEditPopover } from './InlineEditPopover';
import { WeekRecurrenceMoveDialog, type RecurrenceMoveScope } from './WeekRecurrenceMoveDialog';
import { PromotePostActionPopup } from './PromotePostActionPopup';
import { notify } from '@/shared/lib/notify';

// ============================================================================
// Helper: Calculate Week Dates
// ============================================================================

function parseYmdToLocalDate(dateStr: string): Date | null {
  if (typeof dateStr !== 'string') return null;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (!match) return null;

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year) return null;
  if (date.getMonth() !== month - 1) return null;
  if (date.getDate() !== day) return null;
  return date;
}

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

const WEEK_DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const DEFAULT_HOUR_HEIGHT = 24; // 시간당 기본 높이 (픽셀)
const HEADER_HEIGHT = 52; // 요일 헤더 높이 (px) - CSS에서도 h-[52px]로 고정
const START_HOUR = 5;
const END_HOUR = 24;
const TIME_RAIL_WIDTH = 48; // 시간 레일 너비 (px)
const CURRENT_TIME_REFRESH_INTERVAL = 60_000; // 현재 시간 갱신 간격 (1분)

/**
 * Subpixel 스냅 유틸리티
 * devicePixelRatio를 고려하여 픽셀 경계에 맞춰 반올림
 * 이로써 시간 구분선과 현재시간선이 동일한 그리드에 정렬됨
 */
function snapToPixel(value: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.round(value * dpr) / dpr;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateStr: string): { day: number; month: number; isToday: boolean; isWeekend: boolean } {
  const date = parseYmdToLocalDate(dateStr) ?? new Date(dateStr);
  const today = getLocalDate();
  const dayOfWeek = date.getDay();

  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    isToday: dateStr === today,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  };
}

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
// Sub Components
// ============================================================================

interface TaskBlockProps {
  task: TempScheduleTask;
  hourHeight: number;
  onDragStart: (task: TempScheduleTask, e: React.DragEvent) => void;
  onTaskEdit: (task: TempScheduleTask) => void;
  /** A3: 더블클릭 시 인라인 편집 팝오버 표시 */
  onDoubleClick: (task: TempScheduleTask, position: { x: number; y: number }) => void;
  /** B2: 퀵 액션 - 삭제 */
  onDelete: (task: TempScheduleTask) => void;
  /** B2: 퀵 액션 - 프로모션 */
  onPromote: (task: TempScheduleTask, position: { x: number; y: number }) => void;
  /** B2: 퀵 액션 - 보관 */
  onArchive: (task: TempScheduleTask) => void;
}

const TaskBlock = memo(function TaskBlock({ task, hourHeight, onDragStart, onTaskEdit, onDoubleClick, onDelete, onPromote, onArchive }: TaskBlockProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const blockRef = useRef<HTMLDivElement>(null);

  const startMinutes = task.startTime;
  const endMinutes = task.endTime;
  const top = Math.max(0, (startMinutes - START_HOUR * 60) / 60 * hourHeight);
  const height = Math.max(12, (endMinutes - startMinutes) / 60 * hourHeight);
  const duration = endMinutes - startMinutes;
  const isArchived = task.isArchived;
  const isRecurring = task.recurrence.type !== 'none';

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPreviewPosition({
      x: rect.right + 8,
      y: rect.top,
    });
    setShowPreview(true);
  };

  const handleMouseLeave = () => {
    setShowPreview(false);
  };

  /** 싱글 클릭: 전체 편집 모달 */
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTaskEdit(task);
  };

  /** A3: 더블 클릭: 빠른 인라인 편집 */
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDoubleClick(task, { x: e.clientX, y: e.clientY });
  };

  /** B2: 퀵 액션 버튼 클릭 - 드래그 방지 */
  const handlePromoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onPromote(task, { x: e.clientX, y: e.clientY });
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onArchive(task);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete(task);
  };

  return (
    <>
      <div
        ref={blockRef}
        draggable
        onDragStart={(e) => onDragStart(task, e)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={`absolute left-0.5 right-0.5 rounded text-[8px] px-1 py-0.5 overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/50 hover:scale-[1.02] hover:z-10 transition-all group ${
          isArchived ? 'opacity-50' : ''
        }`}
        style={{
          top: `${top}px`,
          height: `${height}px`,
          backgroundColor: task.color + '30',
          borderLeft: `2px solid ${task.color}`,
        }}
      >
        <span style={{ color: task.color }} className="font-semibold flex items-center gap-0.5">
          {task.favorite && <FavoriteBadge compact />}
          {isRecurring && <RecurringBadge compact />}
          {isArchived && <ArchivedBadge compact />}
          <span className="truncate">{task.name}</span>
        </span>

        {/* B2: 호버 시 퀵 액션 버튼들 */}
        <div 
          className="absolute top-0 right-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {!isArchived && (
            <button
              type="button"
              className="p-0.5 rounded bg-white/20 hover:bg-white/40 text-white transition-colors"
              onClick={handlePromoteClick}
              onMouseDown={(e) => e.stopPropagation()}
              title="실제 일정으로 프로모션"
              aria-label="실제 일정으로 프로모션"
            >
              <ArrowUpRight size={10} />
            </button>
          )}
          {!isArchived && (
            <button
              type="button"
              className="p-0.5 rounded bg-white/20 hover:bg-white/40 text-white transition-colors"
              onClick={handleArchiveClick}
              onMouseDown={(e) => e.stopPropagation()}
              title="보관함으로 이동"
              aria-label="보관함으로 이동"
            >
              <Archive size={10} />
            </button>
          )}
          <button
            type="button"
            className="p-0.5 rounded bg-white/20 hover:bg-red-400/80 text-white transition-colors"
            onClick={handleDeleteClick}
            onMouseDown={(e) => e.stopPropagation()}
            title="삭제"
            aria-label="삭제"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      {/* 호버 확대 미리보기 */}
      {showPreview && (
        <div
          className="fixed z-[200] min-w-[180px] max-w-[250px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl overflow-hidden pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${previewPosition.x}px`,
            top: `${previewPosition.y}px`,
          }}
        >
          {/* 헤더 */}
          <div
            className="px-3 py-2 border-b border-[var(--color-border)]"
            style={{ backgroundColor: task.color + '20' }}
          >
            <div className="flex items-center gap-2">
              {task.favorite && <FavoriteBadge />}
              {isRecurring && <RecurringBadge />}
              {isArchived && <ArchivedBadge />}
              <span className="font-bold text-sm" style={{ color: task.color }}>
                {task.name}
              </span>
            </div>
          </div>

          {/* 내용 */}
          <div className="p-3 space-y-2">
            {/* 시간 */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-text-tertiary)]">⏰</span>
              <span className="font-mono text-[var(--color-text)]">
                {minutesToTimeStr(startMinutes)} - {minutesToTimeStr(endMinutes)}
              </span>
              <span className="text-[var(--color-text-secondary)]">
                ({duration}분)
              </span>
            </div>

            {/* 반복 */}
            {task.recurrence.type !== 'none' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--color-text-tertiary)]">🔄</span>
                <span className="text-[var(--color-text-secondary)]">
                  {task.recurrence.type === 'daily' && '매일'}
                  {task.recurrence.type === 'weekly' && `매주 ${task.recurrence.weeklyDays?.map(d => ['일','월','화','수','목','금','토'][d]).join(', ')}`}
                  {task.recurrence.type === 'monthly' && '매월'}
                  {task.recurrence.type === 'custom' && `${task.recurrence.intervalDays}일마다`}
                </span>
              </div>
            )}

            {/* 메모 */}
            {task.memo && (
              <div className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-bg-tertiary)] rounded p-2 line-clamp-2">
                {task.memo}
              </div>
            )}
          </div>

          {/* 안내 */}
          <div className="px-3 py-1.5 bg-[var(--color-bg-tertiary)] text-[9px] text-[var(--color-text-tertiary)] text-center">
            클릭하여 편집 • 드래그하여 이동
          </div>
        </div>
      )}
    </>
  );
});

interface DayColumnProps {
  date: string;
  dayIndex: number;
  tasks: TempScheduleTask[];
  onDayClick: (date: string) => void;
  hourHeight: number;
  onDragStart: (task: TempScheduleTask, e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (date: string, e: React.DragEvent) => void;
  isDragOver: boolean;
  onTaskEdit: (task: TempScheduleTask) => void;
  /** A3: 더블클릭 시 인라인 편집 팝오버 표시 */
  onDoubleClick: (task: TempScheduleTask, position: { x: number; y: number }) => void;
  /** B2: 퀵 액션 - 삭제 */
  onDelete: (task: TempScheduleTask) => void;
  /** B2: 퀵 액션 - 프로모션 */
  onPromote: (task: TempScheduleTask, position: { x: number; y: number }) => void;
  /** B2: 퀵 액션 - 보관 */
  onArchive: (task: TempScheduleTask) => void;
}

const DayColumn = memo(function DayColumn({
  date,
  dayIndex,
  tasks,
  onDayClick,
  hourHeight,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  onTaskEdit,
  onDoubleClick,
  onDelete,
  onPromote,
  onArchive,
}: DayColumnProps) {
  const { day, month, isToday, isWeekend } = formatDate(date);

  return (
    <div
      className={`
        flex-1 border-r border-[var(--color-border)]/30 last:border-r-0 min-w-0 cursor-pointer transition-colors relative
        ${isWeekend ? 'bg-[var(--color-bg-tertiary)]/30' : ''}
        ${isToday ? 'bg-[var(--color-primary)]/5' : ''}
        ${isDragOver ? 'bg-[var(--color-primary)]/20 ring-2 ring-inset ring-[var(--color-primary)]/50' : 'hover:bg-[var(--color-bg-secondary)]/50'}
      `}
      onClick={() => onDayClick(date)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(date, e)}
    >
      {/* 오늘 컬럼 전체 테두리 */}
      {isToday && (
        <div className="absolute inset-0 border-2 border-[var(--color-primary)]/50 pointer-events-none z-[5]" />
      )}
      
      {/* 요일 헤더 - 고정 높이로 레이아웃 안정화 */}
      <div className={`
        sticky top-0 z-10 border-b border-[var(--color-border)] px-1 py-2 text-center h-[52px] box-border
        ${isToday 
          ? 'bg-[var(--color-primary)]/20 border-b-2 border-b-[var(--color-primary)]' 
          : 'bg-[var(--color-bg-surface)]'
        }
      `}>
        <div className={`text-[10px] font-medium ${
          isWeekend ? 'text-red-400' : 'text-[var(--color-text-tertiary)]'
        }`}>
          {WEEK_DAY_LABELS[dayIndex]}
        </div>
        <div className={`text-sm font-bold ${
          isToday
            ? 'text-white bg-[var(--color-primary)] rounded-full w-6 h-6 flex items-center justify-center mx-auto'
            : isWeekend
              ? 'text-red-400'
              : 'text-[var(--color-text)]'
        }`}>
          {day}
        </div>
        <div className="text-[8px] text-[var(--color-text-tertiary)] opacity-80 h-3 flex items-center justify-center">
          {(dayIndex === 0 || day === 1) ? `${month}월` : '\u00A0'}
        </div>
      </div>

      {/* 스케줄 블록들 */}
      <div
        className="relative"
        style={{
          height: `${(END_HOUR - START_HOUR) * hourHeight}px`,
        }}
      >
        {/* 시간별 구분선 - snapToPixel로 서브픽셀 정렬 */}
        <div className="absolute inset-0 pointer-events-none z-0">
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-[var(--color-border)]/20"
              style={{ top: `${snapToPixel(i * hourHeight)}px` }}
            />
          ))}
        </div>
        
        {tasks.map(task => (
          <TaskBlock
            key={task.id}
            task={task}
            hourHeight={hourHeight}
            onDragStart={onDragStart}
            onTaskEdit={onTaskEdit}
            onDoubleClick={onDoubleClick}
            onDelete={onDelete}
            onPromote={onPromote}
            onArchive={onArchive}
          />
        ))}
      </div>
    </div>
  );
});

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
        {/* 시간 레일 (개선됨) */}
        <div 
          className="flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-surface)]"
          style={{ width: `${TIME_RAIL_WIDTH}px` }}
        >
          {/* 헤더 공간 */}
          <div className="h-[52px] border-b border-[var(--color-border)] flex items-end justify-center pb-1">
            <span className="text-[8px] text-[var(--color-text-tertiary)]">시간</span>
          </div>
          
          {/* 시간 라벨들 */}
          <div
            className="relative"
            style={{
              height: `${(END_HOUR - START_HOUR) * hourHeight}px`,
            }}
          >
            {Array.from({ length: (END_HOUR - START_HOUR) + 1 }, (_, i) => START_HOUR + i).map(hour => (
              <div
                key={hour}
                className="absolute left-0 right-0 flex items-center justify-end pr-2 text-[10px] text-[var(--color-text-tertiary)] font-mono"
                style={{ top: `${(hour - START_HOUR) * hourHeight - 6}px` }}
              >
                <span className={hour === Math.floor(currentTimeMinutes / 60) ? 'text-red-400 font-bold' : ''}>
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
            
            {/* 현재 시간 표시 (시간 레일 내) */}
            {currentTimeMinutes >= START_HOUR * 60 && currentTimeMinutes <= END_HOUR * 60 && (
              <div
                className="absolute left-0 right-0 flex items-center justify-end pr-1 z-20"
                style={{ 
                  top: `${(currentTimeMinutes - START_HOUR * 60) / 60 * hourHeight - 8}px` 
                }}
              >
                <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1 rounded">
                  {minutesToTimeStr(currentTimeMinutes)}
                </span>
              </div>
            )}
          </div>
        </div>

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
              <DayColumn
                date={date}
                dayIndex={index}
                tasks={tasksByDate[date] || []}
                onDayClick={handleDayClick}
                hourHeight={hourHeight}
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

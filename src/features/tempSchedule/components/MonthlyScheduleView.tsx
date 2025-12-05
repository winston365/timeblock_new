/**
 * 월간 스케줄 뷰
 *
 * @role 30일간의 스케줄을 캘린더 형식으로 표시
 * @responsibilities
 *   - 월 단위 캘린더 그리드 표시
 *   - 각 날짜별 스케줄 요약 표시
 *   - 호버 시 팝오버로 전체 목록 표시
 *   - 클릭 시 해당 날짜로 이동
 * @dependencies useTempScheduleStore
 */

import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { shouldShowOnDate } from '@/data/repositories/tempScheduleRepository';
import { getLocalDate } from '@/shared/lib/utils';

// ============================================================================
// Constants
// ============================================================================

const WEEK_DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// ============================================================================
// Helper Functions
// ============================================================================

function getMonthInfo(dateStr: string): { year: number; month: number } {
  const date = new Date(dateStr);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

function calculateMonthDates(selectedDate: string): string[] {
  const date = new Date(selectedDate);
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // 첫 주의 월요일부터 시작
  const startDate = new Date(firstDay);
  const startDay = startDate.getDay();
  startDate.setDate(startDate.getDate() - (startDay === 0 ? 6 : startDay - 1));

  // 마지막 주의 일요일까지
  const endDate = new Date(lastDay);
  const endDay = endDate.getDay();
  endDate.setDate(endDate.getDate() + (endDay === 0 ? 0 : 7 - endDay));

  const dates: string[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates;
}

// ============================================================================
// Popover Component
// ============================================================================

interface TaskPopoverProps {
  tasks: TempScheduleTask[];
  date: string;
  position: { x: number; y: number };
  onClose: () => void;
  onDayClick: (date: string) => void;
}

const TaskPopover = memo(function TaskPopover({ tasks, date, position, onClose, onDayClick }: TaskPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // 팝오버가 화면 밖으로 나가지 않도록 위치 조정
  useEffect(() => {
    if (!popoverRef.current) return;

    const rect = popoverRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // 오른쪽 경계 체크
    if (x + rect.width > viewportWidth - 20) {
      x = position.x - rect.width - 10;
    }

    // 하단 경계 체크
    if (y + rect.height > viewportHeight - 20) {
      y = viewportHeight - rect.height - 20;
    }

    // 상단 경계 체크
    if (y < 20) {
      y = 20;
    }

    setAdjustedPosition({ x, y });
  }, [position]);

  const dateObj = new Date(date);
  const formattedDate = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;

  return (
    <div
      ref={popoverRef}
      className="fixed z-[100] min-w-[200px] max-w-[280px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl overflow-hidden"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      onMouseLeave={onClose}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2">
        <span className="text-xs font-bold text-[var(--color-text)]">
          📅 {formattedDate}
        </span>
        <button
          className="text-[10px] text-[var(--color-primary)] hover:underline"
          onClick={() => onDayClick(date)}
        >
          일간 뷰로 →
        </button>
      </div>

      {/* 작업 목록 */}
      <div className="max-h-[300px] overflow-y-auto p-2 space-y-1.5">
        {tasks.length === 0 ? (
          <div className="text-center text-xs text-[var(--color-text-tertiary)] py-4">
            등록된 스케줄 없음
          </div>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: task.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[var(--color-text)] truncate flex items-center gap-1">
                  {task.favorite && <span className="text-amber-400">★</span>}
                  {task.name}
                </div>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">
                  {task.startTime} - {task.endTime}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 푸터 */}
      {tasks.length > 0 && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5">
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            총 {tasks.length}개의 스케줄
          </span>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Sub Components
// ============================================================================

interface DayCellProps {
  date: string;
  currentMonth: number;
  tasks: TempScheduleTask[];
  onDayClick: (date: string) => void;
  onHover: (date: string, e: React.MouseEvent) => void;
  onLeave: () => void;
}

const DayCell = memo(function DayCell({ date, currentMonth, tasks, onDayClick, onHover, onLeave }: DayCellProps) {
  const dateObj = new Date(date);
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const dayOfWeek = dateObj.getDay();
  const isCurrentMonth = month === currentMonth;
  const isToday = date === getLocalDate();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // 색상 도트 (최대 5개)
  const colorDots = useMemo(() => {
    const uniqueColors = [...new Set(tasks.map(t => t.color))];
    return uniqueColors.slice(0, 5);
  }, [tasks]);

  return (
    <div
      className={`border-b border-r border-[var(--color-border)]/30 p-1 min-h-[80px] cursor-pointer transition-colors hover:bg-[var(--color-bg-secondary)]/50 ${
        !isCurrentMonth ? 'bg-[var(--color-bg-tertiary)]/50' : ''
      } ${isWeekend ? 'bg-[var(--color-bg-tertiary)]/30' : ''}`}
      onClick={() => onDayClick(date)}
      onMouseEnter={(e) => tasks.length > 0 && onHover(date, e)}
      onMouseLeave={onLeave}
    >
      {/* 날짜 */}
      <div className="flex items-center justify-between mb-1">
        <div className={`text-xs font-semibold ${
          isToday
            ? 'text-white bg-[var(--color-primary)] rounded-full w-5 h-5 flex items-center justify-center'
            : !isCurrentMonth
              ? 'text-[var(--color-text-tertiary)]'
              : isWeekend
                ? 'text-red-400'
                : 'text-[var(--color-text)]'
        }`}>
          {day}
        </div>
        {/* 색상 도트 */}
        {colorDots.length > 0 && (
          <div className="flex items-center gap-0.5">
            {colorDots.map((color, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 스케줄 요약 */}
      <div className="space-y-0.5">
        {tasks.slice(0, 3).map(task => (
          <div
            key={task.id}
            className="text-[9px] px-1 py-0.5 rounded truncate"
            style={{
              backgroundColor: task.color + '20',
              color: task.color,
              borderLeft: `2px solid ${task.color}`,
            }}
            title={`${task.name}\n${task.startTime} - ${task.endTime}`}
          >
            {task.favorite ? '★ ' : ''}{task.name}
          </div>
        ))}
        {tasks.length > 3 && (
          <div className="text-[8px] text-[var(--color-text-tertiary)] pl-1 font-semibold">
            +{tasks.length - 3}개 더보기
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

function MonthlyScheduleViewComponent() {
  const tasks = useTempScheduleStore(state => state.tasks);
  const selectedDate = useTempScheduleStore(state => state.selectedDate);
  const setSelectedDate = useTempScheduleStore(state => state.setSelectedDate);
  const setViewMode = useTempScheduleStore(state => state.setViewMode);

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);

  // 월간 날짜 계산 (selectedDate가 변경될 때만 재계산)
  const monthDates = useMemo(() => calculateMonthDates(selectedDate), [selectedDate]);

  const { month: currentMonth } = getMonthInfo(selectedDate);

  // 각 날짜별 작업 계산 (모든 작업 표시)
  const tasksByDate = useMemo(() => {
    const result: Record<string, TempScheduleTask[]> = {};
    for (const date of monthDates) {
      result[date] = tasks.filter(task => shouldShowOnDate(task, date));
    }
    return result;
  }, [tasks, monthDates]);

  const handleDayClick = useCallback((date: string) => {
    setHoveredDate(null);
    setPopoverPosition(null);
    setSelectedDate(date);
    setViewMode('day');
  }, [setSelectedDate, setViewMode]);

  const handleHover = useCallback((date: string, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredDate(date);
    setPopoverPosition({
      x: rect.right + 10,
      y: rect.top,
    });
  }, []);

  const handleLeave = useCallback(() => {
    // 팝오버로 마우스가 이동할 수 있도록 약간의 딜레이
    setTimeout(() => {
      setHoveredDate(null);
      setPopoverPosition(null);
    }, 100);
  }, []);

  const handlePopoverClose = useCallback(() => {
    setHoveredDate(null);
    setPopoverPosition(null);
  }, []);

  // 주 단위로 날짜 그룹화
  const weeks = useMemo(() => {
    const result: string[][] = [];
    for (let i = 0; i < monthDates.length; i += 7) {
      result.push(monthDates.slice(i, i + 7));
    }
    return result;
  }, [monthDates]);

  return (
    <div className="flex h-full flex-col relative">
      {/* 요일 헤더 */}
      <div className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        {WEEK_DAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={`flex-1 py-2 text-center text-xs font-semibold ${
              index >= 5 ? 'text-red-400' : 'text-[var(--color-text-secondary)]'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="flex-1 overflow-y-auto">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex">
            {week.map((date) => (
              <div key={date} className="flex-1">
                <DayCell
                  date={date}
                  currentMonth={currentMonth}
                  tasks={tasksByDate[date] || []}
                  onDayClick={handleDayClick}
                  onHover={handleHover}
                  onLeave={handleLeave}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 팝오버 */}
      {hoveredDate && popoverPosition && (
        <TaskPopover
          tasks={tasksByDate[hoveredDate] || []}
          date={hoveredDate}
          position={popoverPosition}
          onClose={handlePopoverClose}
          onDayClick={handleDayClick}
        />
      )}
    </div>
  );
}

export const MonthlyScheduleView = memo(MonthlyScheduleViewComponent);
export default MonthlyScheduleView;

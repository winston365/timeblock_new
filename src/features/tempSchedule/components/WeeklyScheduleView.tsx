/**
 * 주간 스케줄 뷰
 *
 * @role 7일간의 스케줄을 캘린더 형식으로 표시
 * @responsibilities
 *   - 월~일 7일 가로 배열
 *   - 각 날짜별 스케줄 블록 표시
 *   - 클릭 시 해당 날짜로 이동
 * @dependencies useTempScheduleStore
 */

import { memo, useMemo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { shouldShowOnDate, timeToMinutes } from '@/data/repositories/tempScheduleRepository';
import { getLocalDate } from '@/shared/lib/utils';

// ============================================================================
// Helper: Calculate Week Dates
// ============================================================================

function calculateWeekDates(selectedDate: string): string[] {
  const date = new Date(selectedDate);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 월요일 시작
  const monday = new Date(date);
  monday.setDate(diff);
  
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}

// ============================================================================
// Constants
// ============================================================================

const WEEK_DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const DEFAULT_HOUR_HEIGHT = 24; // 시간당 기본 높이 (픽셀)
const HEADER_HEIGHT = 52; // 요일 헤더 높이 (px)
const START_HOUR = 5;
const END_HOUR = 24;

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateStr: string): { day: number; month: number; isToday: boolean; isWeekend: boolean } {
  const date = new Date(dateStr);
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
// Sub Components
// ============================================================================

interface DayColumnProps {
  date: string;
  dayIndex: number;
  tasks: TempScheduleTask[];
  onDayClick: (date: string) => void;
  hourHeight: number;
}

const DayColumn = memo(function DayColumn({ date, dayIndex, tasks, onDayClick, hourHeight }: DayColumnProps) {
  const { day, month, isToday, isWeekend } = formatDate(date);

  return (
    <div 
      className={`flex-1 border-r border-[var(--color-border)]/30 last:border-r-0 min-w-0 cursor-pointer hover:bg-[var(--color-bg-secondary)]/50 transition-colors ${
        isWeekend ? 'bg-[var(--color-bg-tertiary)]/30' : ''
      }`}
      onClick={() => onDayClick(date)}
    >
      {/* 요일 헤더 */}
      <div className={`sticky top-0 z-10 border-b border-[var(--color-border)] px-1 py-2 text-center bg-[var(--color-bg-surface)] ${
        isToday ? 'bg-[var(--color-primary)]/10' : ''
      }`}>
        <div className={`text-[10px] font-medium ${
          isWeekend ? 'text-red-400' : 'text-[var(--color-text-tertiary)]'
        }`}>
          {WEEK_DAY_LABELS[dayIndex]}
        </div>
        <div className={`text-sm font-bold ${
          isToday 
            ? 'text-[var(--color-primary)]' 
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
        {tasks.map(task => {
          const startMinutes = timeToMinutes(task.startTime);
          const endMinutes = timeToMinutes(task.endTime);
          const top = Math.max(0, (startMinutes - START_HOUR * 60) / 60 * hourHeight);
          const height = Math.max(12, (endMinutes - startMinutes) / 60 * hourHeight);

          return (
            <div
              key={task.id}
            className="absolute left-0.5 right-0.5 rounded text-[8px] px-1 py-0.5 overflow-hidden truncate"
            style={{
              top: `${top}px`,
              height: `${height}px`,
              backgroundColor: task.color + '30',
              borderLeft: `2px solid ${task.color}`,
            }}
            title={`${task.name}\n${task.startTime} - ${task.endTime}`}
          >
              <span style={{ color: task.color }} className="font-semibold flex items-center gap-1">
                {task.favorite && <span className="text-amber-300">★</span>}
                <span className="truncate">{task.name}</span>
              </span>
            </div>
          );
        })}
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);

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

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(date);
    setViewMode('day');
  }, [setSelectedDate, setViewMode]);

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
    <div className="flex h-full flex-col" ref={containerRef}>
      {/* 시간 라벨 + 7일 열 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 시간 라벨 */}
        <div className="w-8 flex-shrink-0 border-r border-[var(--color-border)]">
          <div className="h-[52px] border-b border-[var(--color-border)]" />
          <div
            className="relative"
            style={{
              height: `${(END_HOUR - START_HOUR) * hourHeight}px`,
            }}
          >
            {Array.from({ length: (END_HOUR - START_HOUR) + 1 }, (_, i) => START_HOUR + i).map(hour => (
              <div
                key={hour}
                className="absolute left-0 right-0 text-[8px] text-[var(--color-text-tertiary)] text-right pr-1"
                style={{ top: `${(hour - START_HOUR) * hourHeight - 4}px` }}
              >
                {hour}
              </div>
            ))}
          </div>
        </div>

        {/* 7일 열 */}
        <div className="flex flex-1 overflow-y-auto">
          {weekDates.map((date, index) => (
            <DayColumn
              key={date}
              date={date}
              dayIndex={index}
              tasks={tasksByDate[date] || []}
              onDayClick={handleDayClick}
              hourHeight={hourHeight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const WeeklyScheduleView = memo(WeeklyScheduleViewComponent);
export default WeeklyScheduleView;

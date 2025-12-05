/**
 * 월간 스케줄 뷰
 *
 * @role 30일간의 스케줄을 캘린더 형식으로 표시
 * @responsibilities
 *   - 월 단위 캘린더 그리드 표시
 *   - 각 날짜별 스케줄 요약 표시
 *   - 클릭 시 해당 날짜로 이동
 * @dependencies useTempScheduleStore
 */

import { memo, useMemo, useCallback } from 'react';
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
// Sub Components
// ============================================================================

interface DayCellProps {
  date: string;
  currentMonth: number;
  tasks: TempScheduleTask[];
  onDayClick: (date: string) => void;
}

const DayCell = memo(function DayCell({ date, currentMonth, tasks, onDayClick }: DayCellProps) {
  const dateObj = new Date(date);
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const dayOfWeek = dateObj.getDay();
  const isCurrentMonth = month === currentMonth;
  const isToday = date === getLocalDate();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return (
    <div
      className={`border-b border-r border-[var(--color-border)]/30 p-1 min-h-[80px] cursor-pointer transition-colors hover:bg-[var(--color-bg-secondary)]/50 ${
        !isCurrentMonth ? 'bg-[var(--color-bg-tertiary)]/50' : ''
      } ${isWeekend ? 'bg-[var(--color-bg-tertiary)]/30' : ''}`}
      onClick={() => onDayClick(date)}
    >
      {/* 날짜 */}
      <div className={`text-xs font-semibold mb-1 ${
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

      {/* 스케줄 요약 */}
      <div className="space-y-0.5">
        {tasks.slice(0, 2).map(task => (
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
        {tasks.length > 2 && (
          <div className="text-[8px] text-[var(--color-text-tertiary)] pl-1">
            +{tasks.length - 2}개 더
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

  // 월간 날짜 계산 (selectedDate가 변경될 때만 재계산)
  const monthDates = useMemo(() => calculateMonthDates(selectedDate), [selectedDate]);

  const { month: currentMonth } = getMonthInfo(selectedDate);

  // 각 날짜별 작업 계산
  const tasksByDate = useMemo(() => {
    const result: Record<string, TempScheduleTask[]> = {};
    for (const date of monthDates) {
      result[date] = tasks.filter(task => task.favorite && shouldShowOnDate(task, date));
    }
    return result;
  }, [tasks, monthDates]);

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(date);
    setViewMode('day');
  }, [setSelectedDate, setViewMode]);

  // 주 단위로 날짜 그룹화
  const weeks = useMemo(() => {
    const result: string[][] = [];
    for (let i = 0; i < monthDates.length; i += 7) {
      result.push(monthDates.slice(i, i + 7));
    }
    return result;
  }, [monthDates]);

  return (
    <div className="flex h-full flex-col">
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
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const MonthlyScheduleView = memo(MonthlyScheduleViewComponent);
export default MonthlyScheduleView;

/* eslint-disable react-refresh/only-export-components */
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
import { getLocalDate, minutesToTimeStr } from '@/shared/lib/utils';

// ============================================================================
// Constants
// ============================================================================

const WEEK_DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const POPOVER_CLOSE_DELAY = 300; // 팝오버 닫기 지연 시간 (ms)

// ============================================================================
// Helper Functions
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

function getMonthInfo(dateStr: string): { year: number; month: number } {
  const date = parseYmdToLocalDate(dateStr) ?? new Date(dateStr);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

export function calculateMonthDates(selectedDate: string): string[] {
  const parsed = parseYmdToLocalDate(selectedDate);
  if (!parsed) return [];

  const date = parsed;
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
    dates.push(getLocalDate(d));
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
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const TaskPopover = memo(function TaskPopover({ 
  tasks, 
  date, 
  position, 
  onClose: _onClose, // 명시적 닫기용 (현재 미사용)
  onDayClick,
  onMouseEnter,
  onMouseLeave,
}: TaskPopoverProps) {
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

  const dateObj = parseYmdToLocalDate(date) ?? new Date(date);
  const formattedDate = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;

  return (
    <div
      ref={popoverRef}
      className="fixed z-[100] min-w-[200px] max-w-[280px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl overflow-hidden"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
                  {minutesToTimeStr(task.startTime)} - {minutesToTimeStr(task.endTime)}
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
  const dateObj = parseYmdToLocalDate(date) ?? new Date(date);
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
      className={`
        relative border-b border-r p-1 min-h-[80px] cursor-pointer transition-all
        ${isToday 
          ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/50 ring-2 ring-inset ring-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/15' 
          : !isCurrentMonth 
            ? 'bg-[var(--color-bg-tertiary)]/50 border-[var(--color-border)]/30 hover:bg-[var(--color-bg-secondary)]/50'
            : isWeekend 
              ? 'bg-[var(--color-bg-tertiary)]/30 border-[var(--color-border)]/30 hover:bg-[var(--color-bg-secondary)]/50'
              : 'border-[var(--color-border)]/30 hover:bg-[var(--color-bg-secondary)]/50'
        }
      `}
      onClick={() => onDayClick(date)}
      onMouseEnter={(e) => tasks.length > 0 && onHover(date, e)}
      onMouseLeave={onLeave}
    >
      {/* 오늘 마커 - 상단 컬러바 */}
      {isToday && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--color-primary)]" />
      )}
      
      {/* 날짜 */}
      <div className="flex items-center justify-between mb-1">
        <div className={`text-xs font-semibold ${
          isToday
            ? 'text-white bg-[var(--color-primary)] rounded-full w-6 h-6 flex items-center justify-center shadow-sm shadow-[var(--color-primary)]/50'
            : !isCurrentMonth
              ? 'text-[var(--color-text-tertiary)]'
              : isWeekend
                ? 'text-red-400'
                : 'text-[var(--color-text)]'
        }`}>
          {day}
        </div>
        {/* 오늘 라벨 */}
        {isToday && (
          <span className="text-[8px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/20 px-1.5 py-0.5 rounded-full">
            오늘
          </span>
        )}
        {/* 색상 도트 (오늘이 아닐 때만) */}
        {!isToday && colorDots.length > 0 && (
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
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMouseOverPopoverRef = useRef(false);
  const isMouseOverCellRef = useRef(false);

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

  // 이번 달 통계 계산
  const monthStats = useMemo(() => {
    const today = getLocalDate();
    let totalTasks = 0;
    let todayTasks = 0;
    let upcomingTasks = 0;
    let completedDays = 0; // 일정이 있는 지난 날
    const upcomingList: Array<{ date: string; task: TempScheduleTask }> = [];
    
    for (const date of monthDates) {
      const dateTasks = tasksByDate[date] || [];
      const dateMonth = (parseYmdToLocalDate(date) ?? new Date(date)).getMonth() + 1;
      
      // 이번 달만 카운트
      if (dateMonth === currentMonth) {
        totalTasks += dateTasks.length;
        
        if (date === today) {
          todayTasks = dateTasks.length;
        } else if (date > today) {
          upcomingTasks += dateTasks.length;
          // 다가오는 일정 최대 5개
          if (upcomingList.length < 5) {
            for (const task of dateTasks) {
              if (upcomingList.length < 5) {
                upcomingList.push({ date, task });
              }
            }
          }
        } else if (dateTasks.length > 0) {
          completedDays++;
        }
      }
    }
    
    return { totalTasks, todayTasks, upcomingTasks, completedDays, upcomingList };
  }, [monthDates, tasksByDate, currentMonth]);

  const handleDayClick = useCallback((date: string) => {
    setHoveredDate(null);
    setPopoverPosition(null);
    setSelectedDate(date);
    setViewMode('day');
  }, [setSelectedDate, setViewMode]);

  const handleHover = useCallback((date: string, e: React.MouseEvent) => {
    // 닫기 타이머 취소
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    
    isMouseOverCellRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredDate(date);
    setPopoverPosition({
      x: rect.right + 10,
      y: rect.top,
    });
  }, []);

  const handleLeave = useCallback(() => {
    isMouseOverCellRef.current = false;
    
    // 팝오버로 마우스가 이동할 수 있도록 딜레이
    closeTimeoutRef.current = setTimeout(() => {
      // 셀이나 팝오버 위에 없을 때만 닫기
      if (!isMouseOverCellRef.current && !isMouseOverPopoverRef.current) {
        setHoveredDate(null);
        setPopoverPosition(null);
      }
    }, POPOVER_CLOSE_DELAY);
  }, []);

  const handlePopoverMouseEnter = useCallback(() => {
    isMouseOverPopoverRef.current = true;
    // 닫기 타이머 취소
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handlePopoverMouseLeave = useCallback(() => {
    isMouseOverPopoverRef.current = false;
    
    // 팝오버에서 나갔을 때도 딜레이 후 닫기
    closeTimeoutRef.current = setTimeout(() => {
      if (!isMouseOverCellRef.current && !isMouseOverPopoverRef.current) {
        setHoveredDate(null);
        setPopoverPosition(null);
      }
    }, POPOVER_CLOSE_DELAY);
  }, []);

  const handlePopoverClose = useCallback(() => {
    isMouseOverCellRef.current = false;
    isMouseOverPopoverRef.current = false;
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
      {/* 요일 헤더 (Phase 4: grid 레이아웃으로 변경하여 바디와 정렬 일치) */}
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        {WEEK_DAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={`py-2 text-center text-xs font-semibold ${
              index >= 5 ? 'text-red-400' : 'text-[var(--color-text-secondary)]'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="flex-1 min-h-0">
        <div className="h-full flex flex-col">
          {/* 캘린더 셀들 (Phase 4: grid 레이아웃으로 변경하여 헤더와 정렬 일치) */}
          <div className="flex-shrink-0">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7">
                {week.map((date) => (
                  <DayCell
                    key={date}
                    date={date}
                    currentMonth={currentMonth}
                    tasks={tasksByDate[date] || []}
                    onDayClick={handleDayClick}
                    onHover={handleHover}
                    onLeave={handleLeave}
                  />
                ))}
              </div>
            ))}
          </div>
          
          {/* 하단 요약 패널 */}
          <div className="flex-1 min-h-[120px] border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 p-4">
            <div className="flex gap-6 h-full">
              {/* 이번 달 통계 */}
              <div className="flex-shrink-0 space-y-3">
                <h4 className="text-xs font-bold text-[var(--color-text-secondary)] flex items-center gap-1">
                  📊 {currentMonth}월 요약
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[var(--color-primary)]">{monthStats.totalTasks}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">총 일정</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-green-400">{monthStats.todayTasks}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">오늘 일정</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-blue-400">{monthStats.upcomingTasks}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">예정 일정</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-amber-400">{monthStats.completedDays}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">활동일</span>
                  </div>
                </div>
              </div>
              
              {/* 구분선 */}
              <div className="w-px bg-[var(--color-border)]" />
              
              {/* 다가오는 일정 미리보기 */}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-[var(--color-text-secondary)] flex items-center gap-1 mb-2">
                  📅 다가오는 일정
                </h4>
                {monthStats.upcomingList.length === 0 ? (
                  <div className="text-xs text-[var(--color-text-tertiary)] py-2">
                    예정된 일정이 없습니다
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {monthStats.upcomingList.map(({ date, task }) => {
                      const dateObj = parseYmdToLocalDate(date) ?? new Date(date);
                      const day = dateObj.getDate();
                      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
                      
                      return (
                        <div
                          key={`${date}-${task.id}`}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] cursor-pointer transition-colors"
                          onClick={() => handleDayClick(date)}
                        >
                          <div 
                            className="w-1 h-6 rounded-full flex-shrink-0"
                            style={{ backgroundColor: task.color }}
                          />
                          <div className="min-w-0">
                            <div className="text-[10px] text-[var(--color-text-tertiary)]">
                              {day}일 ({dayOfWeek})
                            </div>
                            <div className="text-xs font-medium text-[var(--color-text)] truncate max-w-[120px]">
                              {task.name}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 팝오버 */}
      {hoveredDate && popoverPosition && (
        <TaskPopover
          tasks={tasksByDate[hoveredDate] || []}
          date={hoveredDate}
          position={popoverPosition}
          onClose={handlePopoverClose}
          onDayClick={handleDayClick}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        />
      )}
    </div>
  );
}

export const MonthlyScheduleView = memo(MonthlyScheduleViewComponent);
export default MonthlyScheduleView;

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
import {
  useTimelineData,
  TIMELINE_END_HOUR,
  HOUR_HEIGHT,
  BLOCK_BOUNDARIES,
  PIXELS_PER_MINUTE,
} from './useTimelineData';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useDragDropManager } from '@/features/schedule/hooks/useDragDropManager';
import { loadGlobalGoals } from '@/data/repositories';
import { TIME_BLOCKS, type Task, type TimeBlockId, type DailyGoal } from '@/shared/types/domain';
import { generateId } from '@/shared/lib/utils';
import TimelineTaskBlock from './TimelineTaskBlock';
import TaskModal from '@/features/schedule/TaskModal';
import { useTempScheduleStore } from '@/features/tempSchedule/stores/tempScheduleStore';
import { TEMP_SCHEDULE_DEFAULTS } from '@/shared/types/tempSchedule';

/** 시간 초과 경고 임계값 (분) */
const OVERTIME_THRESHOLD = 50;

/** 3시간 블록 배경색 (오전/오후/저녁) */
const BLOCK_BACKGROUND_COLORS: Record<number, string> = {
  5: 'bg-blue-500/5',    // 이른 아침 (05-08)
  8: 'bg-sky-500/5',     // 오전 (08-11)
  11: 'bg-amber-500/5',  // 점심 (11-14)
  14: 'bg-orange-500/5', // 오후 (14-17)
  17: 'bg-purple-500/5', // 저녁 (17-20)
  20: 'bg-indigo-500/5', // 밤 (20-23)
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
  const { timelineItems, hourGroups, totalHeight, visibleStartHour, showPastBlocks, toggleShowPastBlocks } = useTimelineData();
  const { updateTask, addTask, deleteTask } = useDailyDataStore();
  const { setDragData, getDragData } = useDragDropManager();

  const [currentTimePosition, setCurrentTimePosition] = useState<number | null>(null);
  const [goals, setGoals] = useState<DailyGoal[]>([]);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedHourSlot, setSelectedHourSlot] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<TimeBlockId>(null);

  // 드래그 상태
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 임시 스케줄 데이터 가져오기 (오버레이용)
  const {
    tasks: tempTasks,
    loadData: loadTempData,
    getTasksForDate: getTempTasksForDate
  } = useTempScheduleStore();

  // 현재 날짜의 임시 스케줄 로드
  useEffect(() => {
    loadTempData();
  }, [loadTempData]);

  // 임시 스케줄 고스트 블록 계산
  const tempScheduleBlocks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]; // 일단 오늘 날짜 기준 (TimelineView가 날짜를 prop으로 받지 않음)
    // TODO: TimelineView가 날짜를 prop으로 받게 되면 수정 필요. 현재는 오늘 기준.

    const tasks = getTempTasksForDate(today);

    return tasks.map(t => {
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
    }).filter(b => b.height > 0);
  }, [getTempTasksForDate, visibleStartHour, tempTasks]);

  // 시간대별 초과 여부 계산
  const overtimeHours = useMemo(() => {
    const overtime = new Set<number>();
    hourGroups.forEach(group => {
      if (group.totalDuration > OVERTIME_THRESHOLD) {
        overtime.add(group.hour);
      }
    });
    return overtime;
  }, [hourGroups]);

  // 목표 목록 로드
  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const loadedGoals = await loadGlobalGoals();
        setGoals(loadedGoals);
      } catch (error) {
        console.error('Failed to load goals:', error);
      }
    };
    fetchGoals();
  }, []);

  // 목표 ID → 색상 맵
  const goalColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    goals.forEach(goal => {
      if (goal.color) {
        map[goal.id] = goal.color;
      }
    });
    return map;
  }, [goals]);

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

  // 시간 레이블 생성 (visibleStartHour ~ 23:00)
  const hourLabels = Array.from(
    { length: TIMELINE_END_HOUR - visibleStartHour + 1 },
    (_, i) => visibleStartHour + i
  );

  // 시간 → 타임블록 ID 변환
  const getBlockIdFromHour = useCallback((hour: number): TimeBlockId => {
    const block = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
    return block ? (block.id as TimeBlockId) : null;
  }, []);

  // 작업 클릭 핸들러 (TaskModal 열기)
  const handleTaskClick = useCallback((task: Task) => {
    setEditingTask(task);
    setSelectedBlockId(task.timeBlock);
    setSelectedHourSlot(task.hourSlot ?? null);
    setIsModalOpen(true);
  }, []);

  // 빈 시간대 클릭 핸들러
  const handleEmptyHourClick = useCallback((hour: number) => {
    const blockId = getBlockIdFromHour(hour);
    setEditingTask(null);
    setSelectedBlockId(blockId);
    setSelectedHourSlot(hour);
    setIsModalOpen(true);
  }, [getBlockIdFromHour]);

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
        // 새 작업 생성
        const newTask: Task = {
          id: generateId('task'),
          text: taskData.text || '',
          memo: taskData.memo || '',
          baseDuration: taskData.baseDuration || 15,
          resistance: taskData.resistance || 'low',
          adjustedDuration: taskData.adjustedDuration || taskData.baseDuration || 15,
          timeBlock: selectedBlockId,
          hourSlot: selectedHourSlot ?? undefined,
          completed: false,
          actualDuration: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
          goalId: taskData.goalId,
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
  }, [editingTask, selectedBlockId, selectedHourSlot, updateTask, addTask, handleCloseModal]);

  // 드래그 시작 핸들러
  const handleDragStart = useCallback((task: Task, e: React.DragEvent) => {
    setDragData({
      taskId: task.id,
      sourceBlockId: task.timeBlock,
      sourceHourSlot: task.hourSlot,
      taskData: task,
    }, e);
  }, [setDragData]);

  // 드래그 오버 핸들러
  const handleDragOver = useCallback((e: React.DragEvent, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverHour(hour);
  }, []);

  // 드래그 리브 핸들러
  const handleDragLeave = useCallback(() => {
    setDragOverHour(null);
  }, []);

  // 드롭 핸들러
  const handleDrop = useCallback(async (e: React.DragEvent, targetHour: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverHour(null);

    const dragData = getDragData(e);
    if (!dragData) return;

    // 같은 시간대면 무시
    if (dragData.sourceHourSlot === targetHour) return;

    const targetBlockId = getBlockIdFromHour(targetHour);

    try {
      await updateTask(dragData.taskId, {
        timeBlock: targetBlockId,
        hourSlot: targetHour,
      });
    } catch (error) {
      console.error('Failed to move task:', error);
    }
  }, [getDragData, getBlockIdFromHour, updateTask]);

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
          {/* 시간 눈금 및 구분선 + 빈 시간대 클릭 영역 */}
          {hourLabels.map((hour, index) => {
            const isBlockBoundary = BLOCK_BOUNDARIES.includes(hour);
            const top = index * HOUR_HEIGHT;
            const isDragOver = dragOverHour === hour;
            const isOvertime = overtimeHours.has(hour);
            const hourGroup = hourGroups.find(g => g.hour === hour);
            const overtimeMinutes = hourGroup ? hourGroup.totalDuration - 60 : 0;
            const hasNoTasks = !hourGroup || hourGroup.tasks.length === 0;

            // 3시간 블록 배경색 계산
            const blockStart = BLOCK_BOUNDARIES.find((b, i) =>
              hour >= b && (i === BLOCK_BOUNDARIES.length - 1 || hour < BLOCK_BOUNDARIES[i + 1])
            ) ?? 5;
            const blockBgColor = BLOCK_BACKGROUND_COLORS[blockStart] || '';

            return (
              <div
                key={hour}
                className={`absolute left-0 right-0 transition-colors duration-150 ${blockBgColor} ${isDragOver ? 'bg-[var(--color-primary)]/15' : ''
                  } ${isOvertime ? 'bg-red-500/15' : ''}`}
                style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
                onDragOver={(e) => handleDragOver(e, hour)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, hour)}
              >
                {/* 시간 구분선 */}
                <div
                  className={`absolute left-0 right-0 top-0 ${isBlockBoundary
                    ? 'border-t-2 border-[var(--color-text-tertiary)]/40'
                    : 'border-t border-[var(--color-border)]/40'
                    }`}
                />
                {/* 30분 보조선 */}
                <div
                  className="absolute left-6 right-0 border-t border-dashed border-[var(--color-border)]/20"
                  style={{ top: `${HOUR_HEIGHT / 2}px` }}
                />
                {/* 시간 레이블 */}
                <div
                  className={`absolute left-0.5 top-0.5 text-[10px] font-semibold ${isBlockBoundary
                    ? 'text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)]'
                    }`}
                >
                  {String(hour).padStart(2, '0')}
                  {isBlockBoundary && <span className="text-[8px] ml-0.5 opacity-60">:00</span>}
                </div>
                {/* 시간 초과 경고 표시 */}
                {isOvertime && (
                  <div
                    className="absolute right-1 top-0.5 text-[9px] text-red-400 font-medium flex items-center gap-0.5 animate-pulse"
                    title={`${hourGroup?.totalDuration}분 계획됨 (+${overtimeMinutes}분 초과)`}
                  >
                    <span>⚠️</span>
                    <span>+{overtimeMinutes}분</span>
                  </div>
                )}
                {/* 빈 시간대 표시 및 클릭 영역 */}
                <div
                  className="absolute left-6 right-0 top-0 bottom-0 cursor-pointer group transition-colors duration-150"
                  onClick={() => handleEmptyHourClick(hour)}
                  title={`${hour}시에 작업 추가`}
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
                  goalColor={item.task.goalId ? goalColorMap[item.task.goalId] : null}
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

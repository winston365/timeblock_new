/**
 * 임시 스케줄 작업 목록
 *
 * @role 우측 패널에 스케줄 작업 목록 표시
 * @responsibilities
 *   - 등록된 모든 스케줄 작업 목록 표시
 *   - 반복 규칙 표시
 *   - 작업 추가/편집/삭제 버튼
 *   - 오늘/내일/이후 기준 그룹화 및 정렬
 *   - D-Day 상대적 표시
 *   - 임박 일정 하이라이트
 * @dependencies useTempScheduleStore
 */

import { memo, useMemo, useState, useEffect } from 'react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import { minutesToTimeStr } from '@/shared/lib/utils';
import {
  getNextUpcomingTask,
  getTodayStr,
  groupTasksByDate,
  normalizeYmd,
  splitTasksByRecurrence,
} from '../utils/taskGrouping';
import { TaskListGroup } from './taskList/TaskListGroup';
import { TaskListItem } from './taskList/TaskListItem';

// ============================================================================
// Constants
// ============================================================================

/** 진행 중 일정 갱신 간격 (ms) */
const REFRESH_INTERVAL_MS = 60_000; // 1분

// ============================================================================
// Helper Functions
// ============================================================================

/** 현재 진행 중인 일정인지 확인 */
function isInProgress(task: TempScheduleTask, currentMinutes: number): boolean {
  const today = getTodayStr();
  const scheduledDate = normalizeYmd(task.scheduledDate) ?? today;
  
  if (scheduledDate !== today) return false;
  
  return task.startTime <= currentMinutes && currentMinutes < task.endTime;
}

// ============================================================================
// Main Component
// ============================================================================

interface TempScheduleTaskListProps {
  tasks: TempScheduleTask[];
}

function TempScheduleTaskListComponent({ tasks }: TempScheduleTaskListProps) {
  const { openTaskModal, deleteTask } = useTempScheduleStore();
  
  // 현재 시간 상태 (분 단위, 자동 갱신)
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  
  // 1분마다 현재 시간 갱신 (진행 중 일정 & 임박 일정 자동 업데이트)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.getHours() * 60 + now.getMinutes());
    }, REFRESH_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, []);

  // 반복/일회성 분리 + 일회성은 날짜별 그룹화
  const { recurring, dateGroups, todayCount, inProgressCount, nextUpTask } = useMemo(() => {
    const { recurring: recurringTasks, oneTime: oneTimeTasks } = splitTasksByRecurrence(tasks);

    // 반복 일정은 시간순 정렬
    recurringTasks.sort((a, b) => a.startTime - b.startTime);

    // 일회성 일정은 날짜 그룹화
    const groups = groupTasksByDate(oneTimeTasks);
    
    // 오늘 일정 수 계산
    const todayGroup = groups.find(g => g.label === '오늘');
    const todayTaskCount = todayGroup?.tasks.length ?? 0;
    
    // 진행 중인 일정 수
    const progressCount = tasks.filter(task => isInProgress(task, currentTime)).length;
    
    // 다음 예정 일정
    const nextTask = getNextUpcomingTask(oneTimeTasks, currentTime);

    return { 
      recurring: recurringTasks, 
      dateGroups: groups,
      todayCount: todayTaskCount,
      inProgressCount: progressCount,
      nextUpTask: nextTask,
    };
  }, [tasks, currentTime]);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text)]">📋 스케줄 목록</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              총 {tasks.length}개
            </span>
            {todayCount > 0 && (
              <span className="text-[10px] text-[var(--color-primary)] font-medium">
                오늘 {todayCount}개
              </span>
            )}
            {inProgressCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium animate-pulse">
                ⏳ {inProgressCount}개 진행 중
              </span>
            )}
          </div>
        </div>
        <button
          className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold hover:bg-[var(--color-primary-dark)] transition-colors"
          onClick={() => openTaskModal()}
        >
          + 추가
        </button>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-tertiary)]">
            <div className="text-4xl mb-2">📅</div>
            <p className="text-sm">등록된 스케줄이 없습니다</p>
            <button
              className="mt-3 text-xs text-[var(--color-primary)] hover:underline"
              onClick={() => openTaskModal()}
            >
              첫 번째 스케줄을 추가해보세요!
            </button>
          </div>
        ) : (
          <>
            {/* 날짜별 일회성 일정 (오늘/내일/이번주/다가오는) */}
            {dateGroups.map(group => (
              <TaskListGroup
                key={group.label}
                label={group.label}
                emoji={group.emoji}
                count={group.tasks.length}
                variant={group.label === '오늘' ? 'today' : group.label === '지난 일정' ? 'past' : 'default'}
              >
                {group.tasks.map(task => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onEdit={openTaskModal}
                    onDelete={deleteTask}
                    showDDay={group.label !== '오늘' && group.label !== '지난 일정'}
                    isNextUp={nextUpTask?.id === task.id}
                    currentTime={currentTime}
                  />
                ))}
              </TaskListGroup>
            ))}

            {/* 반복 일정 */}
            {recurring.length > 0 && (
              <TaskListGroup label="반복 일정" emoji="🔄" count={recurring.length} variant="recurring">
                {recurring.map(task => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onEdit={openTaskModal}
                    onDelete={deleteTask}
                    currentTime={currentTime}
                  />
                ))}
              </TaskListGroup>
            )}
          </>
        )}
      </div>

      {/* 푸터 - 총 개수 + 현재 시간 */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 flex justify-between items-center">
        <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
          {minutesToTimeStr(currentTime)} 기준
        </span>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          총 {tasks.length}개의 스케줄
        </span>
      </div>
    </div>
  );
}

export const TempScheduleTaskList = memo(TempScheduleTaskListComponent);
export default TempScheduleTaskList;

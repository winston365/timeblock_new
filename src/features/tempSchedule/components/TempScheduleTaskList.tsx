/**
 * 임시 스케줄 작업 목록
 *
 * @role 우측 패널에 스케줄 작업 목록 표시
 * @responsibilities
 *   - 등록된 모든 스케줄 작업 목록 표시
 *   - 반복 규칙 표시
 *   - 작업 추가/편집/삭제 버튼
 * @dependencies useTempScheduleStore
 */

import { memo, useMemo } from 'react';
import { useTempScheduleStore } from '../stores/tempScheduleStore';
import type { TempScheduleTask, RecurrenceRule } from '@/shared/types/tempSchedule';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 반복 규칙을 읽기 쉬운 문자열로 변환
 */
function getRecurrenceLabel(recurrence: RecurrenceRule): string {
  switch (recurrence.type) {
    case 'daily':
      return '매일';
    case 'weekly':
      if (!recurrence.weeklyDays || recurrence.weeklyDays.length === 0) return '매주';
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayNames = recurrence.weeklyDays.sort((a, b) => a - b).map(d => days[d]);
      return `매주 ${dayNames.join(', ')}`;
    case 'monthly':
      return '매월';
    case 'custom':
      return `${recurrence.intervalDays}일마다`;
    case 'none':
    default:
      return '1회';
  }
}

/**
 * 시간 범위 포맷
 */
function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

// ============================================================================
// Sub Components
// ============================================================================

interface TaskItemProps {
  task: TempScheduleTask;
  onEdit: (task: TempScheduleTask) => void;
  onDelete: (id: string) => void;
}

const TaskItem = memo(function TaskItem({ task, onEdit, onDelete }: TaskItemProps) {
  return (
    <div
      className="group flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 transition-all hover:border-[var(--color-primary)]/50 hover:shadow-md cursor-pointer"
      onClick={() => onEdit(task)}
    >
      {/* 색상 표시 */}
      <div
        className="w-1 self-stretch rounded-full flex-shrink-0"
        style={{ backgroundColor: task.color }}
      />

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[var(--color-text)] truncate">
            {task.name}
          </span>
          {task.parentId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]">
              중첩
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-text-secondary)]">
          <span className="font-mono">{formatTimeRange(task.startTime, task.endTime)}</span>
          <span className="text-[var(--color-border)]">•</span>
          <span>{getRecurrenceLabel(task.recurrence)}</span>
        </div>

        {task.scheduledDate && task.recurrence.type === 'none' && (
          <div className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">
            📅 {task.scheduledDate}
          </div>
        )}

        {task.memo && (
          <div className="mt-1 text-[10px] text-[var(--color-text-tertiary)] truncate">
            {task.memo}
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          title="편집"
        >
          ✏️
        </button>
        <button
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-tertiary)] hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('이 스케줄을 삭제하시겠습니까?')) {
              onDelete(task.id);
            }
          }}
          title="삭제"
        >
          🗑️
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

interface TempScheduleTaskListProps {
  tasks: TempScheduleTask[];
}

function TempScheduleTaskListComponent({ tasks }: TempScheduleTaskListProps) {
  const { openTaskModal, deleteTask } = useTempScheduleStore();

  // 반복 유형별 그룹화
  const groupedTasks = useMemo(() => {
    const recurring: TempScheduleTask[] = [];
    const oneTime: TempScheduleTask[] = [];

    for (const task of tasks) {
      if (task.recurrence.type !== 'none') {
        recurring.push(task);
      } else {
        oneTime.push(task);
      }
    }

    return { recurring, oneTime };
  }, [tasks]);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text)]">📋 스케줄 목록</h3>
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
            총 {tasks.length}개의 스케줄
          </p>
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
            {/* 반복 일정 */}
            {groupedTasks.recurring.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                  🔄 반복 일정 ({groupedTasks.recurring.length})
                </h4>
                <div className="space-y-2">
                  {groupedTasks.recurring.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onEdit={openTaskModal}
                      onDelete={deleteTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 일회성 일정 */}
            {groupedTasks.oneTime.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                  📌 예정 일정 ({groupedTasks.oneTime.length})
                </h4>
                <div className="space-y-2">
                  {groupedTasks.oneTime.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onEdit={openTaskModal}
                      onDelete={deleteTask}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export const TempScheduleTaskList = memo(TempScheduleTaskListComponent);
export default TempScheduleTaskList;

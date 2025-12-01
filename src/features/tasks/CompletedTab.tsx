/**
 * @file CompletedTab.tsx
 * @role 완료된 작업을 날짜별 타임라인 형태로 표시하는 탭
 * @input useCompletedTasksStore에서 완료된 작업 데이터
 * @output 날짜별 그룹화된 완료 작업 목록, XP 합계 UI
 * @dependencies useCompletedTasksStore, calculateTaskXP, formatTime
 */

import { useEffect } from 'react';
import { formatTime, calculateTaskXP } from '@/shared/lib/utils';
import type { Task } from '@/shared/types/domain';
import { useCompletedTasksStore } from '@/shared/stores/completedTasksStore';

export default function CompletedTab() {
  // Store Hooks
  const { completedTasks, loading, loadData, toggleTaskCompletion } = useCompletedTasksStore();

  useEffect(() => {
    loadData(30); // 최근 30일치 로드
  }, [loadData]);

  const handleToggleTask = async (task: Task) => {
    await toggleTaskCompletion(task);
  };

  const sortedTasks = [...completedTasks].sort((a, b) => {
    if (!a.completedAt && !b.completedAt) return 0;
    if (!a.completedAt) return 1;
    if (!b.completedAt) return -1;
    return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
  });

  const totalXP = completedTasks.reduce((sum, task) => sum + calculateTaskXP(task), 0);

  // 날짜별 그룹 (타임라인)
  const groupedByDate = sortedTasks.reduce<Record<string, Task[]>>((acc, task) => {
    const date = task.completedAt ? task.completedAt.slice(0, 10) : '날짜 없음';
    if (!acc[date]) acc[date] = [];
    acc[date].push(task);
    return acc;
  }, {});

  const orderedDates = Object.keys(groupedByDate).sort((a, b) => {
    if (a === '날짜 없음') return 1;
    if (b === '날짜 없음') return -1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  if (loading && completedTasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-6 text-sm text-[var(--color-text-secondary)]">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="text-base font-semibold text-[var(--color-text)]">✅ 완료</h3>
        <div className="flex items-center gap-3 text-xs font-semibold text-[var(--color-text-secondary)]">
          <span>{completedTasks.length}개</span>
          <span className="rounded-full bg-[var(--color-primary)]/90 px-3 py-1 text-[var(--color-text)]">+{totalXP} XP</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {completedTasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
            <p className="text-lg font-semibold text-[var(--color-text)]">📝 완료된 작업이 없습니다</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">작업을 완료하면 이 곳에 표시됩니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {orderedDates.map(date => {
              const tasksForDate = groupedByDate[date] || [];
              const dateXP = tasksForDate.reduce((sum, t) => sum + calculateTaskXP(t), 0);

              return (
                <div key={date} className="flex flex-col gap-2">
                  <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-[var(--color-bg-elevated)]/90 px-2 py-1 text-xs font-semibold text-[var(--color-text)] backdrop-blur">
                    <span>{date}</span>
                    <span className="text-[var(--color-text-secondary)]">{tasksForDate.length}개 · +{dateXP} XP</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {tasksForDate.map(task => {
                      const xp = calculateTaskXP(task);
                      const completedTime = task.completedAt
                        ? formatTime(new Date(task.completedAt))
                        : '-';

                      return (
                        <div
                          key={task.id}
                          className="flex gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm shadow-inner"
                        >
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] text-base transition hover:scale-125"
                            onClick={() => handleToggleTask(task)}
                            title="완료 취소"
                          >
                            ✅
                          </button>

                          <div className="flex flex-1 flex-col gap-1">
                            <div className="text-sm font-semibold text-[var(--color-text-secondary)] line-through">
                              {task.text}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[var(--color-text-tertiary)] text-xs">
                              <span>⏰ {completedTime}</span>
                              {task.timeBlock && <span>🕒 {task.timeBlock}</span>}
                              <span className="font-semibold text-[var(--color-primary)]">+{xp} XP</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

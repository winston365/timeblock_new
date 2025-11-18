/**
 * CompletedTab
 *
 * @role 완료된 작업 목록을 표시하고 관리하는 탭 컴포넌트
 * @input 없음
 * @output 완료된 작업 목록, 총 획득 XP, 완료 시간, 완료 취소 버튼을 포함한 UI
 * @external_dependencies
 *   - useCompletedTasks: 완료된 작업 목록 훅
 *   - formatTime, calculateTaskXP: 유틸리티 함수
 *   - toggleTaskCompletionRepo: DB 요청
 */

import { useState, useEffect } from 'react';
import { useCompletedTasks } from '@/shared/hooks';
import { formatTime, calculateTaskXP } from '@/shared/lib/utils';
import { toggleTaskCompletion as toggleTaskCompletionRepo } from '@/data/repositories';
import type { Task } from '@/shared/types/domain';

export default function CompletedTab() {
  const { completedTasks: initialCompletedTasks, loading } = useCompletedTasks();
  const [completedTasks, setCompletedTasks] = useState<Task[]>(initialCompletedTasks);

  useEffect(() => {
    setCompletedTasks(initialCompletedTasks);
  }, [initialCompletedTasks]);

  const handleToggleTask = async (task: Task) => {
    try {
      setCompletedTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));
      const taskDate = task.completedAt
        ? new Date(task.completedAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      await toggleTaskCompletionRepo(task.id, taskDate);
    } catch (error) {
      console.error('Failed to toggle task:', error);
      setCompletedTasks(initialCompletedTasks);
      alert('작업 취소에 실패했습니다.');
    }
  };

  const sortedTasks = [...completedTasks].sort((a, b) => {
    if (!a.completedAt || !b.completedAt) return 0;
    return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
  });

  const totalXP = completedTasks.reduce((sum, task) => sum + calculateTaskXP(task), 0);

  if (loading) {
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
          <div className="flex flex-col gap-3">
            {sortedTasks.map(task => {
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
                      <span>🕐 {completedTime}</span>
                      {task.timeBlock && <span>📍 {task.timeBlock}</span>}
                      <span className="font-semibold text-[var(--color-primary)]">+{xp} XP</span>
                    </div>
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

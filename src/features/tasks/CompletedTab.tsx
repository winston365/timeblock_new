/**
 * CompletedTab
 *
 * @role 완료된 작업 목록을 표시하고 관리하는 탭 컴포넌트
 * @input 없음
 * @output 완료된 작업 목록, 총 획득 XP, 완료 시간, 완료 취소 버튼을 포함한 UI
 * @external_dependencies
 *   - useDailyData: 일일 데이터 관리 훅
 *   - useInboxStore: 인박스 상태 관리 Store
 *   - formatTime, calculateTaskXP: 유틸리티 함수
 */

import { useMemo, useEffect } from 'react';
import { useDailyData } from '@/shared/hooks';
import { useInboxStore } from '@/shared/stores/inboxStore';
import { formatTime, calculateTaskXP, getLocalDate } from '@/shared/lib/utils';
import type { Task } from '@/shared/types/domain';

export default function CompletedTab() {
  // ✅ Store 중심 아키텍처: Zustand selector 패턴으로 확실한 구독
  const { dailyData, loading: dailyLoading, toggleTaskCompletion } = useDailyData();
  const inboxCompletedTasks = useInboxStore(state => state.completedTasks);
  const inboxLoading = useInboxStore(state => state.loading);
  const toggleInboxTaskCompletion = useInboxStore(state => state.toggleInboxTaskCompletion);
  const loadCompletedTasks = useInboxStore(state => state.loadCompletedTasks);

  // ✅ Inbox 완료된 작업 로드 (마운트 시 1회만)
  useEffect(() => {
    console.log('[CompletedTab] Loading completed tasks...');
    loadCompletedTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 배열: 마운트 시에만 실행

  // ✅ dailyData와 inbox의 완료된 작업 합치기 (useMemo로 최적화)
  const completedTasks = useMemo(() => {
    const dailyCompletedTasks = dailyData?.tasks.filter(task => task.completed) || [];
    return [...dailyCompletedTasks, ...inboxCompletedTasks];
  }, [dailyData, inboxCompletedTasks]);

  const loading = dailyLoading || inboxLoading;

  const handleToggleTask = async (task: Task) => {
    try {
      // ✅ Store 액션 사용 (자동 동기화)
      if (task.timeBlock !== null) {
        // dailyData의 작업 (timeBlock이 있음)
        await toggleTaskCompletion(task.id);
      } else {
        // inbox 작업 (timeBlock이 null)
        await toggleInboxTaskCompletion(task.id);
      }
      // ❌ 수동 상태 업데이트 제거 - Store가 자동으로 처리
    } catch (error) {
      console.error('Failed to toggle task:', error);
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

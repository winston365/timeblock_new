/**
 * CompletedTab
 *
 * @role 완료된 작업 목록을 표시하고 관리하는 탭 컴포넌트
 * @input 없음
 * @output 완료된 작업 목록, 총 획득 XP, 완료 시간, 완료 취소 버튼을 포함한 UI
 * @external_dependencies
 *   - useCompletedTasks: 완료된 작업 목록 훅
 *   - useDailyData: 일일 데이터 및 작업 토글 훅
 *   - formatTime, calculateTaskXP: 유틸리티 함수
 *   - tasks.css: 스타일시트
 */

import { useState, useEffect } from 'react';
import { useCompletedTasks } from '@/shared/hooks';
import { formatTime, calculateTaskXP } from '@/shared/lib/utils';
import { toggleTaskCompletion as toggleTaskCompletionRepo } from '@/data/repositories';
import type { Task } from '@/shared/types/domain';

/**
 * 완료 탭 컴포넌트
 *
 * @returns {JSX.Element} 완료된 작업 목록 UI
 * @sideEffects
 *   - 완료 취소 시 Firebase 동기화
 *   - 완료 시간 역순 정렬 (최근 것이 위)
 */
export default function CompletedTab() {
  const { completedTasks: initialCompletedTasks, loading } = useCompletedTasks();
  const [completedTasks, setCompletedTasks] = useState<Task[]>(initialCompletedTasks);

  // initialCompletedTasks가 변경되면 로컬 state 업데이트
  useEffect(() => {
    setCompletedTasks(initialCompletedTasks);
  }, [initialCompletedTasks]);

  const handleToggleTask = async (task: Task) => {
    try {
      // Optimistic UI 업데이트: 즉시 목록에서 제거
      setCompletedTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));

      // completedAt에서 날짜 추출 (YYYY-MM-DD)
      const taskDate = task.completedAt
        ? new Date(task.completedAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // 백그라운드에서 DB 업데이트
      await toggleTaskCompletionRepo(task.id, taskDate);
    } catch (error) {
      console.error('Failed to toggle task:', error);
      // 에러 발생 시 원래 상태로 복원
      setCompletedTasks(initialCompletedTasks);
      alert('작업 취소에 실패했습니다.');
    }
  };

  // 완료 시간 순으로 정렬 (최근 것이 위로)
  const sortedTasks = [...completedTasks].sort((a, b) => {
    if (!a.completedAt || !b.completedAt) return 0;
    return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
  });

  // 총 XP 계산
  const totalXP = completedTasks.reduce((sum, task) => sum + calculateTaskXP(task), 0);

  if (loading) {
    return <div className="flex justify-center items-center p-xl text-text-secondary">로딩 중...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-md border-b border-border">
        <h3 className="text-base font-semibold text-text">✅ 완료</h3>
        <div className="flex gap-sm items-center text-sm">
          <span>{completedTasks.length}개</span>
          <span className="px-2 py-0.5 bg-primary text-white rounded font-semibold">
            +{totalXP} XP
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-md overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {completedTasks.length === 0 ? (
          <div className="text-center p-xl text-text-secondary">
            <p className="text-[2rem] mb-sm">📝 완료된 작업이 없습니다</p>
            <p className="text-sm text-text-tertiary">작업을 완료하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-sm">
            {sortedTasks.map(task => {
              const xp = calculateTaskXP(task);
              const completedTime = task.completedAt
                ? formatTime(new Date(task.completedAt))
                : '-';

              return (
                <div key={task.id} className="flex gap-sm p-sm bg-bg-base border border-border rounded-md items-start">
                  <button
                    className="flex-shrink-0 w-6 h-6 text-base bg-transparent border-none cursor-pointer transition-transform hover:scale-110"
                    onClick={() => handleToggleTask(task)}
                    title="완료 취소"
                  >
                    ✅
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-secondary line-through mb-xs break-words">
                      {task.text}
                    </div>
                    <div className="flex flex-wrap gap-xs text-xs text-text-tertiary">
                      <span>🕐 {completedTime}</span>
                      {task.timeBlock && (
                        <span>📍 {task.timeBlock}</span>
                      )}
                      <span className="text-primary font-semibold">+{xp} XP</span>
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

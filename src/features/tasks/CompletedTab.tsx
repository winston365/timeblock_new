/**
 * src/features/tasks/CompletedTab.tsx
 * 완료 탭 - 완료된 작업 목록
 */

import { useCompletedTasks, useDailyData } from '@/shared/hooks';
import { formatTime, calculateTaskXP } from '@/shared/lib/utils';
import './tasks.css';

export default function CompletedTab() {
  const { completedTasks, loading } = useCompletedTasks();
  const { toggleTaskCompletion } = useDailyData();

  const handleToggleTask = async (taskId: string) => {
    try {
      await toggleTaskCompletion(taskId);
    } catch (error) {
      console.error('Failed to toggle task:', error);
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
    return <div className="tab-loading">로딩 중...</div>;
  }

  return (
    <div className="completed-tab">
      <div className="tab-header">
        <h3>✅ 완료</h3>
        <div className="completed-stats">
          <span>{completedTasks.length}개</span>
          <span className="xp-badge">+{totalXP} XP</span>
        </div>
      </div>

      <div className="tab-content">
        {completedTasks.length === 0 ? (
          <div className="empty-state">
            <p>📝 완료된 작업이 없습니다</p>
            <p className="empty-hint">작업을 완료하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="completed-list">
            {sortedTasks.map(task => {
              const xp = calculateTaskXP(task);
              const completedTime = task.completedAt
                ? formatTime(new Date(task.completedAt))
                : '-';

              return (
                <div key={task.id} className="completed-item">
                  <button
                    className="completed-checkbox"
                    onClick={() => handleToggleTask(task.id)}
                    title="완료 취소"
                  >
                    ✅
                  </button>

                  <div className="completed-details">
                    <div className="completed-text">{task.text}</div>
                    <div className="completed-meta">
                      <span className="completed-time">🕐 {completedTime}</span>
                      {task.timeBlock && (
                        <span className="completed-block">📍 {task.timeBlock}</span>
                      )}
                      <span className="completed-xp">+{xp} XP</span>
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

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

import { useCompletedTasks, useDailyData } from '@/shared/hooks';
import { formatTime, calculateTaskXP } from '@/shared/lib/utils';
import './tasks.css';

/**
 * 완료 탭 컴포넌트
 *
 * @returns {JSX.Element} 완료된 작업 목록 UI
 * @sideEffects
 *   - 완료 취소 시 Firebase 동기화
 *   - 완료 시간 역순 정렬 (최근 것이 위)
 */
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

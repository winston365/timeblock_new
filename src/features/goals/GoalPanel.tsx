/**
 * GoalPanel - 일일 목표 표시 패널
 *
 * @role 오늘 날짜의 목표 목록을 표시하고 진행 상황을 시각화
 * @input 없음 (store에서 데이터 가져옴)
 * @output 목표 카드 목록 + 추가/수정/삭제 UI
 * @dependencies dailyGoalRepository, useDailyDataStore
 */

import { useState, useEffect } from 'react';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { loadDailyGoals, deleteGoal } from '@/data/repositories/dailyGoalRepository';
import type { DailyGoal } from '@/shared/types/domain';
import './goals.css';

interface GoalPanelProps {
  onOpenModal?: (goal?: DailyGoal) => void;
}

/**
 * 목표 진행률 카드 컴포넌트
 */
function GoalProgressCard({
  goal,
  onEdit,
  onDelete
}: {
  goal: DailyGoal;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // 진행률 계산
  const targetProgress = goal.targetMinutes > 0
    ? Math.min(100, (goal.completedMinutes / goal.targetMinutes) * 100)
    : 0;

  const plannedProgress = goal.targetMinutes > 0
    ? Math.min(100, (goal.plannedMinutes / goal.targetMinutes) * 100)
    : 0;

  // 시간 포맷 (분 → 시간:분)
  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}분`;
    if (mins === 0) return `${hours}시간`;
    return `${hours}시간 ${mins}분`;
  };

  // 목표 달성 상태
  const isCompleted = goal.completedMinutes >= goal.targetMinutes;
  const isOverPlanned = goal.plannedMinutes > goal.targetMinutes;

  return (
    <div className={`goal-card ${isCompleted ? 'goal-completed' : ''}`}>
      {/* 헤더 */}
      <div className="goal-header">
        <div className="goal-title-row">
          {goal.icon && <span className="goal-icon">{goal.icon}</span>}
          <h3 className="goal-title" style={{ color: goal.color || undefined }}>
            {goal.title}
          </h3>
        </div>
        <div className="goal-actions">
          <button
            className="goal-action-btn"
            onClick={onEdit}
            title="목표 수정"
            aria-label={`${goal.title} 수정`}
          >
            ✏️
          </button>
          <button
            className="goal-action-btn"
            onClick={onDelete}
            title="목표 삭제"
            aria-label={`${goal.title} 삭제`}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 시간 정보 */}
      <div className="goal-time-info">
        <div className="goal-time-item">
          <span className="goal-time-label">목표</span>
          <span className="goal-time-value">{formatMinutes(goal.targetMinutes)}</span>
        </div>
        <div className="goal-time-item">
          <span className="goal-time-label">계획</span>
          <span className={`goal-time-value ${isOverPlanned ? 'over-planned' : ''}`}>
            {formatMinutes(goal.plannedMinutes)}
          </span>
        </div>
        <div className="goal-time-item">
          <span className="goal-time-label">달성</span>
          <span className={`goal-time-value ${isCompleted ? 'completed' : ''}`}>
            {formatMinutes(goal.completedMinutes)}
          </span>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="goal-progress-container">
        {/* 계획 진행률 (배경) */}
        <div className="goal-progress-bar goal-progress-planned" style={{ width: `${plannedProgress}%` }} />
        {/* 달성 진행률 (전경) */}
        <div
          className="goal-progress-bar goal-progress-completed"
          style={{
            width: `${targetProgress}%`,
            backgroundColor: goal.color || undefined
          }}
        />
        {/* 진행률 텍스트 */}
        <span className="goal-progress-text">
          {targetProgress.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

/**
 * 목표 패널 메인 컴포넌트
 */
export default function GoalPanel({ onOpenModal }: GoalPanelProps) {
  const { currentDate } = useDailyDataStore();
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // 목표 로드
  const loadGoals = async () => {
    try {
      setLoading(true);
      const loadedGoals = await loadDailyGoals(currentDate);
      // order 기준 정렬
      setGoals(loadedGoals.sort((a, b) => a.order - b.order));
    } catch (error) {
      console.error('[GoalPanel] Failed to load goals:', error);
    } finally {
      setLoading(false);
    }
  };

  // 초기 로드 및 날짜 변경 시 재로드
  useEffect(() => {
    loadGoals();
  }, [currentDate]);

  // 목표 삭제 핸들러
  const handleDelete = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const confirmed = confirm(`"${goal.title}" 목표를 삭제하시겠습니까?`);
    if (!confirmed) return;

    try {
      await deleteGoal(currentDate, goalId);
      await loadGoals(); // 재로드
    } catch (error) {
      console.error('[GoalPanel] Failed to delete goal:', error);
      alert('목표 삭제에 실패했습니다.');
    }
  };

  // 목표 수정 핸들러
  const handleEdit = (goal: DailyGoal) => {
    if (onOpenModal) {
      onOpenModal(goal);
    }
  };

  // 새 목표 추가 핸들러
  const handleAddNew = () => {
    if (onOpenModal) {
      onOpenModal(undefined);
    }
  };

  if (loading) {
    return (
      <div className="goal-panel">
        <div className="goal-panel-loading">목표 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="goal-panel">
      {/* 헤더 */}
      <div className="goal-panel-header">
        <h2 className="goal-panel-title">📌 오늘의 목표</h2>
        <button
          className="goal-add-btn"
          onClick={handleAddNew}
          aria-label="새 목표 추가"
        >
          + 목표 추가
        </button>
      </div>

      {/* 목표 목록 */}
      {goals.length === 0 ? (
        <div className="goal-empty-state">
          <p>아직 목표가 없습니다.</p>
          <p>목표를 추가하여 하루를 계획해보세요!</p>
        </div>
      ) : (
        <div className="goal-list">
          {goals.map(goal => (
            <GoalProgressCard
              key={goal.id}
              goal={goal}
              onEdit={() => handleEdit(goal)}
              onDelete={() => handleDelete(goal.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

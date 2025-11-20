import { useEffect } from 'react';
import { useGoalStore } from '@/shared/stores/goalStore';
import type { DailyGoal } from '@/shared/types/domain';

interface GoalPanelProps {
  onOpenModal?: (goal?: DailyGoal) => void;
}

interface GoalProgressCardProps {
  goal: DailyGoal;
  onEdit: () => void;
  onDelete: () => void;
}

function GoalProgressCard({ goal, onEdit, onDelete }: GoalProgressCardProps) {
  const percentage = goal.targetMinutes > 0
    ? Math.min(100, (goal.completedMinutes / goal.targetMinutes) * 100)
    : 0;

  const isCompleted = goal.completedMinutes >= goal.targetMinutes;

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}시간 ${m}분`;
    if (h > 0) return `${h}시간`;
    return `${m}분`;
  };

  // Circular Progress Calculation
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="group relative flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-all hover:border-[var(--color-primary)] hover:shadow-md">
      {/* Left: Circular Progress */}
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 60 60">
          {/* Background Ring */}
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="var(--color-bg-tertiary)"
            strokeWidth="6"
          />
          {/* Progress Ring */}
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke={goal.color || 'var(--color-primary)'}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xl">
          {isCompleted ? '🎉' : goal.icon || '🎯'}
        </div>
      </div>

      {/* Center: Info */}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[var(--color-text)]">{goal.title}</h3>
          <span className={`text-xs font-bold ${isCompleted ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
            {percentage.toFixed(0)}%
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <span className="font-medium text-[var(--color-text)]">{formatTime(goal.completedMinutes)}</span>
          <span className="text-[var(--color-text-tertiary)]">/</span>
          <span>{formatTime(goal.targetMinutes)} 목표</span>
        </div>

        {/* Planned Info (Optional) */}
        {goal.plannedMinutes > 0 && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
            <span>📅 계획: {formatTime(goal.plannedMinutes)}</span>
            {goal.plannedMinutes < goal.targetMinutes && (
              <span className="text-[var(--color-warning)]">
                (부족 {formatTime(goal.targetMinutes - goal.plannedMinutes)})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions (Hover) */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="rounded p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]"
          title="수정"
        >
          ✏️
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="rounded p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
          title="삭제"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

export default function GoalPanel({ onOpenModal }: GoalPanelProps) {
  const { goals, loading, loadGoals, deleteGoal } = useGoalStore();

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleDelete = async (goalId: string) => {
    if (!confirm('정말 이 목표를 삭제하시겠습니까?')) return;
    try {
      await deleteGoal(goalId);
    } catch (error) {
      console.error('[GoalPanel] Failed to delete goal:', error);
      alert('목표 삭제에 실패했습니다.');
    }
  };

  const handleEdit = (goal: DailyGoal) => {
    onOpenModal?.(goal);
  };

  const handleAddNew = () => {
    onOpenModal?.(undefined);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4 text-[var(--color-text)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">🎯 오늘의 목표</h3>
        <button
          className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-primary-dark)] active:scale-95"
          onClick={handleAddNew}
        >
          + 추가
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-text-tertiary)]">
          로딩 중...
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 px-6 py-10 text-center text-xs text-[var(--color-text-secondary)]">
          <p className="font-medium text-[var(--color-text)]">목표가 없습니다</p>
          <p>오늘 달성하고 싶은 목표를 추가해보세요!</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {goals.map((goal) => (
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

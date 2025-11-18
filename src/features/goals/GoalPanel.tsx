import { useState, useEffect } from 'react';
import { loadGlobalGoals, deleteGlobalGoal } from '@/data/repositories/globalGoalRepository';
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
  const targetProgress = goal.targetMinutes > 0
    ? Math.min(100, (goal.completedMinutes / goal.targetMinutes) * 100)
    : 0;
  const plannedProgress = goal.targetMinutes > 0
    ? Math.min(100, (goal.plannedMinutes / goal.targetMinutes) * 100)
    : 0;

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}분`;
    if (mins === 0) return `${hours}시간`;
    return `${hours}시간 ${mins}분`;
  };

  const isCompleted = goal.completedMinutes >= goal.targetMinutes;
  const isOverPlanned = goal.plannedMinutes > goal.targetMinutes;

  return (
    <div
      className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-sm transition hover:border-[var(--color-primary)] ${
        isCompleted ? 'border-l-4 border-l-[var(--color-success)] bg-green-500/5' : 'border-l-4 border-l-[var(--color-primary)]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {goal.icon && <span className="text-xl">{goal.icon}</span>}
          <h3 className="text-lg font-semibold" style={{ color: goal.color || 'var(--color-text)' }}>
            {goal.title}
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)] transition hover:border-[var(--color-primary)]"
            onClick={onEdit}
            aria-label={`${goal.title} 수정`}
          >
            ✏️
          </button>
          <button
            type="button"
            className="rounded-md border border-red-500 px-2 py-1 text-xs text-red-400 transition hover:bg-red-500/10"
            onClick={onDelete}
            aria-label={`${goal.title} 삭제`}
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-[var(--color-text-secondary)]">목표</span>
          <div className="font-semibold text-[var(--color-text)]">{formatMinutes(goal.targetMinutes)}</div>
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]">계획</span>
          <div className={`font-semibold ${isOverPlanned ? 'text-amber-400' : 'text-[var(--color-text)]'}`}>
            {formatMinutes(goal.plannedMinutes)}
          </div>
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]">진행</span>
          <div className={`font-semibold ${isCompleted ? 'text-green-400' : 'text-[var(--color-text)]'}`}>
            {formatMinutes(goal.completedMinutes)}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4 text-sm">
        <ProgressRow label="목표" progress={100} color={goal.color || 'var(--color-primary)'} suffix={formatMinutes(goal.targetMinutes)} />
        <ProgressRow
          label="계획"
          progress={plannedProgress}
          color={isOverPlanned ? '#f97316' : goal.color || 'var(--color-primary)'}
          suffix={`${plannedProgress.toFixed(0)}%`}
        />
        <ProgressRow
          label="진행"
          progress={targetProgress}
          color={isCompleted ? '#22c55e' : goal.color || 'var(--color-primary)'}
          suffix={`${targetProgress.toFixed(0)}%`}
        />
      </div>
    </div>
  );
}

function ProgressRow({ label, progress, color, suffix }: { label: string; progress: number; color: string; suffix: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-[var(--color-text-secondary)]">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]">
        <div className="h-3 rounded-full transition-[width]" style={{ width: `${progress}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-[var(--color-text)]">{suffix}</span>
    </div>
  );
}

export default function GoalPanel({ onOpenModal }: GoalPanelProps) {
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGoals();
  }, []);

  useEffect(() => {
    const handleGoalChanged = () => loadGoals();
    window.addEventListener('goal-changed', handleGoalChanged);
    return () => window.removeEventListener('goal-changed', handleGoalChanged);
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const loadedGoals = await loadGlobalGoals();
      setGoals(loadedGoals.sort((a, b) => a.order - b.order));
    } catch (error) {
      console.error('[GoalPanel] Failed to load goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    if (!confirm(`"${goal.title}" 목표를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteGlobalGoal(goalId);
      await loadGoals();
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

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 text-center text-[var(--color-text-secondary)]">
        목표 로딩 중...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">오늘의 목표</h2>
        <button
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)]"
          onClick={handleAddNew}
          aria-label="신규 목표 추가"
        >
          + 목표 추가
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-8 text-center text-[var(--color-text-secondary)]">
          <p className="text-base font-semibold text-[var(--color-text)]">등록된 목표가 없습니다.</p>
          <p className="text-sm">목표를 추가해 하루 계획을 세워보세요!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <GoalProgressCard key={goal.id} goal={goal} onEdit={() => handleEdit(goal)} onDelete={() => handleDelete(goal.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

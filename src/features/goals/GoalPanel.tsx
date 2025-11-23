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

  const accent = goal.color || '#60a5fa';
  const accentSoft = `${accent}22`; // soft overlay
  const barGradient = `linear-gradient(90deg, ${accent}, ${accent})`;

  return (
    <div className="group relative flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all hover:border-white/10 hover:bg-white/8">
      {/* Left: Circular Progress */}
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 60 60">
          {/* Background Ring */}
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="6"
          />
          {/* Progress Ring */}
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke={accent}
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
          <h3 className="truncate text-sm font-bold text-white">{goal.title}</h3>
          <span className={`text-xs font-bold ${isCompleted ? 'text-emerald-300' : 'text-white/70'}`}>
            {percentage.toFixed(0)}%
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/70">
          <span className="font-semibold text-white">{formatTime(goal.completedMinutes)}</span>
          <span className="text-white/40">/</span>
          <span className="text-white/60">{formatTime(goal.targetMinutes)} 목표</span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/60">
          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%`, background: barGradient }}
            />
          </div>
          <span className="w-16 text-right tabular-nums text-white/60">
            {goal.completedMinutes}/{goal.targetMinutes}
          </span>
        </div>

        {/* Planned Info (Optional) */}
        {goal.plannedMinutes > 0 && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-white/50">
            <span>📅 계획: {formatTime(goal.plannedMinutes)}</span>
            {goal.plannedMinutes < goal.targetMinutes && (
              <span className="text-amber-300">
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
          className="rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          title="수정"
        >
          ✏️
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="rounded p-1.5 text-white/50 hover:bg-[var(--color-danger)]/20 hover:text-[var(--color-danger)]"
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
    <div className="flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-[#0d1625] via-[#0c1220] to-[#0a0f1c] p-4 text-[var(--color-text)] shadow-[0_25px_60px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">오늘의 목표</h3>
          <p className="text-[11px] text-white/50">목표를 달성하고 계획을 채워보세요</p>
        </div>
        <button
          className="rounded-full bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-primary-dark)] active:scale-95"
          onClick={handleAddNew}
        >
          + 추가
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-white/60">
          로딩 중...
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-xs text-white/60">
          <p className="font-medium text-white">목표가 없습니다</p>
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

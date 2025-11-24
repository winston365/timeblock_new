import { useEffect, useState } from 'react';
import { useGoalStore } from '@/shared/stores/goalStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import type { DailyGoal, Task } from '@/shared/types/domain';
import { motion, AnimatePresence } from 'framer-motion';

interface GoalPanelProps {
  onOpenModal?: (goal?: DailyGoal) => void;
}

interface GoalProgressCardProps {
  goal: DailyGoal;
  tasks: Task[];
  onEdit: () => void;
  onDelete: () => void;
}

function GoalProgressCard({ goal, tasks, onEdit, onDelete }: GoalProgressCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Progress Calculations
  const plannedPercentage = goal.targetMinutes > 0
    ? Math.min(100, (goal.plannedMinutes / goal.targetMinutes) * 100)
    : 0;

  const completedPercentage = goal.targetMinutes > 0
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

  const accent = goal.color || '#60a5fa';

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border border-white/5 bg-white/5 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all hover:border-white/10 hover:bg-white/8 ${isExpanded ? 'bg-white/10' : ''}`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-4">
        {/* Left: Icon & Percentage */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/5 text-2xl">
          {isCompleted ? '🎉' : goal.icon || '🎯'}
          {/* Circular Progress for Quick View */}
          <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke={accent}
              strokeWidth="3"
              strokeDasharray={`${completedPercentage}, 100`}
              className="opacity-30"
            />
          </svg>
        </div>

        {/* Center: Info */}
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center justify-between">
            <h3 className="truncate text-sm font-bold text-white">{goal.title}</h3>
            <span className={`text-xs font-bold ${isCompleted ? 'text-emerald-300' : 'text-white/70'}`}>
              {completedPercentage.toFixed(0)}%
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/70">
            <span className="font-semibold text-white">{formatTime(goal.completedMinutes)}</span>
            <span className="text-white/40">/</span>
            <span className="text-white/60">{formatTime(goal.targetMinutes)}</span>
          </div>

          {/* Dual Progress Bar */}
          <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-700/50">
            {/* Planned (Background Layer) - More visible color */}
            <div
              className="absolute h-full rounded-full bg-blue-400/40 transition-all duration-500"
              style={{ width: `${plannedPercentage}%` }}
            />
            {/* Completed (Foreground Layer) */}
            <div
              className="absolute h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(255,255,255,0.2)]"
              style={{
                width: `${completedPercentage}%`,
                background: `linear-gradient(90deg, ${accent}, ${accent})`
              }}
            />
          </div>

          {/* Legend / Status Text */}
          <div className="mt-1 flex justify-between text-[10px] text-white/40">
            <span>계획: {formatTime(goal.plannedMinutes)}</span>
            {goal.plannedMinutes < goal.targetMinutes && (
              <span className="text-amber-300/80">
                부족 {formatTime(goal.targetMinutes - goal.plannedMinutes)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions (Hover) */}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={e => e.stopPropagation()}>
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

      {/* Drill-down: Related Tasks */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
              {tasks.length === 0 ? (
                <div className="py-1 text-center text-xs text-white/40">
                  <p>연결된 작업이 없습니다</p>
                  {goal.plannedMinutes > 0 && (
                    <p className="mt-1 text-[10px] text-amber-500/70">
                      (데이터 불일치: 계획된 시간은 {goal.plannedMinutes}분입니다)
                    </p>
                  )}
                </div>
              ) : (
                tasks.map(task => {
                  // Determine location text
                  let locationText = '';
                  if (!task.timeBlock) {
                    locationText = '📥 인박스';
                  } else if (task.hourSlot !== undefined) {
                    locationText = `🕒 ${task.hourSlot}시`;
                  } else {
                    locationText = '📅 일정';
                  }

                  return (
                    <div key={task.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5">
                      <span className="text-xs">{task.completed ? '✅' : '⬜'}</span>
                      <div className="flex flex-1 flex-col overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className={`truncate text-xs ${task.completed ? 'text-white/40 line-through' : 'text-white/80'}`}>
                            {task.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/40">
                          <span className="text-blue-300/80">{locationText}</span>
                          <span>•</span>
                          <span>
                            {task.actualDuration > 0 ? `${task.actualDuration}분` : `${task.adjustedDuration}분(예정)`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GoalPanel({ onOpenModal }: GoalPanelProps) {
  const { goals, loading, loadGoals, deleteGoal } = useGoalStore();
  const { dailyData } = useDailyDataStore();

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
    <div className="flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 text-[var(--color-text)] shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
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
          {goals.map((goal) => {
            // Debugging: Check for goalId mismatch
            const relatedTasks = dailyData?.tasks.filter(t => {
              // Loose comparison just in case, though types should be string
              return String(t.goalId) === String(goal.id);
            }) || [];

            return (
              <GoalProgressCard
                key={goal.id}
                goal={goal}
                tasks={relatedTasks}
                onEdit={() => handleEdit(goal)}
                onDelete={() => handleDelete(goal.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

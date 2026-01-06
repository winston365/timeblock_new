/**
 * @file tasks-section.tsx
 * @description Tasks page section for DailySummaryModal.
 */

import { CheckSquare } from 'lucide-react';

import type { DailyReport } from '../types';

export interface TasksSectionProps {
  readonly report: DailyReport;
}

export const TasksSection = ({ report }: TasksSectionProps) => {
  const { tasks } = report;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="flex items-center gap-2 text-sm font-semibold text-green-400 mb-3">
          <CheckSquare size={16} />
          완료된 작업 ({tasks.completed.length})
        </h4>
        {tasks.completed.length === 0 ? (
          <p className="text-sm text-slate-500 italic">완료된 작업이 없습니다.</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
            {tasks.completed.map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✓</span>
                  <span className="text-sm text-slate-200">{task.text}</span>
                </div>
                <span className="text-xs font-medium text-amber-400">+{task.xp}XP</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="flex items-center gap-2 text-sm font-semibold text-orange-400 mb-3">
          <span className="w-4 h-4 rounded border-2 border-orange-400/50" />
          미완료 작업 ({tasks.uncompleted.length})
        </h4>
        {tasks.uncompleted.length === 0 ? (
          <p className="text-sm text-slate-500 italic">모든 작업을 완료했습니다! 🎉</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
            {tasks.uncompleted.map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded border-2 border-orange-400/30" />
                  <span className="text-sm text-slate-300">{task.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

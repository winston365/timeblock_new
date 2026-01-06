/**
 * @file overview-section.tsx
 * @description Overview page section for DailySummaryModal.
 */

import type { DailyReport } from '../types';

export interface OverviewSectionProps {
  readonly report: DailyReport;
}

export const OverviewSection = ({ report }: OverviewSectionProps) => {
  const { overview } = report;

  const statCards = [
    {
      label: '총 XP',
      value: overview.totalXP.toLocaleString(),
      icon: '⭐',
      color: 'from-amber-500/20 to-amber-600/20 border-amber-500/30',
    },
    {
      label: '완료율',
      value: `${overview.completionRate}%`,
      icon: '📊',
      color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    },
    {
      label: '완료 작업',
      value: `${overview.completedTasks}/${overview.totalTasks}`,
      icon: '✅',
      color: 'from-green-500/20 to-green-600/20 border-green-500/30',
    },
    {
      label: '완료 블록',
      value: `${overview.blocksCompleted}/${overview.totalBlocks}`,
      icon: '🧱',
      color: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {statCards.map(stat => (
          <div
            key={stat.label}
            className={`rounded-2xl bg-gradient-to-br ${stat.color} border p-4 backdrop-blur-sm`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{stat.icon}</span>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Ring */}
      <div className="flex items-center justify-center py-6">
        <div className="relative">
          <svg className="w-40 h-40 transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-slate-700"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="url(#progressGradient)"
              strokeWidth="12"
              fill="none"
              strokeDasharray={`${(overview.completionRate / 100) * 440} 440`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{overview.completionRate}%</span>
            <span className="text-xs text-slate-400">달성률</span>
          </div>
        </div>
      </div>
    </div>
  );
};

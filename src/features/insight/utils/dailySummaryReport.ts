/**
 * @file dailySummaryReport.ts
 * @description Builds the base daily summary report (no AI generation).
 */

import { calculateTaskXP } from '@/shared/lib/utils';
import type { DailyData, Task } from '@/shared/types/domain';

import type { DailyReport, TaskSummary } from '@/features/insight/daily-summary/types';

/**
 * Builds the deterministic base report from daily data.
 * This is used by tests and by the AI report builder.
 */
export const createDailyReportBase = (date: string, dailyData: DailyData | null): DailyReport => {
  const tasks = dailyData?.tasks || [];
  const completedTasks = tasks.filter(t => t.completed);
  const uncompletedTasks = tasks.filter(t => !t.completed);

  const taskToSummary = (task: Task): TaskSummary => ({
    id: task.id,
    text: task.text,
    xp: calculateTaskXP(task),
    blockId: task.timeBlock,
    completed: task.completed,
  });

  const totalXP = completedTasks.reduce((sum, t) => sum + calculateTaskXP(t), 0);

  const blockIds = tasks
    .filter((t): t is Task & { timeBlock: string } => t.timeBlock !== null)
    .map(t => t.timeBlock);

  const blocksWithTasks = new Set(blockIds);

  const blocksCompleted = Array.from(blocksWithTasks).filter(blockId => {
    const blockTasks = tasks.filter(t => t.timeBlock === blockId);
    return blockTasks.every(t => t.completed);
  }).length;

  return {
    date,
    generatedAt: new Date().toISOString(),
    overview: {
      totalXP,
      completedTasks: completedTasks.length,
      totalTasks: tasks.length,
      completionRate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
      focusMinutes: 0,
      blocksCompleted,
      totalBlocks: blocksWithTasks.size,
    },
    tasks: {
      completed: completedTasks.map(taskToSummary),
      uncompleted: uncompletedTasks.map(taskToSummary),
    },
    aiAnalysis: '',
  };
};

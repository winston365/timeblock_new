/**
 * @file types.ts
 * @description Daily summary report types.
 */

export interface DailySummaryModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export type ReportDate = 'today' | 'yesterday';

export type ReportPage = 'overview' | 'tasks' | 'ai-analysis';

export interface TaskSummary {
  readonly id: string;
  readonly text: string;
  readonly xp: number;
  readonly blockId: string | null;
  readonly completed: boolean;
}

export interface DailyReport {
  readonly date: string;
  readonly generatedAt: string;
  readonly overview: {
    readonly totalXP: number;
    readonly completedTasks: number;
    readonly totalTasks: number;
    readonly completionRate: number;
    readonly focusMinutes: number;
    readonly blocksCompleted: number;
    readonly totalBlocks: number;
  };
  readonly tasks: {
    readonly completed: readonly TaskSummary[];
    readonly uncompleted: readonly TaskSummary[];
  };
  readonly aiAnalysis: string;
}

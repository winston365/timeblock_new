import type { DailyData, Task, TimeBlockState } from '@/shared/types/domain';

export interface UpdateTaskOptions {
  readonly skipBehaviorTracking?: boolean;
  readonly skipEmoji?: boolean;
  readonly ignoreLock?: boolean;
}

export interface DailyDataStore {
  // state
  readonly dailyData: DailyData | null;
  readonly currentDate: string;
  readonly loading: boolean;
  readonly error: Error | null;

  // actions
  readonly loadData: (date?: string, force?: boolean) => Promise<void>;
  readonly saveData: (tasks: Task[], timeBlockStates: DailyData['timeBlockStates']) => Promise<void>;

  readonly addTask: (task: Task) => Promise<void>;
  readonly updateTask: (taskId: string, updates: Partial<Task>, options?: UpdateTaskOptions) => Promise<void>;
  readonly deleteTask: (taskId: string) => Promise<void>;
  readonly toggleTaskCompletion: (taskId: string) => Promise<void>;

  readonly updateBlockState: (blockId: string, updates: Partial<TimeBlockState>) => Promise<void>;
  readonly toggleBlockLock: (blockId: string) => Promise<void>;
  readonly setHourSlotTag: (hour: number, tagId: string | null) => Promise<void>;

  // don't-do checklist
  readonly toggleDontDoItem: (blockId: string, itemId: string, xpReward: number) => Promise<void>;

  readonly refresh: () => Promise<void>;
  readonly reset: () => void;
}

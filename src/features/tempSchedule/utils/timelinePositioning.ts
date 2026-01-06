import type { TempScheduleTask } from '@/shared/types/tempSchedule';
import type { Task } from '@/shared/types/domain';

export interface BlockPosition {
  readonly task: TempScheduleTask;
  readonly column: number;
  totalColumns: number;
  readonly top: number;
  readonly height: number;
}

export interface TimelineBlockPositioningConfig {
  readonly timelineStartHour: number;
  readonly pixelsPerMinute: number;
  readonly minBlockHeightPx: number;
}

export const minutesToTopPx = (minutes: number, timelineStartHour: number, pixelsPerMinute: number): number => {
  return (minutes - timelineStartHour * 60) * pixelsPerMinute;
};

export const durationMinutesToHeightPx = (
  durationMinutes: number,
  pixelsPerMinute: number,
  minHeightPx: number
): number => {
  return Math.max(durationMinutes * pixelsPerMinute, minHeightPx);
};

export const calculateBlockPositions = (
  tasks: readonly TempScheduleTask[],
  config: TimelineBlockPositioningConfig
): BlockPosition[] => {
  if (tasks.length === 0) return [];

  const sorted = [...tasks].sort((a, b) => a.startTime - b.startTime);

  const positions: BlockPosition[] = [];
  const columns: { endTime: number }[] = [];

  for (const task of sorted) {
    const startMinutes = task.startTime;
    const endMinutes = task.endTime;

    const top = minutesToTopPx(startMinutes, config.timelineStartHour, config.pixelsPerMinute);
    const height = durationMinutesToHeightPx(
      endMinutes - startMinutes,
      config.pixelsPerMinute,
      config.minBlockHeightPx
    );

    let columnIndex = columns.findIndex(col => col.endTime <= startMinutes);

    if (columnIndex === -1) {
      columnIndex = columns.length;
      columns.push({ endTime: endMinutes });
    } else {
      columns[columnIndex].endTime = endMinutes;
    }

    positions.push({
      task,
      column: columnIndex,
      totalColumns: 1,
      top,
      height,
    });
  }

  for (const position of positions) {
    const startMinutes = position.task.startTime;
    const endMinutes = position.task.endTime;

    const overlapping = positions.filter(other => {
      const otherStart = other.task.startTime;
      const otherEnd = other.task.endTime;
      return !(endMinutes <= otherStart || startMinutes >= otherEnd);
    });

    position.totalColumns = Math.max(...overlapping.map(p => p.column + 1));
  }

  return positions;
};

export interface YToTimeConfig {
  readonly timelineStartHour: number;
  readonly timelineEndHour: number;
  readonly pixelsPerMinute: number;
  readonly gridSnapInterval: number;
}

export const yToSnappedTimeMinutes = (y: number, config: YToTimeConfig): number => {
  const minutes = y / config.pixelsPerMinute + config.timelineStartHour * 60;
  const snapped = Math.round(minutes / config.gridSnapInterval) * config.gridSnapInterval;

  return Math.max(
    config.timelineStartHour * 60,
    Math.min(config.timelineEndHour * 60 - 1, snapped)
  );
};

export interface MainSnapshotPosition {
  readonly id: string;
  readonly name: string;
  readonly top: number;
  readonly height: number;
}

export interface MainSnapshotConfig {
  readonly timelineStartHour: number;
  readonly timelineEndHour: number;
  readonly pixelsPerMinute: number;
  readonly minHeightPx: number;
}

export type TimeBlockLike = {
  readonly id: string;
  readonly start: number;
};

export const deriveMainSnapshotPosition = (
  task: Task,
  config: MainSnapshotConfig,
  timeBlocks: readonly TimeBlockLike[]
): MainSnapshotPosition | null => {
  const block = task.timeBlock ? timeBlocks.find(b => b.id === task.timeBlock) : null;

  const startMinutesRaw =
    task.hourSlot !== undefined && task.hourSlot !== null
      ? task.hourSlot * 60
      : block
        ? block.start * 60
        : null;

  if (startMinutesRaw === null) return null;

  const durationMinutes = Math.max(
    task.actualDuration > 0 ? task.actualDuration : task.adjustedDuration || task.baseDuration || 30,
    5
  );

  const endMinutesRaw = startMinutesRaw + durationMinutes;

  const visibleStart = Math.max(startMinutesRaw, config.timelineStartHour * 60);
  const visibleEnd = Math.min(endMinutesRaw, config.timelineEndHour * 60);

  if (visibleEnd <= visibleStart) return null;

  const top = minutesToTopPx(visibleStart, config.timelineStartHour, config.pixelsPerMinute);
  const height = Math.max(
    (visibleEnd - visibleStart) * config.pixelsPerMinute,
    config.minHeightPx
  );

  return {
    id: `main-${task.id}`,
    name: task.text,
    top,
    height,
  };
};

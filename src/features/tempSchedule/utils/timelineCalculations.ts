/**
 * @file timelineCalculations.ts
 * @description TempSchedule timeline drag/create 관련 순수 계산 유틸
 */

export type TimelineDragMode = 'move' | 'resize-top' | 'resize-bottom';

export interface TimelineTimeRange {
  readonly startTime: number;
  readonly endTime: number;
}

export interface TimelinePreviewRect {
  readonly top: number;
  readonly height: number;
}

export interface TimelineCreatePreview extends TimelineTimeRange, TimelinePreviewRect {}

export interface TimelineDragPreview extends TimelineCreatePreview {
  readonly color: string;
  readonly name: string;
}

const clampNumber = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * 타임라인 컨테이너 내부 Y 좌표를 0~heightPx 범위로 고정합니다.
 */
export const clampTimelineY = (y: number, heightPx: number): number => {
  return clampNumber(y, 0, heightPx);
};

/**
 * 분 단위 시간 범위를 타임라인 픽셀 rect(top/height)로 변환합니다.
 */
export const computePreviewRectFromTimeRange = (
  range: TimelineTimeRange,
  config: {
    readonly timelineStartMinutes: number;
    readonly pixelsPerMinute: number;
    readonly minHeightPx: number;
  },
): TimelinePreviewRect => {
  const top = (range.startTime - config.timelineStartMinutes) * config.pixelsPerMinute;
  const durationMinutes = Math.max(0, range.endTime - range.startTime);
  const height = Math.max(durationMinutes * config.pixelsPerMinute, config.minHeightPx);

  return { top, height };
};

/**
 * 새 블록 생성 드래그(create) 프리뷰를 계산합니다.
 */
export const computeCreatePreview = (params: {
  readonly startTimeMinutes: number;
  readonly currentTimeMinutes: number;
  readonly timelineStartMinutes: number;
  readonly pixelsPerMinute: number;
  readonly minHeightPx: number;
}): TimelineCreatePreview => {
  const start = Math.min(params.startTimeMinutes, params.currentTimeMinutes);
  const end = Math.max(params.startTimeMinutes, params.currentTimeMinutes);

  const rect = computePreviewRectFromTimeRange(
    { startTime: start, endTime: end },
    {
      timelineStartMinutes: params.timelineStartMinutes,
      pixelsPerMinute: params.pixelsPerMinute,
      minHeightPx: params.minHeightPx,
    },
  );

  return {
    startTime: start,
    endTime: end,
    top: rect.top,
    height: rect.height,
  };
};

/**
 * 기존 블록 이동/리사이즈 드래그 결과(start/end)를 계산합니다.
 */
export const computeDraggedTimeRange = (params: {
  readonly mode: TimelineDragMode;
  readonly originalStartTime: number;
  readonly originalEndTime: number;
  readonly deltaYPx: number;
  readonly pixelsPerMinute: number;
  readonly gridSnapInterval: number;
  readonly timelineStartMinutes: number;
  readonly timelineEndMinutes: number;
}): TimelineTimeRange => {
  const deltaMinutes = params.deltaYPx / params.pixelsPerMinute;
  const snappedDelta =
    Math.round(deltaMinutes / params.gridSnapInterval) * params.gridSnapInterval;

  let startTime = params.originalStartTime;
  let endTime = params.originalEndTime;

  switch (params.mode) {
    case 'move': {
      startTime = params.originalStartTime + snappedDelta;
      endTime = params.originalEndTime + snappedDelta;
      break;
    }

    case 'resize-top': {
      startTime = Math.min(
        params.originalStartTime + snappedDelta,
        params.originalEndTime - params.gridSnapInterval,
      );
      endTime = params.originalEndTime;
      break;
    }

    case 'resize-bottom': {
      startTime = params.originalStartTime;
      endTime = Math.max(
        params.originalEndTime + snappedDelta,
        params.originalStartTime + params.gridSnapInterval,
      );
      break;
    }
  }

  const clampedStart = clampNumber(
    startTime,
    params.timelineStartMinutes,
    params.timelineEndMinutes - params.gridSnapInterval,
  );

  const clampedEnd = clampNumber(
    endTime,
    clampedStart + params.gridSnapInterval,
    params.timelineEndMinutes,
  );

  return { startTime: clampedStart, endTime: clampedEnd };
};

import { useCallback, useState } from 'react';
import type { TempScheduleTask } from '@/shared/types/tempSchedule';

export interface ContextMenuState {
  readonly task: TempScheduleTask;
  readonly x: number;
  readonly y: number;
}

export interface PositionedTaskState {
  readonly task: TempScheduleTask;
  readonly position: {
    readonly x: number;
    readonly y: number;
  };
}

export interface TimelineSelectionApi {
  readonly contextMenu: ContextMenuState | null;
  readonly inlineEditState: PositionedTaskState | null;
  readonly promotePopupState: PositionedTaskState | null;

  readonly openContextMenu: (task: TempScheduleTask, e: React.MouseEvent) => void;
  readonly closeContextMenu: () => void;

  readonly openInlineEdit: (task: TempScheduleTask, position: { x: number; y: number }) => void;
  readonly closeInlineEdit: () => void;

  readonly openPromotePopupCentered: (task: TempScheduleTask) => void;
  readonly closePromotePopup: () => void;
}

/**
 * TempScheduleTimelineView의 선택/팝업/컨텍스트 메뉴 상태를 캡슐화합니다.
 */
export const useTimelineSelection = (): TimelineSelectionApi => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [inlineEditState, setInlineEditState] = useState<PositionedTaskState | null>(null);
  const [promotePopupState, setPromotePopupState] = useState<PositionedTaskState | null>(null);

  const openContextMenu = useCallback((task: TempScheduleTask, e: React.MouseEvent) => {
    setContextMenu({
      task,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const openInlineEdit = useCallback((task: TempScheduleTask, position: { x: number; y: number }) => {
    setInlineEditState({ task, position });
  }, []);

  const closeInlineEdit = useCallback(() => {
    setInlineEditState(null);
  }, []);

  const openPromotePopupCentered = useCallback((task: TempScheduleTask) => {
    const rect = document.body.getBoundingClientRect();

    setPromotePopupState({
      task,
      position: { x: rect.width / 2, y: rect.height / 3 },
    });
  }, []);

  const closePromotePopup = useCallback(() => {
    setPromotePopupState(null);
  }, []);

  return {
    contextMenu,
    inlineEditState,
    promotePopupState,

    openContextMenu,
    closeContextMenu,

    openInlineEdit,
    closeInlineEdit,

    openPromotePopupCentered,
    closePromotePopup,
  };
};

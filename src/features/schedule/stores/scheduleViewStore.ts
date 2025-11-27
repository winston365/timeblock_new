/**
 * Schedule View Store
 * 
 * @role ScheduleView의 UI 상태 관리 (지난블록 표시, 워밍업 모달 등)
 * @input toggle actions
 * @output showPastBlocks, isWarmupModalOpen 등
 */

import { create } from 'zustand';

interface ScheduleViewState {
    // 지난 블록 표시 여부
    showPastBlocks: boolean;
    toggleShowPastBlocks: () => void;
    setShowPastBlocks: (show: boolean) => void;

    // 워밍업 모달 열림 여부
    isWarmupModalOpen: boolean;
    openWarmupModal: () => void;
    closeWarmupModal: () => void;
}

export const useScheduleViewStore = create<ScheduleViewState>((set) => ({
    // 지난 블록 표시
    showPastBlocks: false,
    toggleShowPastBlocks: () => set((state) => ({ showPastBlocks: !state.showPastBlocks })),
    setShowPastBlocks: (show: boolean) => set({ showPastBlocks: show }),

    // 워밍업 모달
    isWarmupModalOpen: false,
    openWarmupModal: () => set({ isWarmupModalOpen: true }),
    closeWarmupModal: () => set({ isWarmupModalOpen: false }),
}));

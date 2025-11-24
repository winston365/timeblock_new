/**
 * Focus Mode Store
 * 
 * @role Manage focus mode state (전체 보기 ↔ 지금 모드)
 * @input toggle actions
 * @output isFocusMode boolean
 */

import { create } from 'zustand';

interface FocusModeState {
    isFocusMode: boolean;
    activeTaskId: string | null;
    activeTaskStartTime: number | null;
    isPaused: boolean;
    pausedTime: number | null; // 일시정지된 시점의 경과 시간 (ms)
    toggleFocusMode: () => void;
    setFocusMode: (enabled: boolean) => void;
    startTask: (taskId: string) => void;
    stopTask: () => void;
    pauseTask: () => void;
    resumeTask: () => void;
}

export const useFocusModeStore = create<FocusModeState>((set, get) => ({
    isFocusMode: false,
    activeTaskId: null,
    activeTaskStartTime: null,
    isPaused: false,
    pausedTime: null,

    toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),

    setFocusMode: (enabled: boolean) => set({ isFocusMode: enabled }),

    startTask: (taskId: string) => set({
        activeTaskId: taskId,
        activeTaskStartTime: Date.now(),
        isFocusMode: true,
        isPaused: false,
        pausedTime: null,
    }),

    stopTask: () => set({
        activeTaskId: null,
        activeTaskStartTime: null,
        isPaused: false,
        pausedTime: null,
    }),

    pauseTask: () => {
        const state = get();
        if (state.activeTaskStartTime && !state.isPaused) {
            const elapsed = Date.now() - state.activeTaskStartTime;
            set({ isPaused: true, pausedTime: elapsed });
        }
    },

    resumeTask: () => {
        const state = get();
        if (state.isPaused && state.pausedTime !== null) {
            const newStartTime = Date.now() - state.pausedTime;
            set({
                isPaused: false,
                pausedTime: null,
                activeTaskStartTime: newStartTime
            });
        }
    },
}));

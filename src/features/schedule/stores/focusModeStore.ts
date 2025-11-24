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
    toggleFocusMode: () => void;
    setFocusMode: (enabled: boolean) => void;
    startTask: (taskId: string) => void;
    stopTask: () => void;
}

export const useFocusModeStore = create<FocusModeState>((set) => ({
    isFocusMode: false,
    activeTaskId: null,
    activeTaskStartTime: null,

    toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),

    setFocusMode: (enabled: boolean) => set({ isFocusMode: enabled }),

    startTask: (taskId: string) => set({
        activeTaskId: taskId,
        activeTaskStartTime: Date.now(),
        isFocusMode: true
    }),

    stopTask: () => set({
        activeTaskId: null,
        activeTaskStartTime: null
    }),
}));

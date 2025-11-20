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
    toggleFocusMode: () => void;
    setFocusMode: (enabled: boolean) => void;
}

export const useFocusModeStore = create<FocusModeState>((set) => ({
    isFocusMode: false,

    toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),

    setFocusMode: (enabled: boolean) => set({ isFocusMode: enabled }),
}));

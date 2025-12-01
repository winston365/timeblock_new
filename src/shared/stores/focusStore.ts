/**
 * Focus Mode Zustand Store
 *
 * @role 집중 모드 상태의 전역 관리
 * @responsibilities
 *   - 집중 모드 활성화/비활성화 상태 관리
 *   - 집중 모드 토글 및 직접 설정 기능 제공
 * @key_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 */

import { create } from 'zustand';

interface FocusStore {
    isFocusMode: boolean;
    toggleFocusMode: () => void;
    setFocusMode: (active: boolean) => void;
}

/**
 * 집중 모드 상태 Zustand 스토어
 *
 * @returns {FocusStore} 집중 모드 상태 및 관리 함수
 *
 * @example
 * ```tsx
 * const { isFocusMode, toggleFocusMode, setFocusMode } = useFocusStore();
 * toggleFocusMode(); // 토글
 * setFocusMode(true); // 직접 설정
 * ```
 */
export const useFocusStore = create<FocusStore>((set) => ({
    isFocusMode: false,

    /**
     * 집중 모드 토글
     * @returns {void}
     */
    toggleFocusMode: () => set((currentState) => ({ isFocusMode: !currentState.isFocusMode })),

    /**
     * 집중 모드 직접 설정
     * @param {boolean} active - 집중 모드 활성화 여부
     * @returns {void}
     */
    setFocusMode: (active) => set({ isFocusMode: active }),
}));

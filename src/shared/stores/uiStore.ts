/**
 * UI State Zustand Store
 *
 * @role UI 레이아웃 및 모달 상태의 전역 관리
 * @responsibilities
 *   - 활성 탭 상태 관리 (today, stats, completed, inbox)
 *   - 사이드바 및 패널 접힘 상태 관리
 *   - 전역 모달 열림/닫힘 상태 관리
 *   - localStorage 영속성 (레이아웃 상태만)
 * @key_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 *   - zustand/middleware (persist): localStorage 영속성
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
    // Layout
    activeTab: 'today' | 'stats' | 'completed' | 'inbox';
    rightPanelTab: 'quest' | 'shop';
    leftSidebarCollapsed: boolean;
    rightPanelsCollapsed: boolean;

    // Modals
    modals: {
        geminiChat: boolean;
        bulkAdd: boolean;
        settings: boolean;
        templates: boolean;
    };

    // Actions
    setActiveTab: (tab: UIState['activeTab']) => void;
    setRightPanelTab: (tab: UIState['rightPanelTab']) => void;
    toggleLeftSidebar: () => void;
    toggleRightPanels: () => void;
    openModal: (modal: keyof UIState['modals']) => void;
    closeModal: (modal: keyof UIState['modals']) => void;
    toggleModal: (modal: keyof UIState['modals']) => void;
}

/**
 * UI 상태 Zustand 스토어
 *
 * @returns {UIState} UI 상태 및 관리 함수
 * @sideEffects
 *   - localStorage에 레이아웃 상태 영속화 (사이드바 접힘 상태)
 *
 * @example
 * ```tsx
 * const { activeTab, setActiveTab, openModal } = useUIStore();
 * setActiveTab('stats');
 * openModal('settings');
 * ```
 */
export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            // Initial State
            activeTab: 'today',
            rightPanelTab: 'quest',
            leftSidebarCollapsed: false,
            rightPanelsCollapsed: false,
            modals: {
                geminiChat: false,
                bulkAdd: false,
                settings: false,
                templates: false,
            },

            // Actions

            /**
             * 활성 메인 탭 설정
             * @param {UIState['activeTab']} tab - 설정할 탭
             */
            setActiveTab: (tab) => set({ activeTab: tab }),

            /**
             * 우측 패널 탭 설정
             * @param {UIState['rightPanelTab']} tab - 설정할 탭
             */
            setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

            /**
             * 좌측 사이드바 접힘 토글
             */
            toggleLeftSidebar: () =>
                set((currentState) => ({ leftSidebarCollapsed: !currentState.leftSidebarCollapsed })),

            /**
             * 우측 패널 접힘 토글
             */
            toggleRightPanels: () =>
                set((currentState) => ({ rightPanelsCollapsed: !currentState.rightPanelsCollapsed })),

            /**
             * 모달 열기
             * @param {keyof UIState['modals']} modal - 열 모달 이름
             */
            openModal: (modal) =>
                set((currentState) => ({ modals: { ...currentState.modals, [modal]: true } })),

            /**
             * 모달 닫기
             * @param {keyof UIState['modals']} modal - 닫을 모달 이름
             */
            closeModal: (modal) =>
                set((currentState) => ({ modals: { ...currentState.modals, [modal]: false } })),

            /**
             * 모달 토글
             * @param {keyof UIState['modals']} modal - 토글할 모달 이름
             */
            toggleModal: (modal) =>
                set((currentState) => ({ modals: { ...currentState.modals, [modal]: !currentState.modals[modal] } })),
        }),
        {
            name: 'ui-storage',
            partialize: (state) => ({
                leftSidebarCollapsed: state.leftSidebarCollapsed,
                rightPanelsCollapsed: state.rightPanelsCollapsed,
            }),
        }
    )
);

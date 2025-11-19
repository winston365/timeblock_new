import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
    // Layout
    activeTab: 'today' | 'stats' | 'energy' | 'completed' | 'inbox';
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
            setActiveTab: (tab) => set({ activeTab: tab }),
            setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
            toggleLeftSidebar: () =>
                set((state) => ({ leftSidebarCollapsed: !state.leftSidebarCollapsed })),
            toggleRightPanels: () =>
                set((state) => ({ rightPanelsCollapsed: !state.rightPanelsCollapsed })),
            openModal: (modal) =>
                set((state) => ({ modals: { ...state.modals, [modal]: true } })),
            closeModal: (modal) =>
                set((state) => ({ modals: { ...state.modals, [modal]: false } })),
            toggleModal: (modal) =>
                set((state) => ({ modals: { ...state.modals, [modal]: !state.modals[modal] } })),
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

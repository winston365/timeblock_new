import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { WaifuState } from '@/shared/types/domain';
import {
    loadWaifuState,
    increaseAffectionFromTask,
    interactWithWaifu,
    resetDailyWaifuStats,
    getMoodFromAffection,
    getDialogueFromAffection,
} from '@/data/repositories/waifuRepository';

interface WaifuStoreState {
    waifuState: WaifuState | null;
    loading: boolean;
    error: Error | null;
}

interface WaifuStoreActions {
    loadData: () => Promise<void>;
    onTaskComplete: () => Promise<void>;
    onInteract: () => Promise<void>;
    resetDaily: () => Promise<void>;
}

export const useWaifuStore = create<WaifuStoreState & WaifuStoreActions>()(
    devtools(
        (set, get) => ({
            waifuState: null,
            loading: false,
            error: null,

            loadData: async () => {
                set({ loading: true, error: null });
                try {
                    const data = await loadWaifuState();
                    set({ waifuState: data, loading: false });
                } catch (error) {
                    set({ error: error as Error, loading: false });
                }
            },

            onTaskComplete: async () => {
                try {
                    const updatedState = await increaseAffectionFromTask();
                    set({ waifuState: updatedState });
                } catch (error) {
                    set({ error: error as Error });
                }
            },

            onInteract: async () => {
                try {
                    const updatedState = await interactWithWaifu();
                    set({ waifuState: updatedState });
                } catch (error) {
                    set({ error: error as Error });
                }
            },

            resetDaily: async () => {
                try {
                    const updatedState = await resetDailyWaifuStats();
                    set({ waifuState: updatedState });
                } catch (error) {
                    set({ error: error as Error });
                }
            },
        }),
        { name: 'WaifuStore' }
    )
);

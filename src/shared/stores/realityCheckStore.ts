import { create } from 'zustand';

interface RealityCheckStore {
    isOpen: boolean;
    taskId: string | null;
    taskTitle: string;
    estimatedDuration: number;
    openRealityCheck: (taskId: string, title: string, estimatedDuration: number) => void;
    closeRealityCheck: () => void;
}

export const useRealityCheckStore = create<RealityCheckStore>((set) => ({
    isOpen: false,
    taskId: null,
    taskTitle: '',
    estimatedDuration: 0,
    openRealityCheck: (taskId, taskTitle, estimatedDuration) =>
        set({ isOpen: true, taskId, taskTitle, estimatedDuration }),
    closeRealityCheck: () =>
        set({ isOpen: false, taskId: null, taskTitle: '', estimatedDuration: 0 }),
}));

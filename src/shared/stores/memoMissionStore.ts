/**
 * MemoMissionStore
 * 
 * 메모 미션 모달의 전역 상태 관리
 * TaskCard 인스턴스와 독립적으로 동작하여 중복 모달 문제 해결
 */

import { create } from 'zustand';
import type { Task } from '@/shared/types/domain';

interface MemoMissionState {
    // Modal state
    isOpen: boolean;
    task: Task | null;
    
    // Mission state
    initialMemoLength: number;
    memoMissionStartTime: number | null;
    memoMissionElapsed: number;
    memoMissionText: string;
    
    // Callbacks
    onUpdateTask: ((updates: Partial<Task>) => void) | null;
    onAwardXP: ((amount: number, context?: 'memo_mission') => Promise<void> | void) | null;
    
    // Actions
    openMission: (
        task: Task,
        onUpdateTask?: (updates: Partial<Task>) => void,
        onAwardXP?: (amount: number, context?: 'memo_mission') => Promise<void> | void
    ) => void;
    closeMission: () => void;
    setMemoText: (text: string) => void;
    updateElapsed: (elapsed: number) => void;
}

export const useMemoMissionStore = create<MemoMissionState>((set) => ({
    // Initial state
    isOpen: false,
    task: null,
    initialMemoLength: 0,
    memoMissionStartTime: null,
    memoMissionElapsed: 0,
    memoMissionText: '',
    onUpdateTask: null,
    onAwardXP: null,
    
    // Actions
    openMission: (task, onUpdateTask, onAwardXP) => {
        const currentMemo = task.memo || '';
        set({
            isOpen: true,
            task,
            initialMemoLength: currentMemo.length,
            memoMissionStartTime: Date.now(),
            memoMissionElapsed: 0,
            memoMissionText: currentMemo,
            onUpdateTask: onUpdateTask || null,
            onAwardXP: onAwardXP || null,
        });
    },
    
    closeMission: () => set({
        isOpen: false,
        task: null,
        initialMemoLength: 0,
        memoMissionStartTime: null,
        memoMissionElapsed: 0,
        memoMissionText: '',
        onUpdateTask: null,
        onAwardXP: null,
    }),
    
    setMemoText: (text) => set({ memoMissionText: text }),
    
    updateElapsed: (elapsed) => set({ memoMissionElapsed: elapsed }),
}));

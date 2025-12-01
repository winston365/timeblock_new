/**
 * MemoMissionStore
 *
 * @fileoverview 메모 미션 모달 상태 관리 스토어
 *
 * @role 메모 미션 모달의 전역 상태 관리
 * @responsibilities
 *   - 메모 미션 모달 열기/닫기 상태 관리
 *   - 미션 진행 중인 작업 정보 저장
 *   - 메모 텍스트 및 경과 시간 추적
 *   - TaskCard 인스턴스와 독립적으로 동작하여 중복 모달 문제 해결
 * @dependencies
 *   - zustand: 전역 상태 관리
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

/**
 * 메모 미션 상태 스토어
 *
 * @description 작업 완료 후 메모 작성 미션의 상태를 전역으로 관리합니다.
 */
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
    /**
     * 메모 미션 모달을 엽니다.
     * @param task - 미션 대상 작업
     * @param onUpdateTask - 작업 업데이트 콜백 (선택)
     * @param onAwardXP - XP 지급 콜백 (선택)
     */
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
    
    /**
     * 메모 미션 모달을 닫고 상태를 초기화합니다.
     */
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
    
    /**
     * 메모 텍스트를 업데이트합니다.
     * @param text - 새 메모 텍스트
     */
    setMemoText: (text) => set({ memoMissionText: text }),
    
    /**
     * 경과 시간을 업데이트합니다.
     * @param elapsed - 경과 시간(ms)
     */
    updateElapsed: (elapsed) => set({ memoMissionElapsed: elapsed }),
}));

/**
 * @file waifuStore.ts
 *
 * @description 와이푸 캐릭터 상태를 관리하는 Zustand 스토어
 *
 * @role 와이푸 상태 관리 스토어 - 호감도, 작업 완료 수 등
 *
 * @responsibilities
 *   - 와이푸 상태 로드 및 캐싱
 *   - 작업 완료 시 호감도 증가
 *   - 사용자 인터랙션 처리
 *   - 일일 통계 리셋
 *   - XP와 호감도 동기화
 *
 * @dependencies
 *   - zustand: 상태 관리 라이브러리
 *   - waifuRepository: 와이푸 데이터 영속성 레이어
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { WaifuState } from '@/shared/types/domain';
import {
    loadWaifuState,
    increaseAffectionFromTask,
    interactWithWaifu,
    resetDailyWaifuStats,
    syncAffectionWithXP,
} from '@/data/repositories/waifuRepository';

/**
 * 와이푸 스토어 상태 인터페이스
 */
interface WaifuStoreState {
    /** 현재 와이푸 상태 (호감도, 완료 작업 수 등) */
    waifuState: WaifuState | null;
    /** 데이터 로딩 중 여부 */
    loading: boolean;
    /** 에러 객체 */
    error: Error | null;
}

/**
 * 와이푸 스토어 액션 인터페이스
 */
interface WaifuStoreActions {
    /** 와이푸 상태 로드 */
    loadData: () => Promise<void>;
    /** 작업 완료 시 호감도 증가 */
    onTaskComplete: () => Promise<void>;
    /** 사용자 인터랙션 처리 */
    onInteract: () => Promise<void>;
    /** 일일 통계 리셋 */
    resetDaily: () => Promise<void>;
    /** XP와 호감도 동기화 */
    syncWithXP: () => Promise<void>;
}

/**
 * 와이푸 상태 관리 Zustand 스토어
 *
 * @returns 와이푸 상태 및 액션
 */
export const useWaifuStore = create<WaifuStoreState & WaifuStoreActions>()(
    devtools(
        (set, _get) => ({
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

            syncWithXP: async () => {
                try {
                    const updatedState = await syncAffectionWithXP();
                    set({ waifuState: updatedState });
                } catch (error) {
                    console.error('[WaifuStore] Failed to sync affection with XP:', error);
                    set({ error: error as Error });
                }
            },
        }),
        { name: 'WaifuStore' }
    )
);

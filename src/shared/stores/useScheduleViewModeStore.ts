/**
 * useScheduleViewModeStore - 스케줄 뷰 모드 관리 스토어
 *
 * @file useScheduleViewModeStore.ts
 * @role 중앙 영역 표시 모드 상태 관리
 * @responsibilities
 *   - 스케줄 뷰 모드 상태 관리 (타임블럭/목표/인박스)
 *   - Dexie systemState persist로 영속화
 * @dependencies
 *   - zustand: 상태 관리
 *   - zustand/middleware: persist middleware
 *   - dexieSystemStateStorage: Dexie systemState 기반 storage
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createDexieSystemStateStorage } from '@/shared/stores/persist/dexieSystemStateStorage';

/**
 * 스케줄 뷰 모드 타입
 * - timeblock: 기본 타임블럭 스케줄 뷰
 * - goals: 장기 목표 패널
 * - inbox: 인박스 태스크 목록
 */
export type ScheduleViewMode = 'timeblock' | 'goals' | 'inbox';

/**
 * 스케줄 뷰 모드 스토어 상태 인터페이스
 */
interface ScheduleViewModeState {
    /** 현재 스케줄 뷰 모드 */
    mode: ScheduleViewMode;
    /** 모드 변경 함수 */
    setMode: (mode: ScheduleViewMode) => void;
    /** 타임블럭 모드로 전환 */
    showTimeblock: () => void;
    /** 목표 모드로 전환 */
    showGoals: () => void;
    /** 인박스 모드로 전환 */
    showInbox: () => void;
}

/**
 * 스케줄 뷰 모드 관리 스토어
 *
 * 중앙 영역에서 표시할 콘텐츠 모드를 관리합니다.
 * persist middleware로 Dexie systemState에 상태가 영속화됩니다.
 *
 * @example
 * ```typescript
 * const { mode, setMode, showGoals } = useScheduleViewModeStore();
 *
 * // 목표 모드로 전환
 * showGoals();
 *
 * // 또는 직접 모드 설정
 * setMode('inbox');
 * ```
 */
export const useScheduleViewModeStore = create<ScheduleViewModeState>()(
    persist(
        (set) => ({
            mode: 'timeblock',
            setMode: (mode) => set({ mode }),
            showTimeblock: () => set({ mode: 'timeblock' }),
            showGoals: () => set({ mode: 'goals' }),
            showInbox: () => set({ mode: 'inbox' }),
        }),
        {
            name: 'schedule-view-mode',
            storage: createJSONStorage(() =>
                createDexieSystemStateStorage({ prefix: 'persist:' })
            ),
            partialize: (state) => ({
                mode: state.mode,
            }),
        }
    )
);

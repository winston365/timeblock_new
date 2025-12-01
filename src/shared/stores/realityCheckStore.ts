/**
 * RealityCheckStore
 *
 * @fileoverview 리얼리티 체크 모달 상태 관리 스토어
 *
 * @role 작업 시간 예측 검증(리얼리티 체크) 모달 상태 관리
 * @responsibilities
 *   - 리얼리티 체크 모달 열기/닫기 상태 관리
 *   - 검증 대상 작업 정보 저장 (ID, 제목, 예상 소요시간)
 * @dependencies
 *   - zustand: 전역 상태 관리
 */

import { create } from 'zustand';

interface RealityCheckStore {
    isOpen: boolean;
    taskId: string | null;
    taskTitle: string;
    estimatedDuration: number;
    openRealityCheck: (taskId: string, title: string, estimatedDuration: number) => void;
    closeRealityCheck: () => void;
}

/**
 * 리얼리티 체크 모달 상태 스토어
 *
 * @description 작업 완료 시 예상 소요시간과 실제 소요시간을 비교하여
 *              사용자의 시간 예측 정확도를 개선하는 데 사용됩니다.
 */
export const useRealityCheckStore = create<RealityCheckStore>((set) => ({
    isOpen: false,
    taskId: null,
    taskTitle: '',
    estimatedDuration: 0,
    /**
     * 리얼리티 체크 모달을 엽니다.
     * @param taskId - 검증할 작업 ID
     * @param taskTitle - 작업 제목
     * @param estimatedDuration - 예상 소요시간(분)
     */
    openRealityCheck: (taskId, taskTitle, estimatedDuration) =>
        set({ isOpen: true, taskId, taskTitle, estimatedDuration }),
    /**
     * 리얼리티 체크 모달을 닫고 상태를 초기화합니다.
     */
    closeRealityCheck: () =>
        set({ isOpen: false, taskId: null, taskTitle: '', estimatedDuration: 0 }),
}));

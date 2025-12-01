/**
 * ToastStore
 *
 * @fileoverview 토스트 알림 상태 관리 스토어
 *
 * @role 애플리케이션 전역 토스트 알림 메시지 관리
 * @responsibilities
 *   - 토스트 메시지 추가 및 자동 제거
 *   - 토스트 타입별 표시 (success, error, info, warning)
 *   - 토스트 표시 시간 관리
 * @dependencies
 *   - zustand: 전역 상태 관리
 *   - generateId: 고유 ID 생성
 */

import { create } from 'zustand';
import { generateId } from '@/shared/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastStore {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
}

/**
 * 토스트 알림 상태 스토어
 *
 * @description 토스트 메시지를 전역으로 관리하며, 자동 제거 타이머를 지원합니다.
 */
export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    /**
     * 토스트 메시지를 추가합니다.
     * @param message - 표시할 메시지
     * @param type - 토스트 타입 (기본값: 'info')
     * @param duration - 표시 시간(ms), 0이면 자동 제거 안함 (기본값: 3000)
     */
    addToast: (message, type = 'info', duration = 3000) => {
        const toastId = generateId('toast');
        set((state) => ({
            toasts: [...state.toasts, { id: toastId, message, type, duration }],
        }));

        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((toast) => toast.id !== toastId),
                }));
            }, duration);
        }
    },
    /**
     * 특정 토스트 메시지를 제거합니다.
     * @param id - 제거할 토스트의 ID
     */
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((toast) => toast.id !== id),
        }));
    },
}));

/**
 * useXPToast - XP 획득 토스트 관리 훅
 *
 * @role XP 획득 알림 토스트의 생성, 표시, 제거를 관리하는 Zustand 스토어
 * @input XP 금액, 선택적 메시지
 * @output 토스트 목록, 토스트 추가/제거 함수
 * @external_dependencies
 *   - zustand: 전역 상태 관리 라이브러리
 */

import { create } from 'zustand';

interface XPToastItem {
  id: string;
  xp: number;
  message?: string;
}

interface XPToastStore {
  toasts: XPToastItem[];
  addToast: (xp: number, message?: string) => void;
  removeToast: (id: string) => void;
}

/**
 * XP 토스트 관리 Zustand 스토어
 *
 * @returns {XPToastStore} 토스트 목록과 관리 함수를 포함한 스토어
 * @sideEffects 전역 상태를 변경하여 화면에 토스트를 표시/제거
 *
 * @example
 * ```tsx
 * const { toasts, addToast, removeToast } = useXPToastStore();
 * addToast(50, '작업 완료!');
 * ```
 */
export const useXPToastStore = create<XPToastStore>((set) => ({
  toasts: [],
  addToast: (xp: number, message?: string) => {
    const id = `xp-toast-${Date.now()}-${Math.random()}`;
    set((state: XPToastStore) => ({
      toasts: [...state.toasts, { id, xp, message }],
    }));
  },
  removeToast: (id: string) => {
    set((state: XPToastStore) => ({
      toasts: state.toasts.filter((toast: XPToastItem) => toast.id !== id),
    }));
  },
}));

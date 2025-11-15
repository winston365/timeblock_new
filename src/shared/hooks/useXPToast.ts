/**
 * useXPToast - XP 획득 토스트 관리 훅
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

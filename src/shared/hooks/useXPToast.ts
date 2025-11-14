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
  addToast: (xp, message) => {
    const id = `xp-toast-${Date.now()}-${Math.random()}`;
    set((state) => ({
      toasts: [...state.toasts, { id, xp, message }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
}));

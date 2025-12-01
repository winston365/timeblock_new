/**
 * @file breakdownStore.ts
 * @role AI 작업 세분화 상태 관리 Zustand 스토어
 * @input 작업 데이터, API 키, 호감도
 * @output 세분화 모달 상태 (isOpen, isLoading, breakdownText), 트리거 함수
 * @dependencies zustand, generateTaskBreakdown
 */

import { create } from 'zustand';
import { Task } from '@/shared/types/domain';
import { generateTaskBreakdown } from '@/shared/services/ai/geminiApi';

interface BreakdownState {
    isOpen: boolean;
    isLoading: boolean;
    breakdownText: string;
    source: 'schedule' | 'inbox' | null;
    taskData: Task | null;
    abortController: AbortController | null;

    // Actions
    triggerBreakdown: (task: Task, source: 'schedule' | 'inbox', apiKey: string, affection: number, refinement?: 'more_detailed' | 'simpler' | null) => Promise<void>;
    cancelBreakdown: () => void;
    close: () => void;
    setBreakdownText: (text: string) => void;
}

export const useTaskBreakdownStore = create<BreakdownState>((set, get) => ({
    isOpen: false,
    isLoading: false,
    breakdownText: '',
    source: null,
    taskData: null,
    abortController: null,

    triggerBreakdown: async (task, source, apiKey, affection, refinement) => {
        // Cancel previous request if exists
        const prevController = get().abortController;
        if (prevController) {
            prevController.abort();
        }

        const controller = new AbortController();

        set({
            isLoading: true,
            source,
            taskData: task,
            isOpen: false,
            breakdownText: '',
            abortController: controller
        });

        try {
            // Note: generateTaskBreakdown needs to support signal if we want true network cancellation.
            // For now, we just handle the state cleanup.
            const breakdown = await generateTaskBreakdown(
                {
                    taskText: task.text,
                    memo: task.memo,
                    baseDuration: task.baseDuration,
                    resistance: task.resistance,
                    preparation1: task.preparation1 || '',
                    preparation2: task.preparation2 || '',
                    preparation3: task.preparation3 || '',
                    affection: affection,
                    refinement: refinement || null,
                },
                apiKey
            );

            // Check if aborted
            if (controller.signal.aborted) return;

            set({ breakdownText: breakdown, isLoading: false, isOpen: true, abortController: null });
        } catch (error) {
            if (controller.signal.aborted) return;

            console.error('Breakdown generation failed:', error);
            set({
                isLoading: false,
                isOpen: true,
                breakdownText: 'AI 분석에 실패했습니다. 다시 시도해주세요.',
                abortController: null
            });
        }
    },

    cancelBreakdown: () => {
        const { abortController } = get();
        if (abortController) {
            abortController.abort();
        }
        set({ isLoading: false, abortController: null });
    },

    close: () => set({ isOpen: false, taskData: null, source: null, breakdownText: '', abortController: null }),
    setBreakdownText: (text) => set({ breakdownText: text }),
}));

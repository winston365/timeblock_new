/**
 * Template Zustand Store
 *
 * @role 템플릿 데이터 상태 관리
 * @input 템플릿 CRUD 요청
 * @output 템플릿 목록 및 관리 함수
 * @external_dependencies
 *   - zustand: 전역 상태 관리
 *   - templateRepository: 데이터 영속성 관리
 *   - settingsRepository: 카테고리 관리
 */

import { create } from 'zustand';
import type { Template, Resistance } from '@/shared/types/domain';
import {
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
} from '@/data/repositories/templateRepository';
import { getTemplateCategories } from '@/data/repositories/settingsRepository';

interface TemplateStore {
    // 상태
    templates: Template[];
    categories: string[];
    loading: boolean;
    error: Error | null;

    // 액션
    loadData: () => Promise<void>;
    loadCategories: () => Promise<void>;
    addTemplate: (
        name: string,
        text: string,
        memo: string,
        baseDuration: number,
        resistance: Resistance,
        timeBlock: string | null,
        autoGenerate: boolean,
        preparation1: string,
        preparation2: string,
        preparation3: string,
        recurrenceType: 'none' | 'daily' | 'weekly' | 'interval',
        weeklyDays: number[],
        intervalDays: number,
        category: string,
        isFavorite: boolean,
        imageUrl?: string
    ) => Promise<void>;
    updateTemplate: (id: string, updates: Partial<Template>) => Promise<void>;
    deleteTemplate: (id: string) => Promise<void>;
    refresh: () => Promise<void>;
}

/**
 * 템플릿 상태 스토어
 */
export const useTemplateStore = create<TemplateStore>((set, get) => ({
    templates: [],
    categories: [],
    loading: false,
    error: null,

    loadData: async () => {
        set({ loading: true, error: null });
        try {
            const templates = await loadTemplates();
            set({ templates, loading: false });
        } catch (error) {
            console.error('TemplateStore: Failed to load templates', error);
            set({ error: error as Error, loading: false });
        }
    },

    loadCategories: async () => {
        try {
            const categories = await getTemplateCategories();
            set({ categories });
        } catch (error) {
            console.error('TemplateStore: Failed to load categories', error);
            // 카테고리 로드 실패는 전체 에러로 취급하지 않음 (기본값 사용 가능)
        }
    },

    addTemplate: async (
        name, text, memo, baseDuration, resistance, timeBlock, autoGenerate,
        preparation1, preparation2, preparation3, recurrenceType, weeklyDays, intervalDays, category, isFavorite, imageUrl
    ) => {
        set({ loading: true, error: null });
        try {
            await createTemplate(
                name, text, memo, baseDuration, resistance, timeBlock, autoGenerate,
                preparation1, preparation2, preparation3, recurrenceType, weeklyDays, intervalDays, category, isFavorite, imageUrl
            );
            await get().loadData();
        } catch (error) {
            console.error('TemplateStore: Failed to add template', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    updateTemplate: async (id, updates) => {
        set({ loading: true, error: null });
        try {
            await updateTemplate(id, updates);
            await get().loadData();
        } catch (error) {
            console.error('TemplateStore: Failed to update template', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    deleteTemplate: async (id) => {
        set({ loading: true, error: null });
        try {
            await deleteTemplate(id);
            await get().loadData();
        } catch (error) {
            console.error('TemplateStore: Failed to delete template', error);
            set({ error: error as Error, loading: false });
            throw error;
        }
    },

    refresh: async () => {
        await get().loadData();
        await get().loadCategories();
    },
}));

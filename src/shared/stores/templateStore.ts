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
 *   - storeUtils: 비동기 액션 래퍼
 */

import { create } from 'zustand';
import type { Template, Resistance, TimeBlockId } from '@/shared/types/domain';
import {
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
} from '@/data/repositories/templateRepository';
import { getTemplateCategories } from '@/data/repositories/settingsRepository';
import { withAsyncAction, withAsyncActionSafe } from '@/shared/lib/storeUtils';

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
        timeBlock: TimeBlockId,
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

    /**
     * 템플릿 목록을 로드합니다.
     * @returns 로드 완료 후 resolve되는 Promise
     */
    loadData: async () => {
        return withAsyncAction(set, async () => {
            const templates = await loadTemplates();
            set({ templates });
        }, { errorPrefix: 'TemplateStore: loadData', rethrow: false });
    },

    /**
     * 템플릿 카테고리 목록을 로드합니다.
     * @returns 로드 완료 후 resolve되는 Promise
     */
    loadCategories: async () => {
        // 카테고리 로드 실패는 전체 에러로 취급하지 않음
        return withAsyncActionSafe(set, async () => {
            const categories = await getTemplateCategories();
            set({ categories });
        }, 'TemplateStore: loadCategories');
    },

    /**
     * 새 템플릿을 추가합니다.
     */
    addTemplate: async (
        name, text, memo, baseDuration, resistance, timeBlock, autoGenerate,
        preparation1, preparation2, preparation3, recurrenceType, weeklyDays, intervalDays, category, isFavorite, imageUrl
    ) => {
        return withAsyncAction(set, async () => {
            await createTemplate(
                name, text, memo, baseDuration, resistance, timeBlock, autoGenerate,
                preparation1, preparation2, preparation3, recurrenceType, weeklyDays, intervalDays, category, isFavorite, imageUrl
            );
            await get().loadData();
        }, { errorPrefix: 'TemplateStore: addTemplate' });
    },

    /**
     * 기존 템플릿을 업데이트합니다.
     */
    updateTemplate: async (id, updates) => {
        return withAsyncAction(set, async () => {
            await updateTemplate(id, updates);
            await get().loadData();
        }, { errorPrefix: 'TemplateStore: updateTemplate' });
    },

    /**
     * 템플릿을 삭제합니다.
     */
    deleteTemplate: async (id) => {
        return withAsyncAction(set, async () => {
            await deleteTemplate(id);
            await get().loadData();
        }, { errorPrefix: 'TemplateStore: deleteTemplate' });
    },

    /**
     * 템플릿 목록과 카테고리를 새로고침합니다.
     */
    refresh: async () => {
        await get().loadData();
        await get().loadCategories();
    },
}));

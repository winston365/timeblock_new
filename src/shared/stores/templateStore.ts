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

    /**
     * 템플릿 목록을 로드합니다.
     * @returns 로드 완료 후 resolve되는 Promise
     */
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

    /**
     * 템플릿 카테고리 목록을 로드합니다.
     * @returns 로드 완료 후 resolve되는 Promise
     */
    loadCategories: async () => {
        try {
            const categories = await getTemplateCategories();
            set({ categories });
        } catch (error) {
            console.error('TemplateStore: Failed to load categories', error);
            // 카테고리 로드 실패는 전체 에러로 취급하지 않음 (기본값 사용 가능)
        }
    },

    /**
     * 새 템플릿을 추가합니다.
     * @param name - 템플릿 이름
     * @param text - 작업 텍스트
     * @param memo - 메모
     * @param baseDuration - 기본 소요 시간(분)
     * @param resistance - 저항 수준
     * @param timeBlock - 타임블록 슬롯
     * @param autoGenerate - 자동 생성 여부
     * @param preparation1 - 준비 항목 1
     * @param preparation2 - 준비 항목 2
     * @param preparation3 - 준비 항목 3
     * @param recurrenceType - 반복 타입
     * @param weeklyDays - 주간 반복 요일
     * @param intervalDays - 반복 간격(일)
     * @param category - 카테고리
     * @param isFavorite - 즐겨찾기 여부
     * @param imageUrl - 이미지 URL (선택)
     * @returns 추가 완료 후 resolve되는 Promise
     * @throws 템플릿 추가 실패 시 에러
     */
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

    /**
     * 기존 템플릿을 업데이트합니다.
     * @param id - 업데이트할 템플릿 ID
     * @param updates - 업데이트할 필드들
     * @returns 업데이트 완료 후 resolve되는 Promise
     * @throws 템플릿 업데이트 실패 시 에러
     */
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

    /**
     * 템플릿을 삭제합니다.
     * @param id - 삭제할 템플릿 ID
     * @returns 삭제 완료 후 resolve되는 Promise
     * @throws 템플릿 삭제 실패 시 에러
     */
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

    /**
     * 템플릿 목록과 카테고리를 새로고침합니다.
     * @returns 새로고침 완료 후 resolve되는 Promise
     */
    refresh: async () => {
        await get().loadData();
        await get().loadCategories();
    },
}));

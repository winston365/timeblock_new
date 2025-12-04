/**
 * @file weatherStore.ts
 * @description 날씨 정보 Zustand 상태 관리 스토어
 *
 * @role 날씨 데이터 상태 관리 및 조회 액션 제공
 * @responsibilities
 *   - 날씨 예보 데이터 상태 관리 (forecast, selectedDay)
 *   - 인사이트 캐싱 (날씨 새로고침 시에만 갱신)
 *   - 로딩/에러 상태 관리
 *   - 날씨 조회 액션 (캐시 활용, 에러 복구)
 *   - 재조회 필요 여부 판단 (30분 경과)
 * @dependencies
 *   - fetchWeatherFromGoogle, clearWeatherCache: weatherService
 *   - WeatherState: 날씨 상태 타입
 */

import { create } from 'zustand';
import type { WeatherState } from '@/shared/types/weather';
import { fetchWeatherFromGoogle, clearWeatherCache, type WeatherInsightResult } from '../services/weatherService';

/** 날씨별 인사이트 캐시 */
interface InsightCache {
    [dayIndex: number]: WeatherInsightResult;
}

interface WeatherStore extends WeatherState {
    /** 인사이트 캐시 (날씨 데이터와 함께 갱신) */
    insightCache: InsightCache;
    /** 인사이트 로딩 중인 날짜 인덱스 */
    insightLoadingDay: number | null;
    
    fetchWeather: (forceRefresh?: boolean, dayIndex?: number, allowRecovery?: boolean) => Promise<void>;
    setSelectedDay: (day: number) => void;
    shouldRefetch: () => boolean;
    /** 인사이트 캐시에 저장 */
    setInsight: (dayIndex: number, insight: WeatherInsightResult) => void;
    /** 인사이트 캐시 조회 */
    getInsight: (dayIndex: number) => WeatherInsightResult | null;
    /** 인사이트 로딩 상태 설정 */
    setInsightLoading: (dayIndex: number | null) => void;
    /** 인사이트 캐시 클리어 */
    clearInsightCache: () => void;
}

/**
 * 날씨 정보 Zustand 스토어
 *
 * @returns 날씨 상태 및 액션 (forecast, selectedDay, fetchWeather, setSelectedDay, shouldRefetch)
 */
export const useWeatherStore = create<WeatherStore>((set, get) => ({
    forecast: [],
    selectedDay: 0,
    loading: false,
    error: null,
    lastUpdated: null,
    lastErrorAt: null,
    insightCache: {},
    insightLoadingDay: null,

    /**
     * 날씨 정보 가져오기
     */
    fetchWeather: async (forceRefresh = false, dayIndex = 0, allowRecovery = true) => {
        try {
            const { lastErrorAt, error } = get();
            const now = Date.now();
            const ERROR_COOLDOWN = 5 * 60 * 1000; // 5분
            if (!forceRefresh && error && lastErrorAt && now - lastErrorAt < ERROR_COOLDOWN) {
                return;
            }

            set({ loading: true, error: null });

            const result = await fetchWeatherFromGoogle('서울 은평구', forceRefresh);

            if (result.status === 'missing-key') {
                set({
                    error: 'WeatherAPI.com API 키가 설정되지 않았습니다. 설정 > Gemini AI 탭에서 API 키를 입력해 주세요.',
                    loading: false,
                    lastErrorAt: Date.now(),
                });
                return;
            }

            const safeForecast = Array.isArray(result.forecast) ? result.forecast : [];
            if (safeForecast.length === 0) {
                set({
                    error: result.message ?? '예보 데이터가 비어 있습니다.',
                    loading: false,
                    lastErrorAt: Date.now(),
                });
                return;
            }

            // 날씨 데이터가 새로 로드되면 인사이트 캐시도 클리어 (새로고침이면)
            const newState: Partial<WeatherStore> = {
                forecast: safeForecast,
                selectedDay: Math.min(dayIndex, safeForecast.length - 1),
                loading: false,
                lastUpdated: result.timestamp || Date.now(),
                lastErrorAt: null,
            };
            
            if (forceRefresh) {
                newState.insightCache = {};
            }
            
            set(newState as WeatherStore);
        } catch (error) {
            console.error('[WeatherStore] Failed to fetch weather:', error);
            if (allowRecovery) {
                try {
                    await clearWeatherCache();
                    // 캐시 삭제 후 한 번 더 시도
                    await get().fetchWeather(forceRefresh, dayIndex, false);
                    return;
                } catch (re) {
                    console.error('[WeatherStore] Recovery attempt failed:', re);
                }
            }
            set({
                error: '날씨 정보를 불러올 수 없습니다',
                loading: false,
                lastErrorAt: Date.now(),
            });
        }
    },

    /**
     * 선택된 날짜 변경
     */
    setSelectedDay: (day: number) => set({ selectedDay: day }),

    /**
     * 재fetch 필요 여부 확인 (30분 경과)
     */
    shouldRefetch: () => {
        const { lastUpdated } = get();
        if (!lastUpdated) return true;

        const now = Date.now();
        const elapsed = now - lastUpdated;
        const THIRTY_MINUTES = 30 * 60 * 1000;

        return elapsed > THIRTY_MINUTES;
    },
    
    /**
     * 인사이트 캐시에 저장
     */
    setInsight: (dayIndex: number, insight: WeatherInsightResult) => {
        set(state => ({
            insightCache: {
                ...state.insightCache,
                [dayIndex]: insight,
            },
        }));
    },
    
    /**
     * 인사이트 캐시 조회
     */
    getInsight: (dayIndex: number) => {
        return get().insightCache[dayIndex] ?? null;
    },
    
    /**
     * 인사이트 로딩 상태 설정
     */
    setInsightLoading: (dayIndex: number | null) => {
        set({ insightLoadingDay: dayIndex });
    },
    
    /**
     * 인사이트 캐시 클리어
     */
    clearInsightCache: () => {
        set({ insightCache: {} });
    },
}));

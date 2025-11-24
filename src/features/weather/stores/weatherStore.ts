/**
 * Weather Zustand Store
 * 
 * 날씨 정보 상태 관리
 */

import { create } from 'zustand';
import type { WeatherState } from '@/shared/types/weather';
import { fetchWeatherFromGoogle, clearWeatherCache } from '../services/weatherService';

interface WeatherStore extends WeatherState {
    fetchWeather: (forceRefresh?: boolean, dayIndex?: number, allowRecovery?: boolean) => Promise<void>;
    setSelectedDay: (day: number) => void;
    shouldRefetch: () => boolean;
}

export const useWeatherStore = create<WeatherStore>((set, get) => ({
    forecast: [],
    selectedDay: 0,
    loading: false,
    error: null,
    lastUpdated: null,
    lastErrorAt: null,

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
                    error: 'Gemini API 키가 설정되지 않았습니다. 설정 > API 키를 입력해 주세요.',
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

            set({
                forecast: safeForecast,
                selectedDay: Math.min(dayIndex, safeForecast.length - 1),
                loading: false,
                lastUpdated: result.timestamp || Date.now(),
                lastErrorAt: null,
            });
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
}));

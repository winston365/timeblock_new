/**
 * Weather Zustand Store
 * 
 * 날씨 정보 상태 관리
 */

import { create } from 'zustand';
import type { WeatherState } from '@/shared/types/weather';
import { fetchWeatherFromGoogle } from '../services/weatherService';

interface WeatherStore extends WeatherState {
    fetchWeather: (forceRefresh?: boolean) => Promise<void>;
    setSelectedDay: (day: number) => void;
    shouldRefetch: () => boolean;
}

export const useWeatherStore = create<WeatherStore>((set, get) => ({
    forecast: [],
    selectedDay: 0,
    loading: false,
    error: null,
    lastUpdated: null,

    /**
     * 날씨 정보 가져오기
     */
    fetchWeather: async (forceRefresh = false) => {
        try {
            set({ loading: true, error: null });

            const { forecast, timestamp } = await fetchWeatherFromGoogle('서울 은평구', forceRefresh);
            const safeForecast = Array.isArray(forecast) ? forecast : [];
            if (safeForecast.length === 0) {
                throw new Error('예보 데이터가 비어 있습니다.');
            }

            set({
                forecast: safeForecast,
                selectedDay: 0,
                loading: false,
                lastUpdated: timestamp || Date.now(),
            });
        } catch (error) {
            console.error('[WeatherStore] Failed to fetch weather:', error);
            set({
                error: '날씨 정보를 불러올 수 없습니다',
                loading: false,
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

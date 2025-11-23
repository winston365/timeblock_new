/**
 * Weather Zustand Store
 * 
 * 날씨 정보 상태 관리
 */
/**
 * Weather Zustand Store
 * 
 * 날씨 정보 상태 관리
 */

import { create } from 'zustand';
import type { WeatherState } from '@/shared/types/weather';
import { fetchWeatherFromGoogle, loadCachedWeather, cacheWeather } from '../services/weatherService';

interface WeatherStore extends WeatherState {
    fetchWeather: (forceRefresh?: boolean) => Promise<void>;
    shouldRefetch: () => boolean;
}

export const useWeatherStore = create<WeatherStore>((set, get) => ({
    current: null,
    hourly: [],
    loading: false,
    error: null,
    lastUpdated: null,

    /**
     * 날씨 정보 가져오기
     */
    fetchWeather: async (forceRefresh = false) => {
        try {
            set({ loading: true, error: null });

            // weatherService가 내부적으로 캐싱을 처리함
            const { current, hourly, timestamp } = await fetchWeatherFromGoogle('서울 은평구', forceRefresh);

            set({
                current,
                hourly,
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

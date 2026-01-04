/**
 * weatherRepository.ts
 *
 * @role 날씨 데이터 캐싱 관리 (Dexie 'weather' 테이블 사용)
 * @description 날씨 API 응답을 로컬에 캐싱하여 API 호출 횟수를 줄입니다.
 */

import { db, type WeatherCacheRecord } from '../db/dexieClient';
import type { DayForecast } from '@/shared/types/weather';
import { getLocalDate } from '@/shared/lib/utils';

// Re-export for external usage
export type { WeatherCacheRecord };

function isValidForecast(forecast: unknown): forecast is DayForecast[] {
    return Array.isArray(forecast) && forecast.length > 0;
}

/**
 * 캐시된 날씨 데이터 로드
 * @returns 캐시된 날씨 데이터 또는 null (만료/없음)
 */
export async function loadCachedWeather(): Promise<{ forecast: DayForecast[]; timestamp: number } | null> {
    try {
        const cached = await db.weather.get('latest');
        if (!cached) return null;

        // 기본 필드 검증 - data가 DayForecast[] 배열임
        if (!cached.data || !isValidForecast(cached.data) || !cached.timestamp || !cached.lastUpdatedDate) {
            console.warn('[WeatherRepository] Cached weather data invalid. Ignoring cache.');
            await db.weather.delete('latest').catch((err) => console.error('[WeatherRepository] Failed to clear invalid cache', err));
            return null;
        }

        // 오늘 날짜 확인 (YYYY-MM-DD)
        const todayDate = getLocalDate();
        if (cached.lastUpdatedDate !== todayDate) {
            return null;
        }

        return { forecast: cached.data, timestamp: cached.timestamp };
    } catch (error) {
        console.error('[WeatherRepository] Load failed:', error);
        return null;
    }
}

/**
 * 날씨 데이터 캐싱
 * @param forecast - 저장할 날씨 예보 배열
 * @param timestamp - 저장 시점 타임스탬프
 */
export async function cacheWeather(forecast: DayForecast[], timestamp: number): Promise<void> {
    try {
        const today = getLocalDate();
        await db.weather.put({
            id: 'latest',
            data: forecast,
            timestamp: timestamp,
            lastUpdatedDate: today
        });
    } catch (error) {
        console.error('[WeatherRepository] Save failed:', error);
    }
}

/**
 * 날씨 캐시 삭제
 */
export async function clearWeatherCache(): Promise<void> {
    try {
        await db.weather.delete('latest');
    } catch (error) {
        console.error('[WeatherRepository] Cache clear failed:', error);
    }
}

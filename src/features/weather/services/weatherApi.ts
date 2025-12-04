/**
 * @file weatherApi.ts
 * @description WeatherAPI.com을 사용한 날씨 데이터 조회 서비스
 *
 * @role WeatherAPI.com API를 통한 날씨 정보 조회
 * @responsibilities
 *   - 3일치 시간별 날씨 예보 조회
 *   - API 응답을 DayForecast 형식으로 변환
 *   - 날씨 아이콘 매핑
 * @dependencies
 *   - DayForecast: 날씨 예보 타입
 *   - useSettingsStore: API 키 조회
 * 
 * @see https://www.weatherapi.com/docs/
 */

import type { DayForecast, HourlyWeather, WeatherData } from '@/shared/types/weather';
import { useSettingsStore } from '@/shared/stores/settingsStore';

// ============================================================================
// WeatherAPI.com 응답 타입 (API 문서 기준)
// ============================================================================

interface WeatherApiLocation {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    tz_id: string;
    localtime_epoch: number;
    localtime: string;
}

interface WeatherApiCondition {
    text: string;
    icon: string;
    code: number;
}

interface WeatherApiCurrent {
    last_updated_epoch: number;
    last_updated: string;
    temp_c: number;
    temp_f: number;
    is_day: number;
    condition: WeatherApiCondition;
    wind_mph: number;
    wind_kph: number;
    wind_degree: number;
    wind_dir: string;
    pressure_mb: number;
    pressure_in: number;
    precip_mm: number;
    precip_in: number;
    humidity: number;
    cloud: number;
    feelslike_c: number;
    feelslike_f: number;
    vis_km: number;
    vis_miles: number;
    uv: number;
    gust_mph: number;
    gust_kph: number;
}

interface WeatherApiForecastDay {
    date: string;
    date_epoch: number;
    day: {
        maxtemp_c: number;
        maxtemp_f: number;
        mintemp_c: number;
        mintemp_f: number;
        avgtemp_c: number;
        avgtemp_f: number;
        maxwind_mph: number;
        maxwind_kph: number;
        totalprecip_mm: number;
        totalprecip_in: number;
        avgvis_km: number;
        avgvis_miles: number;
        avghumidity: number;
        daily_will_it_rain: number;
        daily_chance_of_rain: number;
        daily_will_it_snow: number;
        daily_chance_of_snow: number;
        condition: WeatherApiCondition;
        uv: number;
    };
    astro: {
        sunrise: string;
        sunset: string;
        moonrise: string;
        moonset: string;
        moon_phase: string;
        moon_illumination: number;
    };
    hour: WeatherApiHour[];
}

interface WeatherApiHour {
    time_epoch: number;
    time: string;
    temp_c: number;
    temp_f: number;
    is_day: number;
    condition: WeatherApiCondition;
    wind_mph: number;
    wind_kph: number;
    wind_degree: number;
    wind_dir: string;
    pressure_mb: number;
    pressure_in: number;
    precip_mm: number;
    precip_in: number;
    humidity: number;
    cloud: number;
    feelslike_c: number;
    feelslike_f: number;
    windchill_c: number;
    windchill_f: number;
    heatindex_c: number;
    heatindex_f: number;
    dewpoint_c: number;
    dewpoint_f: number;
    will_it_rain: number;
    chance_of_rain: number;
    will_it_snow: number;
    chance_of_snow: number;
    vis_km: number;
    vis_miles: number;
    gust_mph: number;
    gust_kph: number;
    uv: number;
}

interface WeatherApiResponse {
    location: WeatherApiLocation;
    current: WeatherApiCurrent;
    forecast: {
        forecastday: WeatherApiForecastDay[];
    };
}

interface WeatherApiError {
    error: {
        code: number;
        message: string;
    };
}

// ============================================================================
// 결과 타입
// ============================================================================

export interface WeatherApiFetchResult {
    forecast: DayForecast[];
    timestamp?: number;
    status: 'ok' | 'missing-key' | 'error';
    message?: string;
}

// ============================================================================
// API 호출
// ============================================================================

// 서울 은평구 좌표 (기본값)
const DEFAULT_LOCATION = '37.6027,126.9291';

/**
 * WeatherAPI.com을 통해 날씨 정보를 조회합니다.
 * 
 * API 문서: https://www.weatherapi.com/docs/
 * - Forecast API: /forecast.json
 * - q 파라미터: 위도,경도 (예: 48.8567,2.3508) 또는 도시명
 * - days: 1-14일 예보 (무료 플랜은 3일까지)
 * - lang: 언어 코드 (ko = 한국어)
 *
 * @param location - 조회할 위치 (기본값: 서울 은평구 좌표 37.6027,126.9291)
 * @returns 날씨 예보 결과 (forecast, timestamp, status, message)
 */
export async function fetchWeatherFromApi(
    location: string = DEFAULT_LOCATION
): Promise<WeatherApiFetchResult> {
    try {
        // 1. API 키 확인
        const weatherApiKey = useSettingsStore.getState().settings?.weatherApiKey;
        if (!weatherApiKey || weatherApiKey.trim() === '') {
            return {
                forecast: [],
                timestamp: Date.now(),
                status: 'missing-key',
                message: 'WeatherAPI.com API 키가 설정되지 않았습니다.',
            };
        }

        // 2. API URL 구성
        // API 문서: q 파라미터는 위도,경도 또는 도시명 사용 가능
        // 좌표 사용 시 encodeURIComponent 불필요 (숫자와 콤마만 있음)
        const baseUrl = 'https://api.weatherapi.com/v1/forecast.json';
        const params = new URLSearchParams({
            key: weatherApiKey.trim(),
            q: location,
            days: '3',
            aqi: 'no',
            alerts: 'no',
            lang: 'ko',
        });
        
        const url = `${baseUrl}?${params.toString()}`;
        
        console.log('[WeatherAPI] Fetching:', url.replace(weatherApiKey, '***API_KEY***'));

        // 3. API 호출
        const response = await fetch(url);
        const responseData = await response.json();
        
        // 4. 에러 처리
        if (!response.ok || responseData.error) {
            const errorInfo = responseData as WeatherApiError;
            const errorCode = errorInfo.error?.code;
            const errorMessage = errorInfo.error?.message || `HTTP ${response.status}`;
            
            console.error('[WeatherAPI] Error:', { 
                status: response.status, 
                code: errorCode, 
                message: errorMessage 
            });
            
            // API 에러 코드별 처리 (API 문서 참조)
            // 1002: API key not provided
            // 1003: Parameter 'q' not provided
            // 1005: API request url is invalid
            // 1006: No location found matching parameter 'q'
            // 2006: API key provided is invalid
            // 2007: API key has exceeded calls per month quota
            // 2008: API key has been disabled
            // 2009: API key does not have access to the resource
            
            let userMessage = errorMessage;
            if (errorCode === 1002 || errorCode === 2006 || errorCode === 2008) {
                userMessage = `API 키 오류: ${errorMessage}`;
            } else if (errorCode === 1006) {
                userMessage = `위치를 찾을 수 없습니다: ${location}`;
            } else if (errorCode === 2007) {
                userMessage = '월간 API 호출 한도를 초과했습니다.';
            } else if (errorCode === 2009) {
                userMessage = '현재 플랜에서는 이 기능을 사용할 수 없습니다.';
            }
            
            return {
                forecast: [],
                timestamp: Date.now(),
                status: 'error',
                message: userMessage,
            };
        }

        // 5. 응답 파싱
        const data = responseData as WeatherApiResponse;
        console.log('[WeatherAPI] Success:', {
            location: data.location.name,
            days: data.forecast.forecastday.length,
        });
        
        const forecast = parseWeatherApiResponse(data);

        return {
            forecast,
            timestamp: Date.now(),
            status: 'ok',
        };
    } catch (error) {
        console.error('[WeatherAPI] Fetch error:', error);
        return {
            forecast: [],
            timestamp: Date.now(),
            status: 'error',
            message: error instanceof Error ? error.message : '날씨 정보를 가져오지 못했습니다.',
        };
    }
}

// ============================================================================
// 응답 파싱
// ============================================================================

/**
 * WeatherAPI.com 응답을 DayForecast 배열로 변환합니다.
 */
function parseWeatherApiResponse(data: WeatherApiResponse): DayForecast[] {
    const locationName = data.location.name;
    const dateLabels = ['오늘', '내일', '모레'] as const;
    const dateIds = ['today', 'tomorrow', 'dayAfter'] as const;

    return data.forecast.forecastday.map((day, index) => {
        // 시간별 데이터 (6시~21시, 3시간 간격)
        const hourlyData = filterHourlyData(day.hour);
        
        // 현재 날씨 정보: 오늘은 현재 시간 기준 hourly 데이터 사용
        const currentWeather: WeatherData = index === 0 
            ? buildCurrentWeatherFromHourly(day.hour, data.current, locationName, day.day.daily_chance_of_rain)
            : buildDayWeather(day, locationName);

        return {
            date: dateIds[index],
            dateLabel: dateLabels[index],
            current: currentWeather,
            hourly: hourlyData,
        };
    });
}

/**
 * 현재 날씨 데이터 생성 (오늘용) - 현재 시간에 가장 가까운 hourly 데이터 사용
 */
function buildCurrentWeatherFromHourly(
    hours: WeatherApiHour[],
    currentApi: WeatherApiCurrent,
    location: string,
    dailyChanceOfRain: number
): WeatherData {
    const now = new Date();
    const currentHour = now.getHours();
    
    // 현재 시간에 가장 가까운 hourly 데이터 찾기
    const closestHour = hours.reduce((closest, hour) => {
        const hourTime = hour.time.split(' ')[1] || '00:00';
        const hourNum = parseInt(hourTime.split(':')[0], 10);
        const closestTime = closest.time.split(' ')[1] || '00:00';
        const closestNum = parseInt(closestTime.split(':')[0], 10);
        
        const diffCurrent = Math.abs(hourNum - currentHour);
        const diffClosest = Math.abs(closestNum - currentHour);
        
        return diffCurrent < diffClosest ? hour : closest;
    }, hours[0]);
    
    // hourly 데이터가 있으면 그것을 사용, 없으면 current API 데이터 사용
    if (closestHour) {
        const hourTime = closestHour.time.split(' ')[1] || '00:00';
        const hourNum = parseInt(hourTime.split(':')[0], 10);
        
        return {
            temp: Math.round(closestHour.temp_c),
            feelsLike: Math.round(closestHour.feelslike_c),
            condition: closestHour.condition.text,
            icon: getWeatherIcon(closestHour.condition.code, closestHour.is_day === 1, hourNum),
            humidity: closestHour.humidity,
            chanceOfRain: dailyChanceOfRain,
            location,
        };
    }
    
    // fallback: current API 데이터
    return {
        temp: Math.round(currentApi.temp_c),
        feelsLike: Math.round(currentApi.feelslike_c),
        condition: currentApi.condition.text,
        icon: getWeatherIcon(currentApi.condition.code, currentApi.is_day === 1, currentHour),
        humidity: currentApi.humidity,
        chanceOfRain: dailyChanceOfRain,
        location,
    };
}

/**
 * 일별 대표 날씨 데이터 생성 (내일/모레용)
 */
function buildDayWeather(day: WeatherApiForecastDay, location: string): WeatherData {
    // 12시 데이터를 대표로 사용
    const noonHour = day.hour.find(h => {
        const hourStr = h.time.split(' ')[1]; // "2024-12-04 12:00" -> "12:00"
        return hourStr?.startsWith('12:');
    }) || day.hour[Math.floor(day.hour.length / 2)];

    return {
        temp: Math.round(day.day.avgtemp_c),
        feelsLike: noonHour ? Math.round(noonHour.feelslike_c) : Math.round(day.day.avgtemp_c),
        condition: day.day.condition.text,
        icon: getWeatherIcon(day.day.condition.code, true, 12),
        humidity: day.day.avghumidity,
        chanceOfRain: day.day.daily_chance_of_rain,
        location,
    };
}

/**
 * 시간별 데이터 필터링 (6시~21시, 3시간 간격)
 */
function filterHourlyData(hours: WeatherApiHour[]): HourlyWeather[] {
    const targetHours = [6, 9, 12, 15, 18, 21];
    
    return hours
        .filter(hour => {
            // time 형식: "2024-12-04 06:00"
            const timeStr = hour.time.split(' ')[1]; // "06:00"
            const hourNum = parseInt(timeStr?.split(':')[0] || '0', 10);
            return targetHours.includes(hourNum);
        })
        .map(hour => {
            const timeStr = hour.time.split(' ')[1] || '00:00'; // "06:00"
            const hourNum = parseInt(timeStr.split(':')[0], 10);
            
            // 강수확률: 비와 눈 중 더 높은 값 사용
            const chanceOfPrecip = Math.max(hour.chance_of_rain, hour.chance_of_snow);
            
            return {
                time: timeStr,
                temp: Math.round(hour.temp_c),
                feelsLike: Math.round(hour.feelslike_c),
                icon: getWeatherIcon(hour.condition.code, hour.is_day === 1, hourNum),
                chanceOfRain: chanceOfPrecip,
            };
        });
}

// ============================================================================
// 날씨 아이콘 매핑
// ============================================================================

/**
 * WeatherAPI.com 날씨 코드를 이모지 아이콘으로 변환
 * 
 * @see https://www.weatherapi.com/docs/weather_conditions.json
 * 
 * 주요 코드:
 * - 1000: Sunny/Clear
 * - 1003: Partly cloudy
 * - 1006: Cloudy
 * - 1009: Overcast
 * - 1030, 1135, 1147: Mist/Fog
 * - 1063, 1180-1195, 1240-1246: Rain
 * - 1066, 1210-1225, 1255-1264: Snow
 * - 1087, 1273-1282: Thunder
 */
function getWeatherIcon(code: number, isDay: boolean, hour: number): string {
    const isNight = !isDay || hour >= 19 || hour < 6;

    // 맑음 (1000)
    if (code === 1000) {
        return isNight ? '🌙' : '☀️';
    }
    
    // 구름 (1003, 1006, 1009)
    if (code === 1003) return isNight ? '☁️' : '🌤️'; // 구름 조금
    if (code === 1006) return isNight ? '☁️' : '⛅'; // 흐림
    if (code === 1009) return '☁️'; // 완전 흐림
    
    // 안개 (1030, 1135, 1147)
    if ([1030, 1135, 1147].includes(code)) return '🌫️';
    
    // 비 (1063, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246)
    if ([1063, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) {
        return '🌧️';
    }
    
    // 눈 (1066, 1069, 1072, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264)
    if ([1066, 1069, 1072, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code)) {
        return '❄️';
    }
    
    // 천둥번개 (1087, 1273, 1276, 1279, 1282)
    if ([1087, 1273, 1276, 1279, 1282].includes(code)) return '⛈️';
    
    // 기본
    return isNight ? '🌙' : '🌤️';
}

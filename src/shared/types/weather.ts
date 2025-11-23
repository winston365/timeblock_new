/**
 * Weather Types
 * 
 * 날씨 정보 타입 정의
 */

export interface WeatherData {
    temp: number;
    feelsLike: number;
    condition: string;
    icon: string;
    humidity?: number;
    chanceOfRain?: number;
    location: string;
}

export interface HourlyWeather {
    time: string;
    temp: number;
    feelsLike: number;
    icon: string;
    chanceOfRain?: number;
}

/**
 * 일별 예보 데이터
 */
export interface DayForecast {
    date: 'today' | 'tomorrow' | 'dayAfter';
    dateLabel: string; // '오늘' | '내일' | '모레'
    current: WeatherData;
    hourly: HourlyWeather[];
}

export interface WeatherState {
    forecast: DayForecast[]; // 3일치 예보
    selectedDay: number; // 0=오늘, 1=내일, 2=모레
    loading: boolean;
    error: string | null;
    lastUpdated: number | null;
}

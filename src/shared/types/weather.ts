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

export interface WeatherState {
    current: WeatherData | null;
    hourly: HourlyWeather[];
    loading: boolean;
    error: string | null;
    lastUpdated: number | null;
}

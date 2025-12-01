/**
 * Weather Types
 *
 * @fileoverview 날씨 정보 관련 타입 정의
 *
 * @role 날씨 API 응답 및 상태 관리를 위한 타입 정의
 * @responsibilities
 *   - 현재 날씨 데이터 타입 정의
 *   - 시간별 예보 데이터 타입 정의
 *   - 일별 예보 데이터 타입 정의
 *   - 날씨 상태 관리 타입 정의
 * @dependencies 없음 (standalone type definitions)
 */

/**
 * 현재 날씨 데이터
 */
export interface WeatherData {
    /** 현재 온도 (섭씨) */
    temp: number;
    /** 체감 온도 (섭씨) */
    feelsLike: number;
    /** 날씨 상태 설명 */
    condition: string;
    /** 날씨 아이콘 코드 */
    icon: string;
    /** 습도 (%) */
    humidity?: number;
    /** 강수 확률 (%) */
    chanceOfRain?: number;
    /** 위치명 */
    location: string;
}

/**
 * 시간별 날씨 데이터
 */
export interface HourlyWeather {
    /** 시간 문자열 (HH:mm 형식) */
    time: string;
    /** 예상 온도 (섭씨) */
    temp: number;
    /** 체감 온도 (섭씨) */
    feelsLike: number;
    /** 날씨 아이콘 코드 */
    icon: string;
    /** 강수 확률 (%) */
    chanceOfRain?: number;
}

/**
 * 일별 예보 데이터
 *
 * 3일간의 날씨 예보를 제공합니다 (오늘, 내일, 모레).
 */
export interface DayForecast {
    /** 날짜 식별자 */
    date: 'today' | 'tomorrow' | 'dayAfter';
    /** 표시용 레이블 ('오늘' | '내일' | '모레') */
    dateLabel: string;
    /** 현재 날씨 정보 */
    current: WeatherData;
    /** 시간별 예보 배열 */
    hourly: HourlyWeather[];
}

/**
 * 날씨 상태 관리 타입
 *
 * Zustand 스토어에서 사용하는 날씨 상태 타입입니다.
 */
export interface WeatherState {
    /** 3일치 예보 배열 */
    forecast: DayForecast[];
    /** 선택된 날짜 인덱스 (0=오늘, 1=내일, 2=모레) */
    selectedDay: number;
    /** 로딩 상태 */
    loading: boolean;
    /** 에러 메시지 */
    error: string | null;
    /** 마지막 업데이트 시간 (타임스탬프) */
    lastUpdated: number | null;
}

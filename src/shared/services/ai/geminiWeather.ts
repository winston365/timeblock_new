/**
 * Gemini Weather Service - Google Search Grounding 사용
 * refer 프로젝트 참고
 */

import { callGeminiAPIWithTools } from './geminiApi';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';
import type { DayForecast } from '@/shared/types/weather';

export interface WeatherDataPoint {
    time: string;
    temperature: number;
    condition: string;
    chanceOfRain: number;
    humidity: number;
}

export interface WeatherResponse {
    resolvedAddress?: string;
    forecast: DayForecast[]; // 3일치 예보
}

/**
 * Gemini Google Search Grounding으로 실시간 날씨 가져오기
 */
export async function fetchWeatherWithGemini(
    location: string,
    apiKey: string
): Promise<WeatherResponse> {
    const prompt = `
You are a weather data assistant. Your task is to use Google Search to find accurate hourly weather forecast for "${location}" for the NEXT 3 DAYS (TODAY, TOMORROW, and DAY AFTER TOMORROW).

**IMPORTANT INSTRUCTIONS:**
1. MUST use Google Search tool to find real weather data
2. Find reliable sources (weather.com, accuweather.com, kma.go.kr, or similar official weather services)
3. Extract ACTUAL data from search results - DO NOT make up or guess any values
4. ChanceOfRain (강수확률) is CRITICAL - get the exact percentage from the source
5. Return data for 3 DAYS in the format below

**OUTPUT FORMAT (Follow EXACTLY):**

=== DAY: 오늘 ===
Location: [City name in Korean]

| Time | Temperature | Condition | ChanceOfRain | Humidity |
|------|-------------|-----------|--------------|----------|
| 06:00 | 15 | 맑음 | 10 | 65 |
| 09:00 | 18 | 맑음 | 5 | 60 |
| 12:00 | 22 | 구름조금 | 0 | 55 |

=== DAY: 내일 ===
Location: [City name in Korean]

| Time | Temperature | Condition | ChanceOfRain | Humidity |
|------|-------------|-----------|--------------|----------|
| 06:00 | 14 | 흐림 | 30 | 70 |
| 09:00 | 17 | 흐림 | 40 | 68 |

=== DAY: 모레 ===
Location: [City name in Korean]

| Time | Temperature | Condition | ChanceOfRain | Humidity |
|------|-------------|-----------|--------------|----------|
| 06:00 | 16 | 맑음 | 5 | 60 |
| 09:00 | 19 | 맑음 | 0 | 58 |

**COLUMN REQUIREMENTS:**
- Time: 24-hour format (HH:MM), provide data for every 3 hours from 06:00 to 21:00
- Temperature: Integer number ONLY (no units, no symbols)
- Condition: Korean weather description (맑음, 흐림, 비, 눈, 구름조금, etc.)
- ChanceOfRain: Integer 0-100 ONLY (no % symbol) - This is the precipitation probability
- Humidity: Integer 0-100 ONLY (no % symbol)

**CRITICAL:**
- Each day MUST start with "=== DAY: [오늘|내일|모레] ===" header
- ChanceOfRain (강수확률) must be the ACTUAL precipitation probability from the weather source
- If you cannot find precipitation data in the search results, use 0
- Use pipe | separators consistently
- Numbers must be bare integers with no extra characters
`.trim();

    try {
        const { text, tokenUsage } = await callGeminiAPIWithTools(prompt, apiKey);

        // 디버깅: 원본 응답 출력
        console.log('[Gemini Weather] Raw response:', text);
        console.log('[Gemini Weather] =====================================');

        if (tokenUsage) {
            addTokenUsage(tokenUsage.promptTokens, tokenUsage.candidatesTokens).catch(console.error);
        }

        const parsed = parseWeatherResponse(text);

        // 파싱된 데이터 로그
        console.log('[Weather Parse] Parsed forecast days:', parsed.forecast.length);
        parsed.forecast.forEach((day) => {
            console.log(`[Weather Parse] ${day.dateLabel}: ${day.hourly.length} hours`);
        });

        return parsed;
    } catch (error) {
        console.error('[Gemini Weather] Error:', error);
        throw new Error('날씨 정보를 가져오는데 실패했습니다.');
    }
}

/**
 * Gemini 응답 파싱 - 3일치 예보
 */
function parseWeatherResponse(text: string): WeatherResponse {
    const lines = text.split('\n');
    let resolvedAddress = '';
    const forecastDays: DayForecast[] = [];

    let currentDay: 'today' | 'tomorrow' | 'dayAfter' | null = null;
    let currentDateLabel = '';
    let currentLocation = '';
    const currentHourlyData: WeatherDataPoint[] = [];
    let isInTable = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Day separator 감지
        if (trimmed.startsWith('=== DAY:')) {
            // 이전 날짜 데이터 저장
            if (currentDay && currentHourlyData.length > 0) {
                saveDayForecast(forecastDays, currentDay, currentDateLabel, currentLocation, currentHourlyData);
                currentHourlyData.length = 0;
            }

            // 새로운 날짜 시작
            if (trimmed.includes('오늘')) {
                currentDay = 'today';
                currentDateLabel = '오늘';
            } else if (trimmed.includes('내일')) {
                currentDay = 'tomorrow';
                currentDateLabel = '내일';
            } else if (trimmed.includes('모레')) {
                currentDay = 'dayAfter';
                currentDateLabel = '모레';
            }
            isInTable = false;
            continue;
        }

        if (trimmed.startsWith('Location:') || trimmed.startsWith('위치:')) {
            currentLocation = trimmed.substring(trimmed.indexOf(':') + 1).trim();
            if (!resolvedAddress) resolvedAddress = currentLocation;
            continue;
        }

        // 테이블 감지
        if (trimmed.startsWith('|')) {
            if (trimmed.toLowerCase().includes('time') || trimmed.includes('---')) {
                isInTable = true;
                continue;
            }

            if (isInTable && currentDay) {
                const parts = trimmed.split('|').map(p => p.trim()).filter(p => p !== '');
                if (parts.length >= 5) {
                    const time = parts[0];
                    const temperature = parseFloat(parts[1].replace(/[^0-9.-]/g, ''));
                    const condition = parts[2];
                    const chanceOfRain = parseFloat(parts[3].replace(/[^0-9.]/g, '')) || 0;
                    const humidity = parseFloat(parts[4].replace(/[^0-9.]/g, '')) || 0;

                    if (!isNaN(temperature)) {
                        currentHourlyData.push({
                            time,
                            temperature,
                            condition,
                            chanceOfRain,
                            humidity
                        });
                    }
                }
            }
        }
    }

    // 마지막 날짜 데이터 저장
    if (currentDay && currentHourlyData.length > 0) {
        saveDayForecast(forecastDays, currentDay, currentDateLabel, currentLocation, currentHourlyData);
    }

    console.log('[Weather Parse] Total days parsed:', forecastDays.length);

    return { forecast: forecastDays, resolvedAddress };
}

/**
 * 날짜별 예보 데이터를 DayForecast 형식으로 변환하여 저장
 */
function saveDayForecast(
    forecastDays: DayForecast[],
    date: 'today' | 'tomorrow' | 'dayAfter',
    dateLabel: string,
    location: string,
    hourlyData: WeatherDataPoint[]
) {
    if (hourlyData.length === 0) return;

    const firstHour = hourlyData[0];
    const maxChanceOfRain = hourlyData.reduce((max, hour) => Math.max(max, hour.chanceOfRain || 0), 0);

    forecastDays.push({
        date,
        dateLabel,
        current: {
            temp: Math.round(firstHour.temperature),
            feelsLike: Math.round(firstHour.temperature),
            condition: firstHour.condition || '알 수 없음',
            icon: mapConditionToIcon(firstHour.condition || '알 수 없음'),
            humidity: firstHour.humidity,
            chanceOfRain: maxChanceOfRain,
            location: location
        },
        hourly: hourlyData.map((hour) => ({
            time: hour.time,
            temp: Math.round(hour.temperature),
            feelsLike: Math.round(hour.temperature),
            icon: getTimeBasedIcon(hour.time, hour.condition),
            chanceOfRain: hour.chanceOfRain
        }))
    });
}

function getTimeBasedIcon(time: string, condition: string): string {
    const hour = parseInt(time.split(':')[0]);
    const isNight = hour >= 18 || hour < 6;
    const c = condition.toLowerCase();

    if (c.includes('맑음') || c.includes('clear')) return isNight ? '🌙' : '☀️';
    if (c.includes('구름') || c.includes('흐림') || c.includes('cloud') || c.includes('cloudy')) {
        return c.includes('조금') || c.includes('약간') ? (isNight ? '☁️' : '🌤️') : '☁️';
    }
    if (c.includes('비') || c.includes('rain')) return '🌧️';
    if (c.includes('눈') || c.includes('snow')) return '❄️';
    if (c.includes('천둥') || c.includes('thunder')) return '⛈️';
    if (c.includes('안개') || c.includes('fog')) return '🌫️';

    return isNight ? '🌙' : '🌤️';
}

function mapConditionToIcon(condition: string): string {
    const c = condition.toLowerCase();

    if (c.includes('맑음') || c.includes('clear')) return '☀️';
    if (c.includes('구름') || c.includes('흐림') || c.includes('cloud') || c.includes('cloudy')) {
        if (c.includes('조금') || c.includes('약간')) return '🌤️';
        if (c.includes('많음')) return '☁️';
        return '⛅';
    }
    if (c.includes('비') || c.includes('rain')) return '🌧️';
    if (c.includes('눈') || c.includes('snow')) return '❄️';
    if (c.includes('천둥') || c.includes('thunder')) return '⛈️';
    if (c.includes('안개') || c.includes('fog')) return '🌫️';

    return '🌤️';
}

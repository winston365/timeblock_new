/**
 * Gemini Weather Service - Google Search Grounding 사용
 * refer 프로젝트 참고
 */

import { callGeminiAPIWithTools } from './geminiApi';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';

export interface WeatherDataPoint {
    time: string;
    temperature: number;
    condition: string;
    chanceOfRain: number;
    humidity: number;
}

export interface WeatherResponse {
    resolvedAddress?: string;
    summary: string;
    hourly: WeatherDataPoint[];
}

/**
 * Gemini Google Search Grounding으로 실시간 날씨 가져오기
 */
export async function fetchWeatherWithGemini(
    location: string,
    apiKey: string
): Promise<WeatherResponse> {
    const prompt = `
You are a weather data assistant. Your task is to use Google Search to find accurate hourly weather forecast for "${location}" for TODAY ONLY.

**IMPORTANT INSTRUCTIONS:**
1. MUST use Google Search tool to find real weather data
2. Find reliable sources (weather.com, accuweather.com, kma.go.kr, or similar official weather services)
3. Extract ACTUAL data from search results - DO NOT make up or guess any values
4. ChanceOfRain (강수확률) is CRITICAL - get the exact percentage from the source
5. Return ONLY the requested format below

**OUTPUT FORMAT (Follow EXACTLY):**

Location: [City name in Korean]
Summary: [Brief weather summary in Korean, 1-2 sentences]

| Time | Temperature | Condition | ChanceOfRain | Humidity |
|------|-------------|-----------|--------------|----------|
| 06:00 | 15 | 맑음 | 10 | 65 |
| 09:00 | 18 | 맑음 | 5 | 60 |
| 12:00 | 22 | 구름조금 | 0 | 55 |

**COLUMN REQUIREMENTS:**
- Time: 24-hour format (HH:MM), provide data for every 3 hours from current time to 23:00
- Temperature: Integer number ONLY (no units, no symbols)
- Condition: Korean weather description (맑음, 흐림, 비, 눈, 구름조금, etc.)
- ChanceOfRain: Integer 0-100 ONLY (no % symbol) - This is the precipitation probability
- Humidity: Integer 0-100 ONLY (no % symbol)

**CRITICAL:**
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
        console.log('[Weather Parse] Parsed hourly data:', parsed.hourly.map(h => `${h.time}: ${h.chanceOfRain}%`).join(', '));

        return parsed;
    } catch (error) {
        console.error('[Gemini Weather] Error:', error);
        throw new Error('날씨 정보를 가져오는데 실패했습니다.');
    }
}

/**
 * Gemini 응답 파싱
 */
function parseWeatherResponse(text: string): WeatherResponse {
    const lines = text.split('\n');
    let summary = '';
    let resolvedAddress = '';
    const hourlyData: WeatherDataPoint[] = [];
    let isInTable = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('Location:') || trimmed.startsWith('위치:')) {
            resolvedAddress = trimmed.substring(trimmed.indexOf(':') + 1).trim();
            continue;
        }

        if (trimmed.startsWith('Summary:') || trimmed.startsWith('요약:')) {
            summary = trimmed.substring(trimmed.indexOf(':') + 1).trim();
            continue;
        }

        // 테이블 감지
        if (trimmed.startsWith('|')) {
            if (trimmed.toLowerCase().includes('time') || trimmed.includes('---')) {
                isInTable = true;
                continue;
            }

            if (isInTable) {
                const parts = trimmed.split('|').map(p => p.trim()).filter(p => p !== '');
                if (parts.length >= 5) {
                    const time = parts[0];
                    const temperature = parseFloat(parts[1].replace(/[^0-9.-]/g, ''));
                    const condition = parts[2];
                    const chanceOfRain = parseFloat(parts[3].replace(/[^0-9.]/g, '')) || 0;
                    const humidity = parseFloat(parts[4].replace(/[^0-9.]/g, '')) || 0;

                    console.log(`[Parse Debug] ${time}: temp=${temperature}, rain=${chanceOfRain}%, humidity=${humidity}%`);

                    if (!isNaN(temperature)) {
                        hourlyData.push({
                            time,
                            temperature,
                            condition,
                            chanceOfRain,
                            humidity
                        });
                    }
                }
            }
        } else if (!isInTable && trimmed.length > 0 &&
            !trimmed.startsWith('Location:') && !trimmed.startsWith('Summary:') &&
            !trimmed.startsWith('위치:') && !trimmed.startsWith('요약:')) {
            summary += (summary ? ' ' : '') + trimmed;
        }
    }

    summary = summary.replace(/#/g, '').trim();

    console.log('[Weather Parse] Summary:', summary);
    console.log('[Weather Parse] Hourly count:', hourlyData.length);

    return { summary, hourly: hourlyData, resolvedAddress };
}

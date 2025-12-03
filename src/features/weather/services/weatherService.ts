/**
 * @file weatherService.ts
 * @description 날씨 데이터 조회 및 인사이트 생성 서비스
 *
 * @role WeatherAPI.com을 통한 날씨 정보 조회 및 캐싱, Gemini AI 복장 추천 생성
 * @responsibilities
 *   - WeatherAPI.com을 통한 날씨 데이터 조회
 *   - Dexie 캐시 관리 (일별 만료)
 *   - Gemini AI 기반 날씨 분석 및 복장 추천
 * @dependencies
 *   - fetchWeatherFromApi: WeatherAPI.com 날씨 조회
 *   - callGeminiAPI: Gemini AI 호출
 *   - useSettingsStore: API 키 조회
 *   - db.weather: Dexie 캐시 테이블
 */

import type { DayForecast } from '@/shared/types/weather';
import { fetchWeatherFromApi } from './weatherApi';
import { db } from '@/data/db/dexieClient';
import { getLocalDate } from '@/shared/lib/utils';
import { callGeminiAPI } from '@/shared/services/ai/gemini';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { trackTokenUsage } from '@/shared/utils/tokenUtils';

export interface OutfitCard {
    option: number;
    vibe: string;
    running: string;
    outing: string;
}

export interface WeatherInsightResult {
    intro: string;
    cards: OutfitCard[];
    markdown: string;
}

function isValidForecast(forecast: unknown): forecast is DayForecast[] {
    return Array.isArray(forecast) && forecast.length > 0;
}

export type WeatherFetchResult = { forecast: DayForecast[]; timestamp?: number; status?: 'ok' | 'missing-key' | 'error'; message?: string };

// 서울 은평구 좌표
const DEFAULT_LOCATION = '37.6027,126.9291';

/**
 * WeatherAPI.com을 통해 날씨 정보를 조회합니다.
 *
 * @param _city - 조회할 도시명 (현재 미사용, 좌표로 대체)
 * @param forceRefresh - 캐시 무시 여부
 * @returns 날씨 예보 결과 (forecast, timestamp, status, message)
 */
export async function fetchWeatherFromGoogle(
    _city: string = '서울 은평구',
    forceRefresh: boolean = false
): Promise<WeatherFetchResult> {
    try {
        // 1. Dexie 캐시 확인 (강제 새로고침이 아닐 경우)
        if (!forceRefresh) {
            const cached = await loadCachedWeather();
            if (cached && isValidForecast(cached.forecast)) {
                return { ...cached, status: 'ok' };
            }
        }

        // 2. WeatherAPI.com API 호출 (좌표 사용)
        const result = await fetchWeatherFromApi(DEFAULT_LOCATION);
        
        if (result.status === 'missing-key') {
            return { 
                forecast: [], 
                timestamp: Date.now(), 
                status: 'missing-key', 
                message: 'WeatherAPI.com API 키가 설정되지 않았습니다.' 
            };
        }

        if (result.status === 'error' || !isValidForecast(result.forecast)) {
            return { 
                forecast: [], 
                timestamp: Date.now(), 
                status: 'error', 
                message: result.message ?? '날씨 응답 데이터가 올바르지 않습니다.' 
            };
        }

        // 3. Dexie에 저장
        const timestamp = Date.now();
        await cacheWeather(result.forecast, timestamp);

        return { forecast: result.forecast, timestamp, status: 'ok' };
    } catch (error) {
        console.error('[WeatherService] Error:', error);
        return { forecast: [], timestamp: Date.now(), status: 'error', message: '날씨 정보를 가져오지 못했습니다.' };
    }
}

/**
 * Dexie에서 캐시된 날씨 데이터를 로드합니다.
 *
 * @returns 캐시된 날씨 데이터 또는 null (만료/없음)
 */
export async function loadCachedWeather(): Promise<{ forecast: DayForecast[]; timestamp: number } | null> {
    try {
        const cached = await db.weather.get('latest');
        if (!cached) return null;

        // 기본 필드 검증
        if (!cached.data || !isValidForecast(cached.data.forecast) || !cached.timestamp || !cached.lastUpdatedDate) {
            console.warn('[WeatherService] Cached weather data invalid. Ignoring cache.');
            await db.weather.delete('latest').catch((err) => console.error('[WeatherService] Failed to clear invalid cache', err));
            return null;
        }

        // 오늘 날짜 확인 (YYYY-MM-DD)
        const todayDate = getLocalDate();
        if (cached.lastUpdatedDate !== todayDate) {
            return null;
        }

        return { forecast: cached.data.forecast, timestamp: cached.timestamp };
    } catch (error) {
        console.error('[WeatherService] Dexie load failed:', error);
        return null;
    }
}

/**
 * 날씨 데이터를 Dexie에 캐시합니다.
 *
 * @param forecast - 저장할 날씨 예보 배열
 * @param timestamp - 저장 시점 타임스탬프
 */
export async function cacheWeather(forecast: DayForecast[], timestamp: number): Promise<void> {
    try {
        const today = getLocalDate();
        await db.weather.put({
            id: 'latest',
            data: { forecast },
            timestamp: timestamp,
            lastUpdatedDate: today
        });
    } catch (error) {
        console.error('[WeatherService] Dexie save failed:', error);
    }
}

/**
 * Dexie에 저장된 날씨 캐시를 삭제합니다.
 */
export async function clearWeatherCache(): Promise<void> {
    try {
        await db.weather.delete('latest');
    } catch (error) {
        console.error('[WeatherService] Dexie cache clear failed:', error);
    }
}

type InsightContext = {
    humidity?: number;
    chanceOfRain?: number;
    tonightLow?: number;
    condition?: string;
    hourlyTemps?: number[];
};

/**
 * Gemini AI를 사용하여 날씨 기반 인사이트 및 복장 추천을 생성합니다.
 *
 * @param temp - 현재 기온
 * @param feelsLike - 체감 온도
 * @param condition - 날씨 상태
 * @param context - 추가 컨텍스트 (humidity, chanceOfRain, tonightLow)
 * @returns 인사이트 결과 (intro, cards, markdown)
 */
export async function getWeatherInsightWithGemini(
    temp: number,
    feelsLike: number,
    condition: string,
    context: InsightContext = {}
): Promise<WeatherInsightResult> {
    const { humidity, chanceOfRain, tonightLow, hourlyTemps } = context;
    
    // Gemini API 키 확인
    const settings = useSettingsStore.getState().settings;
    const geminiApiKey = settings?.geminiApiKey;
    const model = settings?.geminiModel;
    
    if (!geminiApiKey) {
        console.warn('[WeatherInsight] Gemini API key not found, using fallback');
        return getWeatherInsightFallback(temp, feelsLike, condition, context);
    }
    
    try {
        const prompt = buildWeatherInsightPrompt(temp, feelsLike, condition, {
            humidity,
            chanceOfRain,
            tonightLow,
            hourlyTemps,
        });
        
        const { text, tokenUsage } = await callGeminiAPI(prompt, [], geminiApiKey, model);
        trackTokenUsage(tokenUsage);
        
        // 응답 파싱
        const result = parseGeminiWeatherResponse(text, feelsLike);
        return result;
    } catch (error) {
        console.error('[WeatherInsight] Gemini API error:', error);
        return getWeatherInsightFallback(temp, feelsLike, condition, context);
    }
}

/**
 * Gemini에 보낼 날씨 인사이트 프롬프트 생성
 */
function buildWeatherInsightPrompt(
    temp: number,
    feelsLike: number,
    condition: string,
    context: { humidity?: number; chanceOfRain?: number; tonightLow?: number; hourlyTemps?: number[] }
): string {
    const { humidity, chanceOfRain, tonightLow, hourlyTemps } = context;
    
    let weatherInfo = `현재 날씨 정보:
- 기온: ${temp}°C
- 체감온도: ${feelsLike}°C
- 날씨 상태: ${condition}`;
    
    if (humidity !== undefined) {
        weatherInfo += `\n- 습도: ${humidity}%`;
    }
    if (chanceOfRain !== undefined) {
        weatherInfo += `\n- 강수 확률: ${chanceOfRain}%`;
    }
    if (tonightLow !== undefined) {
        weatherInfo += `\n- 오늘 저녁 최저: ${tonightLow}°C`;
    }
    if (hourlyTemps && hourlyTemps.length > 0) {
        weatherInfo += `\n- 시간대별 체감온도: ${hourlyTemps.join('°, ')}°C`;
    }

    return `당신은 날씨 전문가이자 패션 어드바이저입니다.
아래 날씨 정보를 바탕으로 오늘의 날씨 분석과 복장 추천을 해주세요.

${weatherInfo}

다음 형식으로 응답해주세요:

## 인트로
(날씨에 대한 간단한 한 문장 분석. 이모지 1-2개 포함. 체감온도 강조)

## 추천 코디
각 옵션에 대해 러닝과 외출 복장을 추천해주세요.

옵션1(가볍게):
- 러닝: (러닝/운동 시 복장)
- 외출: (일상 외출 복장)

옵션2(표준):
- 러닝: (러닝/운동 시 복장)
- 외출: (일상 외출 복장)

옵션3(따뜻하게 또는 시원하게):
- 러닝: (러닝/운동 시 복장)
- 외출: (일상 외출 복장)

응답은 간결하고 실용적으로, 한국어로 작성해주세요.`;
}

/**
 * Gemini 응답을 WeatherInsightResult로 파싱
 */
function parseGeminiWeatherResponse(text: string, feelsLike: number): WeatherInsightResult {
    const lines = text.split('\n');
    let intro = '';
    const cards: OutfitCard[] = [];
    
    let currentSection = '';
    let currentOption = 0;
    let currentVibe = '';
    let currentRunning = '';
    let currentOuting = '';
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // 섹션 감지
        if (trimmed.startsWith('## 인트로') || trimmed.startsWith('##인트로')) {
            currentSection = 'intro';
            continue;
        }
        if (trimmed.startsWith('## 추천') || trimmed.startsWith('##추천')) {
            currentSection = 'outfit';
            continue;
        }
        
        // 인트로 파싱
        if (currentSection === 'intro' && trimmed && !trimmed.startsWith('##')) {
            intro = trimmed;
            continue;
        }
        
        // 옵션 헤더 감지
        const optionMatch = trimmed.match(/옵션(\d+)\s*\(([^)]+)\)/);
        if (optionMatch) {
            // 이전 옵션 저장
            if (currentOption > 0 && (currentRunning || currentOuting)) {
                cards.push({
                    option: currentOption,
                    vibe: currentVibe,
                    running: currentRunning || '정보 없음',
                    outing: currentOuting || '정보 없음',
                });
            }
            currentOption = parseInt(optionMatch[1]);
            currentVibe = optionMatch[2];
            currentRunning = '';
            currentOuting = '';
            continue;
        }
        
        // 러닝/외출 파싱
        if (currentSection === 'outfit') {
            const runningMatch = trimmed.match(/[-•]\s*러닝\s*[:：]\s*(.+)/);
            const outingMatch = trimmed.match(/[-•]\s*외출\s*[:：]\s*(.+)/);
            
            if (runningMatch) {
                currentRunning = runningMatch[1].trim();
            } else if (outingMatch) {
                currentOuting = outingMatch[1].trim();
            }
        }
    }
    
    // 마지막 옵션 저장
    if (currentOption > 0 && (currentRunning || currentOuting)) {
        cards.push({
            option: currentOption,
            vibe: currentVibe,
            running: currentRunning || '정보 없음',
            outing: currentOuting || '정보 없음',
        });
    }
    
    // fallback: 카드가 없으면 기본값 사용
    if (cards.length === 0) {
        const fallback = getOutfitRecommendations(feelsLike);
        return {
            intro: intro || `체감온도 ${feelsLike}°C입니다.`,
            cards: fallback.cards,
            markdown: text,
        };
    }
    
    return {
        intro,
        cards,
        markdown: text,
    };
}

/**
 * Fallback: Gemini 없이 로컬에서 인사이트 생성
 */
function getWeatherInsightFallback(
    temp: number,
    feelsLike: number,
    _condition: string,
    context: InsightContext = {}
): WeatherInsightResult {
    const { humidity, chanceOfRain, tonightLow } = context;
    const introParts: string[] = [];

    const diff = feelsLike - temp;
    if (diff <= -3) {
        introParts.push(`바람이 꽤 차가워요! 체감온도가 **${Math.abs(diff)}도**나 더 낮게 느껴집니다.`);
    } else if (diff >= 3) {
        introParts.push(`습도가 높아서 실제보다 덥게 느껴져요. 체감온도가 **${diff}도** 더 높습니다.`);
    } else {
        introParts.push(`현재 기온은 **${temp}°C**, 체감온도도 비슷해요! 😊`);
    }

    if (chanceOfRain !== undefined) {
        if (chanceOfRain >= 60) {
            introParts.unshift(`비 올 확률이 ${chanceOfRain}%예요. 우산 꼭 챙기세요! ☔`);
        } else if (chanceOfRain >= 20) {
            introParts.unshift(`가벼운 비 가능성(${chanceOfRain}%)은 있지만 크게 걱정하진 않아도 돼요.`);
        } else {
            introParts.unshift(`비 소식은 거의 없어요. 🌤️`);
        }
    }

    if (humidity !== undefined) {
        if (humidity >= 75) {
            introParts.push(`습도 ${humidity}%라 약간 눅눅할 수 있어요.`);
        } else if (humidity <= 35) {
            introParts.push(`습도 ${humidity}%로 건조해요.`);
        }
    }

    if (tonightLow !== undefined && tonightLow < temp - 3) {
        introParts.push(`저녁엔 **${tonightLow}°C**까지 내려가요.`);
    }

    const intro = introParts.join(' ').trim();
    const { running, outing, cards } = getOutfitRecommendations(feelsLike);
    const markdown = `${intro}\n\n---\n\n## 👗 추천 코디\n\n### 🏃 달리기\n${running}\n\n### 👔 외출\n${outing}`;

    return { intro, cards, markdown };
}

/**
 * 기존 동기 함수 (하위 호환성 유지용)
 * @deprecated getWeatherInsightWithGemini 사용 권장
 */
export function getWeatherInsight(
    temp: number,
    feelsLike: number,
    condition: string,
    context: InsightContext = {}
): WeatherInsightResult {
    return getWeatherInsightFallback(temp, feelsLike, condition, context);
}

type ParsedOption = { option: number; vibe: string; text: string };

function parseOptionLines(text: string): ParsedOption[] {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const match = line.match(/옵션(\d+)\(([^)]*)\):\s*(.+)/);
            if (!match) {
                return null;
            }
            return {
                option: Number(match[1]),
                vibe: match[2] || '추천',
                text: match[3],
            };
        })
        .filter((v): v is ParsedOption => v !== null);
}

function getOutfitRecommendations(feelsLike: number): { running: string; outing: string; cards: OutfitCard[] } {
    let running = '';
    let outing = '';

    if (feelsLike < 0) {
        running = '- 옵션1(가볍게): 기모 긴팔 + 윈드브레이커 + 장갑\n- 옵션2(표준): 기모 상하의 세트 + 패딩 조끼 + 귀마개\n- 옵션3(따뜻하게): 방풍 자켓 + 기모 타이즈 + 넥워머';
        outing = '- 옵션1(실내위주): 히트텍 + 니트 + 두꺼운 코트\n- 옵션2(표준): 롱패딩 + 목도리 + 장갑 (완전무장!)\n- 옵션3(멋부림): 무스탕 + 두꺼운 슬랙스 + 부츠';
    } else if (feelsLike < 10) {
        running = '- 옵션1(가볍게): 긴팔 티셔츠 + 경량 조끼\n- 옵션2(표준): 얇은 자켓 + 긴바지\n- 옵션3(따뜻하게): 기능성 긴팔 + 윈드브레이커 + 레깅스';
        outing = '- 옵션1(활동성): 맨투맨 + 코듀로이 팬츠 + 숏패딩\n- 옵션2(표준): 니트 + 슬랙스 + 울 코트\n- 옵션3(따뜻하게): 후드티 + 조거팬츠 + 플리스 자켓';
    } else if (feelsLike < 20) {
        running = '- 옵션1(가볍게): 반팔 티셔츠 + 반바지 + 팔토시\n- 옵션2(표준): 얇은 긴팔 + 쇼츠\n- 옵션3(따뜻하게): 반팔 + 얇은 바람막이 + 긴바지';
        outing = '- 옵션1(캐주얼): 셔츠 + 청바지 + 가디건\n- 옵션2(표준): 얇은 니트 + 면바지 + 트렌치코트\n- 옵션3(단정하게): 블라우스/셔츠 + 슬랙스 + 자켓';
    } else if (feelsLike < 25) {
        running = '- 옵션1(시원하게): 싱글렛 + 짧은 쇼츠\n- 옵션2(표준): 기능성 반팔 + 반바지\n- 옵션3(자외선차단): 얇은 긴팔 + 쿨링 레깅스';
        outing = '- 옵션1(시원하게): 린넨 셔츠 + 반바지\n- 옵션2(표준): 반팔 티셔츠 + 얇은 긴바지\n- 옵션3(스타일): 얇은 셔츠 소매 걷기 + 치노 팬츠';
    } else {
        running = '- 옵션1(최소한): 싱글렛 + 쇼츠 (선크림 필수!)\n- 옵션2(표준): 쿨링 반팔 + 반바지\n- 옵션3(야간): 눈에 띄는 밝은 색상 반팔 + 반바지';
        outing = '- 옵션1(휴양지룩): 민소매 원피스/티셔츠 + 샌들\n- 옵션2(표준): 린넨 소재 상하의 + 선글라스\n- 옵션3(실내에어컨): 반팔 + 얇은 셔츠(휴대용)';
    }

    const runningOptions = parseOptionLines(running);
    const outingOptions = parseOptionLines(outing);
    const cardCount = Math.max(runningOptions.length, outingOptions.length);

    const cards: OutfitCard[] = Array.from({ length: cardCount }).map((_, idx) => {
        const runningOpt = runningOptions[idx];
        const outingOpt = outingOptions[idx];

        return {
            option: (runningOpt?.option ?? outingOpt?.option ?? idx) || idx + 1,
            vibe: runningOpt?.vibe || outingOpt?.vibe || '추천',
            running: runningOpt?.text || '러닝 코디 정보 없음',
            outing: outingOpt?.text || '외출 코디 정보 없음',
        };
    });

    return { running, outing, cards };
}

/**
 * Weather Service - Gemini Google Search Grounding 사용
 * refer 프로젝트 기반
 */

import type { DayForecast } from '@/shared/types/weather';
import { fetchWeatherWithGemini } from '@/shared/services/ai/geminiWeather';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { db } from '@/data/db/dexieClient';

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

export async function fetchWeatherFromGoogle(
    city: string = '서울 은평구',
    forceRefresh: boolean = false
): Promise<{ forecast: DayForecast[]; timestamp?: number }> {
    try {
        // 1. Dexie 캐시 확인 (강제 새로고침이 아닐 경우)
        if (!forceRefresh) {
            const cached = await loadCachedWeather();
            if (cached && isValidForecast(cached.forecast)) {
                console.log('[WeatherService] Using cached data from Dexie');
                return cached;
            }
        }

        // 2. API 호출
        const geminiApiKey = useSettingsStore.getState().settings?.geminiApiKey;
        if (!geminiApiKey) {
            throw new Error('Gemini API 키가 설정되지 않았습니다.');
        }

        console.log('[WeatherService] Fetching with Gemini Google Search...');
        const data = await fetchWeatherWithGemini(city, geminiApiKey);
        if (!isValidForecast(data?.forecast)) {
            throw new Error('날씨 응답 데이터가 올바르지 않습니다.');
        }

        // 3. Dexie에 저장
        const timestamp = Date.now();
        await cacheWeather(data.forecast, timestamp);

        return { forecast: data.forecast, timestamp };
    } catch (error) {
        console.error('[WeatherService] Error:', error);
        throw error;
    }
}

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
        const today = new Date().toISOString().split('T')[0];
        if (cached.lastUpdatedDate !== today) {
            console.log('[WeatherService] Cache expired (different date)');
            return null;
        }

        return { forecast: cached.data.forecast, timestamp: cached.timestamp };
    } catch (error) {
        console.error('[WeatherService] Dexie load failed:', error);
        return null;
    }
}

export async function cacheWeather(forecast: DayForecast[], timestamp: number): Promise<void> {
    try {
        const today = new Date().toISOString().split('T')[0];
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
};

export function getWeatherInsight(
    temp: number,
    feelsLike: number,
    _condition: string,
    context: InsightContext = {}
): WeatherInsightResult {
    const { humidity, chanceOfRain, tonightLow } = context;
    const introParts: string[] = [];

    // 1. 인사말 & 체감온도 코멘트 (마크다운 포맷)
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
            introParts.push(`습도 ${humidity}%라 약간 눅눅할 수 있어요. 통풍 잘 되는 옷 추천!`);
        } else if (humidity <= 35) {
            introParts.push(`습도 ${humidity}%로 건조해요. 보습과 수분 챙기세요.`);
        }
    }

    if (tonightLow !== undefined && tonightLow < temp - 3) {
        introParts.push(`저녁엔 **${tonightLow}°C**까지 내려가요. 늦게 나가면 겉옷이 필요합니다.`);
    }

    const intro = introParts.join(' ').trim();

    // 2. 복장 추천 (마크다운 포맷)
    const { running, outing, cards } = getOutfitRecommendations(feelsLike);
    const markdown = `${intro}\n\n---\n\n## 👗 추천 코디 (3가지 옵션)\n\n### 🏃 달리기\n${running}\n\n### 👔 외출\n${outing}`;

    return { intro, cards, markdown };
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

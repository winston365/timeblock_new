/**
 * Weather Service - Gemini Google Search Grounding 사용
 * refer 프로젝트 기반
 */

import type { WeatherData, HourlyWeather } from '@/shared/types/weather';
import { fetchWeatherWithGemini } from '@/shared/services/ai/geminiWeather';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { db } from '@/data/db/dexieClient';

export async function fetchWeatherFromGoogle(city: string = '서울 은평구', forceRefresh: boolean = false): Promise<{ current: WeatherData; hourly: HourlyWeather[]; timestamp?: number }> {
    try {
        // 1. Dexie 캐시 확인 (강제 새로고침이 아닐 경우)
        if (!forceRefresh) {
            const cached = await loadCachedWeather();
            if (cached) {
                console.log('[WeatherService] Using cached data from Dexie');
                return cached;
            }
        }

        // 2. API 호출
        const geminiApiKey = useSettingsStore.getState().settings.geminiApiKey;
        if (!geminiApiKey) {
            throw new Error('Gemini API 키가 설정되지 않았습니다.');
        }

        console.log('[WeatherService] Fetching with Gemini Google Search...');
        const data = await fetchWeatherWithGemini(city, geminiApiKey);

        // 3. 데이터 가공
        const firstHour = data.hourly[0];

        // 오늘 남은 시간 중 가장 높은 강수확률 계산
        const maxChanceOfRain = data.hourly.reduce((max, hour) => {
            return Math.max(max, hour.chanceOfRain || 0);
        }, 0);

        const current: WeatherData = {
            temp: firstHour ? Math.round(firstHour.temperature) : 0,
            feelsLike: firstHour ? Math.round(firstHour.temperature) : 0, // Gemini가 체감온도를 따로 주지 않으면 temp 사용
            condition: firstHour?.condition || '알 수 없음',
            icon: mapConditionToIcon(firstHour?.condition || '알 수 없음'),
            humidity: firstHour?.humidity,
            chanceOfRain: maxChanceOfRain, // 현재 시간이 아닌 오늘 최대 강수확률 사용
            location: data.resolvedAddress || city,
        };

        const hourly: HourlyWeather[] = data.hourly.map((hour) => ({
            time: hour.time,
            temp: Math.round(hour.temperature),
            feelsLike: Math.round(hour.temperature),
            icon: getTimeBasedIcon(hour.time, hour.condition),
            chanceOfRain: hour.chanceOfRain,
        }));

        // 4. Dexie에 저장
        const timestamp = Date.now();
        await cacheWeather(current, hourly, timestamp);

        return { current, hourly, timestamp };
    } catch (error) {
        console.error('[WeatherService] Error:', error);
        throw error;
    }
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

export async function loadCachedWeather(): Promise<{ current: WeatherData; hourly: HourlyWeather[]; timestamp: number } | null> {
    try {
        const cached = await db.weather.get('latest');
        if (!cached) return null;

        // 오늘 날짜 확인 (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0];
        if (cached.lastUpdatedDate !== today) {
            console.log('[WeatherService] Cache expired (different date)');
            return null;
        }

        return { ...cached.data, timestamp: cached.timestamp };
    } catch (error) {
        console.error('[WeatherService] Dexie load failed:', error);
        return null;
    }
}

export async function cacheWeather(current: WeatherData, hourly: HourlyWeather[], timestamp: number): Promise<void> {
    try {
        const today = new Date().toISOString().split('T')[0];
        await db.weather.put({
            id: 'latest',
            data: { current, hourly },
            timestamp: timestamp,
            lastUpdatedDate: today
        });
    } catch (error) {
        console.error('[WeatherService] Dexie save failed:', error);
    }
}

export function getWeatherInsight(temp: number, feelsLike: number, condition: string, chanceOfRain: number = 0, hourly: HourlyWeather[] = []): string {
    const c = condition.toLowerCase();
    let intro = '';
    let rainForecast = '';
    let outfitAdvice = '';

    // 1. 인사말 & 체감온도 코멘트 (20대 여자 아나운서 톤)
    const diff = feelsLike - temp;
    if (diff <= -3) {
        intro = `여러분, 오늘 바람이 꽤 차가워요! 🌬️ 실제 온도보다 체감온도가 ${Math.abs(diff)}도나 더 낮게 느껴지네요.`;
    } else if (diff >= 3) {
        intro = `습도가 높아서 실제보다 더 덥게 느껴지는 날이에요! 💦 체감온도가 ${diff}도 더 높으니 불쾌지수 조심하세요.`;
    } else {
        intro = `현재 기온은 ${temp}도, 체감온도도 비슷해요! 😊`;
    }

    // 2. 상세 비 예보 분석
    const rainStart = hourly.find(h => (h.chanceOfRain || 0) >= 30);
    if (rainStart) {
        // 비가 시작되는 시간 찾음
        const rainEnd = hourly.find((h, i) => {
            const startIndex = hourly.indexOf(rainStart);
            return i > startIndex && (h.chanceOfRain || 0) < 30;
        });

        if (rainEnd) {
            rainForecast = `\n\n☔ **비 예보 분석**\n"${rainStart.time}경부터 비가 올 확률이 높아져서 ${rainEnd.time}쯤 그칠 것으로 보여요."\n외출하실 때 우산 꼭 챙기세요!`;
        } else {
            rainForecast = `\n\n☔ **비 예보 분석**\n"${rainStart.time}경부터 비 소식이 있고, 밤까지 이어질 수 있어요."\n든든한 우산이 필요하겠어요!`;
        }
    } else {
        rainForecast = `\n\n☀️ **비 예보 분석**\n"오늘 비 소식은 없어요!"\n안심하고 활동하셔도 좋아요.`;
    }

    // 3. 복장 추천 (3가지 옵션)
    outfitAdvice = getOutfitRecommendations(feelsLike);

    return intro + rainForecast + outfitAdvice;
}

function getOutfitRecommendations(feelsLike: number): string {
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

    return `\n\n👗 **추천 코디 (3가지 옵션)**\n\n🏃 **달리기**\n${running}\n\n👔 **외출**\n${outing}`;
}

/**
 * Weather Widget Component
 * 
 * TopToolbar에 표시되는 날씨 위젯 (클릭 시 드롭다운)
 * Design: Atmospheric & Airy (Glassmorphism, Gradients)
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { useWeatherStore } from './stores/weatherStore';
import { getWeatherInsight, type WeatherInsightResult, type OutfitCard } from './services/weatherService';
import { RefreshCw, Sparkles } from 'lucide-react';
import type { HourlyWeather } from '@/shared/types/weather';

export default function WeatherWidget() {
    const { forecast, selectedDay, loading, error, fetchWeather, setSelectedDay, lastUpdated } = useWeatherStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const safeForecast = Array.isArray(forecast) ? forecast : [];
    const autoRefreshSlots = useMemo(() => new Set([9, 11, 12, 15]), []);
    const lastAutoHourRef = useRef<number | null>(null);
    const lastUpdatedDateRef = useRef<string | null>(null);

    const formatLastUpdated = () => {
        if (!lastUpdated) return '업데이트: -';
        const date = new Date(lastUpdated);
        const today = new Date().toISOString().split('T')[0];
        const updated = date.toISOString().split('T')[0];
        const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        const prefix = updated === today ? '오늘' : updated;
        return `업데이트: ${prefix} ${timeStr}`;
    };

    useEffect(() => {
        if (lastUpdated) {
            lastUpdatedDateRef.current = new Date(lastUpdated).toISOString().split('T')[0];
        }
    }, [lastUpdated]);

    // 초기 로드
    useEffect(() => {
        fetchWeather(false, 0).catch(console.error);
    }, [fetchWeather]);

    // 자동 업데이트: 오늘 예보만 9/11/12/15시에 새로고침
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const hour = now.getHours();
            if (!autoRefreshSlots.has(hour)) return;
            if (lastAutoHourRef.current === hour) return; // 이미 실행
            lastAutoHourRef.current = hour;
            fetchWeather(false, 0).catch(console.error);
        }, 60 * 1000);
        return () => clearInterval(timer);
    }, [autoRefreshSlots, fetchWeather]);

    // 날짜 변경 감지: 자정 이후 today로 리셋
    useEffect(() => {
        const timer = setInterval(() => {
            const today = new Date().toISOString().split('T')[0];
            if (lastUpdatedDateRef.current && lastUpdatedDateRef.current !== today) {
                lastUpdatedDateRef.current = today;
                fetchWeather(true, 0).catch(console.error);
            }
        }, 5 * 60 * 1000);
        return () => clearInterval(timer);
    }, [fetchWeather]);

    const handleRefresh = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await fetchWeather(true, selectedDay); // 강제 새로고침
        } finally {
            setIsRefreshing(false);
        }
    };

    // 현재 선택된 날짜의 예보
    const currentForecast = safeForecast[selectedDay];

    // 배경 그라데이션 결정
    const getBackgroundGradient = (condition: string = '') => {
        const c = condition.toLowerCase();
        if (c.includes('비') || c.includes('rain')) return 'from-slate-700 to-slate-900';
        if (c.includes('눈') || c.includes('snow')) return 'from-slate-100 to-slate-300 text-slate-800';
        if (c.includes('흐림') || c.includes('cloud')) return 'from-slate-500 to-slate-700';
        if (c.includes('맑음') || c.includes('clear')) return 'from-blue-400 to-orange-300';
        return 'from-blue-500 to-indigo-600'; // 기본
    };

    const insight: WeatherInsightResult | null = useMemo(() => {
        if (!currentForecast) return null;
        const { current, hourly } = currentForecast;
        const temps = Array.isArray(hourly) ? hourly.map(h => h.temp).filter((t) => Number.isFinite(t)) : [];
        const tonightLow = temps.length ? Math.min(...temps) : undefined;

        return getWeatherInsight(current.temp, current.feelsLike, current.condition, {
            humidity: current.humidity,
            chanceOfRain: current.chanceOfRain,
            tonightLow,
        });
    }, [currentForecast]);

    // 로딩 상태
    if (loading && safeForecast.length === 0) {
        return (
            <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-5 h-5 border-2 text-blue-400 animate-spin border-gray-300 flex items-center justify-center border-t-blue-400 rounded-full">
                    <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="animate-ping text-[10px]">
                        <path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 6.182 14.976 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.337 13.382 8.976 12 6.001 12z"></path>
                    </svg>
                </div>
            </div>
        );
    }

    // 에러 상태
    if (error && safeForecast.length === 0) {
        return (
            <button
                onClick={() => fetchWeather(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 backdrop-blur-sm hover:bg-red-500/20 transition-colors"
            >
                <span className="text-xl">⚠️</span>
                <span className="text-xs text-red-300">재시도</span>
            </button>
        );
    }

    const bgGradient = currentForecast ? getBackgroundGradient(currentForecast.current.condition) : 'from-blue-500 to-indigo-600';

    return (
        <div className="relative">
            {/* 트리거 버튼 */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r ${bgGradient} bg-opacity-20 border border-white/10 backdrop-blur-sm hover:brightness-110 transition-all duration-200 cursor-pointer group shadow-sm`}
            >
                {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                    <span className="text-xl filter drop-shadow-md group-hover:scale-110 transition-transform">
                        {currentForecast?.current.icon}
                    </span>
                )}
                <span className="font-light text-base text-white drop-shadow-sm">
                    {currentForecast?.current.temp}°
                </span>
                {error && (
                    <span className="text-[9px] font-semibold text-amber-200 bg-black/20 px-1.5 py-0.5 rounded-full">
                        업데이트 실패
                    </span>
                )}
            </button>

            {/* 드롭다운 모달 (2컬럼 레이아웃) */}
            {isExpanded && currentForecast && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
                        onClick={() => setIsExpanded(false)}
                    />

                    <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] min-h-[500px] rounded-3xl overflow-hidden shadow-2xl z-50 bg-gradient-to-br ${bgGradient} text-white ring-1 ring-white/20 flex`}>

                        {/* 왼쪽 컬럼: 날씨 정보 */}
                        <div className="w-[420px] flex flex-col border-r border-white/10 relative">
                            {(isRefreshing || (loading && safeForecast.length > 0)) && (
                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                                    <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        <span>날씨 불러오는 중...</span>
                                    </div>
                                </div>
                            )}
                            {/* 배경 장식 */}
                            <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[150%] bg-white/5 rounded-full blur-3xl pointer-events-none"></div>

                            {/* 헤더 (새로고침) */}
                            <div className="absolute top-4 left-4 z-20">
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    className={`p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors pointer-events-auto ${isRefreshing ? 'animate-spin' : ''}`}
                                    disabled={isRefreshing}
                                    title="날씨 새로고침"
                                >
                                    <RefreshCw size={16} className="text-white/80" />
                                </button>
                            </div>

                            {/* Day Selector Tabs */}
                            <div className="flex justify-center gap-2 mt-4 px-6 z-10">
                                {safeForecast.map((day, idx) => (
                                    <button
                                        key={day.date}
                                        onClick={() => setSelectedDay(idx)}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${selectedDay === idx
                                                ? 'bg-white/30 text-white shadow-lg scale-105'
                                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                                            }`}
                                    >
                                        {day.dateLabel}
                                    </button>
                                ))}
                            </div>

                            {/* 메인 날씨 정보 */}
                            <div className="flex-1 p-8 flex flex-col items-center justify-center relative z-0">
                                <div className="text-sm font-medium text-white/70 mb-1 tracking-wider uppercase">
                                    {currentForecast.current.location}
                                </div>

                                <div className="text-9xl font-thin tracking-tighter mb-2 drop-shadow-lg">
                                    {currentForecast.current.temp}°
                                </div>

                                <div className="text-3xl font-medium mb-8 flex items-center gap-3">
                                    <span>{currentForecast.current.icon}</span>
                                    <span>{currentForecast.current.condition}</span>
                                </div>

                                <div className="flex gap-8 text-sm font-light text-white/80">
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs opacity-60 mb-1">체감</span>
                                        <span className="font-medium text-lg">{currentForecast.current.feelsLike}°</span>
                                    </div>
                                    <div className="w-px h-10 bg-white/20"></div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs opacity-60 mb-1">습도</span>
                                        <span className="font-medium text-lg">{currentForecast.current.humidity}%</span>
                                    </div>
                                    {currentForecast.current.chanceOfRain !== undefined && (
                                        <>
                                            <div className="w-px h-10 bg-white/20"></div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs opacity-60 mb-1">강수확률</span>
                                                <span className="font-medium text-lg">{currentForecast.current.chanceOfRain}%</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* 온도 차트 */}
                            <div className="bg-black/10 backdrop-blur-md border-t border-white/10 p-5">
                                <div className="text-xs font-medium text-white/50 mb-3 px-1 uppercase tracking-wider">
                                    Temperature
                                </div>
                                <TemperatureChart hourly={currentForecast.hourly} />
                            </div>

                            {/* 강수 확률 차트 */}
                            <div className="bg-black/10 backdrop-blur-md border-t border-white/10 p-5">
                                <div className="text-xs font-medium text-white/50 mb-3 px-1 uppercase tracking-wider">
                                    Precipitation
                                </div>
                                <PrecipitationChart hourly={currentForecast.hourly} />
                            </div>

                            {/* 푸터 */}
                            <div className="bg-black/20 p-3 text-center">
                                <p className="text-[10px] text-white/30">
                                    Powered by Gemini 2.5 Flash & Google Search
                                </p>
                                {lastUpdated && (
                                    <p className="text-[10px] text-white/40 mt-1">
                                        {formatLastUpdated()}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 오른쪽 컬럼: AI 인사이트 */}
                        <div className="flex-1 bg-[#0b1220]/90 text-slate-50 backdrop-blur-md flex flex-col relative border-l border-white/5">
                            <div className="p-6 border-b border-white/10 flex items-center gap-3">
                                <div className="p-2 bg-amber-500/15 rounded-full border border-amber-400/30">
                                    <Sparkles size={20} className="text-amber-300" />
                                </div>
                                <span className="font-bold text-lg text-slate-100 tracking-wide">Weather Insight</span>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar relative bg-gradient-to-b from-white/5 via-white/2 to-transparent">
                                {/* 로딩 오버레이 */}
                                {isRefreshing && (
                                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-3 border-amber-200/40 border-t-amber-300 animate-spin rounded-full"></div>
                                            <span className="text-sm text-amber-100 font-medium">인사이트 업데이트 중...</span>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <MarkdownText text={insight?.intro ?? ''} />
                                    <OutfitCards cards={insight?.cards ?? []} />
                                </div>
                            </div>
                        </div>

                    </div>
                </>
            )}
        </div>
    );
}

/**
 * 온도 차트 컴포넌트 (CSS 기반)
 */
function TemperatureChart({ hourly }: { hourly: HourlyWeather[] }) {
    if (hourly.length === 0) return null;

    const maxTemp = Math.max(...hourly.map(h => h.temp));
    const minTemp = Math.min(...hourly.map(h => h.temp));
    const range = maxTemp - minTemp || 1;

    return (
        <div className="relative h-36 flex items-end gap-1">
            {hourly.map((hour, i) => {
                const height = ((hour.temp - minTemp) / range) * 100;
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                        <span className="text-sm drop-shadow-md">{hour.icon}</span>
                        <span className="text-xs text-white/70">{hour.temp}°</span>
                        <div className="flex-1 flex items-end w-full">
                            <div
                                className="w-full bg-gradient-to-t from-blue-400 to-orange-300 rounded-t transition-all"
                                style={{ height: `${Math.max(height, 10)}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-white/40 mt-1">{hour.time}</span>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * 강수 확률 차트 컴포넌트 (CSS 기반)
 */
function PrecipitationChart({ hourly }: { hourly: HourlyWeather[] }) {
    if (hourly.length === 0) return null;

    return (
        <div className="relative h-28 flex items-end gap-1">
            {hourly.map((hour, i) => {
                const chance = hour.chanceOfRain || 0;
                const color = chance > 70 ? 'bg-blue-500' : chance > 40 ? 'bg-blue-400' : 'bg-blue-300/50';

                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                        <span className="text-sm drop-shadow-md">{hour.icon}</span>
                        <span className="text-[10px] text-white/60">{chance}%</span>
                        <div className="flex-1 flex items-end w-full">
                            <div
                                className={`w-full ${color} rounded-t transition-all`}
                                style={{ height: `${Math.max(chance, 5)}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-white/40 mt-1">{hour.time}</span>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * 마크다운 텍스트 렌더러 (간단한 포맷팅)
 */
function MarkdownText({ text }: { text: string }) {
    const lines = text.split('\n');

    return (
        <div className="space-y-3 text-slate-50">
            {lines.map((line, i) => {
                const trimmed = line.trim();

                // 헤더 (##)
                if (trimmed.startsWith('## ')) {
                    return <h3 key={i} className="text-xl font-bold text-slate-100 mt-4 mb-2">{trimmed.slice(3)}</h3>;
                }

                // 헤더 (###)
                if (trimmed.startsWith('### ')) {
                    return <h4 key={i} className="text-lg font-semibold text-slate-200 mt-3 mb-1">{trimmed.slice(4)}</h4>;
                }

                // 수평선
                if (trimmed === '---') {
                    return <hr key={i} className="border-white/20 my-4" />;
                }

                // 리스트
                if (trimmed.startsWith('- ')) {
                    return <li key={i} className="ml-4 text-slate-100/90 leading-relaxed">{formatBold(trimmed.slice(2))}</li>;
                }

                // 빈 줄
                if (!trimmed) {
                    return <div key={i} className="h-2" />;
                }

                // 일반 텍스트 (볼드 지원)
                return <p key={i} className="text-base text-slate-100 leading-relaxed">{formatBold(trimmed)}</p>;
            })}
        </div>
    );
}

/**
 * 볼드 텍스트 포맷팅 (**text**)
 */
function formatBold(text: string): React.ReactNode {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="font-bold text-white">{part}</strong> : part
    );
}

/**
 * Outfit recommendation cards
 */
function OutfitCards({ cards }: { cards: OutfitCard[] }) {
    if (!cards || cards.length === 0) return null;

    const icons = ['🌿', '🎽', '🔥'];

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <span className="text-base">👗</span>
                    <span>추천 코디</span>
                </div>
                <span className="text-xs text-slate-300">3가지 옵션</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {cards.map((card, idx) => (
                    <div
                        key={`${card.option}-${card.vibe}-${idx}`}
                        className="min-w-0 rounded-2xl bg-slate-800/70 border border-slate-700/60 p-3 shadow-lg backdrop-blur-md"
                    >
                        <div className="flex items-start justify-between mb-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-lg text-amber-300">{icons[idx] ?? '✨'}</span>
                                <div>
                                    <p className="text-[9px] uppercase tracking-[0.18em] text-slate-400">Outfit</p>
                                    <p className="text-sm font-semibold text-slate-50 leading-tight">옵션 {card.option}</p>
                                </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-100 border border-amber-400/25 whitespace-nowrap">
                                {card.vibe}
                            </span>
                        </div>

                        <div className="space-y-1.5 text-[13px] text-slate-100 leading-snug">
                            <div className="flex items-start gap-2 min-w-0">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-100 border border-emerald-400/25 flex-shrink-0">러닝</span>
                                <span className="leading-snug break-words min-w-0">{card.running}</span>
                            </div>
                            <div className="flex items-start gap-2 min-w-0">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-100 border border-amber-400/25 flex-shrink-0">외출</span>
                                <span className="leading-snug break-words min-w-0">{card.outing}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

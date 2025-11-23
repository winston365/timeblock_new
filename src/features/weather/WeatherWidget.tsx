/**
 * Weather Widget Component
 * 
 * TopToolbar에 표시되는 날씨 위젯 (클릭 시 드롭다운)
 * Design: Atmospheric & Airy (Glassmorphism, Gradients)
 */

import { useEffect, useState, useMemo } from 'react';
import { useWeatherStore } from './stores/weatherStore';
import { getWeatherInsight } from './services/weatherService';
import { RefreshCw, Sparkles } from 'lucide-react';

export default function WeatherWidget() {
    const { current, hourly, loading, error, fetchWeather, shouldRefetch, lastUpdated } = useWeatherStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 초기 로드
    useEffect(() => {
        fetchWeather();
    }, [fetchWeather]);

    const handleRefresh = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRefreshing(true);
        await fetchWeather(true); // 강제 새로고침
        setIsRefreshing(false);
    };

    // 배경 그라데이션 결정
    const getBackgroundGradient = (condition: string = '') => {
        const c = condition.toLowerCase();
        if (c.includes('비') || c.includes('rain')) return 'from-slate-700 to-slate-900';
        if (c.includes('눈') || c.includes('snow')) return 'from-slate-100 to-slate-300 text-slate-800';
        if (c.includes('흐림') || c.includes('cloud')) return 'from-slate-500 to-slate-700';
        if (c.includes('맑음') || c.includes('clear')) return 'from-blue-400 to-orange-300';
        return 'from-blue-500 to-indigo-600'; // 기본
    };

    const insight = useMemo(() => {
        if (!current) return '';
        return getWeatherInsight(current.temp, current.feelsLike, current.condition, current.chanceOfRain, hourly);
    }, [current, hourly]);

    // 로딩 상태
    if (loading && !current) {
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
    if (error || !current) {
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

    const bgGradient = getBackgroundGradient(current.condition);

    return (
        <div className="relative">
            {/* 트리거 버튼 */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r ${bgGradient} bg-opacity-20 border border-white/10 backdrop-blur-sm hover:brightness-110 transition-all duration-200 cursor-pointer group shadow-sm`}
            >
                <span className="text-2xl filter drop-shadow-md group-hover:scale-110 transition-transform">
                    {current.icon}
                </span>
                <span className="font-light text-lg text-white drop-shadow-sm">
                    {current.temp}°
                </span>
            </button>

            {/* 드롭다운 모달 (2컬럼 레이아웃) */}
            {isExpanded && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
                        onClick={() => setIsExpanded(false)}
                    />

                    <div className={`absolute top-full right-0 mt-3 w-[900px] min-h-[500px] rounded-3xl overflow-hidden shadow-2xl z-50 bg-gradient-to-br ${bgGradient} text-white ring-1 ring-white/20 flex`}>

                        {/* 왼쪽 컬럼: 날씨 정보 */}
                        <div className="w-[420px] flex flex-col border-r border-white/10 relative">
                            {/* 배경 장식 */}
                            <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[150%] bg-white/5 rounded-full blur-3xl pointer-events-none"></div>

                            {/* 헤더 (새로고침) */}
                            <div className="absolute top-4 left-4 z-10">
                                <button
                                    onClick={handleRefresh}
                                    className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                                    title="날씨 새로고침"
                                >
                                    <RefreshCw size={16} className="text-white/80" />
                                </button>
                            </div>

                            {/* 메인 날씨 정보 */}
                            <div className="flex-1 p-8 flex flex-col items-center justify-center relative z-0">
                                <div className="text-sm font-medium text-white/70 mb-1 tracking-wider uppercase">
                                    {current.location}
                                </div>

                                <div className="text-9xl font-thin tracking-tighter mb-2 drop-shadow-lg">
                                    {current.temp}°
                                </div>

                                <div className="text-3xl font-medium mb-8 flex items-center gap-3">
                                    <span>{current.icon}</span>
                                    <span>{current.condition}</span>
                                </div>

                                <div className="flex gap-8 text-sm font-light text-white/80">
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs opacity-60 mb-1">체감</span>
                                        <span className="font-medium text-lg">{current.feelsLike}°</span>
                                    </div>
                                    <div className="w-px h-10 bg-white/20"></div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs opacity-60 mb-1">습도</span>
                                        <span className="font-medium text-lg">{current.humidity}%</span>
                                    </div>
                                    {current.chanceOfRain !== undefined && (
                                        <>
                                            <div className="w-px h-10 bg-white/20"></div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs opacity-60 mb-1">강수확률</span>
                                                <span className="font-medium text-lg">{current.chanceOfRain}%</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* 시간별 예보 */}
                            <div className="bg-black/10 backdrop-blur-md border-t border-white/10 p-5">
                                <div className="text-xs font-medium text-white/50 mb-3 px-1 uppercase tracking-wider flex justify-between items-center">
                                    <span>Hourly Forecast</span>
                                    <span className="text-[10px] opacity-50">Feels Like</span>
                                </div>
                                <div className="flex overflow-x-auto pb-2 gap-5 no-scrollbar snap-x">
                                    {hourly?.map((hour, i) => (
                                        <div key={i} className="flex flex-col items-center min-w-[60px] snap-start">
                                            <span className="text-xs text-white/60 mb-2">{hour.time}</span>
                                            <span className="text-2xl mb-2 drop-shadow-sm">{hour.icon}</span>
                                            <span className="text-lg font-medium">{hour.feelsLike}°</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 푸터 */}
                            <div className="bg-black/20 p-3 text-center">
                                <p className="text-[10px] text-white/30">
                                    Powered by Gemini 2.5 Flash & Google Search
                                </p>
                                {lastUpdated && (
                                    <p className="text-[10px] text-white/40 mt-1">
                                        업데이트: {new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 오른쪽 컬럼: AI 인사이트 */}
                        <div className="flex-1 bg-white/5 backdrop-blur-md flex flex-col relative">
                            <div className="p-6 border-b border-white/10 flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-full">
                                    <Sparkles size={20} className="text-yellow-300" />
                                </div>
                                <span className="font-bold text-lg text-white/90 tracking-wide">Weather Insight</span>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar relative">
                                {/* 로딩 오버레이 */}
                                {isRefreshing && (
                                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-3 border-white/20 border-t-white animate-spin rounded-full"></div>
                                            <span className="text-sm text-white/80 font-medium">인사이트 업데이트 중...</span>
                                        </div>
                                    </div>
                                )}

                                <div className="prose prose-invert prose-sm max-w-none">
                                    <p className="text-base font-light leading-relaxed text-white/90 whitespace-pre-line">
                                        {insight}
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                </>
            )}
        </div>
    );
}

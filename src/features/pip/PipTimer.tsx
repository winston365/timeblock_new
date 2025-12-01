/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file PipTimer.tsx
 * @role 항상 위에 떠 있는 미니 타이머 윈도우 (Picture-in-Picture)
 * @responsibilities
 *   - 현재 작업 타이머 표시 및 진행률 시각화
 *   - 타이머 시작/정지/완료 컨트롤
 *   - 테마 및 최상위 고정 설정
 *   - 다음 작업 미리보기
 * @dependencies
 *   - electronAPI: PiP 상태 동기화 및 액션 전송
 */

import { useEffect, useState } from 'react';

type PipStatus = 'running' | 'paused' | 'break' | 'idle' | 'ready';

interface PipTimerState {
    remainingTime: number; // 초 단위
    totalTime: number;
    isRunning: boolean;
    currentTaskTitle?: string;
    status?: PipStatus;
    expectedEndTime?: number;
    nextTaskTitle?: string;
    breakRemainingSeconds?: number | null;
}

/**
 * 초 단위 시간을 "분:초" 형식으로 변환
 * @param seconds - 변환할 초 단위 시간
 * @returns 포맷된 시간 문자열 (ex: "5:03")
 */
const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.max(0, seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * 타임스탬프를 "HH:MM" 형식의 시계 문자열로 변환
 * @param timestamp - 변환할 타임스탬프 (밀리초)
 * @returns 포맷된 시간 문자열 또는 타임스탬프가 없으면 null
 */
const formatClock = (timestamp?: number) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/**
 * PiP(Picture-in-Picture) 타이머 컴포넌트
 * 항상 위에 떠 있는 미니 타이머 윈도우를 렌더링합니다.
 *
 * @returns 타이머 UI 요소
 */
export default function PipTimer() {
    const [state, setState] = useState<PipTimerState>({
        remainingTime: 0,
        totalTime: 0,
        isRunning: false,
    });
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
    const [themeOption, setThemeOption] = useState<'default' | 'dark' | 'light'>('default');

    useEffect(() => {
        const unsubscribe = window.electronAPI?.onPipUpdate((data: PipTimerState) => {
            setState(data);
        });

        return () => {
            unsubscribe?.();
        };
    }, []);

    const isDarkTheme = themeOption !== 'light';

    const status: PipStatus = state.status ?? (state.isRunning ? 'running' : 'paused');
    const progress = state.totalTime > 0 ? Math.min(100, Math.max(0, ((state.totalTime - state.remainingTime) / state.totalTime) * 100)) : 0;
    const ringRadius = 26;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringDashOffset = ringCircumference - (progress / 100) * ringCircumference;

    const ringColor = (() => {
        if (status === 'break') return '#f59e0b';
        if (status === 'running') return '#14b8a6';
        if (status === 'paused') return '#cbd5e1';
        if (status === 'ready') return '#60a5fa';
        return '#94a3b8';
    })();

    const ringAnimationClass =
        status === 'running'
            ? 'animate-[spin_12s_linear_infinite]'
            : status === 'break'
                ? 'animate-[pulse_1.6s_ease-in-out_infinite]'
                : '';

    const isLongTitle = (state.currentTaskTitle?.length ?? 0) > 18;
    const marqueeFadeClass = isDarkTheme ? 'from-black/70 via-black/30' : 'from-white via-white/70';
    const expectedEndLabel = formatClock(state.expectedEndTime);
    const nextTaskLabel = state.status === 'ready' ? '다음 작업 없음' : (state.nextTaskTitle || '다음 작업 없음');
    const breakSeconds = state.breakRemainingSeconds ?? (status === 'break' ? state.remainingTime : null);
    const canComplete = state.totalTime > 0 && state.remainingTime <= 0 && status !== 'break';

    const handleClose = () => {
        window.electronAPI?.closePip();
    };

    const handleToggleAlwaysOnTop = () => {
        const newValue = !isAlwaysOnTop;
        setIsAlwaysOnTop(newValue);
        window.electronAPI?.sendPipAction('toggle-always-on-top', newValue);
    };

    const handleComplete = () => {
        window.electronAPI?.sendPipAction('complete-task');
    };

    const cycleTheme = () => {
        setThemeOption(prev => {
            if (prev === 'default') return 'dark';
            if (prev === 'dark') return 'light';
            return 'default';
        });
    };

    const themeLabel = themeOption === 'default' ? '기본' : themeOption === 'dark' ? '다크' : '라이트';
    const themeIcon = themeOption === 'dark' ? '🌑' : themeOption === 'light' ? '🌞' : '🌫️';
    const isRunning = status === 'running';
    const buttonIcon = isRunning ? '⏹' : '▶';
    const buttonTitle = isRunning ? '정지' : '시작';

    return (
        <div className={isDarkTheme ? 'dark' : ''}>
            <style>
                {`
                @keyframes pip-marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                html, body, #root {
                    background: transparent !important;
                }
                `}
            </style>
            <div
                className="group relative flex h-full w-full items-center justify-center rounded-3xl overflow-hidden"
                style={{
                    WebkitAppRegion: 'drag',
                    backgroundColor: 'transparent',
                } as any}
            >
                {/* 배경 */}
                <div
                    className={`absolute inset-0 rounded-3xl border border-white/70 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.85)] backdrop-blur-2xl dark:border-slate-500/40 ${
                        themeOption === 'dark'
                            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-black'
                            : themeOption === 'light'
                                ? 'bg-gradient-to-br from-slate-100 via-white to-slate-50'
                                : 'bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-800/70'
                    }`}
                />

                {/* 중앙 콘텐츠 */}
                <div className="relative z-10 mx-auto flex w-full max-w-[360px] flex-col px-5 py-2">
                    {/* 상단 타이틀 & 컨트롤 바 */}
                    <div className="mb-2 flex flex-col gap-1.5">
                        <div className="flex flex-col items-center gap-1 text-white">
                            <div className="text-[10px] uppercase tracking-[0.08em] text-white/70">현재 작업</div>
                            {state.currentTaskTitle && (
                                <>
                                    {!isLongTitle && (
                                        <div className="max-w-full truncate text-center text-[15px] font-extrabold drop-shadow-sm" title={state.currentTaskTitle}>
                                            {state.currentTaskTitle}
                                        </div>
                                    )}
                                    {isLongTitle && (
                                        <div className="relative w-full max-w-full overflow-hidden text-center text-[15px] font-extrabold drop-shadow-sm" title={state.currentTaskTitle}>
                                            <div className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r to-transparent ${marqueeFadeClass}`} />
                                            <div className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent ${marqueeFadeClass}`} />
                                            <div className="flex w-max animate-[pip-marquee_12s_linear_infinite] whitespace-nowrap">
                                                <span className="flex flex-none items-center justify-center px-4">{state.currentTaskTitle}</span>
                                                <span className="flex flex-none items-center justify-center px-4">{state.currentTaskTitle}</span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div
                            className="pointer-events-none absolute top-2 right-2 z-30 flex h-8 items-center gap-1 rounded-full border border-white/30 bg-white/20 px-2 text-white/80 shadow-sm backdrop-blur opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100"
                            style={{ WebkitAppRegion: 'no-drag' } as any}
                        >
                            <button
                                onClick={cycleTheme}
                                aria-label="테마 변경"
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                                title={`테마: ${themeLabel}`}
                            >
                                {themeIcon}
                            </button>
                            <button
                                onClick={handleToggleAlwaysOnTop}
                                aria-label={isAlwaysOnTop ? '최상위 고정 해제' : '최상위 고정'}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                                title={isAlwaysOnTop ? '최상위 고정 해제' : '최상위 고정'}
                            >
                                {isAlwaysOnTop ? '📌' : '📍'}
                            </button>
                            <button
                                onClick={handleClose}
                                aria-label="닫기"
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                                title="닫기"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* 메인 2열 영역 */}
                    <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                        {/* 링 + 버튼 */}
                        <div
                            className={`relative h-[76px] w-[76px] ${ringAnimationClass}`}
                            style={{ WebkitAppRegion: 'no-drag' } as any}
                        >
                            <svg className="absolute inset-0 h-[76px] w-[76px]" viewBox="0 0 76 76" fill="none">
                                <circle
                                    cx="38"
                                    cy="38"
                                    r={ringRadius}
                                    stroke="rgba(255,255,255,0.3)"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx="38"
                                    cy="38"
                                    r={ringRadius}
                                    stroke={ringColor}
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                    strokeDasharray={ringCircumference}
                                    strokeDashoffset={ringDashOffset}
                                    className="transition-[stroke-dashoffset,stroke] duration-700 ease-out drop-shadow-sm"
                                />
                            </svg>
                            <button
                                onClick={() => {
                                    if (isRunning) {
                                        window.electronAPI?.sendPipAction('stop-timer');
                                    } else {
                                        window.electronAPI?.sendPipAction('toggle-pause');
                                    }
                                }}
                                aria-label={buttonTitle}
                                className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg ring-1 ring-white/60 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 active:scale-95 dark:bg-slate-800 dark:text-gray-100 dark:ring-slate-600"
                                title={buttonTitle}
                            >
                                <span className="text-[22px] font-bold leading-none">
                                    {buttonIcon}
                                </span>
                            </button>
                        </div>

                        {/* 시간 및 상태 */}
                        <div className="flex w-full flex-col items-start overflow-hidden">
                            <div className="text-[54px] font-black leading-none tracking-tight text-white drop-shadow-sm tabular-nums" aria-live="polite">
                                {formatTime(state.remainingTime)}
                            </div>
                            <div className="mt-2 flex w-full items-center gap-2 text-[11px] font-semibold text-white/85 whitespace-nowrap">
                                {expectedEndLabel && (
                                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/80">
                                        예상 종료 {expectedEndLabel}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 프로그레스 바 */}
                    <div className="mt-1 w-full">
                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                            {/* 구분선 25/50/75 */}
                            {[25, 50, 75].map((mark) => (
                                <span
                                    key={mark}
                                    className="absolute top-0 h-full w-[1px] bg-white/50"
                                    style={{ left: `${mark}%` }}
                                />
                            ))}
                            <div
                                className={`h-full rounded-full transition-all duration-800 ${status === 'break'
                                    ? 'bg-amber-400'
                                    : 'bg-gradient-to-r from-teal-400 via-blue-500 to-indigo-500'
                                }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* 주요 액션 */}
                    <div className="mt-1 flex w-full flex-wrap items-center justify-between gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                        <div className="flex items-center gap-2">
                            {canComplete && (
                                <button
                                    onClick={handleComplete}
                                    aria-label="작업 완료"
                                    className="flex min-h-[42px] items-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 active:scale-95"
                                >
                                    ✅ 완료
                                </button>
                            )}
                            <div className="flex min-h-[24px] items-center gap-1 px-1 text-[12px] font-semibold text-white/85">
                                <span className="text-[11px]">➡️</span>
                                <span className="truncate max-w-[140px]" title={nextTaskLabel}>
                                    {nextTaskLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 보조 패널 (현재 비활성화) */}
                    <div className="mt-1 w-full overflow-hidden rounded-2xl border border-white/20 bg-white/10 text-sm text-white shadow-sm backdrop-blur transition-all duration-300 max-h-0 opacity-0">
                        <div className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold">휴식 남은 시간</span>
                                <span className="text-xs text-white/80">
                                    {breakSeconds !== null ? `${formatTime(breakSeconds)} 남음` : '—'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

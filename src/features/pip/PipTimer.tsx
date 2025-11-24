/**
 * PiP Timer Component
 *
 * @role 항상 위에 떠 있는 미니 타이머 윈도우
 * @input electronAPI를 통한 상태 동기화
 * @output 타이머 표시 및 컨트롤 버튼
 */

import { useEffect, useState } from 'react';

interface PipTimerState {
    remainingTime: number; // 초 단위
    totalTime: number;
    isRunning: boolean;
    currentTaskTitle?: string;
}

export default function PipTimer() {
    const [state, setState] = useState<PipTimerState>({
        remainingTime: 0,
        totalTime: 0,
        isRunning: false,
    });
    const [isHovered, setIsHovered] = useState(false);
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);

    useEffect(() => {
        // 메인 윈도우로부터 상태 업데이트 수신
        const unsubscribe = window.electronAPI?.onPipUpdate((data: PipTimerState) => {
            console.log('PiP received update:', data);
            setState(data);
        });

        return () => {
            unsubscribe?.();
        };
    }, []);

    const handleClose = () => {
        window.electronAPI?.closePip();
    };

    const handleTogglePause = () => {
        window.electronAPI?.sendPipAction('toggle-pause');
    };

    const handleToggleAlwaysOnTop = () => {
        const newValue = !isAlwaysOnTop;
        setIsAlwaysOnTop(newValue);
        window.electronAPI?.sendPipAction('toggle-always-on-top', newValue);
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = state.totalTime > 0 ? ((state.totalTime - state.remainingTime) / state.totalTime) * 100 : 0;

    return (
        <div
            className="relative flex h-full w-full items-center justify-center bg-white"
            style={{
                WebkitAppRegion: 'drag',
            } as any}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* 우측 상단 호버 아이콘들 */}
            {isHovered && (
                <div
                    className="absolute right-2 top-2 flex gap-1"
                    style={{
                        WebkitAppRegion: 'no-drag',
                    } as any}
                >
                    <button
                        onClick={handleToggleAlwaysOnTop}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        title={isAlwaysOnTop ? '최상위 고정 해제' : '최상위 고정'}
                    >
                        {isAlwaysOnTop ? '📌' : '📍'}
                    </button>
                    <button
                        onClick={handleClose}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        title="닫기"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* 메인 콘텐츠 */}
            <div className="flex w-full flex-col items-center gap-4 p-6">
                {/* 일시정지/재생 버튼 (좌측 상단) */}
                <div className="flex w-full items-start justify-between">
                    <button
                        onClick={handleTogglePause}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl transition hover:bg-gray-200 active:scale-95"
                        style={{
                            WebkitAppRegion: 'no-drag',
                        } as any}
                        title={state.isRunning ? '일시정지' : '재생'}
                    >
                        {state.isRunning ? '⏸' : '▶'}
                    </button>

                    {/* 공간 확보용 */}
                    <div className="h-8 w-8"></div>
                </div>

                {/* 작업 제목 */}
                {state.currentTaskTitle && (
                    <div className="w-full text-center">
                        <div className="text-sm font-medium text-gray-600 line-clamp-2">
                            {state.currentTaskTitle}
                        </div>
                    </div>
                )}

                {/* 타이머 */}
                <div className="text-center">
                    <div className="text-5xl font-bold text-gray-900 tabular-nums">
                        {formatTime(state.remainingTime)}
                    </div>
                </div>

                {/* 프로그레스 바 */}
                <div className="w-full">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                            className="h-full rounded-full bg-blue-500 transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* 하단 정보 */}
                <div className="flex w-full items-center justify-between text-xs text-gray-500">
                    <div>스톱 타임</div>
                    <div>이번 주 진행</div>
                </div>
                <div className="flex w-full items-center justify-between text-sm font-medium text-gray-700">
                    <div>0m</div>
                    <div>0m</div>
                </div>
            </div>
        </div>
    );
}

/**
 * @file FocusView.tsx
 * @role 집중 모드 메인 뷰 컴포넌트
 * @responsibilities
 *   - 현재 시간대 작업 표시 및 타이머 관리
 *   - 작업 시작/완료/중단 처리
 *   - PiP(Picture-in-Picture) 모드 연동
 *   - 휴식 시간 관리 및 자동 전환
 * @dependencies
 *   - focusModeStore: 집중 모드 상태 관리
 *   - settingsStore: 사용자 설정
 *   - FocusTimer, FocusHeroTask, FocusTimeline 등 하위 컴포넌트
 */
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import { calculateTaskXP } from '@/shared/lib/utils';
import { getRecommendationMessage } from '../utils/taskRecommendation';
import { useFocusModeStore } from '../stores/focusModeStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { FocusTimer } from './FocusTimer';
import { FocusHeroTask } from './FocusHeroTask';
import { FocusTimeline } from './FocusTimeline';
import { QuickMemo } from './QuickMemo';
import { BreakView } from './BreakView';
import { FocusMusicPlayer } from './FocusMusicPlayer';
import { useFocusMusicStore } from '../stores/focusMusicStore';
import { getBlockById, getBlockDurationMinutes, getBlockLabel } from '@/shared/utils/timeBlockUtils';
import { isBucketAtCapacity, MAX_TASKS_PER_BLOCK } from '../utils/timeBlockBucket';

interface FocusViewProps {
    currentBlockId: TimeBlockId | null;
    tasks: Task[];
    allDailyTasks: Task[];
    isLocked: boolean;
    onEditTask: (task: Task) => void;
    onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void> | void;
    onToggleTask: (taskId: string) => Promise<void> | void;
    onExitFocusMode: () => void;
    onCreateTask: (text: string, blockId: TimeBlockId, hourSlot?: number) => Promise<void>;
}

export function FocusView({
    currentBlockId,
    tasks,
    allDailyTasks,
    isLocked,
    onEditTask,
    onUpdateTask,
    onToggleTask,
    onExitFocusMode,
    onCreateTask,
}: FocusViewProps) {
    const { setFocusMode, activeTaskId, activeTaskStartTime, startTask, stopTask, isPaused, pauseTask, resumeTask } = useFocusModeStore();
    const { settings } = useSettingsStore();
    const [memoText, setMemoText] = useState('');
    const [isBreakTime, setIsBreakTime] = useState(false);
    const [breakRemainingSeconds, setBreakRemainingSeconds] = useState<number | null>(null);
    const [pendingNextTaskId, setPendingNextTaskId] = useState<string | null>(null);

    // Music player store
    const {
        selectedMusicFolder,
        musicTracks,
        currentTrackIndex,
        isMusicLoading,
        isMusicPlaying,
        loopMode,
        musicVolume,
        setSelectedMusicFolder,
        setMusicVolume,
        handleTogglePlay,
        handleNextRandom,
        handleLoopModeChange,
        fetchMusicTracks,
    } = useFocusMusicStore();

    // 현재 시각 상태 (타이머/슬롯 라벨용)
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // 초기 로드 (트랙이 비어있으면 로드)
    useEffect(() => {
        if (musicTracks.length === 0 && !isMusicLoading) {
            fetchMusicTracks(settings?.githubToken);
        }
    }, [musicTracks.length, isMusicLoading, fetchMusicTracks, settings?.githubToken]);

    // ... rest of the component

    const lastSavedMemoRef = useRef<{ taskId: string | null; memo: string }>({ taskId: null, memo: '' });
    // 시간/작업 계산 (상단에서 정의하여 TDZ 회피)
    const nowDate = useMemo(() => new Date(now), [now]);
    const currentHour = nowDate.getHours();
    const currentMinute = nowDate.getMinutes();
    const nowTotalMinutes = currentHour * 60 + currentMinute;
    const currentBlock = getBlockById(currentBlockId);
    const blockEndTotalMinutes = Math.min(currentBlock?.end ?? 24, 24) * 60;
    const slotLabel = getBlockLabel(currentBlockId);
    const remainingMinutes = Math.max(0, blockEndTotalMinutes - nowTotalMinutes);

    const currentBlockTasks = useMemo(() => {
        return [...tasks].sort((a, b) => {
            const orderA = a.order ?? new Date(a.createdAt).getTime();
            const orderB = b.order ?? new Date(b.createdAt).getTime();
            return orderA - orderB;
        });
    }, [tasks]);
    const recommendedTask = useMemo(() => {
        return currentBlockTasks.find(t => !t.completed) || null;
    }, [currentBlockTasks]);
    const recommendationMessage = recommendedTask
        ? getRecommendationMessage(recommendedTask)
        : '';
    const initialUpcomingTasks = useMemo(() => {
        return currentBlockTasks.filter(t => !t.completed && t.id !== recommendedTask?.id);
    }, [currentBlockTasks, recommendedTask]);
    const [upcomingTasks, setUpcomingTasks] = useState(initialUpcomingTasks);

    // 활성 작업 변경 시 메모 동기화
    useEffect(() => {
        if (!activeTaskId) {
            setMemoText('');
            lastSavedMemoRef.current = { taskId: null, memo: '' };
            return;
        }
        const activeTask =
            currentBlockTasks.find(t => t.id === activeTaskId) ||
            allDailyTasks.find(t => t.id === activeTaskId) ||
            null;
        const nextMemo = activeTask?.memo ?? '';
        setMemoText(nextMemo);
        lastSavedMemoRef.current = { taskId: activeTaskId, memo: nextMemo };
    }, [activeTaskId, currentBlockTasks, allDailyTasks]);

    // 메모 자동 저장 (3초 딜레이)
    useEffect(() => {
        if (!activeTaskId) return;
        const saveTimer = setTimeout(async () => {
            const activeTask =
                currentBlockTasks.find(t => t.id === activeTaskId) ||
                allDailyTasks.find(t => t.id === activeTaskId) ||
                null;
            if (!activeTask) return;
            const currentMemo = activeTask.memo ?? '';
            if (memoText === currentMemo) return;
            try {
                await onUpdateTask(activeTaskId, { memo: memoText });
                lastSavedMemoRef.current = { taskId: activeTaskId, memo: memoText };
            } catch (err) {
                console.error('[FocusView] 메모 자동 저장 실패:', err);
            }
        }, 3000);

        return () => clearTimeout(saveTimer);
    }, [memoText, activeTaskId, currentBlockTasks, allDailyTasks, onUpdateTask]);

    // 인라인 작업 추가
    const [inlineInputValue, setInlineInputValue] = useState('');
    const inlineInputRef = useRef<HTMLInputElement>(null);

    const handleInlineInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inlineInputValue.trim()) {
            e.preventDefault();
            const trimmedText = inlineInputValue.trim();

            // 현재 타임블럭 작업 3개 제한
            if (isBucketAtCapacity(currentBlockTasks.length)) {
                toast.error(`이 시간대에는 최대 ${MAX_TASKS_PER_BLOCK}개의 작업만 추가할 수 있습니다.`);
                return;
            }

            try {
                if (!currentBlockId || !currentBlock) {
                    toast.error('현재 타임블록이 없어서 작업을 추가할 수 없습니다.');
                    return;
                }
                await onCreateTask(trimmedText, currentBlockId, currentBlock.start);
                setInlineInputValue('');
                inlineInputRef.current?.focus();
            } catch (err) {
                console.error('Failed to create task:', err);
            }
        } else if (e.key === 'Escape') {
            setInlineInputValue('');
        }
    };

    // All completed tasks from the entire day
    const allCompletedTasks = allDailyTasks.filter(t => t.completed);

    type ToggleOptions = { skipBonus?: boolean; bonusReason?: 'autoTimer' };

    const startBreakForNextTask = useCallback((completedTaskId: string | null) => {
        const nextTask = currentBlockTasks.find(t => !t.completed && t.id !== completedTaskId);
        setIsBreakTime(true);
        setBreakRemainingSeconds(60);
        setPendingNextTaskId(nextTask?.id ?? null);
    }, [currentBlockTasks]);

    const handleToggleTaskWrapper = useCallback(async (taskId: string, options?: ToggleOptions) => {
        const isCompletingActiveTask = taskId === activeTaskId;
        const task =
            currentBlockTasks.find(t => t.id === taskId) ||
            allDailyTasks.find(t => t.id === taskId) ||
            null;

        try {
            await onToggleTask(taskId);

            // 집중 모드에서 자동(타이머 만료) 완료 시에만 추가 XP 보너스 지급 (총 4배)
            // ✅ 수동 완료/토글 시에는 보너스를 지급하지 않는다.
            if (isCompletingActiveTask && task && !task.completed && options?.bonusReason === 'autoTimer' && !options?.skipBonus) {
                // 기본 XP는 다른 경로로 지급되므로, 여기서 3배 추가해 총 4배가 되도록 한다.
                const bonusXP = calculateTaskXP(task) * 3;
                const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
                const gameStateStore = useGameStateStore.getState();
                await gameStateStore.addXP(bonusXP, task.timeBlock || undefined);
            }

            if (isCompletingActiveTask) {
                stopTask();
                setMemoText('');
                startBreakForNextTask(taskId);
            }
        } catch (error) {
            console.error('[FocusView] Failed to toggle task:', error);
            toast.error('작업 완료 처리 중 문제가 발생했습니다.');
        }
    }, [activeTaskId, onToggleTask, startBreakForNextTask, stopTask, currentBlockTasks, allDailyTasks]);

    // Sync state when props change
    useEffect(() => {
        setUpcomingTasks(initialUpcomingTasks);
    }, [initialUpcomingTasks]);

    // 작업 시간 경과 시 자동 완료 (보너스 XP 적용)
    useEffect(() => {
        if (!activeTaskId || !activeTaskStartTime || isPaused || isBreakTime) return;
        const activeTask =
            currentBlockTasks.find(t => t.id === activeTaskId) ||
            allDailyTasks.find(t => t.id === activeTaskId) ||
            null;
        if (!activeTask || activeTask.completed) return;

        const elapsedSeconds = Math.floor((now - activeTaskStartTime) / 1000);
        const totalSeconds = (activeTask.baseDuration || 0) * 60;
        if (totalSeconds > 0 && elapsedSeconds >= totalSeconds) {
            handleToggleTaskWrapper(activeTaskId, { bonusReason: 'autoTimer' });
        }
    }, [now, activeTaskId, activeTaskStartTime, isPaused, isBreakTime, currentBlockTasks, allDailyTasks, handleToggleTaskWrapper]);

    // 휴식 타이머 관리
    useEffect(() => {
        if (!isBreakTime || breakRemainingSeconds === null) return;

        const interval = setInterval(() => {
            setBreakRemainingSeconds(prev => {
                if (prev === null) return prev;
                if (prev <= 1) {
                    clearInterval(interval);
                    setIsBreakTime(false);
                    if (pendingNextTaskId) {
                        startTask(pendingNextTaskId);
                    }
                    setPendingNextTaskId(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isBreakTime, breakRemainingSeconds, pendingNextTaskId, startTask]);

    const sendPipState = useCallback(() => {
        if (!window.electronAPI?.sendPipUpdate) return;

        const activeTask = currentBlockTasks.find(t => t.id === activeTaskId);
        const nextTask = currentBlockTasks.find(t => !t.completed && t.id !== activeTaskId);
        const readyTask = recommendedTask || nextTask || null;
        const basePayload = {
            nextTaskTitle: nextTask?.text,
        };

        // 휴식 중이면 휴식 정보 전송
        if (isBreakTime && breakRemainingSeconds !== null) {
            window.electronAPI.sendPipUpdate({
                remainingTime: breakRemainingSeconds,
                totalTime: 60,
                isRunning: true,
                status: 'break',
                expectedEndTime: Date.now() + breakRemainingSeconds * 1000,
                currentTaskTitle: '휴식 중',
                breakRemainingSeconds,
                ...basePayload,
            }).catch(console.error);
            return;
        }

        // 활성 작업 없으면 기본 상태 전송 (추천 작업 안내)
        if (!activeTask || !activeTaskStartTime) {
            window.electronAPI.sendPipUpdate({
                remainingTime: readyTask ? readyTask.baseDuration * 60 : 0,
                totalTime: readyTask ? readyTask.baseDuration * 60 : 0,
                isRunning: false,
                status: readyTask ? 'ready' : 'idle',
                currentTaskTitle: readyTask ? readyTask.text : '대기 중',
                nextTaskTitle: nextTask?.text || readyTask?.text,
            }).catch(console.error);
            return;
        }

        const elapsedSeconds = Math.floor((now - activeTaskStartTime) / 1000);
        const totalSeconds = activeTask.baseDuration * 60;
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

        window.electronAPI.sendPipUpdate({
            remainingTime: remainingSeconds,
            totalTime: totalSeconds,
            isRunning: !isPaused,
            status: isPaused ? 'paused' : 'running',
            expectedEndTime: Date.now() + remainingSeconds * 1000,
            currentTaskTitle: activeTask.text,
            breakRemainingSeconds: null,
            ...basePayload,
        }).catch(console.error);
    }, [activeTaskId, activeTaskStartTime, breakRemainingSeconds, currentBlockTasks, isBreakTime, isPaused, now, recommendedTask]);

    const handleOpenPip = useCallback((options?: { silent?: boolean }) => {
        if (!window.electronAPI?.openPip) {
            if (!options?.silent) {
                alert('PiP 모드는 Electron 앱에서만 사용 가능합니다.');
            }
            return;
        }

        window.electronAPI.openPip()
            .then(() => {
                sendPipState();
            })
            .catch(console.error);
    }, [sendPipState]);

    // PiP 상태 동기화
    useEffect(() => {
        sendPipState();
    }, [sendPipState]);

    // PiP 액션 핸들러
    useEffect(() => {
        if (!window.electronAPI?.onPipAction) return;

        const unsubscribe = window.electronAPI.onPipAction((action: string) => {
            if (action === 'toggle-pause') {
                if (!activeTaskId && recommendedTask) {
                    setFocusMode(true);
                    startTask(recommendedTask.id);
                } else {
                    if (isPaused) {
                        resumeTask();
                    } else {
                        pauseTask();
                    }
                }
            }
            if (action === 'complete-task' && activeTaskId) {
                handleToggleTaskWrapper(activeTaskId);
            }
            if (action === 'start-break') {
                startBreakForNextTask(null);
            }
            if (action === 'stop-timer') {
                stopTask();
                setMemoText('');
                setIsBreakTime(false);
                setBreakRemainingSeconds(null);
                setPendingNextTaskId(null);
            }
        });

        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPaused, pauseTask, resumeTask, activeTaskId, handleToggleTaskWrapper, startBreakForNextTask, recommendedTask, setFocusMode, startTask]);

    // Progress calculation for current hour tasks only
    const totalTasks = currentBlockTasks.length;
    const completedCount = currentBlockTasks.filter(t => t.completed).length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    const handleStartNow = (task: Task) => {
        setFocusMode(true);
        startTask(task.id);
        handleOpenPip({ silent: true });
        // 잠금 없이도 포커스 모드 시작 가능
    };

    const handleReorder = (newOrder: Task[]) => {
        setUpcomingTasks(newOrder);

        const baseOrder = Date.now();
        newOrder.forEach((task, index) => {
            if (task.order !== baseOrder + index) {
                onUpdateTask(task.id, { order: baseOrder + index });
            }
        });
    };

    const handlePromoteTask = (taskToPromote: Task) => {
        if (!recommendedTask) return;

        const currentHeroOrder = recommendedTask.order ?? new Date(recommendedTask.createdAt).getTime();
        const targetOrder = taskToPromote.order ?? new Date(taskToPromote.createdAt).getTime();

        // Swap orders
        onUpdateTask(recommendedTask.id, { order: targetOrder });
        onUpdateTask(taskToPromote.id, { order: currentHeroOrder });

        toast.success('작업 순서를 변경했습니다.');
    };

    if (isBreakTime) {
        return (
            <div className="mx-auto max-w-4xl p-6 flex items-center justify-center min-h-[600px]">
                <BreakView onFinish={() => setIsBreakTime(false)} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            {/* Header + Music Player */}
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
                <div className="flex items-start justify-between gap-6">
                    <div className="flex flex-1 flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={onExitFocusMode}
                                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                                <span>←</span>
                                <span>본 화면</span>
                            </button>
                            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">🎯 지금 집중</h1>
                            <button
                                onClick={() => handleOpenPip()}
                                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-bg-tertiary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] shadow-sm hover:bg-[var(--color-bg-tertiary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition"
                            >
                                <span>📌</span>
                                <span>PiP 모드</span>
                            </button>
                        </div>
                        <p className="text-base text-[var(--color-text-secondary)]">{slotLabel}</p>

                        {/* 배경 음악 플레이어 (컴팩트) */}
                        <FocusMusicPlayer
                            selectedMusicFolder={selectedMusicFolder}
                            setSelectedMusicFolder={setSelectedMusicFolder}
                            isMusicLoading={isMusicLoading}
                            isMusicPlaying={isMusicPlaying}
                            musicTracks={musicTracks}
                            currentTrackIndex={currentTrackIndex}
                            loopMode={loopMode}
                            musicVolume={musicVolume}
                            setMusicVolume={setMusicVolume}
                            handleTogglePlay={handleTogglePlay}
                            handleNextRandom={handleNextRandom}
                            handleLoopModeChange={handleLoopModeChange}
                        />
                    </div>
                    <FocusTimer remainingMinutes={remainingMinutes} totalMinutes={getBlockDurationMinutes(currentBlockId)} />
                </div>
            </div>

            {/* Hero Task Section */}
            {recommendedTask ? (
                <div className="space-y-6">
                    <FocusHeroTask
                        task={recommendedTask}
                        recommendationMessage={recommendationMessage}
                        isActive={activeTaskId === recommendedTask.id}
                        startTime={activeTaskStartTime}
                        onEdit={onEditTask}
                        onUpdateTask={onUpdateTask}
                        onToggle={handleToggleTaskWrapper}
                        onStartNow={handleStartNow}
                        onStop={stopTask}
                        onComplete={() => handleToggleTaskWrapper(recommendedTask.id, { skipBonus: true })}
                    />

                    <QuickMemo
                        value={memoText}
                        onChange={setMemoText}
                        isVisible={activeTaskId === recommendedTask.id}
                    />
                </div>
            ) : (
                <div className="rounded-3xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)] p-12 text-center">
                    <div className="text-6xl">🎉</div>
                    <h2 className="mt-4 text-2xl font-bold text-[var(--color-text-primary)]">모든 작업 완료!</h2>
                    <p className="mt-2 text-lg text-[var(--color-text-secondary)]">휴식하거나 다음 블록 작업을 추가해보세요</p>
                </div>
            )}

            {/* 인라인 작업 추가 */}
            {!isLocked && !isBucketAtCapacity(currentBlockTasks.length) && (
                <div className="rounded-2xl bg-[var(--color-bg-surface)] p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">현재 타임블록에 작업 추가</span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">({currentBlockTasks.length}/{MAX_TASKS_PER_BLOCK})</span>
                    </div>
                    <input
                        ref={inlineInputRef}
                        type="text"
                        value={inlineInputValue}
                        onChange={e => setInlineInputValue(e.target.value)}
                        onKeyDown={handleInlineInputKeyDown}
                        placeholder="작업을 입력하고 Enter로 추가하세요"
                        className="w-full rounded-xl border border-dashed border-[var(--color-border)] bg-transparent px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />
                </div>
            )}

            {/* Timeline Section */}
            {upcomingTasks.length > 0 && (
                <FocusTimeline
                    tasks={upcomingTasks}
                    onReorder={handleReorder}
                    onEdit={onEditTask}
                    onPromote={handlePromoteTask}
                />
            )}

            {/* Progress Section - Current hour only */}
            <div className="rounded-2xl bg-[var(--color-bg-surface)] p-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">이번 타임블록 진행률</span>
                    <span className="text-lg font-bold text-[var(--color-primary)]">{completionPercentage}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${completionPercentage}%` }} />
                </div>
                <div className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                    {completedCount}개 완료 / 전체 {totalTasks}개
                </div>
            </div>

            {/* Completed Tasks Section - All day */}
            {allCompletedTasks.length > 0 && (
                <details className="group">
                    <summary className="cursor-pointer rounded-xl bg-[var(--color-bg-surface)] p-4 font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]">
                        ✅ 오늘 완료한 작업 {allCompletedTasks.length}개
                    </summary>
                    <div className="mt-2 space-y-2">
                        {allCompletedTasks.map(task => (
                            <div key={task.id} className="flex items-center gap-3 rounded-lg bg-[var(--color-bg-surface)] p-3 opacity-75">
                                <span className="text-emerald-500">✓</span>
                                <span className="flex-1 text-sm text-[var(--color-text-secondary)] line-through">{task.text}</span>
                                <span className="text-xs text-[var(--color-text-tertiary)]">{task.baseDuration}분</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}

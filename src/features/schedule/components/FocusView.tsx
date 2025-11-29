import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import type { Task, TimeBlockId } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { calculateTaskXP } from '@/shared/lib/utils';
import { recommendNextTask, getRecommendationMessage } from '../utils/taskRecommendation';
import { useFocusModeStore } from '../stores/focusModeStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { FocusTimer } from './FocusTimer';
import { FocusHeroTask } from './FocusHeroTask';
import { FocusTimeline } from './FocusTimeline';
import { QuickMemo } from './QuickMemo';
import { BreakView } from './BreakView';

const MUSIC_REPO = { owner: 'winston365', repo: 'music', branches: ['main', 'gh-pages'] } as const;
const MUSIC_FOLDERS = [
    { id: '잔잔6593', label: '잔잔 6593' },
    { id: '활기', label: '활기' },
    { id: '흥분', label: '흥분' },
] as const;

interface FocusViewProps {
    currentBlockId: TimeBlockId;
    tasks: Task[];
    allDailyTasks: Task[];
    isLocked: boolean;
    onEditTask: (task: Task) => void;
    onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
    onToggleTask: (taskId: string) => void;
    onToggleLock?: () => void;
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
    onToggleLock,
    onExitFocusMode,
    onCreateTask
}: FocusViewProps) {
    const { setFocusMode, activeTaskId, activeTaskStartTime, startTask, stopTask, isPaused, pauseTask, resumeTask } = useFocusModeStore();
    const { settings } = useSettingsStore();
    const [memoText, setMemoText] = useState('');
    const [isBreakTime, setIsBreakTime] = useState(false);
    const [breakRemainingSeconds, setBreakRemainingSeconds] = useState<number | null>(null);
    const [pendingNextTaskId, setPendingNextTaskId] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());

    const currentEnergy = 50;
    type MusicTrack = { name: string; url: string };

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [selectedMusicFolder, setSelectedMusicFolder] = useState<string>(MUSIC_FOLDERS[0].id);
    const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [isMusicLoading, setIsMusicLoading] = useState(false);
    const [isMusicPlaying, setIsMusicPlaying] = useState(false);
    const [loopMode, setLoopMode] = useState<'track' | 'folder'>('folder');

    // 인라인 작업 추가
    const [inlineInputValue, setInlineInputValue] = useState('');
    const inlineInputRef = useRef<HTMLInputElement>(null);

    const handleInlineInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inlineInputValue.trim()) {
            e.preventDefault();
            const trimmedText = inlineInputValue.trim();

            if (trimmedText.length <= 10) {
                toast.error('작업 제목을 10자 이상 입력해주세요.');
                return;
            }

            // 현재 시간대 작업 2개 제한
            if (currentHourTasks.length >= 2) {
                toast.error('이 시간대에는 최대 2개의 작업만 추가할 수 있습니다.');
                return;
            }

            try {
                await onCreateTask(trimmedText, currentBlockId, currentHour);
                setInlineInputValue('');
                inlineInputRef.current?.focus();
            } catch (err) {
                console.error('Failed to create task:', err);
            }
        } else if (e.key === 'Escape') {
            setInlineInputValue('');
        }
    };

    const stopMusic = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.src = '';
        }
        setIsMusicPlaying(false);
        setCurrentTrackIndex(null);
    }, []);

    const fetchMusicTracks = useCallback(async () => {
        if (!selectedMusicFolder) return;
        setIsMusicLoading(true);
        setMusicTracks([]);
        setCurrentTrackIndex(null);
        try {
            const folderEncoded = encodeURIComponent(selectedMusicFolder);
            const headers: Record<string, string> = {
                Accept: 'application/vnd.github+json',
            };
            if (settings?.githubToken) {
                headers.Authorization = `Bearer ${settings.githubToken}`;
            }

            let tracks: MusicTrack[] = [];
            let lastStatus: number | null = null;

            for (const branch of MUSIC_REPO.branches) {
                const apiUrl = `https://api.github.com/repos/${MUSIC_REPO.owner}/${MUSIC_REPO.repo}/contents/${folderEncoded}?ref=${branch}`;
                const res = await fetch(apiUrl, { headers });
                lastStatus = res.status;
                if (!res.ok) {
                    continue; // 다음 브랜치 시도
                }
                const data = await res.json();
                if (!Array.isArray(data)) {
                    continue;
                }
                tracks = data
                    .filter((item) => item.type === 'file' && /\.mp3$/i.test(item.name))
                    .map((item) => {
                        const fileEncoded = encodeURIComponent(item.name);
                        const url = `https://cdn.jsdelivr.net/gh/${MUSIC_REPO.owner}/${MUSIC_REPO.repo}@${branch}/${folderEncoded}/${fileEncoded}`;
                        return {
                            name: item.name.replace(/\.mp3$/i, ''),
                            url,
                        };
                    });
                if (tracks.length > 0) break;
            }

            if (tracks.length === 0) {
                if (lastStatus === 404) {
                    toast.error('음원 폴더를 찾을 수 없습니다. (branch main/gh-pages 모두 실패)');
                } else {
                    toast.error('선택한 폴더에 mp3 파일이 없거나 불러오지 못했습니다.');
                }
            }
            setMusicTracks(tracks);
        } catch (error) {
            console.error('[FocusView] 음악 목록 로드 실패:', error);
            toast.error('음악 목록을 불러오는 데 실패했습니다.');
        } finally {
            setIsMusicLoading(false);
        }
    }, [selectedMusicFolder, settings?.githubToken]);

    const handleNextRandom = useCallback(
        (avoidSame = true) => {
            if (!musicTracks.length) {
                toast.error('재생할 트랙이 없습니다.');
                return;
            }
            let nextIndex = Math.floor(Math.random() * musicTracks.length);
            if (avoidSame && musicTracks.length > 1 && nextIndex === currentTrackIndex) {
                nextIndex = (nextIndex + 1) % musicTracks.length;
            }
            setCurrentTrackIndex(nextIndex);
            const audio = audioRef.current || new Audio();
            audioRef.current = audio;
            audio.src = musicTracks[nextIndex].url;
            audio.loop = loopMode === 'track';
            audio.onended = () => {
                if (loopMode === 'folder') {
                    handleNextRandom();
                }
            };
            audio
                .play()
                .then(() => setIsMusicPlaying(true))
                .catch((err) => {
                    console.error('[FocusView] 음악 재생 실패:', err);
                    toast.error('음악을 재생할 수 없습니다.');
                });
        },
        [currentTrackIndex, loopMode, musicTracks]
    );

    const handleTogglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (audio && isMusicPlaying) {
            audio.pause();
            setIsMusicPlaying(false);
            return;
        }
        if (!musicTracks.length) {
            toast.error('재생할 트랙이 없습니다.');
            return;
        }
        if (audio && currentTrackIndex !== null) {
            audio.play().then(() => setIsMusicPlaying(true)).catch(() => toast.error('음악을 재생할 수 없습니다.'));
        } else {
            handleNextRandom(false);
        }
    }, [currentTrackIndex, handleNextRandom, isMusicPlaying, musicTracks.length]);

    const handleLoopModeChange = useCallback((mode: 'track' | 'folder') => {
        setLoopMode(mode);
        if (audioRef.current) {
            audioRef.current.loop = mode === 'track';
        }
    }, []);

    useEffect(() => {
        stopMusic();
        fetchMusicTracks();
    }, [fetchMusicTracks, stopMusic]);

    useEffect(() => {
        return () => {
            stopMusic();
        };
    }, [stopMusic]);

    const currentBlock = TIME_BLOCKS.find(b => b.id === currentBlockId);
    const blockLabel = currentBlock?.label ?? '블록 외 시간';

    const nowDate = new Date(now);
    const currentHour = nowDate.getHours();
    const currentMinute = nowDate.getMinutes();
    const slotStart = currentHour;
    const slotEnd = (currentHour + 1) % 24;
    const slotLabel = `${String(slotStart).padStart(2, '0')}:00 - ${String(slotEnd).padStart(2, '0')}:00 · ${String(currentHour).padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    const remainingMinutes = Math.max(0, (slotEnd === 0 ? 24 : slotEnd) * 60 - slotStart * 60 - currentMinute);

    // Filter tasks to only current hour slot - memoized to prevent infinite loop
    const currentHourTasks = useMemo(() => {
        return tasks
            .filter(t => t.hourSlot === currentHour)
            .sort((a, b) => {
                const orderA = a.order ?? new Date(a.createdAt).getTime();
                const orderB = b.order ?? new Date(b.createdAt).getTime();
                return orderA - orderB;
            });
    }, [tasks, currentHour]);

    // Use the first incomplete task based on order (respects HourBar ordering)
    const recommendedTask = useMemo(() => {
        return currentHourTasks.find(t => !t.completed) || null;
    }, [currentHourTasks]);

    const recommendationMessage = recommendedTask
        ? getRecommendationMessage(recommendedTask, currentEnergy)
        : '';

    // All completed tasks from the entire day
    const allCompletedTasks = allDailyTasks.filter(t => t.completed);

    // Filter upcoming tasks from current hour only (exclude completed and recommended)
    const initialUpcomingTasks = useMemo(() => {
        return currentHourTasks.filter(t => !t.completed && t.id !== recommendedTask?.id);
    }, [currentHourTasks, recommendedTask]);

    const [upcomingTasks, setUpcomingTasks] = useState(initialUpcomingTasks);

    const startBreakForNextTask = useCallback((completedTaskId: string | null) => {
        const nextTask = currentHourTasks.find(t => !t.completed && t.id !== completedTaskId);
        setIsBreakTime(true);
        setBreakRemainingSeconds(60);
        setPendingNextTaskId(nextTask?.id ?? null);
    }, [currentHourTasks]);

    const handleToggleTaskWrapper = useCallback(async (taskId: string, options?: { skipBonus?: boolean }) => {
        const isCompletingActiveTask = taskId === activeTaskId;
        const task =
            currentHourTasks.find(t => t.id === taskId) ||
            allDailyTasks.find(t => t.id === taskId) ||
            null;

        try {
            await onToggleTask(taskId);

            // 집중 모드에서 활성 작업을 완료했을 때: 추가 XP 보너스 지급 (x3 total)
            // ✅ 완료 취소 시에는 bonusXP 지급하지 않음
            if (isCompletingActiveTask && task && !task.completed && !options?.skipBonus) {
                // 기본 XP는 다른 경로로 지급되므로, 여기서 2배 추가해 총 3배가 되도록 한다.
                const bonusXP = calculateTaskXP(task) * 2;
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
    }, [activeTaskId, onToggleTask, startBreakForNextTask, stopTask, currentHourTasks, allDailyTasks]);

    // Sync state when props change
    useEffect(() => {
        setUpcomingTasks(initialUpcomingTasks);
    }, [initialUpcomingTasks]);

    // 타이머 업데이트
    useEffect(() => {
        if (!activeTaskId || !activeTaskStartTime || isPaused || isBreakTime) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [activeTaskId, activeTaskStartTime, isPaused, isBreakTime]);

    // 작업 시간 경과 시 자동 완료 (보너스 XP 적용)
    useEffect(() => {
        if (!activeTaskId || !activeTaskStartTime || isPaused || isBreakTime) return;
        const activeTask =
            currentHourTasks.find(t => t.id === activeTaskId) ||
            allDailyTasks.find(t => t.id === activeTaskId) ||
            null;
        if (!activeTask || activeTask.completed) return;

        const elapsedSeconds = Math.floor((now - activeTaskStartTime) / 1000);
        const totalSeconds = (activeTask.baseDuration || 0) * 60;
        if (totalSeconds > 0 && elapsedSeconds >= totalSeconds) {
            handleToggleTaskWrapper(activeTaskId);
        }
    }, [now, activeTaskId, activeTaskStartTime, isPaused, isBreakTime, currentHourTasks, allDailyTasks, handleToggleTaskWrapper]);

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

        const activeTask = currentHourTasks.find(t => t.id === activeTaskId);
        const nextTask = currentHourTasks.find(t => !t.completed && t.id !== activeTaskId);
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
    }, [activeTaskId, activeTaskStartTime, breakRemainingSeconds, currentHourTasks, isBreakTime, isPaused, now, recommendedTask]);

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
    }, [isPaused, pauseTask, resumeTask, activeTaskId, handleToggleTaskWrapper, startBreakForNextTask, recommendedTask, setFocusMode, startTask]);

    // Progress calculation for current hour tasks only
    const totalTasks = currentHourTasks.length;
    const completedCount = currentHourTasks.filter(t => t.completed).length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    const handleStartNow = (task: Task) => {
        setFocusMode(true);
        startTask(task.id);
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
                                onClick={() => {
                                    if (!window.electronAPI) {
                                        alert('PiP 모드는 Electron 앱에서만 사용 가능합니다.');
                                        return;
                                    }
                                    window.electronAPI.openPip().then(() => {
                                        sendPipState();
                                    }).catch(console.error);
                                }}
                                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-bg-tertiary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] shadow-sm hover:bg-[var(--color-bg-tertiary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition"
                            >
                                <span>📌</span>
                                <span>PiP 모드</span>
                            </button>
                        </div>
                        <p className="text-base text-[var(--color-text-secondary)]">{slotLabel}</p>

                        {/* 배경 음악 플레이어 (컴팩트) */}
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3 shadow-sm max-w-3xl">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-semibold text-[var(--color-text)]">배경 음악</span>
                                    <span className="text-xs text-[var(--color-text-tertiary)]">폴더 선택 후 랜덤 재생 / 반복</span>
                                </div>
                                <select
                                    className="ml-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
                                    value={selectedMusicFolder}
                                    onChange={(e) => {
                                        setSelectedMusicFolder(e.target.value);
                                    }}
                                    disabled={isMusicLoading}
                                >
                                    {MUSIC_FOLDERS.map((folder) => (
                                        <option key={folder.id} value={folder.id}>{folder.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleTogglePlay}
                            className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-sm disabled:opacity-60 ${
                                isMusicPlaying
                                    ? 'bg-emerald-500 text-white hover:opacity-90'
                                    : 'bg-[var(--color-primary)] text-white hover:opacity-90'
                            }`}
                            disabled={isMusicLoading || !musicTracks.length}
                            aria-pressed={isMusicPlaying}
                        >
                            {isMusicPlaying ? '⏸︎ 일시정지 (재생 중)' : '▶️ 재생'}
                        </button>
                                <button
                                    onClick={() => handleNextRandom(true)}
                                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary-hover)] disabled:opacity-60"
                                    disabled={isMusicLoading || !musicTracks.length}
                                >
                                    🔀 랜덤 다음
                                </button>
                                <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleLoopModeChange('track')}
                                className={`rounded-xl border px-3 py-2 text-sm transition ${
                                    loopMode === 'track'
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
                                        : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary-hover)]'
                                }`}
                                aria-pressed={loopMode === 'track'}
                            >
                                🔂 한 곡 반복
                            </button>
                            <button
                                onClick={() => handleLoopModeChange('folder')}
                                className={`rounded-xl border px-3 py-2 text-sm transition ${
                                    loopMode === 'folder'
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
                                        : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary-hover)]'
                                }`}
                                aria-pressed={loopMode === 'folder'}
                            >
                                🔁 폴더 반복
                            </button>
                        </div>
                                <div className="ml-auto text-xs text-[var(--color-text-tertiary)]">
                                    {isMusicLoading && '불러오는 중...'}
                                    {!isMusicLoading && currentTrackIndex !== null && musicTracks[currentTrackIndex] && (
                                        <span>재생 중: {musicTracks[currentTrackIndex].name}</span>
                                    )}
                                    {!isMusicLoading && currentTrackIndex === null && musicTracks.length > 0 && (
                                        <span>{musicTracks.length}곡 준비됨</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <FocusTimer remainingMinutes={remainingMinutes} totalMinutes={60} />
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
            {!isLocked && currentHourTasks.length < 2 && (
                <div className="rounded-2xl bg-[var(--color-bg-surface)] p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">현재 시간대에 작업 추가</span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">({currentHourTasks.length}/2)</span>
                    </div>
                    <input
                        ref={inlineInputRef}
                        type="text"
                        value={inlineInputValue}
                        onChange={e => setInlineInputValue(e.target.value)}
                        onKeyDown={handleInlineInputKeyDown}
                        placeholder="작업을 입력하고 Enter로 추가하세요 (10자 이상)"
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
                />
            )}

            {/* Progress Section - Current hour only */}
            <div className="rounded-2xl bg-[var(--color-bg-surface)] p-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">이번 시간 진행률</span>
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

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useFocusModeStore } from '@/features/schedule/stores/focusModeStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { calculateTaskXP, formatDuration } from '@/shared/lib/utils';
import confetti from 'canvas-confetti';

export function FocusTimerOverlay() {
  const { isFocusMode, setFocusMode } = useFocusModeStore();
  const { dailyData, toggleTaskCompletion } = useDailyDataStore();
  const [now, setNow] = useState(new Date());
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [pausedAt, setPausedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!isFocusMode || !isRunning) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isFocusMode, isRunning]);

  const slotStart = now.getHours();
  const slotEnd = (slotStart + 1) % 24;
  const slotLabel = `${String(slotStart).padStart(2, '0')}:00 ~ ${String(slotEnd).padStart(2, '0')}:00`;
  const slotKey = `${slotStart}:00`;

  const currentBlock = TIME_BLOCKS.find(b => slotStart >= b.start && slotStart < b.end);
  const tasks = dailyData?.tasks ?? [];
  const currentSlotTasks = useMemo(
    () =>
      tasks
        .filter(
          t =>
            t.hourSlot === slotStart ||
            (!t.hourSlot && t.timeBlock === currentBlock?.id)
        )
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [tasks, slotStart, currentBlock?.id]
  );

  // 현재 작업: 해당 시간대의 첫 번째 미완료 작업
  const currentTask = currentSlotTasks.find(t => !t.completed);
  // 다음 작업: 현재 작업 다음의 미완료 작업
  const nextTask = currentTask
    ? currentSlotTasks.slice(currentSlotTasks.indexOf(currentTask) + 1).find(t => !t.completed)
    : null;

  const currentXP = currentTask ? calculateTaskXP(currentTask) : 0;
  const currentDuration = currentTask ? formatDuration(currentTask.baseDuration) : null;
  const nextDuration = nextTask ? formatDuration(nextTask.baseDuration) : null;

  // 작업 기반 타이머 계산
  const taskDurationMs = currentTask ? (currentTask.baseDuration || 15) * 60 * 1000 : 0;
  const taskEndTimestamp = useMemo(() => {
    if (!startTime || !currentTask) {
      const end = new Date(now);
      end.setHours(slotEnd, 0, 0, 0);
      if (slotEnd === 0 && slotStart !== 0) {
        end.setDate(end.getDate() + 1);
      }
      return end;
    }
    return new Date(startTime.getTime() + taskDurationMs);
  }, [startTime, currentTask, taskDurationMs, now, slotEnd, slotStart]);

  const remainingMs = Math.max(0, taskEndTimestamp.getTime() - now.getTime());
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
  const progress = taskDurationMs > 0 && startTime
    ? Math.min(1, (now.getTime() - startTime.getTime()) / taskDurationMs)
    : 0;

  const radius = 120;
  const circumference = 2 * Math.PI * radius;

  const handleStart = useCallback(() => {
    setIsRunning(true);
    setStartTime(prev => prev ?? new Date());
    setPausedAt(null);
  }, []);

  const handlePause = useCallback(() => {
    setIsRunning(false);
    setPausedAt(new Date());
  }, []);

  const handleResume = useCallback(() => {
    setIsRunning(true);
    setPausedAt(null);
  }, []);

  const handleComplete = useCallback(async () => {
    setIsRunning(false);
    if (currentTask) {
      await toggleTaskCompletion(currentTask.id);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#60A5FA', '#34D399', '#F472B6', '#FBBF24'] // Custom colors matching theme vibes
      });
    }
    setFocusMode(false);
  }, [currentTask, toggleTaskCompletion, setFocusMode]);

  const handleExit = useCallback(() => {
    setIsRunning(false);
    setFocusMode(false);
  }, [setFocusMode]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setStartTime(null);
    setPausedAt(null);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isFocusMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input (though unlikely in this overlay)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === 'a') {
        if (!isRunning) handleStart();
      } else if (key === 's') {
        if (isRunning) handlePause();
      } else if (key === 'd') {
        handleComplete();
      } else if (key === 'f') {
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, isRunning, handleStart, handlePause, handleComplete, handleExit]);

  // 타이머가 0이 되면 자동 완료 처리
  useEffect(() => {
    if (!isFocusMode || !isRunning || !currentTask) return;
    if (remainingMs <= 0) {
      handleComplete();
    }
  }, [isFocusMode, isRunning, remainingMs, currentTask, handleComplete]);


  if (!isFocusMode) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-[#0b1220e6] text-white backdrop-blur-xl animate-in fade-in duration-300">
      <div className="absolute top-8 flex flex-col items-center gap-1 text-center">
        <div className="text-sm text-white/60">🎯 지금 집중 · {slotLabel} · {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}</div>
        <h1 className="text-3xl font-bold tracking-tight">{currentBlock?.label ?? '자유 시간대'}</h1>
      </div>

      {/* XP 표시 - 독립적으로 배치 */}
      {currentTask && (
        <div className="absolute top-32 flex items-center gap-3 text-sm">
          <div className="relative inline-flex items-center gap-2 rounded-xl border-2 border-yellow-400/60 bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 px-4 py-2 shadow-lg shadow-yellow-500/20">
            <span className="text-2xl animate-bounce">🪙</span>
            <div className="flex flex-col">
              <span className="text-xs text-yellow-200/80 font-medium">획듥 가능</span>
              <span className="text-lg font-bold text-yellow-300">+{currentXP} XP</span>
            </div>
            <div className="absolute -top-1 -right-1 h-3 w-3 animate-ping rounded-full bg-yellow-400/60"></div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-white/80">
            ⌛ {currentDuration}
          </span>
        </div>
      )}

      {/* 현재 작업 표시 */}
      {currentTask && (
        <div className="mt-28 w-full max-w-md rounded-2xl border-2 border-white/20 bg-white/5 px-6 py-4 text-center">
          <div className="text-sm text-white/60 mb-1">현재 작업</div>
          <div className="text-2xl font-bold">{currentTask.text}</div>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-white/70">
            <span>{currentDuration}</span>
            <span>·</span>
            <span>{currentTask.resistance === 'low' ? '쉬움' : currentTask.resistance === 'medium' ? '보통' : '어려움'}</span>
          </div>
        </div>
      )}

      <div className="relative mt-8 flex items-center justify-center">
        <svg className={`h-72 w-72 -rotate-90 transform transition-all duration-700 ${isRunning ? 'scale-105 drop-shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]' : ''}`}>
          <circle
            cx="144"
            cy="144"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            className="text-white/10"
          />
          <circle
            cx="144"
            cy="144"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            className={`transition-all duration-1000 ease-linear text-[var(--color-primary)] ${isRunning ? 'animate-pulse' : ''}`}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <div className="text-sm text-white/60">⏳ 남은 시간</div>
          <div className="text-[42px] font-mono font-bold tabular-nums leading-tight drop-shadow-lg">
            {String(Math.floor(remainingMinutes)).padStart(2, '0')}:{String(remainingSeconds).padStart(2, '0')}
          </div>
          <div className="mt-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70">
            {currentTask && startTime
              ? `${String(taskEndTimestamp.getHours()).padStart(2, '0')}:${String(taskEndTimestamp.getMinutes()).padStart(2, '0')} 종료 예상`
              : `${slotLabel} 종료 예상`}
          </div>
        </div>
      </div>

      {nextTask && (
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/80">
            다음 작업 · {slotKey}
          </div>
          <div className="rounded-2xl bg-white/5 px-6 py-4 shadow-xl border border-white/10">
            <div className="text-xl font-semibold">{nextTask.text}</div>
            <div className="mt-1 text-sm text-white/70">
              {nextDuration} · {nextTask.resistance === 'low' ? '쉬움' : nextTask.resistance === 'medium' ? '보통' : '어려움'}
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-10 flex flex-wrap items-center justify-center gap-3">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold shadow-lg shadow-[var(--color-primary)]/30 transition hover:translate-y-[-1px] hover:shadow-[var(--color-primary)]/50 text-white"
          >
            ▶ 시작 (A)
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-white/10 transition hover:bg-white/15"
          >
            ❚❚ 일시정지 (S)
          </button>
        )}
        {pausedAt && (
          <button
            onClick={handleResume}
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold shadow-lg shadow-emerald-500/30 transition hover:translate-y-[-1px] hover:shadow-emerald-500/50"
          >
            ▶ 재시작
          </button>
        )}
        <button
          onClick={handleReset}
          className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold shadow-lg shadow-amber-500/30 transition hover:translate-y-[-1px] hover:shadow-amber-500/50 text-white"
        >
          🔄 초기화
        </button>
        <button
          onClick={handleComplete}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold shadow-lg shadow-blue-500/30 transition hover:translate-y-[-1px] hover:shadow-blue-500/50"
        >
          ✅ 완료 (D)
        </button>
        <button
          onClick={handleExit}
          className="rounded-xl bg-rose-700 px-6 py-3 text-sm font-semibold shadow-lg shadow-rose-500/30 transition hover:translate-y-[-1px] hover:shadow-rose-500/50"
        >
          ⏹ 종료 (F)
        </button>
      </div>
    </div>
  );
}

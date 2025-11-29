import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import type { Task, Resistance } from '@/shared/types/domain';
import { calculateTaskXP } from '@/shared/lib/utils';

interface FocusHeroTaskProps {
    task: Task;
    recommendationMessage: string;
    isActive: boolean;
    startTime: number | null;
    onEdit: (task: Task) => void;
    onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
    onToggle: (taskId: string) => void;
    onStartNow: (task: Task) => void;
    onStop: () => void;
    onComplete: () => void;
}

const RESISTANCE_COLORS: Record<Resistance, string> = {
    low: 'bg-emerald-500/20 text-emerald-300',
    medium: 'bg-amber-500/20 text-amber-300',
    high: 'bg-rose-500/20 text-rose-300',
};

const RESISTANCE_EMOJI: Record<Resistance, string> = {
    low: '🟢',
    medium: '🟠',
    high: '🔴'
};

const RESISTANCE_LABEL: Record<Resistance, string> = {
    low: '쉬움',
    medium: '보통',
    high: '어려움'
};

export function FocusHeroTask({
    task,
    recommendationMessage,
    isActive,
    startTime,
    onEdit,
    onUpdateTask,
    onToggle,
    onStartNow,
    onStop,
    onComplete
}: FocusHeroTaskProps) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [reachedMilestones, setReachedMilestones] = useState<Set<number>>(new Set());
    const [celebratingMilestone, setCelebratingMilestone] = useState<number | null>(null);
    const milestonesRef = useRef<Set<number>>(new Set());

    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const [showResistancePicker, setShowResistancePicker] = useState(false);
    const durationOptions = [5, 10, 15, 30, 45, 60];

    useEffect(() => {
        if (!isActive || !startTime) {
            setElapsedSeconds(0);
            setReachedMilestones(new Set());
            milestonesRef.current = new Set();
            return;
        }

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setElapsedSeconds(elapsed);

            // Check for milestone achievements
            const totalSeconds = task.baseDuration * 60;
            const currentProgress = (elapsed / totalSeconds) * 100;

            [25, 50, 75].forEach(milestone => {
                if (currentProgress >= milestone && !milestonesRef.current.has(milestone)) {
                    milestonesRef.current.add(milestone);
                    setReachedMilestones(new Set(milestonesRef.current));
                    setCelebratingMilestone(milestone);
                    setTimeout(() => setCelebratingMilestone(null), 2000);
                }
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isActive, startTime, task.baseDuration]);

    const totalSeconds = task.baseDuration * 60;
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    const progress = Math.min(100, (elapsedSeconds / totalSeconds) * 100);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleResistanceChange = (resistance: Resistance) => {
        const multiplier = resistance === 'low' ? 1.0 : resistance === 'medium' ? 1.3 : 1.6;
        onUpdateTask(task.id, {
            resistance,
            adjustedDuration: Math.round(task.baseDuration * multiplier),
        });
        setShowResistancePicker(false);
    };

    const handleDurationChange = (baseDuration: number) => {
        const multiplier = task.resistance === 'low' ? 1.0 : task.resistance === 'medium' ? 1.3 : 1.6;
        onUpdateTask(task.id, {
            baseDuration,
            adjustedDuration: Math.round(baseDuration * multiplier),
        });
        setShowDurationPicker(false);
    };

    // Calculate XP (Base + Bonus)
    const baseXP = calculateTaskXP(task);
    const totalXP = baseXP * 4;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-visible rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl"
        >
            {/* Dynamic Background Gradient */}
            <motion.div
                className="absolute inset-0 -z-10 opacity-30 rounded-3xl overflow-hidden"
                animate={{
                    background: isActive
                        ? [
                            'radial-gradient(circle at 50% 50%, #ef4444 0%, transparent 70%)',
                            'radial-gradient(circle at 50% 50%, #f59e0b 0%, transparent 70%)',
                            'radial-gradient(circle at 50% 50%, #ef4444 0%, transparent 70%)'
                        ]
                        : [
                            'radial-gradient(circle at 0% 0%, #4f46e5 0%, transparent 50%)',
                            'radial-gradient(circle at 100% 100%, #ec4899 0%, transparent 50%)',
                            'radial-gradient(circle at 0% 0%, #4f46e5 0%, transparent 50%)',
                        ],
                }}
                transition={{ duration: isActive ? 2 : 10, repeat: Infinity, ease: "linear" }}
            />

            <div className="flex flex-col gap-6">
                {/* Header Badge */}
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/30">
                        <span>💡</span>
                        <span>혜은이 추천!</span>
                    </span>
                    <span className="text-sm text-white/60">
                        {recommendationMessage}
                    </span>
                </div>

                {/* Task Content */}
                <div>
                    <div className="flex items-start justify-between gap-4">
                        <h2 className="text-4xl font-bold text-white leading-tight">
                            {task.text}
                        </h2>
                        <button
                            onClick={() => onEdit(task)}
                            className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            ✏️
                        </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 items-center">
                        {/* XP Badge */}
                        <span className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.2)]">
                            🪙 +{totalXP} XP (x4 Bonus)
                        </span>

                        {/* Duration Picker */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowDurationPicker(!showDurationPicker);
                                    setShowResistancePicker(false);
                                }}
                                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors"
                            >
                                ⏱ {task.baseDuration}분
                            </button>
                            {showDurationPicker && (
                                <div className="absolute left-0 top-full z-[50] mt-2 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-[#2a2a2a] p-2 text-xs shadow-xl backdrop-blur-md w-[180px]">
                                    {durationOptions.map((duration) => (
                                        <button
                                            key={duration}
                                            className={`rounded-lg px-2 py-1.5 transition ${task.baseDuration === duration ? 'bg-amber-500 text-white' : 'hover:bg-white/5 text-white/70'}`}
                                            onClick={() => handleDurationChange(duration)}
                                        >
                                            {duration}m
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Resistance Picker */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowResistancePicker(!showResistancePicker);
                                    setShowDurationPicker(false);
                                }}
                                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:brightness-110 transition-all ${RESISTANCE_COLORS[task.resistance]}`}
                            >
                                {RESISTANCE_EMOJI[task.resistance]} {RESISTANCE_LABEL[task.resistance]}
                            </button>
                            {showResistancePicker && (
                                <div className="absolute left-0 top-full z-[50] mt-2 flex min-w-[120px] flex-col gap-1 rounded-xl border border-white/10 bg-[#2a2a2a] p-1.5 text-xs shadow-xl backdrop-blur-md">
                                    <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-emerald-200" onClick={() => handleResistanceChange('low')}>
                                        🟢 쉬움 (x1.0)
                                    </button>
                                    <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-amber-200" onClick={() => handleResistanceChange('medium')}>
                                        🟠 보통 (x1.3)
                                    </button>
                                    <button className="rounded-lg px-2 py-1.5 text-left hover:bg-white/5 text-rose-200" onClick={() => handleResistanceChange('high')}>
                                        🔴 어려움 (x1.6)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Button / Timer */}
                {isActive ? (
                    <div className="mt-2 w-full rounded-2xl bg-white/5 p-6 border border-white/10">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-white/60">집중 중...</span>
                            <span className="text-3xl font-bold text-white font-mono relative -translate-y-5">{formatTime(remainingSeconds)}</span>
                        </div>

                        {/* Celebration Message */}
                        {celebratingMilestone && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                                className="mb-4 text-center"
                            >
                                <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-2 border border-amber-500/30">
                                    <span className="text-2xl">🎉</span>
                                    <span className="text-sm font-bold text-amber-300">
                                        {celebratingMilestone}% 달성!
                                    </span>
                                </div>
                            </motion.div>
                        )}

                        {/* Progress Bar with Milestones */}
                        <div className="relative w-full mt-6">
                            {/* Arc indicators above progress bar */}
                            {/* Arc overlay */}
                            <svg
                                className="absolute -top-10 left-0 right-0 h-10 w-full"
                                viewBox="0 0 100 20"
                                preserveAspectRatio="none"
                                style={{ overflow: 'visible' }}
                            >
                                {[25, 50, 75, 100].map((milestone, idx) => {
                                    const prev = [0, 25, 50, 75][idx];
                                    const startX = prev;
                                    const endX = milestone;
                                    const controlX = (startX + endX) / 2;
                                    const isReached = progress >= milestone;
                                    return (
                                        <path
                                            key={milestone}
                                            d={`M ${startX} 18 Q ${controlX} 4 ${endX} 18`}
                                            stroke={isReached ? '#fbbf24' : '#ffffff40'}
                                            strokeWidth="1.5"
                                            fill="none"
                                        />
                                    );
                                })}
                            </svg>

                            {/* Labels aligned to milestones */}
                            <div className="absolute -top-11 left-0 right-0 h-5 w-full">
                                {[25, 50, 75, 100].map((milestone) => {
                                    const requiredMinutes = Math.ceil((task.baseDuration * milestone) / 100);
                                    const isReached = progress >= milestone;
                                    return (
                                        <div
                                            key={milestone}
                                            className="absolute flex flex-col items-center"
                                            style={{ left: `${milestone}%`, transform: 'translateX(-50%)' }}
                                        >
                                            <span
                                                className={`text-xs font-medium ${isReached ? 'text-amber-400' : 'text-white/40'}`}
                                            >
                                                {requiredMinutes}분
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Progress bar */}
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                                {/* Milestone markers */}
                                {[25, 50, 75].map(milestone => (
                                    <div
                                        key={milestone}
                                        className="absolute top-0 bottom-0 w-0.5"
                                        style={{ left: `${milestone}%` }}
                                    >
                                        <div className={`h-full transition-all ${reachedMilestones.has(milestone)
                                            ? 'bg-amber-400 shadow-lg shadow-amber-500/50'
                                            : 'bg-white/30'
                                            }`} />
                                    </div>
                                ))}

                                {/* Progress fill */}
                                <motion.div
                                    className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        </div>

                        {/* Milestone labels */}
                        <div className="relative mt-2 h-4">
                            <span
                                className={`absolute text-xs ${reachedMilestones.has(25) ? 'text-amber-400 font-medium' : 'text-white/40'}`}
                                style={{ left: '25%', transform: 'translateX(-50%)' }}
                            >
                                25%
                            </span>
                            <span
                                className={`absolute text-xs ${reachedMilestones.has(50) ? 'text-amber-400 font-medium' : 'text-white/40'}`}
                                style={{ left: '50%', transform: 'translateX(-50%)' }}
                            >
                                50%
                            </span>
                            <span
                                className={`absolute text-xs ${reachedMilestones.has(75) ? 'text-amber-400 font-medium' : 'text-white/40'}`}
                                style={{ left: '75%', transform: 'translateX(-50%)' }}
                            >
                                75%
                            </span>
                            <span
                                className={`absolute text-xs ${progress >= 100 ? 'text-emerald-400 font-medium' : 'text-white/40'}`}
                                style={{ left: '100%', transform: 'translateX(-100%)' }}
                            >
                                100%
                            </span>
                        </div>

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={onComplete}
                                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 py-3 text-sm font-bold text-white hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/20"
                            >
                                ✓ 일찍 끝내기 (+{baseXP} XP)
                            </button>
                            <button
                                onClick={onStop}
                                className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-medium text-white/60 hover:bg-white/20 hover:text-white transition-colors"
                            >
                                중단하기
                            </button>
                        </div>
                    </div>
                ) : (
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        animate={{
                            boxShadow: [
                                "0 0 0 0 rgba(99, 102, 241, 0)",
                                "0 0 0 10px rgba(99, 102, 241, 0.1)",
                                "0 0 0 20px rgba(99, 102, 241, 0)",
                            ]
                        }}
                        transition={{
                            boxShadow: {
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }
                        }}
                        onClick={() => onStartNow(task)}
                        className="mt-2 w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
                    >
                        🚀 지금 시작하기
                    </motion.button>
                )}
            </div>
        </motion.div>
    );
}

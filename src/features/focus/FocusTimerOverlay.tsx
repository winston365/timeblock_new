import { useEffect, useState } from 'react';
import { useFocusStore } from '@/shared/stores/focusStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';

export function FocusTimerOverlay() {
    const { isFocusMode, toggleFocusMode } = useFocusStore();
    const { dailyData } = useDailyDataStore();
    const [now, setNow] = useState(new Date());

    // Update time every second
    useEffect(() => {
        if (!isFocusMode) return;
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, [isFocusMode]);

    if (!isFocusMode) return null;

    // Standard Blocks Definition
    const BLOCKS = [
        { id: 'morning_1', start: 6, end: 9, label: '🌅 Morning Focus' },
        { id: 'morning_2', start: 9, end: 12, label: '☀️ Deep Work' },
        { id: 'afternoon_1', start: 12, end: 15, label: '🍱 Lunch & Reset' },
        { id: 'afternoon_2', start: 15, end: 18, label: '☕ Afternoon Flow' },
        { id: 'evening_1', start: 18, end: 21, label: '🌙 Evening Wrap' },
        { id: 'evening_2', start: 21, end: 24, label: '🦉 Night Owl' },
    ];

    const currentHour = now.getHours();
    const activeBlock = BLOCKS.find(b => currentHour >= b.start && currentHour < b.end);

    if (!activeBlock) {
        return (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 text-white">
                <div className="text-center">
                    <h2 className="text-2xl font-bold">No Active Block</h2>
                    <button onClick={toggleFocusMode} className="mt-4 rounded bg-white/20 px-4 py-2">Close</button>
                </div>
            </div>
        );
    }

    // Calculate Progress
    const startTimestamp = new Date(now);
    startTimestamp.setHours(activeBlock.start, 0, 0, 0);
    const endTimestamp = new Date(now);
    endTimestamp.setHours(activeBlock.end, 0, 0, 0);

    const totalDuration = endTimestamp.getTime() - startTimestamp.getTime();
    const elapsed = now.getTime() - startTimestamp.getTime();
    const remaining = Math.max(0, totalDuration - elapsed);
    const progress = Math.min(1, elapsed / totalDuration);

    // SVG Circle Calculation
    const radius = 120;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * progress; // Shrinks as time passes

    // Format Time
    const remainingMinutes = Math.floor(remaining / 1000 / 60);
    const remainingSeconds = Math.floor((remaining / 1000) % 60);

    return (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black/95 text-white backdrop-blur-xl animate-in fade-in duration-300">
            {/* Header */}
            <div className="absolute top-8 flex flex-col items-center gap-2">
                <span className="text-sm font-medium text-white/50 uppercase tracking-widest">Current Block</span>
                <h1 className="text-3xl font-bold">{activeBlock.label}</h1>
                <div className="text-xl text-white/70">{activeBlock.start}:00 - {activeBlock.end}:00</div>
            </div>

            {/* Visual Timer */}
            <div className="relative flex items-center justify-center">
                {/* Background Circle */}
                <svg className="transform -rotate-90 w-80 h-80">
                    <circle
                        cx="160"
                        cy="160"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        className="text-white/10"
                    />
                    {/* Progress Circle (Red Time Timer Style) */}
                    <circle
                        cx="160"
                        cy="160"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="text-rose-500 transition-all duration-1000 ease-linear"
                    />
                </svg>

                {/* Digital Time (Optional, can be hidden for pure visual) */}
                <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-mono font-bold tabular-nums">
                        {remainingMinutes}:{remainingSeconds.toString().padStart(2, '0')}
                    </span>
                    <span className="text-xs text-white/40 mt-1">REMAINING</span>
                </div>
            </div>

            {/* Tasks Preview (Zen Mode) */}
            <div className="mt-12 w-full max-w-md px-6">
                <h3 className="text-sm font-medium text-white/50 mb-4 uppercase tracking-widest text-center">Focus Tasks</h3>
                <div className="space-y-3">
                    {dailyData?.tasks
                        .filter(t => t.timeBlock === activeBlock.id && !t.completed)
                        .slice(0, 3)
                        .map(task => (
                            <div key={task.id} className="flex items-center gap-3 rounded-xl bg-white/10 p-4 border border-white/5">
                                <div className="h-3 w-3 rounded-full border border-white/40" />
                                <span className="text-lg">{task.text}</span>
                            </div>
                        ))
                    }
                    {dailyData?.tasks.filter(t => t.timeBlock === activeBlock.id && !t.completed).length === 0 && (
                        <div className="text-center text-white/30 italic">No pending tasks. You are free!</div>
                    )}
                </div>
            </div>

            {/* Footer Controls */}
            <div className="absolute bottom-12 flex gap-4">
                <button
                    onClick={toggleFocusMode}
                    className="rounded-full border border-white/20 bg-white/10 px-8 py-3 text-sm font-medium hover:bg-white/20 transition-colors"
                >
                    Exit Focus Mode
                </button>
            </div>
        </div>
    );
}

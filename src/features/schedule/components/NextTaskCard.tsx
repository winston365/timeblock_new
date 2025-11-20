/**
 * NextTaskCard - Large focused task card
 * 
 * @role Display recommended task prominently with "Start Now" button
 */

import type { Task } from '@/shared/types/domain';

interface NextTaskCardProps {
    task: Task;
    recommendationMessage: string;
    onEdit: (task: Task) => void;
    onToggle: (taskId: string) => void;
    onStartNow: (task: Task) => void;
}

export function NextTaskCard({
    task,
    recommendationMessage,
    onEdit,
    onToggle,
    onStartNow
}: NextTaskCardProps) {
    const resistanceColors = {
        low: 'text-emerald-500 bg-emerald-500/10',
        medium: 'text-amber-500 bg-amber-500/10',
        high: 'text-rose-500 bg-rose-500/10'
    };

    const resistanceLabels = {
        low: '쉬움',
        medium: '보통',
        high: '어려움'
    };

    const resistanceColor = resistanceColors[task.resistance];
    const resistanceLabel = resistanceLabels[task.resistance];

    return (
        <div className="relative">
            {/* Recommendation message */}
            <div className="mb-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-4">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">💡</span>
                    <div>
                        <div className="text-sm font-medium text-[var(--color-text-secondary)]">혜은이 추천!</div>
                        <div className="text-base text-[var(--color-text-primary)]">{recommendationMessage}</div>
                    </div>
                </div>
            </div>

            {/* Main task card */}
            <div className="group relative overflow-hidden rounded-3xl border-2 border-[var(--color-primary)] bg-[var(--color-bg-surface)] p-8 shadow-lg transition-all hover:shadow-xl">
                {/* Gradient background */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/5 via-transparent to-transparent" />

                <div className="relative space-y-6">
                    {/* Task title with checkbox */}
                    <div className="flex items-start gap-4">
                        <button
                            onClick={() => onToggle(task.id)}
                            className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-primary)] bg-[var(--color-bg-base)] transition-all hover:scale-110 hover:border-[var(--color-primary-light)]"
                            aria-label={task.completed ? '완료 취소' : '완료 표시'}
                        >
                            {task.completed && (
                                <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                        <h2 className="flex-1 text-3xl font-bold text-[var(--color-text-primary)]">
                            {task.text}
                        </h2>
                    </div>

                    {/* Task metadata */}
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Duration */}
                        <div className="flex items-center gap-2 rounded-full bg-[var(--color-bg-tertiary)] px-4 py-2">
                            <span className="text-xl">⏱️</span>
                            <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                                {task.baseDuration}분
                            </span>
                        </div>

                        {/* Difficulty */}
                        <div className={`flex items-center gap-2 rounded-full px-4 py-2 ${resistanceColor}`}>
                            <span className="text-xl">
                                {task.resistance === 'low' ? '🟢' : task.resistance === 'medium' ? '🟡' : '🔴'}
                            </span>
                            <span className="text-lg font-semibold">{resistanceLabel}</span>
                        </div>

                        {/* Hour slot */}
                        {task.hourSlot !== undefined && (
                            <div className="flex items-center gap-2 rounded-full bg-[var(--color-bg-tertiary)] px-4 py-2">
                                <span className="text-xl">⏰</span>
                                <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {task.hourSlot}:00까지
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Memo if exists */}
                    {task.memo && (
                        <div className="rounded-xl bg-[var(--color-bg-tertiary)]/50 p-4">
                            <p className="text-base text-[var(--color-text-secondary)]">{task.memo}</p>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => onStartNow(task)}
                            className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
                        >
                            ⏰ 지금 시작
                        </button>
                        <button
                            onClick={() => onEdit(task)}
                            className="rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-bg-base)] px-6 py-4 text-lg font-semibold text-[var(--color-text-primary)] transition-all hover:border-[var(--color-border-light)] hover:bg-[var(--color-bg-tertiary)]"
                        >
                            ✏️ 수정
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

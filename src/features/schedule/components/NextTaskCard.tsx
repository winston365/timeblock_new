/**
 * @file NextTaskCard.tsx
 * @role 다음 추천 작업 카드 컴포넌트
 * @responsibilities
 *   - 추천 작업을 대형 카드로 표시
 *   - "지금 시작" 버튼 제공
 *   - 작업 메타데이터 (소요시간, 난이도 등) 표시
 * @dependencies
 *   - NeonCheckbox: 체크박스 컴포넌트
 */

import type { Task } from '@/shared/types/domain';
import { NeonCheckbox } from '@/shared/components/ui/NeonCheckbox';

/**
 * NextTaskCard 컴포넌트 Props
 * @param task - 표시할 작업 객체
 * @param recommendationMessage - AI 추천 메시지
 * @param onEdit - 작업 수정 핸들러
 * @param onToggle - 작업 완료 토글 핸들러
 * @param onStartNow - 작업 시작 핸들러
 */
interface NextTaskCardProps {
    task: Task;
    recommendationMessage: string;
    onEdit: (task: Task) => void;
    onToggle: (taskId: string) => void;
    onStartNow: (task: Task) => void;
}

/**
 * 다음 추천 작업 카드 컴포넌트
 * @param props - NextTaskCardProps
 * @returns 추천 작업 카드 UI
 */
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
                        <div className="mt-1">
                            <NeonCheckbox
                                checked={task.completed}
                                onChange={() => onToggle(task.id)}
                                size={32}
                            />
                        </div>
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

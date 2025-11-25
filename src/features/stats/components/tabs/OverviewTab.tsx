/**
 * OverviewTab
 *
 * @role XP 요약 카드, 목표 진행률, 타임블록 요약을 표시하는 Stats 탭
 * @input OverviewTabProps (gameState, weeklyProgress, monthlyProgress 등)
 * @output 요약 대시보드 UI 렌더링
 * @external_dependencies
 *   - TIME_BLOCKS: 타임블록 정의 상수
 */

import { memo } from 'react';
import type { OverviewTabProps, SummaryCardProps, TodayBlockProgressProps } from './types';
import { TIME_BLOCKS } from '@/shared/types/domain';

const BLOCKS_WITH_OTHER = [
    ...TIME_BLOCKS,
    { id: 'other', label: '기타 (23:00 - 05:00)', start: 23, end: 5 },
] as const;

// Summary Card Component
export const SummaryCard = memo(function SummaryCard({ title, value, accent = false }: SummaryCardProps) {
    return (
        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">{title}</span>
            <span className={`mt-2 text-2xl font-bold ${accent ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                {value}
            </span>
        </div>
    );
});

// Today Block Progress Component
export const TodayBlockProgress = memo(function TodayBlockProgress({ blocks }: TodayBlockProgressProps) {
    const entries = BLOCKS_WITH_OTHER.map(block => ({
        ...block,
        xp: blocks?.[block.id] ?? 0,
    }));
    const max = entries.reduce((m, b) => Math.max(m, b.xp), 50);
    const best = entries.reduce((prev, cur) => (cur.xp > prev.xp ? cur : prev), entries[0]);
    const formatter = new Intl.NumberFormat('ko-KR');

    return (
        <div className="space-y-2">
            <div className="text-xs text-[var(--color-text-secondary)]">가장 많은 XP: {best.label} ({formatter.format(best.xp)} XP)</div>
            <div className="space-y-2">
                {entries.map(entry => {
                    const width = max > 0 ? Math.max((entry.xp / max) * 100, 2) : 0;
                    return (
                        <div key={entry.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                                <span>{entry.label}</span>
                                <span className="font-semibold text-[var(--color-text)]">{formatter.format(entry.xp)} XP</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                                <div
                                    className="h-full rounded-full bg-[var(--color-primary)]"
                                    style={{ width: `${width}%` }}
                                    aria-label={`${entry.label} ${entry.xp} XP`}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

// Overview Tab Component
export function OverviewTab({
    gameState,
    weeklyProgress,
    monthlyProgress,
    numberFormatter,
}: OverviewTabProps) {
    return (
        <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard title="오늘 XP" value={numberFormatter.format(gameState.dailyXP)} accent />
                <SummaryCard title="총 누적 XP" value={numberFormatter.format(gameState.totalXP)} />
                <SummaryCard title="사용 가능 XP" value={numberFormatter.format(gameState.availableXP)} />
                <SummaryCard title="연속 달성" value={`${numberFormatter.format(gameState.streak)}일`} />
            </div>

            {/* Goal Progress Cards */}
            {(weeklyProgress || monthlyProgress) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {weeklyProgress && (
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">주간 목표</span>
                                <span className="text-xs font-semibold text-[var(--color-primary)]">{weeklyProgress.percentage}%</span>
                            </div>
                            <div className="text-2xl font-bold text-[var(--color-text)] mb-2">
                                {numberFormatter.format(weeklyProgress.current)} / {numberFormatter.format(weeklyProgress.target)} XP
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-amber-500 transition-all duration-500"
                                    style={{ width: `${Math.min(weeklyProgress.percentage, 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                    {monthlyProgress && (
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">월간 목표</span>
                                <span className="text-xs font-semibold text-[var(--color-success)]">{monthlyProgress.percentage}%</span>
                            </div>
                            <div className="text-2xl font-bold text-[var(--color-text)] mb-2">
                                {numberFormatter.format(monthlyProgress.current)} / {numberFormatter.format(monthlyProgress.target)} XP
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-[var(--color-success)] to-emerald-500 transition-all duration-500"
                                    style={{ width: `${Math.min(monthlyProgress.percentage, 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Today Summary */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm space-y-3">
                <div>
                    <h3 className="text-sm font-semibold">오늘 타임블록 요약</h3>
                    <p className="text-xs text-[var(--color-text-tertiary)]">최대 블록과 진행 상황</p>
                </div>
                <TodayBlockProgress blocks={gameState.timeBlockXP} />
            </div>
        </>
    );
}

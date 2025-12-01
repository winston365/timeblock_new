/**
 * XPAnalysisTab
 *
 * @role XP 추이 차트 및 고급 필터 기능을 제공하는 Stats 탭
 * @input XPAnalysisTabProps (xpHistory, averageXP, 필터 상태 등)
 * @output XP 바 차트, 필터 섹션 UI 렌더링
 * @external_dependencies
 *   - recharts: 차트 라이브러리
 *   - TIME_BLOCKS: 타임블록 정의 상수
 */

import { memo } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { TIME_BLOCKS } from '@/shared/types/domain';
import type { XPAnalysisTabProps, FilterProps } from './types';

const BLOCKS_WITH_OTHER = [
    ...TIME_BLOCKS,
    { id: 'other', label: '기타 (23:00 - 05:00)', start: 23, end: 5 },
] as const;

/**
 * 상태 통계 필터 섹션 컴포넌트
 * @param props - FilterProps
 * @param props.rangeDays - 선택된 기간 (7, 14, 30일)
 * @param props.onRangeDaysChange - 기간 변경 핸들러
 * @param props.includeWeekends - 주말 포함 여부
 * @param props.onIncludeWeekendsChange - 주말 포함 변경 핸들러
 * @param props.todayOnly - 오늘만 보기 여부
 * @param props.onTodayOnlyChange - 오늘만 보기 변경 핸들러
 * @param props.showLastWeekComparison - 지난 주 비교 여부
 * @param props.onShowLastWeekComparisonChange - 지난 주 비교 변경 핸들러
 * @param props.showAdvancedFilters - 고급 필터 표시 여부
 * @param props.onShowAdvancedFiltersToggle - 고급 필터 토글 핸들러
 * @param props.blockVisibility - 블록 표시 여부 맵
 * @param props.onBlockVisibilityChange - 블록 표시 변경 핸들러
 * @returns 필터 섹션 UI 엘리먼트
 */
export const FilterSection = memo(function FilterSection({
    rangeDays,
    onRangeDaysChange,
    includeWeekends,
    onIncludeWeekendsChange,
    todayOnly,
    onTodayOnlyChange,
    showLastWeekComparison,
    onShowLastWeekComparisonChange,
    showAdvancedFilters,
    onShowAdvancedFiltersToggle,
    blockVisibility,
    onBlockVisibilityChange,
}: FilterProps) {
    return (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
                {/* Period Dropdown */}
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--color-text-secondary)]">📅 기간</span>
                    <select
                        value={rangeDays}
                        onChange={(e) => onRangeDaysChange(parseInt(e.target.value) as 7 | 14 | 30)}
                        className="rounded-lg bg-[var(--color-bg-elevated)] px-3 py-1 font-semibold text-[var(--color-text)] border border-[var(--color-border)]"
                    >
                        <option value="7">최근 7일</option>
                        <option value="14">최근 14일</option>
                        <option value="30">최근 30일</option>
                    </select>
                </div>

                {/* Advanced Filters Toggle */}
                <button
                    onClick={onShowAdvancedFiltersToggle}
                    className="ml-auto rounded-lg bg-[var(--color-bg-elevated)] px-3 py-1 font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition"
                >
                    {showAdvancedFilters ? '▲ 고급 필터 숨기기' : '▼ 고급 필터 보기'}
                </button>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeWeekends}
                            onChange={(e) => onIncludeWeekendsChange(e.target.checked)}
                        />
                        <span>주말 포함</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={todayOnly}
                            onChange={(e) => onTodayOnlyChange(e.target.checked)}
                        />
                        <span>오늘만</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showLastWeekComparison}
                            onChange={(e) => onShowLastWeekComparisonChange(e.target.checked)}
                        />
                        <span>지난 주와 비교</span>
                    </label>

                    {/* Block Selection */}
                    <div className="w-full flex flex-wrap items-center gap-2 mt-2">
                        <span className="font-semibold text-[var(--color-text-secondary)]">표시 블록:</span>
                        {BLOCKS_WITH_OTHER.map(block => (
                            <label key={block.id} className="flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-tertiary)] transition">
                                <input
                                    type="checkbox"
                                    checked={blockVisibility[block.id]}
                                    onChange={(e) => onBlockVisibilityChange(block.id, e.target.checked)}
                                    aria-label={`${block.label} 표시`}
                                />
                                <span>{block.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

/**
 * XP 추이 차트 및 고급 필터 기능을 제공하는 탭
 * @param props - XPAnalysisTabProps
 * @param props.xpHistory - 일별 XP 데이터 배열
 * @param props.averageXP - 평균 XP
 * @param props.maxXP - 최대 XP
 * @param props.numberFormatter - 숫자 포맷터
 * @param props.showLastWeekComparison - 지난 주 비교 여부
 * @returns XP 분석 탭 UI 엘리먼트
 */
export function XPAnalysisTab({
    xpHistory,
    averageXP,
    maxXP,
    numberFormatter,
    showLastWeekComparison,
    ...filterProps
}: XPAnalysisTabProps) {
    return (
        <>
            {/* Filters */}
            <FilterSection
                showLastWeekComparison={showLastWeekComparison}
                {...filterProps}
            />

            {/* XP Trend Chart */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold">최근 XP 추이</h3>
                        <p className="text-xs text-[var(--color-text-tertiary)]">어제 대비 흐름과 평균선 확인</p>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">평균 {numberFormatter.format(averageXP)} XP</div>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%" aria-label="최근 XP 차트">
                        <BarChart data={xpHistory} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="date" tickFormatter={d => d.substring(5)} stroke="var(--color-text-tertiary)" />
                            <YAxis stroke="var(--color-text-tertiary)" domain={[0, Math.max(maxXP, averageXP)]} tickFormatter={v => numberFormatter.format(v)} />
                            <Tooltip
                                contentStyle={{ background: 'var(--color-bg-secondary)', border: `1px solid var(--color-border)` }}
                                formatter={(xpValue: number, dataKey: string) => [
                                    `${numberFormatter.format(xpValue)} XP`,
                                    dataKey === 'xp' ? '이번 주' : dataKey === 'lastWeekXP' ? '지난 주' : dataKey
                                ]}
                            />
                            <Legend />
                            <ReferenceLine y={averageXP} stroke="var(--color-primary)" strokeDasharray="4 4" label={{ value: '평균', position: 'insideTop', fill: 'var(--color-primary)' }} />
                            {showLastWeekComparison && (
                                <Bar dataKey="lastWeekXP" name="지난 주 XP" fill="var(--color-text-tertiary)" opacity={0.4} radius={[6, 6, 0, 0]} />
                            )}
                            <Bar dataKey="xp" name="이번 주 XP" fill="var(--color-warning)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </>
    );
}

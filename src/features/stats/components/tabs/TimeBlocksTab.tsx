/**
 * TimeBlocksTab
 *
 * @role 타임블록별 XP 누적 차트 및 분포 파이차트를 제공하는 Stats 탭
 * @input TimeBlocksTabProps (gameState, stackedBlockData, todayBlockPie 등)
 * @output 누적 바 차트, 파이 차트, 오늘 요약 UI 렌더링
 * @external_dependencies
 *   - recharts: 차트 라이브러리
 *   - TIME_BLOCKS: 타임블록 정의 상수
 *   - chartColors: 블록 색상 유틸리티
 */

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { getBlockColor } from '../../utils/chartColors';
import type { TimeBlocksTabProps } from './types';
import { FilterSection } from './XPAnalysisTab';
import { TodayBlockProgress } from './OverviewTab';

const BLOCKS_WITH_OTHER = [
    ...TIME_BLOCKS,
    { id: 'other', label: '기타 (23:00 - 05:00)', start: 23, end: 5 },
] as const;

/**
 * 타임블록별 XP 누적 차트 및 분포 파이차트를 제공하는 탭
 * @param props - TimeBlocksTabProps
 * @param props.gameState - 게임 상태
 * @param props.stackedBlockData - 누적 차트 데이터
 * @param props.todayBlockPie - 오늘 파이차트 데이터
 * @param props.todayXP - 오늘 XP
 * @param props.todayBlockSum - 오늘 블록별 XP 합계
 * @param props.xpMismatch - XP 불일치 여부
 * @param props.numberFormatter - 숫자 포맷터
 * @param props.blockVisibility - 블록 표시 여부 맵
 * @returns TimeBlocks 탭 UI 엘리먼트
 */
export function TimeBlocksTab({
    gameState,
    stackedBlockData,
    todayBlockPie,
    todayXP,
    todayBlockSum,
    xpMismatch,
    numberFormatter,
    blockVisibility,
    ...filterProps
}: TimeBlocksTabProps) {
    return (
        <>
            {/* Filters */}
            <FilterSection
                blockVisibility={blockVisibility}
                {...filterProps}
            />

            {/* Stacked Block Chart */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold">타임블록별 XP (누적)</h3>
                        <p className="text-xs text-[var(--color-text-tertiary)]">블록 기여도를 누적으로 확인</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${xpMismatch ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
                        합계 {numberFormatter.format(todayBlockSum)} XP / 오늘 XP {numberFormatter.format(todayXP)}
                    </span>
                </div>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%" aria-label="타임블록별 XP 누적 차트">
                        <BarChart data={stackedBlockData} stackOffset="none" margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="date" tickFormatter={d => d.substring(5)} stroke="var(--color-text-tertiary)" />
                            <YAxis stroke="var(--color-text-tertiary)" tickFormatter={v => numberFormatter.format(v)} />
                            <Tooltip
                                contentStyle={{ background: 'var(--color-bg-secondary)', border: `1px solid var(--color-border)` }}
                                formatter={(xpValue: number, blockName: string) => [`${numberFormatter.format(xpValue)} XP`, blockName]}
                            />
                            <Legend />
                            {BLOCKS_WITH_OTHER.filter(b => blockVisibility[b.id]).map((block) => (
                                <Bar
                                    key={block.id}
                                    dataKey={block.id}
                                    name={block.label}
                                    stackId="timeblocks"
                                    fill={getBlockColor(block.id)}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Block Distribution Pie Chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
                    <div className="mb-3">
                        <h3 className="text-sm font-semibold">오늘 타임블록 분포</h3>
                        <p className="text-xs text-[var(--color-text-tertiary)]">블록별 XP 비중</p>
                    </div>
                    <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%" aria-label="오늘 타임블록 분포 파이차트">
                            <PieChart>
                                <Pie
                                    dataKey="value"
                                    data={todayBlockPie}
                                    innerRadius="45%"
                                    outerRadius="70%"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {todayBlockPie.map((entry) => (
                                        <Cell key={`cell-${entry.name}`} fill={getBlockColor(entry.id)} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-bg-secondary)', border: `1px solid var(--color-border)` }}
                                    formatter={(xpValue: number, blockName: string) => [`${numberFormatter.format(xpValue)} XP`, blockName]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm space-y-3">
                    <div>
                        <h3 className="text-sm font-semibold">오늘 요약</h3>
                        <p className="text-xs text-[var(--color-text-tertiary)]">최대 블록과 남은 목표</p>
                    </div>
                    <TodayBlockProgress blocks={gameState.timeBlockXP} />
                </div>
            </div>
        </>
    );
}

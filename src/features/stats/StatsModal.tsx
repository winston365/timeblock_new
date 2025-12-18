/**
 * @file StatsModal.tsx
 * @role 통계 대시보드 모달 컴포넌트
 * @responsibilities
 *   - XP 히스토리 및 타임블록 데이터 집계
 *   - 탭 기반 UI (개요, XP 분석, 타임블록, 인사이트)
 *   - AI 인사이트 생성 및 캐싱
 *   - 필터링 옵션 (기간, 주말 포함, 지난주 비교 등)
 * @dependencies useGameState, useCompletedTasksStore, useSettingsStore, Gemini API, aiInsightsRepository
 */

import { TIME_BLOCKS } from '@/shared/types/domain';
import { getLocalDate, calculateTaskXP, getBlockIdFromHour } from '@/shared/lib/utils';
import { useGameState } from '@/shared/hooks/useGameState';
import { useCompletedTasksStore } from '@/shared/stores/completedTasksStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { callGeminiAPI } from '@/shared/services/ai/geminiApi';
import { trackTokenUsage } from '@/shared/utils/tokenUtils';
import { getAIInsight, saveAIInsight } from '@/data/repositories/aiInsightsRepository';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
    OverviewTab,
    XPAnalysisTab,
    TimeBlocksTab,
    InsightsTab,
    type XPHistoryEntry,
    type GoalProgress,
} from './components/tabs';
import CompletedTab from '@/features/tasks/CompletedTab';
import { useModalEscapeClose } from '@/shared/hooks';

interface StatsModalProps {
    open: boolean;
    onClose: () => void;
}

const BLOCKS_WITH_OTHER = [
    ...TIME_BLOCKS,
    { id: 'other', label: '기타 (23:00 - 05:00)', start: 23, end: 5 },
] as const;

/**
 * 통계 대시보드 모달 컴포넌트
 * 상세 XP 분석, 타임블록 성과, AI 인사이트를 제공합니다.
 * @param {StatsModalProps} props - 모달 속성
 * @param {boolean} props.open - 모달 열림 상태
 * @param {Function} props.onClose - 닫기 콜백 함수
 * @returns {JSX.Element | null} 통계 모달 UI 또는 null
 */
export function StatsModal({ open, onClose }: StatsModalProps) {
    const { gameState, loading } = useGameState();
    const { completedTasks, loadData: loadCompletedTasks } = useCompletedTasksStore();
    const { settings } = useSettingsStore();
    useModalEscapeClose(open, onClose);

    // Tab state
    const [activeTab, setActiveTab] = useState<'overview' | 'xp' | 'blocks' | 'completed' | 'insights'>('overview');

    // Filter states
    const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);
    const [includeWeekends, setIncludeWeekends] = useState(true);
    const [todayOnly, setTodayOnly] = useState(false);
    const [showLastWeekComparison, setShowLastWeekComparison] = useState(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [blockVisibility, setBlockVisibility] = useState<Record<string, boolean>>(
        () => BLOCKS_WITH_OTHER.reduce((acc, b) => ({ ...acc, [b.id]: true }), {} as Record<string, boolean>)
    );

    // AI Insight state
    const [insight, setInsight] = useState<string | null>(null);
    const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
    const [insightError, setInsightError] = useState<string | null>(null);

    const numberFormatter = useMemo(() => new Intl.NumberFormat('ko-KR'), []);

    // Callback handlers for performance
    const handleRangeDaysChange = useCallback((days: 7 | 14 | 30) => {
        setRangeDays(days);
        setTodayOnly(false);
    }, []);

    const handleIncludeWeekendsChange = useCallback((include: boolean) => {
        setIncludeWeekends(include);
    }, []);

    const handleTodayOnlyChange = useCallback((only: boolean) => {
        setTodayOnly(only);
    }, []);

    const handleShowLastWeekComparisonChange = useCallback((show: boolean) => {
        setShowLastWeekComparison(show);
    }, []);

    const handleShowAdvancedFiltersToggle = useCallback(() => {
        setShowAdvancedFilters(prev => !prev);
    }, []);

    const handleBlockVisibilityChange = useCallback((blockId: string, visible: boolean) => {
        setBlockVisibility(prev => ({ ...prev, [blockId]: visible }));
    }, []);

    const handleTabChange = useCallback((tab: 'overview' | 'xp' | 'blocks' | 'completed' | 'insights') => {
        setActiveTab(tab);
    }, []);

    useEffect(() => {
        if (open) {
            loadCompletedTasks(30).catch(console.error);
        }
    }, [open, loadCompletedTasks]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const tabs: Array<'overview' | 'xp' | 'blocks' | 'completed' | 'insights'> = ['overview', 'xp', 'blocks', 'completed', 'insights'];
                const currentIndex = tabs.indexOf(activeTab);

                if (e.shiftKey) {
                    const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
                    handleTabChange(tabs[prevIndex]);
                } else {
                    const nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
                    handleTabChange(tabs[nextIndex]);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, activeTab, handleTabChange]);

    const today = getLocalDate();
    const todayXP = gameState?.dailyXP ?? 0;

    // Load insight from aiInsightsRepository
    useEffect(() => {
        if (activeTab === 'insights' && open) {
            const loadInsight = async () => {
                try {
                    const savedInsight = await getAIInsight(today);
                    if (savedInsight) {
                        setInsight(savedInsight.content);
                    }
                } catch (error) {
                    console.error('Failed to load insight:', error);
                }
            };
            loadInsight();
        }
    }, [activeTab, open, today]);

    // Completed tasks aggregation
    const completedAgg = useMemo(() => {
        const map = new Map<string, { xp: number; blocks: Record<string, number> }>();
        completedTasks.forEach(task => {
            if (!task.completedAt) return;
            const date = task.completedAt.slice(0, 10);
            const xp = calculateTaskXP(task);
            const prev = map.get(date) ?? { xp: 0, blocks: {} };
            prev.xp += xp;
            const hour = new Date(task.completedAt).getHours();
            const blockId = getBlockIdFromHour(hour);
            prev.blocks[blockId] = (prev.blocks[blockId] ?? 0) + xp;
            map.set(date, prev);
        });
        return map;
    }, [completedTasks]);

    // XP History calculation
    const xpHistory: XPHistoryEntry[] = useMemo(() => {
        const raw = gameState?.xpHistory ?? [];
        const map = new Map<string, number>();
        raw.forEach(entry => map.set(entry.date, entry.xp));
        completedAgg.forEach((value, date) => {
            if (!map.has(date) || (map.get(date) ?? 0) === 0) {
                map.set(date, value.xp);
            }
        });
        const todayValue = Math.max(map.get(today) ?? 0, todayXP);
        map.set(today, todayValue);

        let arr = Array.from(map.entries())
            .map(([date, xp]) => ({ date, xp }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (!includeWeekends) {
            arr = arr.filter(item => {
                const day = new Date(item.date).getDay();
                return day !== 0 && day !== 6;
            });
        }

        if (todayOnly) {
            arr = arr.filter(item => item.date === today);
        }

        const sliced = arr.slice(-rangeDays);

        if (showLastWeekComparison) {
            return sliced.map(entry => {
                const entryDate = new Date(entry.date);
                const lastWeekDate = new Date(entryDate);
                lastWeekDate.setDate(lastWeekDate.getDate() - 7);
                const lastWeekDateStr = lastWeekDate.toISOString().slice(0, 10);
                const lastWeekXP = map.get(lastWeekDateStr) ?? 0;
                return { ...entry, lastWeekXP };
            });
        }

        return sliced;
    }, [gameState?.xpHistory, completedAgg, today, todayXP, includeWeekends, todayOnly, rangeDays, showLastWeekComparison]);

    // Stacked block data
    const stackedBlockData = useMemo(() => {
        const history = gameState?.timeBlockXPHistory ?? [];
        const map = new Map<string, Record<string, number>>();
        history.forEach(entry => {
            map.set(entry.date, { ...entry.blocks });
        });
        completedAgg.forEach((value, date) => {
            const current = map.get(date) ?? {};
            const merged = { ...current };
            Object.entries(value.blocks).forEach(([blockId, xp]) => {
                merged[blockId] = (merged[blockId] ?? 0) + xp;
            });
            map.set(date, merged);
        });
        const todayBlocks = gameState?.timeBlockXP ?? {};
        map.set(today, { ...(map.get(today) ?? {}), ...todayBlocks });

        let arr = Array.from(map.entries())
            .map(([date, blocks]) => ({ date, blocks }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-(todayOnly ? 1 : Math.min(rangeDays, 30)));

        if (!includeWeekends) {
            arr = arr.filter(item => {
                const day = new Date(item.date).getDay();
                return day !== 0 && day !== 6;
            });
        }

        if (todayOnly) {
            arr = arr.filter(item => item.date === today);
        }

        return arr.map(entry => {
            const blockXPRow: Record<string, string | number> = { date: entry.date };
            BLOCKS_WITH_OTHER.forEach(block => {
                blockXPRow[block.id] = entry.blocks?.[block.id] ?? 0;
            });
            return blockXPRow;
        });
    }, [gameState?.timeBlockXPHistory, gameState?.timeBlockXP, completedAgg, today, includeWeekends, todayOnly, rangeDays]);

    // Today block pie chart data
    const todayBlockPie = useMemo(() => {
        const fallbackBlocks = completedAgg.get(today)?.blocks ?? {};
        const blocks = Object.keys(gameState?.timeBlockXP ?? {}).length ? gameState?.timeBlockXP ?? {} : fallbackBlocks;
        const data = BLOCKS_WITH_OTHER.map(block => ({
            id: block.id,
            name: block.label,
            value: blocks[block.id] ?? 0,
        }))
            .filter(d => d.value > 0)
            .filter(d => blockVisibility[d.id]);
        return data.length ? data : [{ id: 'none', name: '데이터 없음', value: 1 }];
    }, [gameState?.timeBlockXP, completedAgg, today, blockVisibility]);

    // Statistics
    const maxXP = xpHistory.reduce((m, v) => Math.max(m, v.xp), 100);
    const averageXP = xpHistory.length ? Math.round(xpHistory.reduce((s, v) => s + v.xp, 0) / xpHistory.length) : 0;
    const todayBlockSum = useMemo(() => {
        const blocks = gameState?.timeBlockXP ?? {};
        return Object.values(blocks).reduce((s, v) => s + (v ?? 0), 0);
    }, [gameState?.timeBlockXP]);
    const xpMismatch = todayBlockSum !== todayXP;

    // Goal progress calculations
    const weeklyProgress: GoalProgress | null = useMemo(() => {
        if (!settings?.weeklyXPGoal) return null;
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekStartStr = weekStart.toISOString().slice(0, 10);

        const weekXP = xpHistory
            .filter(entry => entry.date >= weekStartStr)
            .reduce((sum, entry) => sum + entry.xp, 0);

        return {
            current: weekXP,
            target: settings.weeklyXPGoal,
            percentage: Math.round((weekXP / settings.weeklyXPGoal) * 100)
        };
    }, [xpHistory, settings?.weeklyXPGoal, today]);

    const monthlyProgress: GoalProgress | null = useMemo(() => {
        if (!settings?.monthlyXPGoal) return null;
        const monthStart = today.slice(0, 8) + '01';

        const monthXP = xpHistory
            .filter(entry => entry.date >= monthStart)
            .reduce((sum, entry) => sum + entry.xp, 0);

        return {
            current: monthXP,
            target: settings.monthlyXPGoal,
            percentage: Math.round((monthXP / settings.monthlyXPGoal) * 100)
        };
    }, [xpHistory, settings?.monthlyXPGoal, today]);

    // Generate AI Insight
    const generateInsight = useCallback(async () => {
        if (!settings?.geminiApiKey) {
            setInsightError('Gemini API 키가 설정되지 않았습니다. 설정에서 키를 입력해주세요.');
            return;
        }

        setIsGeneratingInsight(true);
        setInsightError(null);

        try {
            const recentXP = xpHistory.slice(-7).map(entry => `${entry.date}: ${entry.xp} XP`).join('\n');
            const timeBlockData = stackedBlockData.slice(-7).map(entry => {
                const blocks = Object.entries(entry)
                    .filter(([k, v]) => k !== 'date' && typeof v === 'number' && v > 0)
                    .map(([k, v]) => {
                        const blockLabel = BLOCKS_WITH_OTHER.find(b => b.id === k)?.label || k;
                        return `${blockLabel}: ${v} XP`;
                    })
                    .join(', ');
                return `${entry.date}: ${blocks}`;
            }).join('\n');

            const prompt = `
                당신은 사용자의 생산성 향상을 돕는 AI 코치입니다.
                다음은 사용자의 최근 7일간의 XP(경험치) 획득 기록과 시간대별 활동 내역입니다.
                
                [일별 XP 기록]
                ${recentXP}
                
                [일별 시간대별 활동 내역]
                ${timeBlockData}
                
                이 데이터를 분석하여 다음 내용을 포함한 인사이트를 제공해주세요:
                1. 전반적인 주간 성과 요약
                2. 가장 생산적인 시간대와 요일 패턴 분석
                3. 개선이 필요한 부분 식별
                4. 다음 주를 위한 구체적인 조언 2-3가지
                
                응답은 마크다운 형식을 사용하지 말고, 가독성 좋은 일반 텍스트로 작성해주세요.
                이모지를 적절히 사용하여 친근하고 격려하는 톤으로 작성해주세요.
            `;

            const { text, tokenUsage } = await callGeminiAPI(prompt, [], settings.geminiApiKey, settings.geminiModel);
            setInsight(text);
            trackTokenUsage(tokenUsage);

            try {
                await saveAIInsight(today, text);
            } catch (error) {
                console.error('Failed to save insight:', error);
            }
        } catch (error) {
            console.error('Failed to generate insight:', error);
            setInsightError('인사이트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsGeneratingInsight(false);
        }
    }, [xpHistory, stackedBlockData, settings?.geminiApiKey, settings?.geminiModel, today]);

    if (!open) return null;

    // Filter props shared between tabs
    const filterProps = {
        rangeDays,
        onRangeDaysChange: handleRangeDaysChange,
        includeWeekends,
        onIncludeWeekendsChange: handleIncludeWeekendsChange,
        todayOnly,
        onTodayOnlyChange: handleTodayOnlyChange,
        showLastWeekComparison,
        onShowLastWeekComparisonChange: handleShowLastWeekComparisonChange,
        showAdvancedFilters,
        onShowAdvancedFiltersToggle: handleShowAdvancedFiltersToggle,
        blockVisibility,
        onBlockVisibilityChange: handleBlockVisibilityChange,
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4 py-6">
            <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-[var(--color-bg-secondary)] text-[var(--color-text)] shadow-2xl">
                {/* Header with tabs */}
                <header className="border-b border-[var(--color-border)]">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div>
                            <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Insights</div>
                            <h2 className="text-xl font-bold">통계 대시보드</h2>
                            <p className="text-xs text-[var(--color-text-secondary)]">최근 흐름과 타임블록 성과를 한눈에 확인하세요.</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg bg-[var(--color-bg-tertiary)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition"
                            aria-label="닫기"
                        >
                            닫기
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-2 px-6 pb-3">
                        {(['overview', 'xp', 'blocks', 'completed', 'insights'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === tab
                                    ? 'bg-[var(--color-primary)] text-white shadow-md'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                                    }`}
                            >
                                {tab === 'overview' && '📊 개요'}
                                {tab === 'xp' && '📈 XP 분석'}
                                {tab === 'blocks' && '⏰ 타임블록'}
                                {tab === 'completed' && '✅ 완료'}
                                {tab === 'insights' && '💡 인사이트'}
                            </button>
                        ))}
                    </div>
                </header>

                {/* Content */}
                {loading || !gameState ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-text-secondary)]">
                        불러오는 중...
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                        {activeTab === 'overview' && (
                            <OverviewTab
                                gameState={gameState}
                                weeklyProgress={weeklyProgress}
                                monthlyProgress={monthlyProgress}
                                numberFormatter={numberFormatter}
                            />
                        )}

                        {activeTab === 'xp' && (
                            <XPAnalysisTab
                                xpHistory={xpHistory}
                                averageXP={averageXP}
                                maxXP={maxXP}
                                numberFormatter={numberFormatter}
                                {...filterProps}
                            />
                        )}

                        {activeTab === 'blocks' && (
                            <TimeBlocksTab
                                gameState={gameState}
                                stackedBlockData={stackedBlockData}
                                todayBlockPie={todayBlockPie}
                                todayXP={todayXP}
                                todayBlockSum={todayBlockSum}
                                xpMismatch={xpMismatch}
                                numberFormatter={numberFormatter}
                                {...filterProps}
                            />
                        )}

                        {activeTab === 'completed' && (
                            <div className="h-full min-h-[400px]">
                                <CompletedTab />
                            </div>
                        )}

                        {activeTab === 'insights' && (
                            <InsightsTab
                                insight={insight}
                                isGeneratingInsight={isGeneratingInsight}
                                insightError={insightError}
                                onGenerateInsight={generateInsight}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

import type { GameState } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { useGameState } from '@/shared/hooks/useGameState';
import { calculateTaskXP } from '@/shared/lib/utils';
import { useCompletedTasksStore } from '@/shared/stores/completedTasksStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { callGeminiAPI } from '@/shared/services/ai/geminiApi';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';
import { db } from '@/data/db/dexieClient';
import { getBlockColor } from './utils/chartColors';
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
  ReferenceLine,
} from 'recharts';
import { useEffect, useMemo, useState, useCallback, memo } from 'react';

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
}

type XPHistoryEntry = { date: string; xp: number; lastWeekXP?: number };

const BLOCKS_WITH_OTHER = [
  ...TIME_BLOCKS,
  { id: 'other', label: '기타 (23:00 - 05:00)', start: 23, end: 5 },
] as const;

function getBlockIdFromHourLocal(hour: number): string {
  if (hour >= 5 && hour < 8) return '5-8';
  if (hour >= 8 && hour < 11) return '8-11';
  if (hour >= 11 && hour < 14) return '11-14';
  if (hour >= 14 && hour < 17) return '14-17';
  if (hour >= 17 && hour < 20) return '17-20';
  if (hour >= 20 && hour < 23) return '20-23';
  return 'other';
}

export function StatsModal({ open, onClose }: StatsModalProps) {
  const { gameState, loading } = useGameState();
  const { completedTasks, loadData: loadCompletedTasks, loading: completedLoading } = useCompletedTasksStore();
  const { settings } = useSettingsStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'xp' | 'blocks' | 'insights'>('overview');

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

  const handleTabChange = useCallback((tab: 'overview' | 'xp' | 'blocks' | 'insights') => {
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
      // Esc: Close modal
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Tab / Shift+Tab: Navigate tabs
      if (e.key === 'Tab') {
        e.preventDefault();
        const tabs: Array<'overview' | 'xp' | 'blocks' | 'insights'> = ['overview', 'xp', 'blocks', 'insights'];
        const currentIndex = tabs.indexOf(activeTab);

        if (e.shiftKey) {
          // Shift+Tab: Previous tab
          const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
          handleTabChange(tabs[prevIndex]);
        } else {
          // Tab: Next tab
          const nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
          handleTabChange(tabs[nextIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, activeTab, handleTabChange, onClose]);

  const today = getLocalDate();
  const todayXP = gameState?.dailyXP ?? 0;

  // Load insight from DB
  useEffect(() => {
    if (activeTab === 'insights' && open) {
      const loadInsight = async () => {
        try {
          const savedInsight = await db.aiInsights.get(today);
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
      const blockId = getBlockIdFromHourLocal(hour);
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

    // Add last week data for comparison
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
      const row: Record<string, any> = { date: entry.date };
      BLOCKS_WITH_OTHER.forEach(block => {
        row[block.id] = entry.blocks?.[block.id] ?? 0;
      });
      return row;
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
  const weeklyProgress = useMemo(() => {
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

  const monthlyProgress = useMemo(() => {
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
      // Prepare data
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

      if (tokenUsage) {
        addTokenUsage(tokenUsage.promptTokens, tokenUsage.candidatesTokens).catch(console.error);
      }

      // Save to DB
      try {
        await db.aiInsights.put({
          date: today,
          content: text,
          createdAt: new Date().toISOString()
        });
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
            <button
              onClick={() => handleTabChange('overview')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === 'overview'
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                }`}
            >
              📊 개요
            </button>
            <button
              onClick={() => handleTabChange('xp')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === 'xp'
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                }`}
            >
              📈 XP 분석
            </button>
            <button
              onClick={() => handleTabChange('blocks')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === 'blocks'
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                }`}
            >
              ⏰ 타임블록
            </button>
            <button
              onClick={() => handleTabChange('insights')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === 'insights'
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
                }`}
            >
              💡 인사이트
            </button>
          </div>
        </header>

        {/* Content */}
        {loading || completedLoading || !gameState ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-text-secondary)]">
            불러오는 중...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
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
            )}

            {/* XP Analysis Tab */}
            {activeTab === 'xp' && (
              <>
                {/* Filters */}
                <FilterSection
                  rangeDays={rangeDays}
                  onRangeDaysChange={handleRangeDaysChange}
                  includeWeekends={includeWeekends}
                  onIncludeWeekendsChange={handleIncludeWeekendsChange}
                  todayOnly={todayOnly}
                  onTodayOnlyChange={handleTodayOnlyChange}
                  showLastWeekComparison={showLastWeekComparison}
                  onShowLastWeekComparisonChange={handleShowLastWeekComparisonChange}
                  showAdvancedFilters={showAdvancedFilters}
                  onShowAdvancedFiltersToggle={handleShowAdvancedFiltersToggle}
                  blockVisibility={blockVisibility}
                  onBlockVisibilityChange={handleBlockVisibilityChange}
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
                          formatter={(value: any, name: any) => [
                            `${numberFormatter.format(value as number)} XP`,
                            name === 'xp' ? '이번 주' : name === 'lastWeekXP' ? '지난 주' : name
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
            )}

            {/* Time Blocks Tab */}
            {activeTab === 'blocks' && (
              <>
                {/* Filters */}
                <FilterSection
                  rangeDays={rangeDays}
                  onRangeDaysChange={handleRangeDaysChange}
                  includeWeekends={includeWeekends}
                  onIncludeWeekendsChange={handleIncludeWeekendsChange}
                  todayOnly={todayOnly}
                  onTodayOnlyChange={handleTodayOnlyChange}
                  showLastWeekComparison={showLastWeekComparison}
                  onShowLastWeekComparisonChange={handleShowLastWeekComparisonChange}
                  showAdvancedFilters={showAdvancedFilters}
                  onShowAdvancedFiltersToggle={handleShowAdvancedFiltersToggle}
                  blockVisibility={blockVisibility}
                  onBlockVisibilityChange={handleBlockVisibilityChange}
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
                          formatter={(value: any, name: any) => [`${numberFormatter.format(value as number)} XP`, name]}
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
                            formatter={(value: any, name: any) => [`${numberFormatter.format(value as number)} XP`, name]}
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
            )}

            {/* Insights Tab */}
            {activeTab === 'insights' && (
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                <div className="text-6xl animate-bounce">💡</div>
                <h3 className="text-2xl font-bold">AI 인사이트</h3>

                {!insight && !isGeneratingInsight && (
                  <div className="text-center space-y-4 max-w-md">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      최근 활동 데이터를 분석하여<br />
                      맞춤형 생산성 인사이트와 조언을 제공합니다.
                    </p>
                    <button
                      onClick={generateInsight}
                      className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg hover:bg-opacity-90 transition transform hover:scale-105"
                    >
                      ✨ 인사이트 생성하기
                    </button>
                    {insightError && (
                      <p className="text-sm text-[var(--color-warning)]">{insightError}</p>
                    )}
                  </div>
                )}

                {isGeneratingInsight && (
                  <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      데이터를 분석하고 있습니다...<br />
                      잠시만 기다려주세요.
                    </p>
                  </div>
                )}

                {insight && !isGeneratingInsight && (
                  <div className="w-full max-w-3xl space-y-4">
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-sm">
                      <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap leading-relaxed text-[var(--color-text)]">
                        {insight}
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={generateInsight}
                        className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition flex items-center gap-2"
                      >
                        🔄 다시 생성하기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Filter Section Component (Memoized for performance)
interface FilterSectionProps {
  rangeDays: 7 | 14 | 30;
  onRangeDaysChange: (days: 7 | 14 | 30) => void;
  includeWeekends: boolean;
  onIncludeWeekendsChange: (include: boolean) => void;
  todayOnly: boolean;
  onTodayOnlyChange: (only: boolean) => void;
  showLastWeekComparison: boolean;
  onShowLastWeekComparisonChange: (show: boolean) => void;
  showAdvancedFilters: boolean;
  onShowAdvancedFiltersToggle: () => void;
  blockVisibility: Record<string, boolean>;
  onBlockVisibilityChange: (blockId: string, visible: boolean) => void;
}

const FilterSection = memo(function FilterSection({
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
}: FilterSectionProps) {
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

// Summary Card Component (Memoized)
const SummaryCard = memo(function SummaryCard({ title, value, accent = false }: { title: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
      <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">{title}</span>
      <span className={`mt-2 text-2xl font-bold ${accent ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
        {value}
      </span>
    </div>
  );
});

// Today Block Progress Component (Memoized)
const TodayBlockProgress = memo(function TodayBlockProgress({ blocks }: { blocks: GameState['timeBlockXP'] }) {
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

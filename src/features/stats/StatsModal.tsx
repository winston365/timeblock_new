import type { GameState } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { useGameState } from '@/shared/hooks/useGameState';
import { calculateTaskXP } from '@/shared/lib/utils';
import { useCompletedTasksStore } from '@/shared/stores/completedTasksStore';
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
import { useEffect, useMemo } from 'react';

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
}

type XPHistoryEntry = { date: string; xp: number };
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

  useEffect(() => {
    if (open) {
      loadCompletedTasks(30).catch(console.error);
    }
  }, [open, loadCompletedTasks]);

  const today = getLocalDate();
  const todayXP = gameState?.dailyXP ?? 0;
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
    const arr = Array.from(map.entries())
      .map(([date, xp]) => ({ date, xp }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return arr.slice(-14);
  }, [gameState?.xpHistory, completedAgg, today, todayXP]);

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

    const arr = Array.from(map.entries())
      .map(([date, blocks]) => ({ date, blocks }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10);

    return arr.map(entry => {
      const row: Record<string, any> = { date: entry.date };
      BLOCKS_WITH_OTHER.forEach(block => {
        row[block.id] = entry.blocks?.[block.id] ?? 0;
      });
      return row;
    });
  }, [gameState?.timeBlockXPHistory, gameState?.timeBlockXP, completedAgg, today]);

  const todayBlockPie = useMemo(() => {
    const fallbackBlocks = completedAgg.get(today)?.blocks ?? {};
    const blocks = Object.keys(gameState?.timeBlockXP ?? {}).length ? gameState?.timeBlockXP ?? {} : fallbackBlocks;
    const data = BLOCKS_WITH_OTHER.map(block => ({
      name: block.label,
      value: blocks[block.id] ?? 0,
    })).filter(d => d.value > 0);
    return data.length ? data : [{ name: '데이터 없음', value: 1 }];
  }, [gameState?.timeBlockXP, completedAgg, today]);

  const maxXP = xpHistory.reduce((m, v) => Math.max(m, v.xp), 100);
  const averageXP = xpHistory.length ? Math.round(xpHistory.reduce((s, v) => s + v.xp, 0) / xpHistory.length) : 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-[var(--color-bg-secondary)] text-[var(--color-text)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
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
        </header>

        {loading || completedLoading || !gameState ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-text-secondary)]">
            불러오는 중...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard title="오늘 XP" value={gameState.dailyXP} accent />
              <SummaryCard title="총 누적 XP" value={gameState.totalXP} />
              <SummaryCard title="사용 가능 XP" value={gameState.availableXP} />
              <SummaryCard title="연속 달성" value={`${gameState.streak}일`} />
            </div>

            {/* XP Trend */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">최근 XP 추이 (최대 14일)</h3>
                  <p className="text-xs text-[var(--color-text-tertiary)]">어제 대비 흐름과 평균선 확인</p>
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">평균 {averageXP} XP</div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={xpHistory} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" tickFormatter={d => d.substring(5)} stroke="var(--color-text-tertiary)" />
                    <YAxis stroke="var(--color-text-tertiary)" domain={[0, Math.max(maxXP, averageXP)]} />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-secondary)', border: `1px solid var(--color-border)` }} />
                    <Legend />
                    <ReferenceLine y={averageXP} stroke="var(--color-primary)" strokeDasharray="4 4" label={{ value: '평균', position: 'insideTop', fill: 'var(--color-primary)' }} />
                    <Bar dataKey="xp" name="XP" fill="var(--color-warning)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Time block stacked */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">타임블록별 XP (최근)</h3>
                <p className="text-xs text-[var(--color-text-tertiary)]">블록 기여도를 누적으로 확인</p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stackedBlockData} stackOffset="none" margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" tickFormatter={d => d.substring(5)} stroke="var(--color-text-tertiary)" />
                    <YAxis stroke="var(--color-text-tertiary)" />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-secondary)', border: `1px solid var(--color-border)` }} />
                    <Legend />
                    {BLOCKS_WITH_OTHER.map((block, idx) => (
                      <Bar
                        key={block.id}
                        dataKey={block.id}
                        name={block.label}
                        stackId="timeblocks"
                        fill={`hsl(${(idx * 45) % 360}deg 70% 55%)`}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Today distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold">오늘 타임블록 분포</h3>
                  <p className="text-xs text-[var(--color-text-tertiary)]">블록별 XP 비중</p>
                </div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        dataKey="value"
                        data={todayBlockPie}
                        innerRadius="45%"
                        outerRadius="70%"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {todayBlockPie.map((entry, index) => (
                          <Cell key={`cell-${entry.name}`} fill={`hsl(${(index * 60) % 360}deg 70% 55%)`} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--color-bg-secondary)', border: `1px solid var(--color-border)` }} />
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
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, accent = false }: { title: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm">
      <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">{title}</span>
      <span className={`mt-2 text-2xl font-bold ${accent ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
        {value}
      </span>
    </div>
  );
}

function TodayBlockProgress({ blocks }: { blocks: GameState['timeBlockXP'] }) {
  const entries = BLOCKS_WITH_OTHER.map(block => ({
    ...block,
    xp: blocks?.[block.id] ?? 0,
  }));
  const max = entries.reduce((m, b) => Math.max(m, b.xp), 50);
  const best = entries.reduce((prev, cur) => (cur.xp > prev.xp ? cur : prev), entries[0]);

  return (
    <div className="space-y-2">
      <div className="text-xs text-[var(--color-text-secondary)]">가장 많은 XP: {best.label} ({best.xp} XP)</div>
      <div className="space-y-2">
        {entries.map(entry => {
          const width = max > 0 ? Math.max((entry.xp / max) * 100, 2) : 0;
          return (
            <div key={entry.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                <span>{entry.label}</span>
                <span className="font-semibold text-[var(--color-text)]">{entry.xp} XP</span>
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
}

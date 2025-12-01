/**
 * @file EnergyTab.tsx
 * @role 에너지 레벨 기록 및 시각화 탭 컴포넌트
 * @input 없음 (useEnergy 훅에서 데이터 로드)
 * @output 에너지 입력 폼, 상태 카드, 라인 차트, 히트맵, 기록 목록 UI
 * @dependencies useEnergy 훅, EnergyLevel 타입
 */

import { useState, useMemo } from 'react';
import { useEnergy } from '@/features/energy/hooks/useEnergy';

const ACTIVITY_OPTIONS = [
  { value: '', label: '선택 없음' },
  { value: '사무 업무', label: '사무 업무' },
  { value: '미팅/회의', label: '미팅/회의' },
  { value: '운동 활동', label: '운동 활동' },
  { value: '식사/휴식', label: '식사/휴식' },
  { value: '딥 워크', label: '딥 워크' },
  { value: '창의 작업', label: '창의 작업' },
  { value: '이동/통근', label: '이동/통근' },
  { value: '학습', label: '학습' },
  { value: '수면', label: '수면' },
];

const TIME_BLOCKS = ['5-8', '8-11', '11-14', '14-17', '17-19', '19-24'];

/**
 * 에너지 탭 메인 컴포넌트
 * 사용자의 에너지 레벨을 시간대별로 기록하고 시각화합니다.
 *
 * @returns {JSX.Element} 에너지 탭 UI
 */
export default function EnergyTab() {
  const {
    energyLevels,
    loading,
    currentEnergy,
    todayAverage,
    overallAverage,
    timeBlockAverages,
    recentTimeBlockStats,
    addEnergyLevel,
    deleteEnergyLevel,
  } = useEnergy();

  const [showInput, setShowInput] = useState(false);
  const [energy, setEnergy] = useState(50);
  const [context, setContext] = useState('');
  const [activity, setActivity] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addEnergyLevel(energy, context || undefined, activity || undefined);
    setEnergy(50);
    setContext('');
    setActivity('');
    setShowInput(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-tertiary)]">
        <div className="animate-pulse">에너지 데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-1">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-[var(--color-text)]">⚡ 에너지 리듬</h3>
          <span className="rounded-full bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
            오늘 평균 {todayAverage}%
          </span>
        </div>
        <button
          className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[var(--color-primary)]/20 transition hover:bg-[var(--color-primary-dark)] hover:shadow-[var(--color-primary)]/40 active:scale-95"
          onClick={() => setShowInput((prev) => !prev)}
        >
          {showInput ? '취소' : '+ 기록하기'}
        </button>
      </div>

      {/* Input Form */}
      {showInput && (
        <form
          className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 shadow-xl animate-in slide-in-from-top-2 duration-200"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-[var(--color-text)]">현재 에너지 레벨</label>
            <span className="text-lg font-bold" style={{ color: getEnergyColor(energy) }}>{energy}%</span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={energy}
            onChange={(e) => setEnergy(Number(e.target.value))}
            className="h-3 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-bg-tertiary)] accent-[var(--color-primary)]"
            style={{
              backgroundImage: `linear-gradient(to right, ${getEnergyColor(energy)} 0%, ${getEnergyColor(energy)} ${energy}%, var(--color-bg-tertiary) ${energy}%, var(--color-bg-tertiary) 100%)`
            }}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--color-text-secondary)]">활동</label>
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                {ACTIVITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--color-text-secondary)]">메모</label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="상황 입력..."
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-[var(--color-primary)] py-3 text-sm font-bold text-white transition hover:bg-[var(--color-primary-dark)]"
          >
            저장
          </button>
        </form>
      )}

      {/* Current Status Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatusCard
          label="현재 에너지"
          value={`${currentEnergy}%`}
          color={getEnergyColor(currentEnergy)}
          icon={<BatteryIcon level={currentEnergy} />}
        />
        <StatusCard
          label="오늘 평균"
          value={`${todayAverage}%`}
          color={getEnergyColor(todayAverage)}
        />
        <StatusCard
          label="전체 평균"
          value={`${overallAverage}%`}
          color={getEnergyColor(overallAverage)}
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Trend (Line Chart) */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
          <h4 className="text-sm font-bold text-[var(--color-text)]">📈 오늘의 에너지 흐름</h4>
          <div className="h-48 w-full">
            {energyLevels.length > 1 ? (
              <EnergyLineChart data={energyLevels} />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-tertiary)]">
                데이터가 부족합니다 (2개 이상 필요)
              </div>
            )}
          </div>
        </section>

        {/* 5-Day Heatmap */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
          <h4 className="text-sm font-bold text-[var(--color-text)]">🔥 시간대별 에너지 (최근 5일)</h4>
          <div className="flex flex-1 items-center justify-center">
            {recentTimeBlockStats?.length ? (
              <EnergyHeatmap stats={recentTimeBlockStats} />
            ) : (
              <div className="text-xs text-[var(--color-text-tertiary)]">데이터가 없습니다</div>
            )}
          </div>
        </section>
      </div>

      {/* Recent Records List */}
      <section className="flex flex-col gap-3">
        <h4 className="text-sm font-bold text-[var(--color-text)]">📝 오늘 기록 ({energyLevels.length})</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {[...energyLevels].reverse().map((level) => (
            <div
              key={level.timestamp}
              className="group flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 transition hover:border-[var(--color-primary)]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: getEnergyColor(level.energy) }}
                >
                  {level.energy}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    {new Date(level.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-sm font-bold text-[var(--color-text)]">
                    {level.activity || '기록 없음'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {level.context && (
                  <span className="max-w-[100px] truncate text-xs text-[var(--color-text-tertiary)]">
                    {level.context}
                  </span>
                )}
                <button
                  onClick={() => deleteEnergyLevel(level.timestamp)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// --- Components ---

function StatusCard({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 text-center shadow-sm transition hover:-translate-y-1">
      {icon && <div className="mb-1 text-2xl">{icon}</div>}
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function BatteryIcon({ level }: { level: number }) {
  return (
    <div className="relative h-6 w-10 rounded border-2 border-[var(--color-text)] p-0.5">
      <div
        className="h-full rounded-sm transition-all duration-500"
        style={{
          width: `${level}%`,
          backgroundColor: getEnergyColor(level)
        }}
      />
      <div className="absolute -right-1.5 top-1.5 h-2 w-1 rounded-r bg-[var(--color-text)]" />
    </div>
  );
}

function EnergyLineChart({ data }: { data: any[] }) {
  // Simple SVG Line Chart
  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const points = sortedData.map((d, i) => {
    const x = (i / (sortedData.length - 1)) * 100;
    const y = 100 - d.energy; // Invert Y for SVG
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
      {/* Grid Lines */}
      <line x1="0" y1="25" x2="100" y2="25" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="2" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="2" />
      <line x1="0" y1="75" x2="100" y2="75" stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="2" />

      {/* Area */}
      <path
        d={`M0,100 ${points.split(' ').map(p => `L${p}`).join(' ')} L100,100 Z`}
        fill="var(--color-primary)"
        fillOpacity="0.1"
      />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {sortedData.map((d, i) => {
        const x = (i / (sortedData.length - 1)) * 100;
        const y = 100 - d.energy;
        return (
          <circle
            key={d.timestamp}
            cx={x}
            cy={y}
            r="3" // Increased radius for visibility
            fill={getEnergyColor(d.energy)}
            stroke="var(--color-bg-surface)"
            strokeWidth="1"
            className="transition-all hover:r-4"
          >
            <title>{`${new Date(d.timestamp).toLocaleTimeString()} - ${d.energy}%`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function EnergyHeatmap({ stats }: { stats: any[] }) {
  // stats: [{ date: 'MM-DD', timeBlocks: { '5-8': 80, ... } }, ...]
  // We want rows = Time Blocks, Cols = Days

  return (
    <div className="flex w-full flex-col gap-1">
      {/* Header Row (Dates) */}
      <div className="flex">
        <div className="w-16 shrink-0" /> {/* Spacer for labels */}
        {stats.map(day => (
          <div key={day.date} className="flex-1 text-center text-[10px] font-bold text-[var(--color-text-secondary)]">
            {day.date.substring(5)}
          </div>
        ))}
      </div>

      {/* Rows */}
      {TIME_BLOCKS.map(blockId => (
        <div key={blockId} className="flex items-center gap-1">
          <div className="w-16 shrink-0 text-[10px] font-medium text-[var(--color-text-tertiary)]">
            {getBlockLabel(blockId).split(' ')[0]} {/* Simplify label */}
          </div>
          {stats.map(day => {
            const value = day.timeBlocks[blockId];
            return (
              <div
                key={`${day.date}-${blockId}`}
                className="flex-1 aspect-[2/1] rounded-md transition-all hover:scale-105 hover:shadow-sm"
                style={{
                  backgroundColor: value !== undefined ? getEnergyColor(value) : 'var(--color-bg-elevated)',
                  opacity: value !== undefined ? 0.8 : 0.3,
                }}
                title={`${day.date} ${getBlockLabel(blockId)}: ${value !== undefined ? value + '%' : 'No Data'}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// --- Utils ---

function getBlockLabel(blockId: string): string {
  const labels: Record<string, string> = {
    '5-8': '아침 (05-08)',
    '8-11': '오전 (08-11)',
    '11-14': '점심 (11-14)',
    '14-17': '오후 (14-17)',
    '17-19': '저녁 (17-19)',
    '19-24': '밤 (19-24)',
  };
  return labels[blockId] || blockId;
}

function getEnergyColor(energy: number): string {
  if (energy >= 80) return '#10b981'; // Emerald
  if (energy >= 60) return '#3b82f6'; // Blue
  if (energy >= 40) return '#f59e0b'; // Amber
  if (energy >= 20) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

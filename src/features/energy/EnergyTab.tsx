import { useState } from 'react';
import { useEnergyState } from '@/shared/hooks';

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
  } = useEnergyState();

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
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 text-center text-[var(--color-text-secondary)]">
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-[var(--color-text)]">에너지</h3>
        <button
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-primary-dark)]"
          onClick={() => setShowInput((prev) => !prev)}
          aria-label={showInput ? '입력 닫기' : '에너지 기록'}
        >
          {showInput ? '취소' : '새 기록'}
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto">
        {showInput && (
          <form className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-sm" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="energy-level" className="text-sm font-medium text-[var(--color-text)]">
                에너지 레벨: {energy}%
              </label>
              <input
                id="energy-level"
                type="range"
                min="0"
                max="100"
                step="5"
                value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="energy-activity" className="text-sm font-medium text-[var(--color-text)]">
                활동
              </label>
              <select
                id="energy-activity"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              >
                {ACTIVITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="energy-context" className="text-sm font-medium text-[var(--color-text)]">
                상황/맥락 (선택)
              </label>
              <input
                id="energy-context"
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="점심 식사 후 집중이 떨어짐"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)]"
            >
              기록 저장
            </button>
          </form>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="현재 에너지" value={`${currentEnergy}%`} valueColor={getEnergyColor(currentEnergy)} />
          <StatCard label="오늘 평균" value={`${todayAverage}%`} />
          <StatCard label="전체 평균" value={`${overallAverage}%`} />
        </div>

        {recentTimeBlockStats?.length ? (
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-sm">
            <h4 className="mb-3 text-base font-semibold text-[var(--color-text)]">5일간 시간대별 에너지</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--color-bg)] text-[var(--color-text)]">
                    <th className="rounded-l-md px-3 py-2 text-left">시간대</th>
                    {recentTimeBlockStats.map((day) => (
                      <th key={day.date} className="px-3 py-2 text-center text-xs font-semibold">
                        {day.date.substring(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_BLOCKS.map((blockId) => (
                    <tr key={blockId} className="border-t border-[var(--color-border)]">
                      <td className="bg-[var(--color-bg)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)]">
                        {getBlockLabel(blockId)}
                      </td>
                      {recentTimeBlockStats.map((day) => {
                        const value = day.timeBlocks[blockId];
                        return (
                          <td
                            key={`${day.date}-${blockId}`}
                            className="px-3 py-2 text-center text-xs font-semibold text-white"
                            style={{
                              background: value !== undefined ? getEnergyColor(value) : 'transparent',
                              opacity: value !== undefined ? 0.75 : 1,
                            }}
                          >
                            {value !== undefined ? `${value}%` : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {Object.keys(timeBlockAverages).length > 0 && (
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-sm">
            <h4 className="mb-3 text-base font-semibold text-[var(--color-text)]">오늘 시간대 평균</h4>
            <div className="space-y-3">
              {Object.entries(timeBlockAverages).map(([block, avg]) => (
                <div key={block} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-[var(--color-text-secondary)]">{getBlockLabel(block)}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]">
                    <div
                      className="h-3 rounded-full"
                      style={{ width: `${avg}%`, background: getEnergyColor(avg) }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold text-[var(--color-text)]">{avg}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {energyLevels.length > 0 ? (
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-sm">
            <h4 className="mb-3 text-base font-semibold text-[var(--color-text)]">오늘 기록 ({energyLevels.length})</h4>
            <div className="space-y-3">
              {[...energyLevels].reverse().map((level) => (
                <div key={level.timestamp} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {new Date(level.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-base font-semibold" style={{ color: getEnergyColor(level.energy) }}>
                    {level.energy}%
                  </div>
                  {level.activity && <div className="text-sm text-[var(--color-text)]">{level.activity}</div>}
                  {level.context && <div className="text-sm text-[var(--color-text-secondary)]">{level.context}</div>}
                  <button
                    type="button"
                    className="ml-auto rounded border border-red-500 px-2 py-1 text-xs text-red-400 transition hover:bg-red-500/10"
                    onClick={() => deleteEnergyLevel(level.timestamp)}
                    aria-label="기록 삭제"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : !showInput ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-8 text-center text-[var(--color-text-secondary)]">
            <p className="text-base font-semibold text-[var(--color-text)]">오늘 기록된 에너지가 없습니다.</p>
            <p className="text-sm">오른쪽 버튼을 눌러 에너지를 기록해 보세요!</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center shadow-sm">
      <div className="text-sm text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-2xl font-bold" style={{ color: valueColor || 'var(--color-text)' }}>
        {value}
      </div>
    </div>
  );
}

function getBlockLabel(blockId: string): string {
  const labels: Record<string, string> = {
    '5-8': '05:00-08:00',
    '8-11': '08:00-11:00',
    '11-14': '11:00-14:00',
    '14-17': '14:00-17:00',
    '17-19': '17:00-19:00',
    '19-24': '19:00-24:00',
  };
  return labels[blockId] || blockId;
}

function getEnergyColor(energy: number): string {
  if (energy >= 80) return '#10b981';
  if (energy >= 60) return '#3b82f6';
  if (energy >= 40) return '#f59e0b';
  if (energy >= 20) return '#f97316';
  return '#ef4444';
}

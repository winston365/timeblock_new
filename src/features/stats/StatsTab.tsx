import { useGameState } from '@/shared/hooks';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';

export default function StatsTab() {
  const { gameState, loading } = useGameState();

  if (loading || !gameState) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-secondary)]">
        불러오는 중...
      </div>
    );
  }

  const pastHistory = gameState.xpHistory.slice(-4);
  const today = getLocalDate();
  const todayData = { date: today, xp: gameState.dailyXP };

  const xpHistory = [...pastHistory, todayData];
  const maxXP = Math.max(...xpHistory.map(h => h.xp), 100);

  const timeBlockXP = gameState.timeBlockXP;
  const maxBlockXP = Math.max(...Object.values(timeBlockXP), 10);

  const recentBlockXPHistory = gameState.timeBlockXPHistory.slice(-5);
  const todayInHistory = recentBlockXPHistory.find(h => h.date === today);
  const finalBlockXPHistory = todayInHistory
    ? recentBlockXPHistory
    : [...recentBlockXPHistory.slice(-4), { date: today, blocks: timeBlockXP }];

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-4 text-[var(--color-text)]">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-4 shadow-sm">
        <h3 className="text-lg font-semibold">📊 통계</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">XP 흐름과 타임블록별 성과를 확인하세요.</p>
      </div>

      <div className="space-y-8">
        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">최근 5일 XP</h4>
          {xpHistory.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
              데이터가 없습니다.
            </div>
          ) : (
            <div className="flex min-h-[180px] items-end gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-6">
              {xpHistory.map(item => {
                const barHeight = Math.max((item.xp / maxXP) * 100, 6);
                return (
                  <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="flex w-full flex-col items-center justify-start rounded-2xl bg-gradient-to-t from-[var(--color-reward)] to-[var(--color-warning)] text-[0.65rem] font-semibold text-white shadow-inner transition-all"
                      style={{ height: `${barHeight}%` }}
                    >
                      <span className="mt-2 drop-shadow">{item.xp}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)]">{item.date.substring(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            5일간 타임블록별 XP 추이
          </h4>
          {finalBlockXPHistory.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
              데이터가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="text-[var(--color-text)]">
                    <th className="sticky left-0 border border-[var(--color-border)] bg-[var(--color-primary)] px-3 py-2 text-left text-white">
                      타임블록
                    </th>
                    {finalBlockXPHistory.map(dayXP => (
                      <th
                        key={dayXP.date}
                        className="border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-[var(--color-text-secondary)]"
                      >
                        {dayXP.date.substring(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_BLOCKS.map(block => (
                    <tr key={block.id}>
                      <td className="sticky left-0 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">
                        {block.label}
                      </td>
                      {finalBlockXPHistory.map(dayXP => {
                        const xp = dayXP.blocks[block.id] || 0;
                        const intensity = Math.min((xp / 200) * 100, 100);
                        return (
                          <td
                            key={`${dayXP.date}-${block.id}`}
                            className="border border-[var(--color-border)] px-3 py-2 text-center font-semibold text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]"
                            style={{
                              background:
                                xp > 0
                                  ? `linear-gradient(135deg, rgba(102,126,234,${intensity / 100}), rgba(118,75,162,${
                                      intensity / 100
                                    }))`
                                  : 'transparent',
                            }}
                          >
                            {xp > 0 ? xp : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            오늘 타임블록별 XP
          </h4>
          {Object.keys(timeBlockXP).length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
              아직 누적된 XP가 없습니다.
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              {TIME_BLOCKS.map(block => {
                const xp = timeBlockXP[block.id] || 0;
                return (
                  <div key={block.id} className="flex items-center gap-3 text-sm">
                    <div className="w-28 text-[var(--color-text-secondary)]">{block.label}</div>
                    <div className="flex-1">
                      <div className="relative h-4 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--color-reward)] to-[var(--color-warning)] transition-all"
                          style={{ width: xp > 0 ? `${(xp / maxBlockXP) * 100}%` : '2%' }}
                        />
                        <span className="absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-white drop-shadow">
                          {xp} XP
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">요약</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
              <span className="text-xs uppercase tracking-widest text-[var(--color-text-tertiary)]">오늘 XP</span>
              <div className="text-2xl font-bold text-[var(--color-primary)]">{gameState.dailyXP}</div>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
              <span className="text-xs uppercase tracking-widest text-[var(--color-text-tertiary)]">총 누적 XP</span>
              <div className="text-2xl font-bold">{gameState.totalXP}</div>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
              <span className="text-xs uppercase tracking-widest text-[var(--color-text-tertiary)]">사용 가능 XP</span>
              <div className="text-2xl font-bold">{gameState.availableXP}</div>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
              <span className="text-xs uppercase tracking-widest text-[var(--color-text-tertiary)]">연속 달성</span>
              <div className="text-2xl font-bold">{gameState.streak}일</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

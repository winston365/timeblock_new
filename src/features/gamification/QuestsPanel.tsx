/**
 * QuestsPanel
 *
 * @role 일일 퀘스트 목록과 진행 상황을 표시하는 패널 컴포넌트
 * @input 없음 (useQuests 훅으로 데이터 로드)
 * @output 퀘스트 목록, 진행률 바, 완료 배너
 * @external_dependencies
 *   - useQuests: 퀘스트 데이터 훅
 */

import { useQuests } from '@/shared/hooks';
import type { Quest } from '@/shared/types/domain';

type QuestVisual = {
  icon: string;
  accent: string;
  accentSoft: string;
  bar: string;
};

const QUEST_VISUALS: Record<Quest['type'], QuestVisual> = {
  complete_tasks: { icon: '✅', accent: '#22c55e', accentSoft: 'rgba(34,197,94,0.12)', bar: 'from-[#34d399] to-[#16a34a]' },
  earn_xp: { icon: '💎', accent: '#60a5fa', accentSoft: 'rgba(96,165,250,0.12)', bar: 'from-[#60a5fa] to-[#2563eb]' },
  lock_blocks: { icon: '🔒', accent: '#f97316', accentSoft: 'rgba(249,115,22,0.14)', bar: 'from-[#fb923c] to-[#f97316]' },
  perfect_blocks: { icon: '✨', accent: '#a855f7', accentSoft: 'rgba(168,85,247,0.14)', bar: 'from-[#c084fc] to-[#a855f7]' },
  prepare_tasks: { icon: '🧠', accent: '#22d3ee', accentSoft: 'rgba(34,211,238,0.14)', bar: 'from-[#22d3ee] to-[#0ea5e9]' },
  use_timer: { icon: '⏱️', accent: '#38bdf8', accentSoft: 'rgba(56,189,248,0.14)', bar: 'from-[#38bdf8] to-[#0ea5e9]' },
};

/**
 * 일일 퀘스트 패널
 *
 * @returns {JSX.Element} 퀘스트 패널 UI
 */
export default function QuestsPanel() {
  const { quests, loading } = useQuests();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-secondary)]">
        퀘스트 로딩 중...
      </div>
    );
  }

  const completedCount = quests.filter(q => q.completed).length;
  const totalReward = quests.reduce((sum, q) => sum + q.reward, 0);
  const earnedReward = quests.filter(q => q.completed).reduce((sum, q) => sum + q.reward, 0);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Daily Quests</h3>
          <p className="text-[11px] text-white/50">오늘의 미션을 완료하고 XP를 모으세요</p>
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className="text-xs font-semibold text-emerald-300">
            {completedCount}/{quests.length} <span className="text-xs text-white/60">퀘스트</span>
          </span>
          <span className="text-[11px] font-semibold text-[var(--color-primary)]">
            +{earnedReward} / {totalReward} XP
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {quests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-xs text-white/60">
            <p className="font-medium text-white">오늘의 퀘스트가 없습니다</p>
            <p>내일을 기대해주세요!</p>
          </div>
        ) : (
          quests.map(quest => <QuestItem key={quest.id} quest={quest} />)
        )}
      </div>

      {completedCount === quests.length && quests.length > 0 && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-center text-xs font-bold text-emerald-200">
          🎉 오늘의 퀘스트를 모두 완료했습니다!
        </div>
      )}
    </section>
  );
}

function QuestItem({ quest }: { quest: Quest }) {
  const progress = Math.min((quest.progress / quest.target) * 100, 100);
  const visuals = QUEST_VISUALS[quest.type] ?? {
    icon: '🎯',
    accent: '#60a5fa',
    accentSoft: 'rgba(96,165,250,0.12)',
    bar: 'from-[#60a5fa] to-[#2563eb]',
  };

  return (
    <article
      className={`relative flex gap-3 rounded-xl border border-white/5 bg-white/5 p-3 transition-all ${quest.completed
          ? 'ring-1 ring-emerald-400/30 bg-emerald-400/5'
          : 'hover:border-white/15 hover:bg-white/8'
        }`}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base shadow-inner"
        style={{
          background: quest.completed ? 'rgba(34,197,94,0.15)' : visuals.accentSoft,
          color: quest.completed ? '#34d399' : visuals.accent,
        }}
      >
        {quest.completed ? '✔️' : visuals.icon}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm font-semibold ${quest.completed ? 'text-white/50 line-through' : 'text-white'}`}>
            {quest.title}
          </span>
          <span className="shrink-0 text-xs font-bold" style={{ color: visuals.accent }}>
            +{quest.reward} XP
          </span>
        </div>

        {quest.description && (
          <p className="truncate text-[11px] text-white/50">
            {quest.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-[11px] text-white/60">
          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${quest.completed ? 'from-[#34d399] to-[#22c55e]' : visuals.bar}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-14 text-right tabular-nums">
            {quest.progress}/{quest.target}
          </span>
        </div>
      </div>
    </article>
  );
}

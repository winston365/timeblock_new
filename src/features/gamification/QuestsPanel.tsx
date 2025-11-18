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
  const totalReward = quests
    .filter(q => q.completed)
    .reduce((sum, q) => sum + q.reward, 0);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
        <h3 className="text-sm font-bold text-[var(--color-text)]">🎯 일일 퀘스트</h3>
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
          <span>
            {completedCount} / {quests.length}
          </span>
          {totalReward > 0 && (
            <span className="rounded-md bg-[var(--color-primary)]/10 px-2 py-0.5 text-[var(--color-primary)]">
              +{totalReward} XP
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {quests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 px-4 py-8 text-center text-xs text-[var(--color-text-secondary)]">
            <p className="font-medium text-[var(--color-text)]">오늘의 퀘스트가 없습니다</p>
            <p>내일을 기대해주세요!</p>
          </div>
        ) : (
          quests.map(quest => <QuestItem key={quest.id} quest={quest} />)
        )}
      </div>

      {completedCount === quests.length && quests.length > 0 && (
        <div className="rounded-xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 px-4 py-3 text-center text-xs font-bold text-[var(--color-success)]">
          🎉 오늘의 퀘스트를 모두 완료했습니다!
        </div>
      )}
    </section>
  );
}

function QuestItem({ quest }: { quest: Quest }) {
  const progress = Math.min((quest.progress / quest.target) * 100, 100);

  const getQuestIcon = (type: Quest['type']) => {
    switch (type) {
      case 'complete_tasks':
        return '✅';
      case 'earn_xp':
        return '💎';
      case 'lock_blocks':
        return '🔒';
      case 'perfect_blocks':
        return '✨';
      default:
        return '🎯';
    }
  };

  return (
    <article
      className={`relative flex gap-3 rounded-xl border p-3 transition-all ${quest.completed
          ? 'border-[var(--color-success)]/30 bg-[var(--color-success)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-primary)]/50'
        }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${quest.completed
            ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]'
          }`}
      >
        {getQuestIcon(quest.type)}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-semibold truncate ${quest.completed ? 'text-[var(--color-text-secondary)] line-through' : 'text-[var(--color-text)]'}`}>
            {quest.title}
          </span>
          <span className="text-[10px] font-bold text-[var(--color-reward)] shrink-0">
            +{quest.reward} XP
          </span>
        </div>

        <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">
          {quest.description}
        </p>

        <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)]">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${quest.completed ? 'bg-[var(--color-success)]' : 'bg-[var(--color-primary)]'
                }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-8 text-right">{quest.progress}/{quest.target}</span>
        </div>
      </div>
    </article>
  );
}

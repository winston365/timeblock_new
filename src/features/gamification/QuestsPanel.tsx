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
      <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-6 text-sm text-[var(--color-text-secondary)]">
        퀘스트 로딩 중...
      </div>
    );
  }

  const completedCount = quests.filter(q => q.completed).length;
  const totalReward = quests
    .filter(q => q.completed)
    .reduce((sum, q) => sum + q.reward, 0);

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-[0_25px_45px_rgba(0,0,0,0.45)]">
      <header className="flex items-center justify-between rounded-t-3xl border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-5 py-4">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">🎯 일일 퀘스트</h3>
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
          <span>
            {completedCount} / {quests.length}
          </span>
          {totalReward > 0 && (
            <span className="rounded-full bg-[var(--color-primary)]/90 px-3 py-1 text-[var(--color-text)]">
              +{totalReward} XP
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3 px-5 pb-4 pt-3">
        {quests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
            <p className="font-semibold text-[var(--color-text)]">오늘의 퀘스트가 없습니다</p>
            <p>내일을 기대해주세요!</p>
          </div>
        ) : (
          quests.map(quest => <QuestItem key={quest.id} quest={quest} />)
        )}
      </div>

      {completedCount === quests.length && quests.length > 0 && (
        <div className="rounded-b-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white">
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
      className={[
        'relative flex gap-4 rounded-2xl border-2 p-4 transition-shadow duration-200',
        quest.completed
          ? 'border-[var(--color-success)] bg-[rgba(16,185,129,0.15)] shadow-[0_20px_30px_rgba(16,185,129,0.25)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)] hover:shadow-xl',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-10 w-10 items-center justify-center rounded-2xl text-xl',
          quest.completed ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)]',
        ].join(' ')}
      >
        {getQuestIcon(quest.type)}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="text-sm font-semibold text-[var(--color-text)]">{quest.title}</div>
        <p className="text-xs text-[var(--color-text-secondary)]">{quest.description}</p>

        <div className="flex items-center gap-2 text-[var(--color-text-tertiary)] text-[11px]">
          <span>{quest.progress} / {quest.target}</span>
          <span className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 text-xs font-semibold text-[var(--color-reward)]">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--color-reward)]">+{quest.reward} XP</span>
      </div>

      {quest.completed && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-success)] text-sm font-semibold text-white shadow-lg">
          ✓
        </span>
      )}
    </article>
  );
}

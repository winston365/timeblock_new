/**
 * src/features/gamification/QuestsPanel.tsx
 * 일일 퀘스트 패널
 */

import { useQuests } from '@/shared/hooks';
import type { Quest } from '@/shared/types/domain';
import './gamification.css';

export default function QuestsPanel() {
  const { quests, loading } = useQuests();

  if (loading) {
    return <div className="quests-loading">퀘스트 로딩 중...</div>;
  }

  const completedCount = quests.filter(q => q.completed).length;
  const totalReward = quests
    .filter(q => q.completed)
    .reduce((sum, q) => sum + q.reward, 0);

  return (
    <div className="quests-panel">
      <div className="quests-header">
        <h3>🎯 일일 퀘스트</h3>
        <div className="quests-summary">
          <span className="quest-count">
            {completedCount} / {quests.length}
          </span>
          {totalReward > 0 && (
            <span className="quest-reward">+{totalReward} XP</span>
          )}
        </div>
      </div>

      <div className="quests-list">
        {quests.length === 0 ? (
          <div className="quests-empty">오늘의 퀘스트가 없습니다</div>
        ) : (
          quests.map(quest => <QuestItem key={quest.id} quest={quest} />)
        )}
      </div>

      {completedCount === quests.length && quests.length > 0 && (
        <div className="quests-complete-banner">
          🎉 오늘의 퀘스트를 모두 완료했습니다!
        </div>
      )}
    </div>
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
    <div className={`quest-item ${quest.completed ? 'completed' : ''}`}>
      <div className="quest-icon">{getQuestIcon(quest.type)}</div>

      <div className="quest-content">
        <div className="quest-title">{quest.title}</div>
        <div className="quest-description">{quest.description}</div>

        <div className="quest-progress-bar">
          <div
            className="quest-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="quest-footer">
          <span className="quest-progress-text">
            {quest.progress} / {quest.target}
          </span>
          <span className="quest-reward-text">+{quest.reward} XP</span>
        </div>
      </div>

      {quest.completed && (
        <div className="quest-complete-badge">✓</div>
      )}
    </div>
  );
}

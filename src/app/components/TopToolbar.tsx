/**
 * TopToolbar - 상단 툴바
 */

import type { GameState } from '@/shared/types/domain';
import { useEnergyState } from '@/shared/hooks';

interface TopToolbarProps {
  gameState: GameState | null;
  onOpenGeminiChat?: () => void;
}

export default function TopToolbar({ gameState, onOpenGeminiChat }: TopToolbarProps) {
  const { currentEnergy } = useEnergyState();

  return (
    <header className="top-toolbar" role="banner">
      <h1>⏰ 타임블럭 플래너</h1>

      <div className="toolbar-stats">
        <div className="stat-item">
          <span>⚡ 에너지:</span>
          <span>{currentEnergy > 0 ? `${currentEnergy}%` : '-'}</span>
        </div>
        <div className="stat-item">
          <span>💎 오늘 XP:</span>
          <span>{gameState?.dailyXP ?? 0}</span>
        </div>
        <div className="stat-item">
          <span>🏆 보유 XP:</span>
          <span>{gameState?.availableXP ?? 0}</span>
        </div>
        <div className="stat-item">
          <span>📊 레벨:</span>
          <span>{gameState?.level ?? 1}</span>
        </div>
      </div>

      <div className="toolbar-actions">
        <button className="toolbar-btn" title="에너지 탭에서 입력하세요">
          ⚡ 에너지 입력
        </button>
        <button className="toolbar-btn" onClick={onOpenGeminiChat}>
          💬 AI 대화
        </button>
      </div>
    </header>
  );
}

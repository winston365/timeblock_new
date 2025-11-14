/**
 * TopToolbar - 상단 툴바
 */

import type { GameState } from '@/shared/types/domain';

interface TopToolbarProps {
  gameState: GameState | null;
}

export default function TopToolbar({ gameState }: TopToolbarProps) {
  return (
    <header className="top-toolbar">
      <h1>⏰ 타임블럭 플래너</h1>

      <div className="toolbar-stats">
        <div className="stat-item">
          <span>⚡ 에너지:</span>
          <span>-</span>
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
        <button className="toolbar-btn">⚡ 에너지 입력</button>
        <button className="toolbar-btn">💬 AI 대화</button>
      </div>
    </header>
  );
}

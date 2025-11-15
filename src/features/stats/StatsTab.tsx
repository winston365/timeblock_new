/**
 * src/features/stats/StatsTab.tsx
 * 통계 탭 - XP 히스토리 및 블록별 XP 차트
 */

import { useGameState } from '@/shared/hooks';
import { TIME_BLOCKS } from '@/shared/types/domain';
import './stats.css';

export default function StatsTab() {
  const { gameState, loading } = useGameState();

  if (loading || !gameState) {
    return <div className="tab-loading">로딩 중...</div>;
  }

  const xpHistory = gameState.xpHistory.slice(-5); // 최근 5일
  const maxXP = Math.max(...xpHistory.map(h => h.xp), 100);

  const timeBlockXP = gameState.timeBlockXP;
  const maxBlockXP = Math.max(...Object.values(timeBlockXP), 10);

  return (
    <div className="stats-tab">
      <div className="tab-header">
        <h3>📊 통계</h3>
      </div>

      <div className="tab-content">
        {/* 지난 5일 XP */}
        <div className="stats-section">
          <h4>지난 5일 XP</h4>
          <div className="xp-chart">
            {xpHistory.length === 0 ? (
              <div className="chart-empty">데이터가 없습니다</div>
            ) : (
              xpHistory.map(item => (
                <div key={item.date} className="chart-bar-wrapper">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${(item.xp / maxXP) * 100}%`,
                    }}
                  >
                    <span className="chart-value">{item.xp}</span>
                  </div>
                  <div className="chart-label">{item.date.substring(5)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 오늘 블록별 XP */}
        <div className="stats-section">
          <h4>오늘 블록별 XP</h4>
          <div className="block-xp-chart">
            {Object.keys(timeBlockXP).length === 0 ? (
              <div className="chart-empty">아직 획득한 XP가 없습니다</div>
            ) : (
              TIME_BLOCKS.map(block => {
                const xp = timeBlockXP[block.id] || 0;
                return (
                  <div key={block.id} className="block-xp-row">
                    <div className="block-xp-label">{block.label}</div>
                    <div className="block-xp-bar-wrapper">
                      <div
                        className="block-xp-bar"
                        style={{
                          width: xp > 0 ? `${(xp / maxBlockXP) * 100}%` : '0%',
                        }}
                      />
                      <span className="block-xp-value">{xp} XP</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 요약 통계 */}
        <div className="stats-section">
          <h4>요약</h4>
          <div className="stats-summary">
            <div className="summary-item">
              <span className="summary-label">오늘 획득 XP</span>
              <span className="summary-value xp-value">{gameState.dailyXP}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">총 누적 XP</span>
              <span className="summary-value xp-value">{gameState.totalXP}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">사용 가능 XP</span>
              <span className="summary-value xp-value">{gameState.availableXP}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">연속 출석</span>
              <span className="summary-value">{gameState.streak}일</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

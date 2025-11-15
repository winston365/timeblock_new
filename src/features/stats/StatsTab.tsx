/**
 * StatsTab
 *
 * @role XP 히스토리 및 타임블록별 XP 통계를 차트로 표시하는 탭 컴포넌트
 * @input 없음 (useGameState 훅으로 데이터 로드)
 * @output 지난 5일 XP 차트, 오늘 블록별 XP 차트, 요약 통계
 * @external_dependencies
 *   - useGameState: 게임 상태 데이터 훅
 *   - utils: 날짜 유틸리티
 */

import { useGameState } from '@/shared/hooks';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import './stats.css';

/**
 * 통계 탭
 *
 * @returns {JSX.Element} 통계 탭 UI
 */
export default function StatsTab() {
  const { gameState, loading } = useGameState();

  if (loading || !gameState) {
    return <div className="tab-loading">로딩 중...</div>;
  }

  // 과거 4일 + 오늘 = 최근 5일
  const pastHistory = gameState.xpHistory.slice(-4);
  const today = getLocalDate();
  const todayData = { date: today, xp: gameState.dailyXP };

  // 오늘 데이터를 마지막에 추가
  const xpHistory = [...pastHistory, todayData];
  const maxXP = Math.max(...xpHistory.map(h => h.xp), 100);

  const timeBlockXP = gameState.timeBlockXP;
  const maxBlockXP = Math.max(...Object.values(timeBlockXP), 10);

  // 5일간 블록별 XP 히스토리
  const recentBlockXPHistory = gameState.timeBlockXPHistory.slice(-5);
  // 오늘 데이터가 없으면 추가
  const todayInHistory = recentBlockXPHistory.find(h => h.date === today);
  const finalBlockXPHistory = todayInHistory
    ? recentBlockXPHistory
    : [...recentBlockXPHistory.slice(-4), { date: today, blocks: timeBlockXP }];

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

        {/* 5일간 시간대별 XP 통계 (그리드 형식) */}
        <div className="stats-section">
          <h4>5일간 시간대별 XP 통계</h4>
          {finalBlockXPHistory.length === 0 ? (
            <div className="chart-empty">데이터가 없습니다</div>
          ) : (
            <div className="timeblock-grid-container">
              <table className="timeblock-grid-table">
                <thead>
                  <tr>
                    <th className="timeblock-header">시간대</th>
                    {finalBlockXPHistory.map((dayXP) => (
                      <th key={dayXP.date} className="date-header">
                        {dayXP.date.substring(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_BLOCKS.map((block) => (
                    <tr key={block.id}>
                      <td className="timeblock-label">{block.label}</td>
                      {finalBlockXPHistory.map((dayXP) => {
                        const xp = dayXP.blocks[block.id] || 0;
                        const maxCellXP = 200;
                        const intensity = Math.min((xp / maxCellXP) * 100, 100);
                        return (
                          <td
                            key={`${dayXP.date}-${block.id}`}
                            className="timeblock-cell"
                            style={{
                              background: xp > 0
                                ? `linear-gradient(135deg,
                                    rgba(102, 126, 234, ${intensity / 100}),
                                    rgba(118, 75, 162, ${intensity / 100}))`
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

/**
 * WaifuPanel - 와이푸 패널
 * 세로 이미지, 대사, 호감도, 완료한 작업 수, 기분 표시
 */

import { useWaifuState } from '@/shared/hooks';
import './waifu.css';

interface WaifuPanelProps {
  imagePath?: string; // 와이푸 이미지 경로 (optional, 기본 플레이스홀더)
}

export default function WaifuPanel({ imagePath }: WaifuPanelProps) {
  const { waifuState, loading, currentMood, currentDialogue, onInteract } = useWaifuState();

  if (loading) {
    return (
      <div className="waifu-panel">
        <div className="waifu-loading">로딩 중...</div>
      </div>
    );
  }

  if (!waifuState) {
    return (
      <div className="waifu-panel">
        <div className="waifu-error">와이푸 데이터를 불러올 수 없습니다</div>
      </div>
    );
  }

  return (
    <div className="waifu-panel">
      {/* 와이푸 이미지 */}
      <div className="waifu-image-container" onClick={onInteract}>
        {imagePath ? (
          <img src={imagePath} alt="Waifu" className="waifu-image" />
        ) : (
          <div className="waifu-image-placeholder">
            <div className="waifu-placeholder-icon">🥰</div>
            <p className="waifu-placeholder-text">
              이미지를 추가하려면
              <br />
              imagePath prop을 전달하세요
            </p>
          </div>
        )}
        <div className="waifu-click-hint">클릭하여 상호작용</div>
      </div>

      {/* 와이푸 정보 */}
      <div className="waifu-info">
        {/* 대사 */}
        <div className="waifu-dialogue">
          <div className="dialogue-bubble">
            <p className="dialogue-text">{currentDialogue}</p>
          </div>
        </div>

        {/* 정보 카드들 */}
        <div className="waifu-stats">
          {/* 호감도 */}
          <div className="waifu-stat-card">
            <div className="stat-label">호감도</div>
            <div className="stat-value-row">
              <div className="affection-bar">
                <div
                  className="affection-fill"
                  style={{ width: `${waifuState.affection}%` }}
                />
              </div>
              <span className="stat-value">{waifuState.affection}%</span>
            </div>
          </div>

          {/* 기분 */}
          <div className="waifu-stat-card">
            <div className="stat-label">기분</div>
            <div className="stat-value mood-value">{currentMood}</div>
          </div>

          {/* 완료한 작업 수 */}
          <div className="waifu-stat-card">
            <div className="stat-label">오늘 완료한 작업</div>
            <div className="stat-value tasks-value">
              {waifuState.tasksCompletedToday}개
            </div>
          </div>

          {/* 총 상호작용 횟수 */}
          <div className="waifu-stat-card">
            <div className="stat-label">총 상호작용</div>
            <div className="stat-value interactions-value">
              {waifuState.totalInteractions}회
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

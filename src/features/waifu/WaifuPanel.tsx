/**
 * WaifuPanel - 와이푸 패널
 * 세로 이미지, 대사, 호감도, 완료한 작업 수, 기분 표시
 * 호감도에 따라 자동으로 이미지가 변경됩니다.
 */

import { useState, useEffect } from 'react';
import { useWaifuState } from '@/shared/hooks';
import { getWaifuImagePathWithFallback } from './waifuImageUtils';
import './waifu.css';

interface WaifuPanelProps {
  imagePath?: string; // 수동 이미지 경로 (optional, 지정하지 않으면 호감도 기반 자동 선택)
}

export default function WaifuPanel({ imagePath }: WaifuPanelProps) {
  const { waifuState, loading, currentMood, currentDialogue, onInteract } = useWaifuState();
  const [displayImagePath, setDisplayImagePath] = useState<string>('');

  // 이미지 경로 결정: 수동 지정 > 호감도 기반 자동 선택
  useEffect(() => {
    if (imagePath) {
      setDisplayImagePath(imagePath);
    } else if (waifuState) {
      // 호감도에 따라 이미지 자동 선택
      getWaifuImagePathWithFallback(waifuState.affection).then(path => {
        setDisplayImagePath(path);
      });
    }
  }, [imagePath, waifuState?.affection]);

  if (loading) {
    return (
      <div className="waifu-panel" role="status" aria-live="polite">
        <div className="waifu-loading">로딩 중...</div>
      </div>
    );
  }

  if (!waifuState) {
    return (
      <div className="waifu-panel" role="alert">
        <div className="waifu-error">와이푸 데이터를 불러올 수 없습니다</div>
      </div>
    );
  }

  return (
    <div className="waifu-panel">
      {/* 와이푸 이미지 */}
      <div
        className="waifu-image-container"
        onClick={onInteract}
        role="button"
        tabIndex={0}
        aria-label={`와이푸와 상호작용하기. 현재 호감도: ${waifuState.affection}%, 기분: ${currentMood}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onInteract();
          }
        }}
      >
        {displayImagePath ? (
          <img
            src={displayImagePath}
            alt={`와이푸 (호감도 ${waifuState.affection}%)`}
            className="waifu-image"
          />
        ) : (
          <div className="waifu-image-placeholder">
            <div className="waifu-placeholder-icon">🥰</div>
            <p className="waifu-placeholder-text">
              이미지를 추가하려면
              <br />
              /public/assets/waifu/poses/ 폴더에
              <br />
              호감도별 이미지를 넣어주세요
              <br />
              <small className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                (very_low.png, low.png, medium.png,
                <br />
                good.png, very_good.png, max.png)
              </small>
            </p>
          </div>
        )}
        <div className="waifu-click-hint" aria-hidden="true">
          클릭하여 상호작용
        </div>
      </div>

      {/* 와이푸 정보 */}
      <div className="waifu-info">
        {/* 대사 */}
        <div className="waifu-dialogue" role="status" aria-live="polite">
          <div className="dialogue-bubble">
            <p className="dialogue-text">{currentDialogue}</p>
          </div>
        </div>

        {/* 정보 카드들 */}
        <div className="waifu-stats" role="region" aria-label="와이푸 통계">
          {/* 호감도 */}
          <div className="waifu-stat-card">
            <div className="stat-label" id="affection-label">호감도</div>
            <div className="stat-value-row">
              <div
                className="affection-bar"
                role="progressbar"
                aria-labelledby="affection-label"
                aria-valuenow={waifuState.affection}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${waifuState.affection}%`}
              >
                <div
                  className="affection-fill"
                  style={{ width: `${waifuState.affection}%` }}
                />
              </div>
              <span className="stat-value" aria-hidden="true">
                {waifuState.affection}%
              </span>
            </div>
          </div>

          {/* 기분 */}
          <div className="waifu-stat-card">
            <div className="stat-label">기분</div>
            <div className="stat-value mood-value" role="status">
              {currentMood}
            </div>
          </div>

          {/* 완료한 작업 수 */}
          <div className="waifu-stat-card">
            <div className="stat-label">오늘 완료한 작업</div>
            <div className="stat-value tasks-value" role="status">
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

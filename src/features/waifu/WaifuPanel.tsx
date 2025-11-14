/**
 * WaifuPanel - 와이푸 패널
 * 세로 이미지, 대사, 호감도, 완료한 작업 수, 기분 표시
 * 호감도에 따라 자동으로 이미지가 변경됩니다.
 * 4번 클릭 또는 10분마다 같은 호감도 범위 내에서 랜덤 이미지로 변경됩니다.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWaifuState } from '@/shared/hooks';
import { getWaifuImagePathWithFallback, getRandomImageNumber, getAffectionTier } from './waifuImageUtils';
import './waifu.css';

interface WaifuPanelProps {
  imagePath?: string; // 수동 이미지 경로 (optional, 지정하지 않으면 호감도 기반 자동 선택)
}

export default function WaifuPanel({ imagePath }: WaifuPanelProps) {
  const { waifuState, loading, currentMood, currentDialogue } = useWaifuState();
  const [displayImagePath, setDisplayImagePath] = useState<string>('');
  const [clickCount, setClickCount] = useState(0);
  const lastImageChangeTime = useRef<number>(Date.now());

  // 이미지 변경 함수
  const changeImage = useCallback(async (affection: number) => {
    if (!waifuState) return;

    const tier = getAffectionTier(affection);
    const newImageNumber = getRandomImageNumber(tier.name);

    const path = await getWaifuImagePathWithFallback(affection, newImageNumber);
    setDisplayImagePath(path);
    lastImageChangeTime.current = Date.now();
  }, [waifuState]);

  // 초기 이미지 로드 및 호감도 변경 시 이미지 업데이트
  useEffect(() => {
    if (imagePath) {
      setDisplayImagePath(imagePath);
    } else if (waifuState) {
      changeImage(waifuState.affection);
    }
  }, [imagePath, waifuState?.affection, changeImage]);

  // 10분마다 자동으로 이미지 변경
  useEffect(() => {
    if (!waifuState) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastImageChangeTime.current;

      // 10분 (600,000ms) 경과 시 이미지 변경
      if (elapsed >= 600000) {
        changeImage(waifuState.affection);
      }
    }, 60000); // 1분마다 체크

    return () => clearInterval(interval);
  }, [waifuState, changeImage]);

  // 클릭 핸들러 - 4번 클릭마다 이미지 변경 (호감도 변화는 제거)
  const handleClick = useCallback(() => {
    if (!waifuState) return;

    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // 4번 클릭마다 이미지 변경
    if (newClickCount % 4 === 0) {
      changeImage(waifuState.affection);
      setClickCount(0); // 카운트 리셋
    }
  }, [clickCount, waifuState, changeImage]);

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

  // 기분 설명 가져오기
  const getMoodDescription = (mood: string): string => {
    switch (mood) {
      case '🥰': return '애정 넘침';
      case '😊': return '호감';
      case '🙂': return '관심';
      case '😐': return '무관심';
      case '😠': return '경계';
      case '😡': return '적대';
      default: return '보통';
    }
  };

  return (
    <div className="waifu-panel">
      {/* 와이푸 이미지 */}
      <div
        className="waifu-image-container"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`와이푸 이미지. 클릭 시 포즈 변경. 현재 호감도: ${waifuState.affection}%, 기분: ${currentMood}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
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
                폴더 구조: hostile/, wary/, indifferent/,
                <br />
                interested/, affectionate/, loving/
                <br />
                각 폴더에 1.png, 2.png, 3.png...
              </small>
            </p>
          </div>
        )}
        <div className="waifu-click-hint" aria-hidden="true">
          클릭하여 포즈 변경 ({clickCount}/4)
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
              <span className="mood-icon">{currentMood}</span>
              <span className="mood-description">{getMoodDescription(currentMood)}</span>
            </div>
          </div>

          {/* 완료한 작업 수 */}
          <div className="waifu-stat-card">
            <div className="stat-label">오늘 완료한 작업</div>
            <div className="stat-value tasks-value" role="status">
              {waifuState.tasksCompletedToday}개
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

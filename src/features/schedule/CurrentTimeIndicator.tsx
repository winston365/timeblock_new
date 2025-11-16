/**
 * CurrentTimeIndicator
 *
 * @role 스케줄 뷰에서 현재 시간을 시각적으로 표시하는 인디케이터 컴포넌트
 * @input scheduleRef (스케줄 컨테이너 ref), dailyData (블록 크기 변화 감지용)
 * @output 현재 시간 위치에 표시되는 인디케이터 라인과 시간 레이블
 * @external_dependencies
 *   - TIME_BLOCKS: 시간 블록 정의
 *   - ResizeObserver: 블록 크기 변화 감지
 */

import { useState, useEffect } from 'react';
import { TIME_BLOCKS } from '@/shared/types/domain';
import type { DailyData } from '@/shared/types/domain';

interface CurrentTimeIndicatorProps {
  scheduleRef: React.RefObject<HTMLDivElement>;
  dailyData: DailyData | null;
}

/**
 * 현재 시간 인디케이터 컴포넌트
 *
 * @param {CurrentTimeIndicatorProps} props - scheduleRef와 dailyData
 * @returns {JSX.Element | null} 인디케이터 UI 또는 null
 * @sideEffects
 *   - 1분마다 현재 시간 업데이트
 *   - ResizeObserver로 블록 크기 변화 감지
 *   - 인디케이터 위치 계산 및 표시
 */
export default function CurrentTimeIndicator({ scheduleRef, dailyData }: CurrentTimeIndicatorProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [indicatorPosition, setIndicatorPosition] = useState<number | null>(null);

  // 1분 단위로 현재 시간 업데이트
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };

    updateTime(); // 초기 실행
    const interval = setInterval(updateTime, 60 * 1000); // 1분

    return () => clearInterval(interval);
  }, []);

  // 현재 시간 인디케이터 위치 계산
  useEffect(() => {
    const calculateIndicatorPosition = () => {
      if (!scheduleRef.current) return null;

      const currentTotalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

      // 현재 시간대 블록 찾기
      const currentBlock = TIME_BLOCKS.find(
        b => currentTotalMinutes >= b.start * 60 && currentTotalMinutes < b.end * 60
      );

      if (!currentBlock) {
        setIndicatorPosition(null);
        return;
      }

      // 현재 블록의 DOM 요소 찾기
      const blockElement = scheduleRef.current.querySelector(
        `.time-block[data-block-id="${currentBlock.id}"]`
      ) as HTMLElement;

      if (!blockElement) {
        setIndicatorPosition(null);
        return;
      }

      // 블록 시작/종료 시간 (분 단위)
      const blockStartMinutes = currentBlock.start * 60;
      const blockEndMinutes = currentBlock.end * 60;

      // 블록 내 경과 시간 비율
      const elapsedMinutes = currentTotalMinutes - blockStartMinutes;
      const totalBlockMinutes = blockEndMinutes - blockStartMinutes;
      const progressRatio = elapsedMinutes / totalBlockMinutes;

      // 블록의 위치와 높이
      const scheduleTop = scheduleRef.current.getBoundingClientRect().top;
      const blockTop = blockElement.getBoundingClientRect().top;
      const blockHeight = blockElement.offsetHeight;

      // 스케줄 영역 기준 상대 위치
      const relativeBlockTop = blockTop - scheduleTop;

      // 최종 인디케이터 위치 (스케줄 영역 상단 기준)
      const position = relativeBlockTop + (blockHeight * progressRatio);

      setIndicatorPosition(position);
    };

    calculateIndicatorPosition();

    // ResizeObserver로 블록 크기 변화 감지
    const resizeObserver = new ResizeObserver(() => {
      calculateIndicatorPosition();
    });

    if (scheduleRef.current) {
      const blocks = scheduleRef.current.querySelectorAll('.time-block');
      blocks.forEach(block => resizeObserver.observe(block));
    }

    return () => resizeObserver.disconnect();
  }, [currentTime, dailyData, scheduleRef]);

  // 현재 시간 포맷팅 (HH:MM)
  const formatCurrentTime = () => {
    const hour = currentTime.getHours().toString().padStart(2, '0');
    const minute = currentTime.getMinutes().toString().padStart(2, '0');
    return `${hour}:${minute}`;
  };

  if (indicatorPosition === null) {
    return null;
  }

  return (
    <div
      className="global-time-indicator"
      style={{
        top: `${indicatorPosition}px`,
      }}
    >
      <div className="time-indicator-line" />
      <div className="time-indicator-label">
        <span className="time-text">{formatCurrentTime()}</span>
      </div>
    </div>
  );
}

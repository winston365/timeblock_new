/**
 * ExpandHintBadge.tsx
 *
 * @file 첫 1회 더보기 힌트 배지
 * @description
 *   - T16: compact 모드에서 첫 1회 더보기 힌트 표시
 *   - 사용자가 본 후에는 다시 표시하지 않음
 *   - ADHD 친화적: 기능 발견 도움
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getGoalsExpandHintShown, 
  setGoalsExpandHintShown 
} from '../utils/goalSystemState';

interface ExpandHintBadgeProps {
  /** 축소 모드 활성화 여부 */
  compactMode: boolean;
}

/**
 * 첫 1회 더보기 힌트 배지 컴포넌트
 */
export default function ExpandHintBadge({ compactMode }: ExpandHintBadgeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 표시 여부 확인
  useEffect(() => {
    let mounted = true;

    const checkVisibility = async () => {
      try {
        const hintShown = await getGoalsExpandHintShown();
        
        if (mounted) {
          // compact 모드이고, 아직 힌트를 본 적 없으면 표시
          setIsVisible(compactMode && !hintShown);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[ExpandHintBadge] Failed to check visibility:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void checkVisibility();

    return () => {
      mounted = false;
    };
  }, [compactMode]);

  // 힌트 닫기
  const handleDismiss = useCallback(async () => {
    setIsVisible(false);
    await setGoalsExpandHintShown(true);
  }, []);

  // 로딩 중이거나 표시 안 함
  if (isLoading || !isVisible) {
    return null;
  }

  return (
    <div className="mb-3 flex items-center justify-center">
      <div className="flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 text-xs text-indigo-300">
        <span>💡</span>
        <span>카드 하단의 "⚡ 빠른 조절 펼치기"를 클릭하면 상세 조절이 가능해요!</span>
        <button
          type="button"
          onClick={handleDismiss}
          className="ml-1 rounded-full p-0.5 hover:bg-indigo-500/30 transition"
          aria-label="힌트 닫기"
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

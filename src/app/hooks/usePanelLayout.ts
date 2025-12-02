/**
 * usePanelLayout Hook
 *
 * @file usePanelLayout.ts
 * @role 패널 레이아웃 상태 관리
 * @responsibilities
 *   - 좌/우 패널 접힘 상태 관리
 *   - 타임라인 뷰 표시/숨김 상태 관리
 *   - Dexie systemState 영속화
 *   - 반응형 레이아웃 (창 크기에 따른 자동 패널 접기)
 *   - 집중 모드 적용
 * @dependencies
 *   - dexieClient: systemState 영속화
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/data/db/dexieClient';

/**
 * 패널 레이아웃 상태 인터페이스
 */
interface PanelLayoutState {
  /** 좌측 사이드바 접힘 상태 (사용자 설정) */
  leftSidebarCollapsed: boolean;
  /** 우측 패널 접힘 상태 (사용자 설정) */
  rightPanelsCollapsed: boolean;
  /** 타임라인 뷰 표시 상태 */
  timelineVisible: boolean;
  /** 실제 좌측 접힘 상태 (집중 모드 적용) */
  effectiveLeftCollapsed: boolean;
  /** 실제 우측 접힘 상태 (집중 모드 적용) */
  effectiveRightCollapsed: boolean;
  /** 실제 타임라인 표시 상태 (집중 모드 적용) */
  effectiveTimelineVisible: boolean;
  /** CSS Grid 템플릿 컬럼 값 */
  gridTemplateColumns: string;
  /** 좌측 사이드바 토글 함수 */
  toggleLeftSidebar: () => void;
  /** 우측 패널 토글 함수 */
  toggleRightPanels: () => void;
  /** 타임라인 뷰 토글 함수 */
  toggleTimeline: () => void;
}

// Dexie systemState 키
const LEFT_SIDEBAR_KEY = 'leftSidebarCollapsed';
const RIGHT_PANELS_KEY = 'rightPanelsCollapsed';
const TIMELINE_VISIBLE_KEY = 'timelineVisible';

/**
 * 패널 레이아웃 관리 훅
 *
 * 좌측 사이드바와 우측 패널의 접힘 상태를 관리합니다.
 * 상태는 Dexie systemState에 영속화되고, 창 크기에 따라 자동으로 패널이 접힙니다.
 * 집중 모드에서는 모든 패널이 강제로 접힙니다.
 *
 * @param {boolean} isFocusMode - 집중 모드 활성화 여부
 * @returns {PanelLayoutState} 패널 상태 및 토글 함수
 */
export function usePanelLayout(isFocusMode: boolean): PanelLayoutState {
  // 패널 접힘 상태 (초기값 false, Dexie에서 로드 후 업데이트)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightPanelsCollapsed, setRightPanelsCollapsed] = useState(false);
  const [timelineVisible, setTimelineVisible] = useState(true); // 기본값: 표시
  const [initialized, setInitialized] = useState(false);

  // Dexie에서 초기값 로드
  useEffect(() => {
    const loadFromDexie = async () => {
      try {
        const leftState = await db.systemState.get(LEFT_SIDEBAR_KEY);
        const rightState = await db.systemState.get(RIGHT_PANELS_KEY);
        const timelineState = await db.systemState.get(TIMELINE_VISIBLE_KEY);
        
        if (leftState?.value === true) {
          setLeftSidebarCollapsed(true);
        }
        if (rightState?.value === true) {
          setRightPanelsCollapsed(true);
        }
        // 타임라인은 명시적으로 false인 경우에만 숨김 (기본 true)
        if (timelineState?.value === false) {
          setTimelineVisible(false);
        }
      } catch (error) {
        console.error('Failed to load panel layout from Dexie:', error);
      } finally {
        setInitialized(true);
      }
    };

    loadFromDexie();
  }, []);

  // Dexie에 상태 저장 헬퍼
  const saveToSystemState = useCallback(async (key: string, value: boolean) => {
    try {
      await db.systemState.put({ key, value });
    } catch (error) {
      console.error(`Failed to save ${key} to Dexie:`, error);
    }
  }, []);

  // 반응형 레이아웃: 창 크기에 따른 자동 패널 접기
  useEffect(() => {
    if (!initialized) return;

    const handleResize = () => {
      const width = window.innerWidth;

      // 1200px 미만: 우측 패널 자동 접기
      if (width < 1200) {
        setRightPanelsCollapsed(prev => {
          if (!prev) {
            saveToSystemState(RIGHT_PANELS_KEY, true);
            return true;
          }
          return prev;
        });
      }

      // 800px 미만: 좌측 사이드바 자동 접기
      if (width < 800) {
        setLeftSidebarCollapsed(prev => {
          if (!prev) {
            saveToSystemState(LEFT_SIDEBAR_KEY, true);
            return true;
          }
          return prev;
        });
      }
    };

    // 초기 실행 및 이벤트 리스너 등록
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initialized, saveToSystemState]);

  // Focus Mode 적용
  const effectiveLeftCollapsed = leftSidebarCollapsed || isFocusMode;
  const effectiveRightCollapsed = rightPanelsCollapsed || isFocusMode;
  const effectiveTimelineVisible = timelineVisible && !isFocusMode;

  // Grid 템플릿 계산 (타임라인 + 3컬럼 = 4컬럼 레이아웃)
  const gridTemplateColumns = useMemo(() => {
    const timelineWidth = effectiveTimelineVisible ? '360px' : '0';
    
    if (effectiveLeftCollapsed && effectiveRightCollapsed) {
      return `0 ${timelineWidth} 1fr 0`;
    }
    if (effectiveLeftCollapsed) {
      return `0 ${timelineWidth} 1fr 340px`;
    }
    if (effectiveRightCollapsed) {
      return `320px ${timelineWidth} 1fr 0`;
    }
    return `320px ${timelineWidth} 1fr 340px`;
  }, [effectiveLeftCollapsed, effectiveRightCollapsed, effectiveTimelineVisible]);

  // 토글 핸들러
  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarCollapsed(prev => {
      const newValue = !prev;
      saveToSystemState(LEFT_SIDEBAR_KEY, newValue);
      return newValue;
    });
  }, [saveToSystemState]);

  const toggleRightPanels = useCallback(() => {
    setRightPanelsCollapsed(prev => {
      const newValue = !prev;
      saveToSystemState(RIGHT_PANELS_KEY, newValue);
      return newValue;
    });
  }, [saveToSystemState]);

  const toggleTimeline = useCallback(() => {
    setTimelineVisible(prev => {
      const newValue = !prev;
      saveToSystemState(TIMELINE_VISIBLE_KEY, newValue);
      return newValue;
    });
  }, [saveToSystemState]);

  return {
    leftSidebarCollapsed,
    rightPanelsCollapsed,
    timelineVisible,
    effectiveLeftCollapsed,
    effectiveRightCollapsed,
    effectiveTimelineVisible,
    gridTemplateColumns,
    toggleLeftSidebar,
    toggleRightPanels,
    toggleTimeline,
  };
}

/**
 * usePanelLayout Hook
 *
 * @file usePanelLayout.ts
 * @role 패널 레이아웃 상태 관리
 * @responsibilities
 *   - 좌/우 패널 접힘 상태 관리
 *   - 타임라인 뷰 표시/숨김 상태 관리
 *   - systemRepository 영속화
 *   - 반응형 레이아웃 (창 크기에 따른 자동 패널 접기)
 *   - 집중 모드 적용
 * @dependencies
 *   - systemRepository: systemState 영속화
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';

const AUTO_COLLAPSE_WIDTH_PX = 800;
const LEFT_PANEL_WIDTH_PX = 320;
const TIMELINE_WIDTH_PX = 360;

type SystemKey = (typeof SYSTEM_KEYS)[keyof typeof SYSTEM_KEYS];

/**
 * 패널 레이아웃 상태 인터페이스
 */
interface PanelLayoutState {
  /** 좌측 사이드바 접힘 상태 (사용자 설정) */
  leftSidebarCollapsed: boolean;
  /** 타임라인 뷰 표시 상태 */
  timelineVisible: boolean;
  /** 실제 좌측 접힘 상태 (집중 모드 적용) */
  effectiveLeftCollapsed: boolean;
  /** 실제 타임라인 표시 상태 (집중 모드 적용) */
  effectiveTimelineVisible: boolean;
  /** CSS Grid 템플릿 컬럼 값 */
  gridTemplateColumns: string;
  /** 좌측 사이드바 토글 함수 */
  toggleLeftSidebar: () => void;
  /** 타임라인 뷰 토글 함수 */
  toggleTimeline: () => void;
}

/**
 * 패널 레이아웃 관리 훅
 *
 * 좌측 사이드바의 접힘 상태를 관리합니다.
 * 상태는 systemRepository에 영속화되고, 창 크기에 따라 자동으로 패널이 접힙니다.
 * 집중 모드에서는 모든 패널이 강제로 접힙니다.
 *
 * @param {boolean} isFocusMode - 집중 모드 활성화 여부
 * @returns {PanelLayoutState} 패널 상태 및 토글 함수
 */
export function usePanelLayout(isFocusMode: boolean): PanelLayoutState {
  // 패널 접힘 상태 (초기값 false, systemRepository에서 로드 후 업데이트)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [timelineVisible, setTimelineVisible] = useState(true); // 기본값: 표시
  const [initialized, setInitialized] = useState(false);

  // systemRepository에서 초기값 로드
  useEffect(() => {
    const loadFromRepository = async () => {
      try {
        const leftState = await getSystemState<boolean>(SYSTEM_KEYS.LEFT_SIDEBAR_COLLAPSED);
        const timelineState = await getSystemState<boolean>(SYSTEM_KEYS.TIMELINE_VISIBLE);
        
        if (leftState === true) {
          setLeftSidebarCollapsed(true);
        }
        // 타임라인은 명시적으로 false인 경우에만 숨김 (기본 true)
        if (timelineState === false) {
          setTimelineVisible(false);
        }
      } catch (error) {
        console.error('Failed to load panel layout from repository:', error);
      } finally {
        setInitialized(true);
      }
    };

    loadFromRepository();
  }, []);

  // systemRepository에 상태 저장 헬퍼
  const saveToSystemState = useCallback(async (key: SystemKey, value: boolean) => {
    try {
      await setSystemState(key, value);
    } catch (error) {
      console.error(`Failed to save ${key} to repository:`, error);
    }
  }, []);

  // 반응형 레이아웃: 창 크기에 따른 자동 패널 접기
  useEffect(() => {
    if (!initialized) return;

    const handleResize = () => {
      const width = window.innerWidth;

      // 800px 미만: 좌측 사이드바 자동 접기
      if (width < AUTO_COLLAPSE_WIDTH_PX) {
        setLeftSidebarCollapsed(prev => {
          if (!prev) {
            void saveToSystemState(SYSTEM_KEYS.LEFT_SIDEBAR_COLLAPSED, true);
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
  const effectiveTimelineVisible = timelineVisible && !isFocusMode;

  // Grid 템플릿 계산 (타임라인 + 2컬럼 = 3컬럼 레이아웃, 우측 패널 제거됨)
  const gridTemplateColumns = useMemo(() => {
    const timelineWidth = effectiveTimelineVisible ? `${TIMELINE_WIDTH_PX}px` : '0';
    
    if (effectiveLeftCollapsed) {
      return `0 ${timelineWidth} 1fr`;
    }
    return `${LEFT_PANEL_WIDTH_PX}px ${timelineWidth} 1fr`;
  }, [effectiveLeftCollapsed, effectiveTimelineVisible]);

  // 토글 핸들러
  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarCollapsed(prev => {
      const newValue = !prev;
      void saveToSystemState(SYSTEM_KEYS.LEFT_SIDEBAR_COLLAPSED, newValue);
      return newValue;
    });
  }, [saveToSystemState]);

  const toggleTimeline = useCallback(() => {
    setTimelineVisible(prev => {
      const newValue = !prev;
      void saveToSystemState(SYSTEM_KEYS.TIMELINE_VISIBLE, newValue);
      return newValue;
    });
  }, [saveToSystemState]);

  return {
    leftSidebarCollapsed,
    timelineVisible,
    effectiveLeftCollapsed,
    effectiveTimelineVisible,
    gridTemplateColumns,
    toggleLeftSidebar,
    toggleTimeline,
  };
}

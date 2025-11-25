/**
 * usePanelLayout Hook
 *
 * @role 패널 레이아웃 상태 관리 (좌/우 패널 접힘, 반응형 처리)
 * @input isFocusMode
 * @output 패널 상태 및 토글 함수
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

interface PanelLayoutState {
  leftSidebarCollapsed: boolean;
  rightPanelsCollapsed: boolean;
  effectiveLeftCollapsed: boolean;
  effectiveRightCollapsed: boolean;
  gridTemplateColumns: string;
  toggleLeftSidebar: () => void;
  toggleRightPanels: () => void;
}

/**
 * 패널 레이아웃 관리 훅
 */
export function usePanelLayout(isFocusMode: boolean): PanelLayoutState {
  // 패널 접힘 상태 (localStorage에서 초기값 로드)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('leftSidebarCollapsed');
    return saved === 'true';
  });
  
  const [rightPanelsCollapsed, setRightPanelsCollapsed] = useState(() => {
    const saved = localStorage.getItem('rightPanelsCollapsed');
    return saved === 'true';
  });

  // 반응형 레이아웃: 창 크기에 따른 자동 패널 접기
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;

      // 1200px 미만: 우측 패널 자동 접기
      if (width < 1200) {
        setRightPanelsCollapsed(prev => {
          if (!prev) {
            localStorage.setItem('rightPanelsCollapsed', 'true');
            return true;
          }
          return prev;
        });
      }

      // 800px 미만: 좌측 사이드바 자동 접기
      if (width < 800) {
        setLeftSidebarCollapsed(prev => {
          if (!prev) {
            localStorage.setItem('leftSidebarCollapsed', 'true');
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
  }, []);

  // Focus Mode 적용
  const effectiveLeftCollapsed = leftSidebarCollapsed || isFocusMode;
  const effectiveRightCollapsed = rightPanelsCollapsed || isFocusMode;

  // Grid 템플릿 계산
  const gridTemplateColumns = useMemo(() => {
    if (effectiveLeftCollapsed && effectiveRightCollapsed) {
      return '0 1fr 0 0';
    }
    if (effectiveLeftCollapsed) {
      return '0 minmax(600px, 1fr) 320px 336px';
    }
    if (effectiveRightCollapsed) {
      return '380px minmax(600px, 1fr) 0 0';
    }
    return '380px minmax(600px, 1fr) 320px 336px';
  }, [effectiveLeftCollapsed, effectiveRightCollapsed]);

  // 토글 핸들러
  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('leftSidebarCollapsed', String(newValue));
      return newValue;
    });
  }, []);

  const toggleRightPanels = useCallback(() => {
    setRightPanelsCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('rightPanelsCollapsed', String(newValue));
      return newValue;
    });
  }, []);

  return {
    leftSidebarCollapsed,
    rightPanelsCollapsed,
    effectiveLeftCollapsed,
    effectiveRightCollapsed,
    gridTemplateColumns,
    toggleLeftSidebar,
    toggleRightPanels,
  };
}

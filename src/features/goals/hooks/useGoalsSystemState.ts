/**
 * useGoalsSystemState.ts
 *
 * @file Goals 시스템 상태 관리 훅
 * @description
 *   - Goals 관련 systemState를 React 상태로 관리
 *   - 필터, 모드 등의 영속 상태 제공
 *   - Dexie systemState와 동기화
 */

import { useState, useEffect, useCallback } from 'react';
import { SYSTEM_STATE_DEFAULTS } from '@/shared/constants/defaults';
import {
  getGoalsFilterTodayOnly,
  setGoalsFilterTodayOnly,
  getGoalsCompactMode,
  setGoalsCompactMode,
  getGoalsAdvancedInputEnabled,
  setGoalsAdvancedInputEnabled,
  getGoalsThemeFilter,
  setGoalsThemeFilter,
  getGoalsExpandHintShown,
  setGoalsExpandHintShown,
} from '../utils/goalSystemState';

interface UseGoalsSystemStateReturn {
  /** 오늘만 보기 필터 */
  filterTodayOnly: boolean;
  setFilterTodayOnly: (value: boolean) => void;
  
  /** 축소 모드 */
  compactMode: boolean;
  setCompactMode: (value: boolean) => void;
  
  /** 고급 입력 활성화 */
  advancedInputEnabled: boolean;
  setAdvancedInputEnabled: (value: boolean) => void;
  
  /** 테마 필터 */
  themeFilter: string | null;
  setThemeFilter: (value: string | null) => void;
  
  /** 더보기 힌트 노출 여부 */
  expandHintShown: boolean;
  setExpandHintShown: (value: boolean) => void;
  
  /** 로딩 상태 */
  loading: boolean;
}

/**
 * Goals 시스템 상태 관리 훅
 *
 * @returns Goals systemState 상태 및 setter
 */
export function useGoalsSystemState(): UseGoalsSystemStateReturn {
  const [loading, setLoading] = useState(true);
  
  // 필터 상태
  const [filterTodayOnly, setFilterTodayOnlyState] = useState(
    SYSTEM_STATE_DEFAULTS.goalsFilterTodayOnly
  );
  
  // 축소 모드
  const [compactMode, setCompactModeState] = useState(
    SYSTEM_STATE_DEFAULTS.goalsCompactMode
  );
  
  // 고급 입력
  const [advancedInputEnabled, setAdvancedInputEnabledState] = useState(
    SYSTEM_STATE_DEFAULTS.goalsAdvancedInputEnabled
  );
  
  // 테마 필터
  const [themeFilter, setThemeFilterState] = useState<string | null>(
    SYSTEM_STATE_DEFAULTS.goalsThemeFilter
  );
  
  // 더보기 힌트
  const [expandHintShown, setExpandHintShownState] = useState(
    SYSTEM_STATE_DEFAULTS.goalsExpandHintShown
  );

  // 초기 로드
  useEffect(() => {
    let mounted = true;
    
    const loadState = async () => {
      try {
        const [
          filterValue,
          compactValue,
          advancedValue,
          themeValue,
          hintValue,
        ] = await Promise.all([
          getGoalsFilterTodayOnly(),
          getGoalsCompactMode(),
          getGoalsAdvancedInputEnabled(),
          getGoalsThemeFilter(),
          getGoalsExpandHintShown(),
        ]);
        
        if (mounted) {
          setFilterTodayOnlyState(filterValue);
          setCompactModeState(compactValue);
          setAdvancedInputEnabledState(advancedValue);
          setThemeFilterState(themeValue);
          setExpandHintShownState(hintValue);
          setLoading(false);
        }
      } catch (error) {
        console.error('[useGoalsSystemState] Failed to load state:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    void loadState();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Setter with persistence
  const setFilterTodayOnly = useCallback((value: boolean) => {
    setFilterTodayOnlyState(value);
    void setGoalsFilterTodayOnly(value);
  }, []);

  const setCompactMode = useCallback((value: boolean) => {
    setCompactModeState(value);
    void setGoalsCompactMode(value);
  }, []);

  const setAdvancedInputEnabled = useCallback((value: boolean) => {
    setAdvancedInputEnabledState(value);
    void setGoalsAdvancedInputEnabled(value);
  }, []);

  const setThemeFilter = useCallback((value: string | null) => {
    setThemeFilterState(value);
    void setGoalsThemeFilter(value);
  }, []);

  const setExpandHintShown = useCallback((value: boolean) => {
    setExpandHintShownState(value);
    void setGoalsExpandHintShown(value);
  }, []);

  return {
    filterTodayOnly,
    setFilterTodayOnly,
    compactMode,
    setCompactMode,
    advancedInputEnabled,
    setAdvancedInputEnabled,
    themeFilter,
    setThemeFilter,
    expandHintShown,
    setExpandHintShown,
    loading,
  };
}

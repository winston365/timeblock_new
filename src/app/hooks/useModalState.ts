/**
 * useModalState Hook
 *
 * @file useModalState.ts
 * @role 모달 상태 관리
 * @responsibilities
 *   - 모든 모달의 열림/닫힘 상태 관리
 *   - 모달 제어 핸들러 제공
 * @dependencies
 *   - 없음 (순수 React 상태)
 */

import { useState, useCallback } from 'react';

/**
 * 모달 표시 상태 인터페이스
 */
interface ModalState {
  /** 대량 추가 모달 표시 여부 */
  showBulkAdd: boolean;
  /** 설정 모달 표시 여부 */
  showSettings: boolean;
  /** 템플릿 모달 표시 여부 */
  showTemplates: boolean;
}

/**
 * 모달 제어 핸들러 인터페이스
 */
interface ModalHandlers {
  /** 대량 추가 모달 열기 */
  openBulkAdd: () => void;
  /** 대량 추가 모달 닫기 */
  closeBulkAdd: () => void;
  /** 설정 모달 열기 */
  openSettings: () => void;
  /** 설정 모달 닫기 */
  closeSettings: () => void;
  /** 템플릿 모달 열기 */
  openTemplates: () => void;
  /** 템플릿 모달 닫기 */
  closeTemplates: () => void;
}

type UseModalStateReturn = ModalState & ModalHandlers;

/**
 * 모달 상태 관리 훅
 *
 * 애플리케이션에서 사용되는 모든 모달의 표시 상태와
 * 열기/닫기 핸들러를 제공합니다.
 *
 * @returns {UseModalStateReturn} 모달 상태 및 제어 핸들러
 */
export function useModalState(): UseModalStateReturn {
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const openBulkAdd = useCallback(() => setShowBulkAdd(true), []);
  const closeBulkAdd = useCallback(() => setShowBulkAdd(false), []);
  
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  
  const openTemplates = useCallback(() => setShowTemplates(true), []);
  const closeTemplates = useCallback(() => setShowTemplates(false), []);

  return {
    showBulkAdd,
    showSettings,
    showTemplates,
    openBulkAdd,
    closeBulkAdd,
    openSettings,
    closeSettings,
    openTemplates,
    closeTemplates,
  };
}

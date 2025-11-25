/**
 * useModalState Hook
 *
 * @role 모달 상태 관리를 위한 커스텀 훅
 * @input 없음
 * @output 모달 상태 및 핸들러
 */

import { useState, useCallback } from 'react';

interface ModalState {
  showGeminiChat: boolean;
  showBulkAdd: boolean;
  showSettings: boolean;
  showTemplates: boolean;
}

interface ModalHandlers {
  openGeminiChat: () => void;
  closeGeminiChat: () => void;
  openBulkAdd: () => void;
  closeBulkAdd: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openTemplates: () => void;
  closeTemplates: () => void;
}

type UseModalStateReturn = ModalState & ModalHandlers;

/**
 * 모달 상태 관리 훅
 */
export function useModalState(): UseModalStateReturn {
  const [showGeminiChat, setShowGeminiChat] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const openGeminiChat = useCallback(() => setShowGeminiChat(true), []);
  const closeGeminiChat = useCallback(() => setShowGeminiChat(false), []);
  
  const openBulkAdd = useCallback(() => setShowBulkAdd(true), []);
  const closeBulkAdd = useCallback(() => setShowBulkAdd(false), []);
  
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  
  const openTemplates = useCallback(() => setShowTemplates(true), []);
  const closeTemplates = useCallback(() => setShowTemplates(false), []);

  return {
    showGeminiChat,
    showBulkAdd,
    showSettings,
    showTemplates,
    openGeminiChat,
    closeGeminiChat,
    openBulkAdd,
    closeBulkAdd,
    openSettings,
    closeSettings,
    openTemplates,
    closeTemplates,
  };
}

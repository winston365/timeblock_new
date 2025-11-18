/**
 * Electron Preload Script
 *
 * @role Main Process와 Renderer Process 간 안전한 브릿지
 * @input 없음 (윈도우 생성 시 자동 로드)
 * @output window.electronAPI 객체
 * @external_dependencies
 *   - electron: contextBridge, ipcRenderer
 *
 * @security
 *   - contextIsolation: true 환경에서 동작
 *   - 최소한의 API만 노출 (Principle of Least Privilege)
 */

import { contextBridge, ipcRenderer } from 'electron';

// ============================================================================
// Electron API 정의
// ============================================================================

/**
 * Renderer에 노출할 안전한 API
 */
const electronAPI = {
  // 플랫폼 정보
  platform: process.platform,

  // 앱 버전 가져오기
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('get-app-version');
  },

  // 수동 업데이트 체크
  checkForUpdates: (): Promise<{
    success: boolean;
    message: string;
    currentVersion?: string;
    updateInfo?: any;
    error?: string;
  }> => {
    return ipcRenderer.invoke('check-for-updates');
  },

  // QuickAdd 창 닫기
  closeQuickAddWindow: (): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('close-quickadd-window');
  },

  // 윈도우 알림 표시
  showNotification: (title: string, body: string): Promise<{ success: boolean; message?: string }> => {
    return ipcRenderer.invoke('show-notification', title, body);
  },
};

// ============================================================================
// Context Bridge로 안전하게 노출
// ============================================================================

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  console.log('✅ Preload: electronAPI exposed successfully');
} catch (error) {
  console.error('❌ Preload: Failed to expose electronAPI', error);
}

// ============================================================================
// TypeScript 타입 선언 (window 객체 확장)
// ============================================================================

export type ElectronAPI = typeof electronAPI;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

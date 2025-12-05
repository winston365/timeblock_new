/* eslint-disable @typescript-eslint/no-explicit-any */
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
 * Electron API 정의
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

  // 날씨 정보 fetch (CORS 회피)
  fetchWeather: (city?: string): Promise<string> => {
    return ipcRenderer.invoke('fetch-weather', city);
  },

  // PiP 모드 제어
  openPip: (): Promise<void> => ipcRenderer.invoke('open-pip'),
  closePip: (): Promise<void> => ipcRenderer.invoke('close-pip'),

  // PiP 상태 동기화 (Main -> PiP)
  sendPipUpdate: (data: any): Promise<void> => ipcRenderer.invoke('pip-update', data),
  onPipUpdate: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('pip-update-msg', subscription);
    return () => ipcRenderer.removeListener('pip-update-msg', subscription);
  },

  // PiP 액션 (PiP -> Main)
  sendPipAction: (action: string, payload?: any): Promise<void> => ipcRenderer.invoke('pip-action', action, payload),
  onPipAction: (callback: (action: string, payload?: any) => void) => {
    const subscription = (_: any, action: string, payload: any) => callback(action, payload);
    ipcRenderer.on('pip-action-msg', subscription);
    return () => ipcRenderer.removeListener('pip-action-msg', subscription);
  },

  // 메인 윈도우 최상위 설정
  setMainAlwaysOnTop: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('set-main-always-on-top', enabled),

  // Google OAuth (Authorization Code Flow with PKCE)
  googleOAuthLogin: (clientId: string, clientSecret: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> => ipcRenderer.invoke('google-oauth-login', clientId, clientSecret),

  googleOAuthWaitCallback: (): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    email?: string;
    error?: string;
  }> => ipcRenderer.invoke('google-oauth-wait-callback'),

  googleOAuthRefresh: (clientId: string, clientSecret: string, refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    error?: string;
  }> => ipcRenderer.invoke('google-oauth-refresh', clientId, clientSecret, refreshToken),
};

// ============================================================================
// Context Bridge로 안전하게 노출
// ============================================================================

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} catch (exposeBridgeError) {
  console.error('❌ Preload: Failed to expose electronAPI', exposeBridgeError);
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

/// <reference types="vite/client" />

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.gif' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

declare module '*.webp' {
  const value: string;
  export default value;
}

type CheckForUpdatesResult = {
  success: boolean;
  message: string;
  currentVersion?: string;
  updateInfo?: unknown;
  error?: string;
};

type SimpleResult = {
  success: boolean;
  message?: string;
};

type GoogleOAuthLoginResult = {
  success: boolean;
  message?: string;
  error?: string;
};

type GoogleOAuthWaitCallbackResult = {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  email?: string;
  error?: string;
};

type GoogleOAuthRefreshResult = {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
};

// Electron API 타입 정의 (preload에서 노출되는 window.electronAPI와 동기화)
interface ElectronAPI {
  platform: string;

  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<CheckForUpdatesResult>;

  closeQuickAddWindow: () => Promise<SimpleResult>;
  showNotification: (title: string, body: string) => Promise<SimpleResult>;
  fetchWeather: (city?: string) => Promise<string>;

  openPip: () => Promise<void>;
  closePip: () => Promise<void>;
  sendPipUpdate: (data: unknown) => Promise<void>;
  onPipUpdate: (callback: (data: unknown) => void) => () => void;
  sendPipAction: (action: string, payload?: unknown) => Promise<void>;
  onPipAction: (callback: (action: string, payload?: unknown) => void) => () => void;

  setMainAlwaysOnTop: (enabled: boolean) => Promise<boolean>;

  googleOAuthLogin: (clientId: string, clientSecret: string) => Promise<GoogleOAuthLoginResult>;
  googleOAuthWaitCallback: () => Promise<GoogleOAuthWaitCallbackResult>;
  googleOAuthRefresh: (clientId: string, clientSecret: string, refreshToken: string) => Promise<GoogleOAuthRefreshResult>;
}

interface Window {
  electronAPI?: ElectronAPI;
}

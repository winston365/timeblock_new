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

// Electron API 타입 정의
interface ElectronAPI {
  platform: string;
  getAppVersion: () => Promise<string>;
  closeQuickAddWindow: () => Promise<boolean>;
  showNotification: (title: string, body: string) => Promise<boolean>;
  fetchWeather: (city?: string) => Promise<string>;
}

interface Window {
  electronAPI?: ElectronAPI;
}

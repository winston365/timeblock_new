/**
 * Electron Main Process
 *
 * @role Electron 앱의 메인 프로세스 (윈도우 생성, 라이프사이클 관리)
 * @input 없음 (앱 시작 시 자동 실행)
 * @output BrowserWindow 인스턴스, 앱 라이프사이클 이벤트
 * @external_dependencies
 *   - electron: BrowserWindow, app, ipcMain
 *   - path: 경로 처리
 */

import { app, BrowserWindow } from 'electron';
import path from 'path';

// ============================================================================
// 환경 변수
// ============================================================================

const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER_URL = 'http://localhost:5173';

// ============================================================================
// 윈도우 관리
// ============================================================================

let mainWindow: BrowserWindow | null = null;

/**
 * 메인 윈도우 생성
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      // 보안 설정 (Production-Ready)
      nodeIntegration: false,        // ✅ Node.js 직접 접근 차단
      contextIsolation: true,        // ✅ Context 격리
      sandbox: true,                 // ✅ Renderer 샌드박스
      preload: path.join(__dirname, '../preload/index.js'),
    },
    // UI 설정
    backgroundColor: '#0a0e1a',      // Dark mode 배경
    show: false,                     // 준비될 때까지 숨김
    autoHideMenuBar: !isDev,         // 개발 모드에서만 메뉴바 표시
  });

  // 윈도우 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 개발 모드 vs 프로덕션 모드
  if (isDev) {
    // 개발 모드: Vite dev server 로드
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools(); // DevTools 자동 열기
  } else {
    // 프로덕션 모드: 빌드된 파일 로드
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // 윈도우 닫힘 이벤트
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// 앱 라이프사이클
// ============================================================================

/**
 * 앱 준비 완료 시
 */
app.whenReady().then(() => {
  createWindow();

  // macOS: 모든 윈도우 닫혀도 앱 유지
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * 모든 윈도우 닫힘 시
 */
app.on('window-all-closed', () => {
  // macOS 제외하고 앱 종료
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================================
// IPC 통신 (예시)
// ============================================================================

// IPC 핸들러는 필요에 따라 추가
// 예: ipcMain.handle('get-app-version', () => app.getVersion());

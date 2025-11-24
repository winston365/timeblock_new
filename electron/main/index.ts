/**
 * Electron Main Process
 *
 * @role Electron 앱의 메인 프로세스 (윈도우 생성, 라이프사이클 관리, 자동 업데이트)
 * @input 없음 (앱 시작 시 자동 실행)
 * @output BrowserWindow 인스턴스, 앱 라이프사이클 이벤트, 자동 업데이트
 * @external_dependencies
 *   - electron: BrowserWindow, app, ipcMain
 *   - electron-updater: autoUpdater
 *   - path: 경로 처리
 */

import { app, BrowserWindow, dialog, ipcMain, globalShortcut, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';

// ============================================================================
// 환경 변수 & 설정
// ============================================================================

const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER_URL = 'http://localhost:5173';

// AutoUpdater 설정
autoUpdater.autoDownload = false; // 사용자 확인 후 다운로드
autoUpdater.autoInstallOnAppQuit = true; // 앱 종료 시 자동 설치

// 프로덕션 모드에서도 로깅 활성화 (디버깅용)
autoUpdater.logger = console;

// GitHub releases 명시적 설정
if (!isDev) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'winston365',
    repo: 'timeblock_new',
  });
  console.log('[AutoUpdater] Feed URL set to GitHub releases: winston365/timeblock_new');
}

// ============================================================================
// 윈도우 관리
// ============================================================================

let mainWindow: BrowserWindow | null = null;
let quickAddWindow: BrowserWindow | null = null;
let pipWindow: BrowserWindow | null = null;

/**
 * 메인 윈도우 생성
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    // Allow the window to shrink further in production builds
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      // 보안 설정 (Production-Ready)
      nodeIntegration: false,        // ✅ Node.js 직접 접근 차단
      contextIsolation: true,        // ✅ Context 격리
      sandbox: true,                 // ✅ Renderer 샌드박스
      preload: path.join(__dirname, '../preload/index.cjs'),
    },
    // UI 설정
    icon: path.join(__dirname, '../resources/icon.ico'),  // 앱 아이콘
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

/**
 * 퀵 애드 윈도우 생성 (글로벌 단축키용)
 */
function createQuickAddWindow(): void {
  // 이미 윈도우가 열려있으면 포커스
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.show();
    quickAddWindow.focus();
    return;
  }

  quickAddWindow = new BrowserWindow({
    width: 900,      // 600 → 900 (2컬럼 레이아웃에 충분한 공간)
    height: 750,     // 700 → 750 (여유 공간 확보)
    resizable: false,
    frame: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload/index.cjs'),
    },
    icon: path.join(__dirname, '../resources/icon.ico'),  // 앱 아이콘
    backgroundColor: '#0a0e1a',
    show: false,
    title: '빠른 작업 추가',
  });

  // 윈도우 준비되면 표시
  quickAddWindow.once('ready-to-show', () => {
    quickAddWindow?.show();
    quickAddWindow?.focus();
  });

  // 개발 모드 vs 프로덕션 모드 (쿼리 파라미터로 모드 구분)
  if (isDev) {
    quickAddWindow.loadURL(`${VITE_DEV_SERVER_URL}?mode=quickadd`);
  } else {
    quickAddWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      query: { mode: 'quickadd' }
    });
  }

  // 윈도우 닫힘 이벤트
  quickAddWindow.on('closed', () => {
    quickAddWindow = null;
  });
}

/**
 * PiP 윈도우 생성
 */
function createPipWindow(): void {
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.show();
    pipWindow.focus();
    return;
  }

  pipWindow = new BrowserWindow({
    width: 240,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload/index.cjs'),
    },
    icon: path.join(__dirname, '../resources/icon.ico'),
    show: false,
    title: 'TimeBlock PiP',
  });

  pipWindow.once('ready-to-show', () => {
    pipWindow?.show();
  });

  if (isDev) {
    pipWindow.loadURL(`${VITE_DEV_SERVER_URL}?mode=pip`);
  } else {
    pipWindow.loadFile(path.join(__dirname, '../../dist/index.html'), {
      query: { mode: 'pip' }
    });
  }

  pipWindow.on('closed', () => {
    pipWindow = null;
    // PiP 닫힐 때 메인 윈도우 보이기
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });
}

/**
 * 글로벌 단축키 설정
 */
function setupGlobalShortcuts(): void {
  // Cmd+Shift+Space (macOS) / Ctrl+Shift+Space (Windows/Linux)
  const shortcut = process.platform === 'darwin' ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space';

  const registered = globalShortcut.register(shortcut, () => {
    console.log(`[GlobalShortcut] ${shortcut} pressed - Opening Quick Add window`);
    createQuickAddWindow();
  });

  if (registered) {
    console.log(`[GlobalShortcut] ${shortcut} registered successfully`);
  } else {
    console.error(`[GlobalShortcut] Failed to register ${shortcut}`);
  }
}

// ============================================================================
// 앱 라이프사이클
// ============================================================================

/**
 * 앱 준비 완료 시
 */
app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater(); // 자동 업데이트 초기화
  setupGlobalShortcuts(); // 글로벌 단축키 설정

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

/**
 * 앱 종료 시 글로벌 단축키 해제
 */
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  console.log('[GlobalShortcut] All shortcuts unregistered');
});

// ============================================================================
// 자동 업데이트 (electron-updater)
// ============================================================================

/**
 * 업데이트 확인 및 처리
 *
 * @description
 * - 프로덕션 모드에서만 작동
 * - 앱 시작 후 5초 뒤 업데이트 체크
 * - 이후 12시간마다 자동 체크
 */
function setupAutoUpdater(): void {
  // 개발 모드에서는 업데이트 비활성화
  if (isDev) {
    console.log('[AutoUpdater] Disabled in development mode');
    return;
  }

  // 다운로드 진행률 알림용 변수
  let lastNotifiedPercent = 0;

  // 업데이트 확인 가능 시
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
  });

  // 업데이트 발견 시
  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);

    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: '업데이트 발견',
      message: `새로운 버전(v${info.version})이 있습니다.`,
      detail: '지금 다운로드하시겠습니까?\n\n다운로드 완료 후 앱 재시작 시 자동으로 설치됩니다.',
      buttons: ['다운로드', '나중에'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        console.log('[AutoUpdater] Starting download...');

        // 다운로드 진행률 알림 카운터 리셋
        lastNotifiedPercent = 0;

        // 다운로드 시작 알림
        if (Notification.isSupported()) {
          new Notification({
            title: '⬇️ 업데이트 다운로드 시작',
            body: '백그라운드에서 업데이트를 다운로드합니다. 진행 상황은 앱 아이콘에서 확인할 수 있습니다.',
          }).show();
        }

        // 다운로드 시작
        autoUpdater.downloadUpdate();

        // 프로그레스 바 초기화
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setProgressBar(0);
        }
      }
    });
  });

  // 업데이트 없음
  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] No updates available. Current version:', info.version);
  });

  // 다운로드 진행 중
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    const speedMB = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2);
    const transferredMB = (progressObj.transferred / 1024 / 1024).toFixed(2);
    const totalMB = (progressObj.total / 1024 / 1024).toFixed(2);

    const logMessage = `Download speed: ${speedMB} MB/s - Downloaded ${percent}% (${transferredMB}/${totalMB} MB)`;
    console.log('[AutoUpdater]', logMessage);

    // 메인 윈도우 프로그레스 바 업데이트 (0.0 ~ 1.0)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(progressObj.percent / 100);
    }

    // 25%, 50%, 75% 구간마다 알림 표시
    if (percent >= 25 && lastNotifiedPercent < 25) {
      lastNotifiedPercent = 25;
      if (Notification.isSupported()) {
        new Notification({
          title: '업데이트 다운로드 중',
          body: `다운로드 진행 중: 25% (${speedMB} MB/s)`,
        }).show();
      }
    } else if (percent >= 50 && lastNotifiedPercent < 50) {
      lastNotifiedPercent = 50;
      if (Notification.isSupported()) {
        new Notification({
          title: '업데이트 다운로드 중',
          body: `다운로드 진행 중: 50% (${speedMB} MB/s)`,
        }).show();
      }
    } else if (percent >= 75 && lastNotifiedPercent < 75) {
      lastNotifiedPercent = 75;
      if (Notification.isSupported()) {
        new Notification({
          title: '업데이트 다운로드 중',
          body: `다운로드 진행 중: 75% (${speedMB} MB/s)`,
        }).show();
      }
    }
  });

  // 다운로드 완료
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);

    // 프로그레스 바 완료 표시 후 제거
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(1.0);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setProgressBar(-1); // 프로그레스 바 제거
        }
      }, 1000);
    }

    // 다운로드 완료 알림
    if (Notification.isSupported()) {
      new Notification({
        title: '✅ 업데이트 다운로드 완료',
        body: `새로운 버전(v${info.version})이 준비되었습니다.`,
      }).show();
    }

    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: '업데이트 준비 완료',
      message: `새로운 버전(v${info.version}) 다운로드가 완료되었습니다.`,
      detail: '앱을 다시 시작하여 업데이트를 설치하시겠습니까?\n\n지금 설치하지 않으면 다음 실행 시 자동으로 설치됩니다.',
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        // 즉시 재시작 및 설치
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  // 에러 처리
  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error);

    // 프로그레스 바 제거
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }

    // 사용자에게 에러 표시
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: '업데이트 오류',
        message: '자동 업데이트 중 오류가 발생했습니다.',
        detail: `오류 내용: ${error.message}\n\n나중에 다시 시도해주세요.`,
        buttons: ['확인'],
      });
    }
  });

  // 초기 업데이트 체크 (앱 시작 5초 후)
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);

  // 주기적 업데이트 체크 (12시간마다)
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 12 * 60 * 60 * 1000);
}

// ============================================================================
// IPC 통신
// ============================================================================

/**
 * Weather fetch handler (CORS 회피용)
 */
ipcMain.handle('fetch-weather', async (_event, city: string = '서울') => {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(city)}+날씨`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
    });
    return await response.text();
  } catch (error) {
    console.error('[IPC] fetch-weather failed:', error);
    throw error;
  }
});

/**
 * 앱 버전 정보 제공
 */
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

/**
 * 수동 업데이트 체크 (사용자 요청)
 */
ipcMain.handle('check-for-updates', async () => {
  try {
    if (isDev) {
      return {
        success: false,
        message: '개발 모드에서는 업데이트를 확인할 수 없습니다.',
      };
    }

    console.log('[AutoUpdater] Manual update check requested');
    console.log('[AutoUpdater] Current version:', app.getVersion());
    console.log('[AutoUpdater] Feed URL:', autoUpdater.getFeedURL());

    const result = await autoUpdater.checkForUpdates();

    if (result) {
      console.log('[AutoUpdater] Update check result:', result);
      return {
        success: true,
        message: '업데이트 확인 중...',
        currentVersion: app.getVersion(),
        updateInfo: result.updateInfo,
      };
    } else {
      return {
        success: false,
        message: '업데이트를 확인할 수 없습니다.',
      };
    }
  } catch (error: any) {
    console.error('[AutoUpdater] Manual check error:', error);
    console.error('[AutoUpdater] Error stack:', error.stack);
    return {
      success: false,
      message: `업데이트 확인 중 오류: ${error.message}`,
      error: error.message,
      errorStack: error.stack,
    };
  }
});

// ============================================================================
// QuickAdd & Notification IPC Handlers
// ============================================================================

/**
 * QuickAdd 창 닫기
 */
ipcMain.handle('close-quickadd-window', () => {
  try {
    if (quickAddWindow && !quickAddWindow.isDestroyed()) {
      quickAddWindow.close();
      console.log('[IPC] QuickAdd window closed');
      return { success: true };
    }
    return { success: false, message: 'QuickAdd window not found' };
  } catch (error: any) {
    console.error('[IPC] Failed to close QuickAdd window:', error);
    return { success: false, message: error.message };
  }
});

/**
 * 윈도우 알림 표시
 */
ipcMain.handle('show-notification', (event, title: string, body: string) => {
  try {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        icon: path.join(__dirname, '../resources/icon.ico'), // 앱 아이콘 사용
      });
      notification.show();
      console.log(`[Notification] Shown: ${title} - ${body}`);
      return { success: true };
    } else {
      console.warn('[Notification] Not supported on this platform');
      return { success: false, message: 'Notifications not supported' };
    }
  } catch (error: any) {
    console.error('[Notification] Failed to show notification:', error);
    return { success: false, message: error.message };
  }
});

// ============================================================================
// PiP IPC Handlers
// ============================================================================

ipcMain.handle('open-pip', () => {
  createPipWindow();
  // 메인 창은 숨기지 않고 계속 사용 가능하게 둔다
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
  }
});

ipcMain.handle('close-pip', () => {
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.close();
  }
});

ipcMain.handle('pip-update', (event, data) => {
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.webContents.send('pip-update-msg', data);
  }
});


ipcMain.handle('pip-action', (event, action, payload) => {
  if (action === 'toggle-always-on-top') {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.setAlwaysOnTop(payload);
    }
  } else {
    // 다른 액션은 메인 윈도우로 전달
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pip-action-msg', action, payload);
    }
  }
});

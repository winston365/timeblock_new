/* eslint-disable @typescript-eslint/no-explicit-any */
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

import { app, BrowserWindow, dialog, ipcMain, globalShortcut, Notification, Tray, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';
import path from 'path';

// ============================================================================
// 환경 변수 & 설정
// ============================================================================

const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER_URL = 'http://localhost:5173';

// 개발용 별도 userData 경로 (캐시/IndexedDB 충돌 방지)
if (isDev) {
  const devUserDataPath = path.join(app.getPath('appData'), 'timeblockplanner-dev');
  app.setPath('userData', devUserDataPath);
}

// 런타임 에셋 경로 (개발/프로덕션 대응)
function getAssetPath(fileName: string): string {
  const prodPath = path.join(process.resourcesPath, fileName);
  if (!isDev && fs.existsSync(prodPath)) {
    return prodPath;
  }
  const devPath = path.join(__dirname, '../resources', fileName);
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  // 개발 환경에서 dist-electron/resources가 없을 때를 대비한 프로젝트 경로 폴백
  const projectPath = path.join(process.cwd(), 'electron', 'resources', fileName);
  if (fs.existsSync(projectPath)) {
    return projectPath;
  }
  // 최악의 경우 생산 경로 반환 (존재하지 않더라도 기본값)
  return prodPath;
}

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
}

// ============================================================================
// 윈도우 관리
// ============================================================================

let mainWindow: BrowserWindow | null = null;
let quickAddWindow: BrowserWindow | null = null;
let pipWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

/**
 * 메인 윈도우를 표시하거나 생성
 * @returns void
 */
function showMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSkipTaskbar(false);
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow();
}

/**
 * 메인 윈도우를 시스템 트레이로 숨김
 * @returns void
 */
function hideMainWindowToTray(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
  }
}

/**
 * 메인 윈도우 생성
 * @returns void
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
    icon: getAssetPath('icon.ico'),  // 앱 아이콘
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

  // 최소화/닫기 시 작업표시줄 대신 트레이로 이동
  mainWindow.on('minimize', () => {
    hideMainWindowToTray();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    hideMainWindowToTray();
  });
}

/**
 * 퀵 애드 윈도우 생성 (글로벌 단축키용)
 * @returns void
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
    icon: getAssetPath('icon.ico'),  // 앱 아이콘
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
 * @returns void
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
    icon: getAssetPath('icon.ico'),
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
 * 트레이 아이콘 생성
 * @returns void
 */
function createTray(): void {
  if (tray) return;

  const iconPath = getAssetPath('icon.ico');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => showMainWindow(),
    },
    {
      label: '종료',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('TimeBlock');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => showMainWindow());
}

/**
 * 글로벌 단축키 설정
 * @returns void
 */
function setupGlobalShortcuts(): void {
  // Cmd+Shift+Space (macOS) / Ctrl+Shift+Space (Windows/Linux)
  const shortcut = process.platform === 'darwin' ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space';

  const isRegistered = globalShortcut.register(shortcut, () => {
    createQuickAddWindow();
  });

  if (!isRegistered) {
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
  createTray();
  setupAutoUpdater(); // 자동 업데이트 초기화
  setupGlobalShortcuts(); // 글로벌 단축키 설정

  // macOS: 모든 윈도우 닫혀도 앱 유지
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
    showMainWindow();
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
 * 종료 플래그 설정 (트레이에서 종료 시 정상 종료 허용)
 */
app.on('before-quit', () => {
  isQuitting = true;
});

/**
 * 앱 종료 시 글로벌 단축키 해제
 */
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
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
    return;
  }

  // 다운로드 진행률 알림용 변수
  let lastNotifiedPercent = 0;

  // 업데이트 확인 가능 시
  autoUpdater.on('checking-for-update', () => {
    // 업데이트 확인 중
  });

  // 업데이트 발견 시
  autoUpdater.on('update-available', (updateInfo) => {

    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: '업데이트 발견',
      message: `새로운 버전(v${updateInfo.version})이 있습니다.`,
      detail: '지금 다운로드하시겠습니까?\n\n다운로드 완료 후 앱 재시작 시 자동으로 설치됩니다.',
      buttons: ['다운로드', '나중에'],
      defaultId: 0,
      cancelId: 1,
    }).then((dialogResult) => {
      if (dialogResult.response === 0) {

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
  autoUpdater.on('update-not-available', () => {
    // 최신 버전 사용 중
  });

  // 다운로드 진행 중
  autoUpdater.on('download-progress', (progressInfo) => {
    const downloadPercent = Math.round(progressInfo.percent);
    const downloadSpeedMB = (progressInfo.bytesPerSecond / 1024 / 1024).toFixed(2);

    // 메인 윈도우 프로그레스 바 업데이트 (0.0 ~ 1.0)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(progressInfo.percent / 100);
    }

    // 25%, 50%, 75% 구간마다 알림 표시
    if (downloadPercent >= 25 && lastNotifiedPercent < 25) {
      lastNotifiedPercent = 25;
      if (Notification.isSupported()) {
        new Notification({
          title: '업데이트 다운로드 중',
          body: `다운로드 진행 중: 25% (${downloadSpeedMB} MB/s)`,
        }).show();
      }
    } else if (downloadPercent >= 50 && lastNotifiedPercent < 50) {
      lastNotifiedPercent = 50;
      if (Notification.isSupported()) {
        new Notification({
          title: '업데이트 다운로드 중',
          body: `다운로드 진행 중: 50% (${downloadSpeedMB} MB/s)`,
        }).show();
      }
    } else if (downloadPercent >= 75 && lastNotifiedPercent < 75) {
      lastNotifiedPercent = 75;
      if (Notification.isSupported()) {
        new Notification({
          title: '업데이트 다운로드 중',
          body: `다운로드 진행 중: 75% (${downloadSpeedMB} MB/s)`,
        }).show();
      }
    }
  });

  // 다운로드 완료
  autoUpdater.on('update-downloaded', (downloadedUpdateInfo) => {

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
        body: `새로운 버전(v${downloadedUpdateInfo.version})이 준비되었습니다.`,
      }).show();
    }

    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: '업데이트 준비 완료',
      message: `새로운 버전(v${downloadedUpdateInfo.version}) 다운로드가 완료되었습니다.`,
      detail: '앱을 다시 시작하여 업데이트를 설치하시겠습니까?\n\n지금 설치하지 않으면 다음 실행 시 자동으로 설치됩니다.',
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
      cancelId: 1,
    }).then((installDialogResult) => {
      if (installDialogResult.response === 0) {
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
ipcMain.handle('fetch-weather', async (_ipcEvent, cityName: string = '서울') => {
  try {
    const weatherSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(cityName)}+날씨`;
    const weatherResponse = await fetch(weatherSearchUrl, {
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
    return await weatherResponse.text();
  } catch (weatherFetchError) {
    console.error('[IPC] fetch-weather failed:', weatherFetchError);
    throw weatherFetchError;
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

    const updateCheckResult = await autoUpdater.checkForUpdates();

    if (updateCheckResult) {
      return {
        success: true,
        message: '업데이트 확인 중...',
        currentVersion: app.getVersion(),
        updateInfo: updateCheckResult.updateInfo,
      };
    } else {
      return {
        success: false,
        message: '업데이트를 확인할 수 없습니다.',
      };
    }
  } catch (updateCheckError: any) {
    console.error('[AutoUpdater] Manual check error:', updateCheckError);
    return {
      success: false,
      message: `업데이트 확인 중 오류: ${updateCheckError.message}`,
      error: updateCheckError.message,
      errorStack: updateCheckError.stack,
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
      return { success: true };
    }
    return { success: false, message: 'QuickAdd window not found' };
  } catch (closeWindowError: any) {
    console.error('[IPC] Failed to close QuickAdd window:', closeWindowError);
    return { success: false, message: closeWindowError.message };
  }
});

/**
 * 윈도우 알림 표시
 */
ipcMain.handle('show-notification', (_notificationEvent, notificationTitle: string, notificationBody: string) => {
  try {
    if (Notification.isSupported()) {
      const systemNotification = new Notification({
        title: notificationTitle,
        body: notificationBody,
        icon: getAssetPath('icon.ico'),
      });
      systemNotification.show();
      return { success: true };
    } else {
      return { success: false, message: 'Notifications not supported' };
    }
  } catch (notificationError: any) {
    console.error('[Notification] Failed to show notification:', notificationError);
    return { success: false, message: notificationError.message };
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

ipcMain.handle('pip-update', (_pipUpdateEvent, pipStateData) => {
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.webContents.send('pip-update-msg', pipStateData);
  }
});


ipcMain.handle('pip-action', (_pipActionEvent, pipActionType, pipActionPayload) => {
  if (pipActionType === 'toggle-always-on-top') {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.setAlwaysOnTop(pipActionPayload);
    }
  } else {
    // 다른 액션은 메인 윈도우로 전달
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pip-action-msg', pipActionType, pipActionPayload);
    }
  }
});

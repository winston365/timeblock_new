/**
 * AppShell - 앱 전체 레이아웃 및 상태 관리
 *
 * @role 앱의 최상위 컴포넌트로 레이아웃 구성, DB 초기화, Firebase 동기화, 전역 상태 관리 담당
 * @input 없음 (최상위 컴포넌트)
 * @output 앱 전체 UI (Toolbar, Sidebar, Content, Panels, Modals)
 * @dependencies 각종 feature 컴포넌트, hooks, stores, services
 */
import { useState, useEffect, useMemo } from 'react';
import { useGameState } from '@/shared/hooks';
import { createTaskFromTemplate } from '@/data/repositories/templateRepository';
import { exposeDebugToWindow } from '@/shared/services/sync/firebase/firebaseDebug';
import { RealityCheckModal } from '@/features/feedback/RealityCheckModal';
import GlobalTaskBreakdown from '@/features/tasks/GlobalTaskBreakdown';
import { XPParticleOverlay } from '@/features/gamification/components/XPParticleOverlay';
import FloatingIgnitionTrigger from '@/features/ignition/components/FloatingIgnitionTrigger';
import { useAppInitialization } from './hooks/useAppInitialization';
import { useFocusModeStore } from '@/features/schedule/stores/focusModeStore';
import { eventBus, loggerMiddleware, performanceMiddleware } from '@/shared/lib/eventBus';
import { initAllSubscribers } from '@/shared/subscribers';
import { setErrorCallback, retryNow } from '@/shared/services/sync/firebase/syncRetryQueue';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { toast, Toaster } from 'react-hot-toast';
import type { Template, Task } from '@/shared/types/domain';
import SyncErrorToast from '@/shared/components/SyncErrorToast';

// 임시로 컴포넌트를 직접 import (나중에 features에서 가져올 것)
import TopToolbar from './components/TopToolbar';
import LeftSidebar from './components/LeftSidebar';
import CenterContent from './components/CenterContent';
import RightPanel from './components/RightPanel';
import WaifuPanel from '@/features/waifu/WaifuPanel';
import GeminiFullscreenChat from '@/features/gemini/GeminiFullscreenChat';
import BulkAddModal from '@/features/tasks/BulkAddModal';
import SettingsModal from '@/features/settings/SettingsModal';
import InsightPanel from '@/features/insight/InsightPanel';
import TemplatesModal from '@/features/template/TemplatesModal';

/**
 * 앱 셸 컴포넌트 - 전체 앱 레이아웃 및 초기화
 * @returns 앱 전체 UI
 */
interface SyncErrorToastData {
  id: string;
  collection: string;
  message: string;
  canRetry: boolean;
  retryId?: string;
}

export default function AppShell() {
  const { isInitialized: dbInitialized, error: initError } = useAppInitialization();

  const [activeTab, setActiveTab] = useState<'today' | 'stats' | 'energy' | 'completed' | 'inbox'>('today');
  const [rightPanelTab, setRightPanelTab] = useState<'quest' | 'shop' | 'inventory'>('quest');
  const [showGeminiChat, setShowGeminiChat] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [syncErrorToasts, setSyncErrorToasts] = useState<SyncErrorToastData[]>([]);

  // 패널 접힘 상태 (기본값: 펼침)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('leftSidebarCollapsed');
    return saved === 'true';
  });
  const [rightPanelsCollapsed, setRightPanelsCollapsed] = useState(() => {
    const saved = localStorage.getItem('rightPanelsCollapsed');
    return saved === 'true';
  });

  // 반응형 레이아웃: 창 크기에 따른 자동 패널 접기 (Progressive Collapsing)
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;

      // 1200px 미만: 우측 패널 자동 접기
      if (width < 1200) {
        setRightPanelsCollapsed(prev => {
          if (!prev) {
            localStorage.setItem('rightPanelsCollapsed', 'true');
            return true;
          }
          return prev;
        });
      }

      // 800px 미만: 좌측 사이드바 자동 접기
      if (width < 800) {
        setLeftSidebarCollapsed(prev => {
          if (!prev) {
            localStorage.setItem('leftSidebarCollapsed', 'true');
            return true;
          }
          return prev;
        });
      }
    };

    // 초기 실행 및 이벤트 리스너 등록
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { isFocusMode } = useFocusModeStore();
  const effectiveLeftCollapsed = leftSidebarCollapsed || isFocusMode;
  const effectiveRightCollapsed = rightPanelsCollapsed || isFocusMode;

  const gridTemplateColumns = useMemo(() => {
    if (effectiveLeftCollapsed && effectiveRightCollapsed) {
      return '0 1fr 0 0';
    }
    if (effectiveLeftCollapsed) {
      return '0 minmax(600px, 1fr) 320px 336px';
    }
    if (effectiveRightCollapsed) {
      return '380px minmax(600px, 1fr) 0 0';
    }
    return '380px minmax(600px, 1fr) 320px 336px';
  }, [effectiveLeftCollapsed, effectiveRightCollapsed]);

  const { gameState, updateQuestProgress } = useGameState();
  const { visibility } = useWaifuCompanionStore();

  const waifuVisibilityClass =
    visibility === 'visible'
      ? 'translate-x-0 opacity-100 pointer-events-auto scale-100'
      : visibility === 'peeking'
        ? 'translate-x-[calc(100%-0.35rem)] opacity-60 pointer-events-none scale-95'
        : 'translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none scale-95';
  const waifuContainerClass = `waifu-panel-container fixed bottom-0 right-0 z-40 p-4 ${visibility === 'visible' ? '' : 'pointer-events-none'
    }`;

  // 패널 토글 핸들러
  const toggleLeftSidebar = () => {
    setLeftSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('leftSidebarCollapsed', String(newValue));
      return newValue;
    });
  };

  const toggleRightPanels = () => {
    setRightPanelsCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('rightPanelsCollapsed', String(newValue));
      return newValue;
    });
  };

  // 동기화 에러 콜백 설정
  useEffect(() => {
    setErrorCallback((collection, message, canRetry) => {
      const toastId = `sync-error-${Date.now()}-${Math.random()}`;
      setSyncErrorToasts((prev: SyncErrorToastData[]) => [
        ...prev,
        {
          id: toastId,
          collection,
          message,
          canRetry,
          retryId: canRetry ? `${collection}-retry-${Date.now()}` : undefined,
        },
      ]);
    });
  }, []);

  // 동기화 에러 토스트 제거
  const removeSyncErrorToast = (id: string) => {
    setSyncErrorToasts((prev: SyncErrorToastData[]) => prev.filter((toast: SyncErrorToastData) => toast.id !== id));
  };

  // 동기화 재시도 핸들러
  const handleSyncRetry = async (retryId: string | undefined) => {
    if (!retryId) return;
    try {
      await retryNow(retryId);
    } catch (error) {
      console.error('Failed to retry sync:', error);
    }
  };

  // Event Bus 초기화 (앱 시작 시 한 번만)
  useEffect(() => {
    if (import.meta.env.DEV) {
      // 개발 환경에서만 미들웨어 활성화
      eventBus.use(loggerMiddleware);
      eventBus.use(performanceMiddleware);
      console.log('✅ [AppShell] Event Bus middleware registered');
    }

    // Subscribers 초기화
    initAllSubscribers();

    console.log('✅ [AppShell] Event Bus initialized');
  }, []);

  // 디버그 함수 노출
  useEffect(() => {
    if (dbInitialized) {
      exposeDebugToWindow();
    }
  }, [dbInitialized]);

  // 비활동 알림 서비스 초기화
  useEffect(() => {
    if (!dbInitialized) return;

    // 동적 import로 서비스 불러오기
    import('@/shared/services/behavior/inactivityAlertService').then(({ inactivityAlertService }) => {
      inactivityAlertService.start();
      console.log('✅ [AppShell] Inactivity alert service started');

      // 컴포넌트 언마운트 시 서비스 정리
      return () => {
        inactivityAlertService.stop();
        console.log('🛑 [AppShell] Inactivity alert service stopped');
      };
    });
  }, [dbInitialized]);

  // 키보드 단축키 처리 (입력 필드가 아닐 때만)
  const { settings } = useSettingsStore();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드나 contentEditable 요소에서는 단축키 비활성화
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]');

      if (isInputField) return;

      // 단축키 매칭 헬퍼 함수
      const matchesShortcut = (shortcutStr: string) => {
        const parts = shortcutStr.split('+').map(p => p.trim());
        const keyPart = parts[parts.length - 1];

        // 수정자 키 확인
        const needsCtrl = parts.includes('Ctrl');
        const needsShift = parts.includes('Shift');
        const needsAlt = parts.includes('Alt');

        // 수정자 키가 하나라도 필요한 경우
        if (needsCtrl || needsShift || needsAlt) {
          return (
            (!needsCtrl || e.ctrlKey) &&
            (!needsShift || e.shiftKey) &&
            (!needsAlt || e.altKey) &&
            e.key.toUpperCase() === keyPart.toUpperCase()
          );
        }

        // 단순 키인 경우 (수정자 키 없이)
        // 이 경우 수정자 키가 눌리지 않았어야 함
        return (
          !e.ctrlKey && !e.shiftKey && !e.altKey &&
          e.key.toUpperCase() === keyPart.toUpperCase()
        );
      };

      // F1: 대량 할 일 추가 (설정 가능)
      const bulkAddKey = settings?.bulkAddModalKey || 'F1';
      if (matchesShortcut(bulkAddKey)) {
        e.preventDefault();
        setShowBulkAdd(true);
        return;
      }

      // 좌측 패널 토글 (기본: Ctrl+B)
      const leftKey = settings?.leftPanelToggleKey || 'Ctrl+B';
      if (matchesShortcut(leftKey)) {
        e.preventDefault();
        toggleLeftSidebar();
        return;
      }

      // 우측 패널 토글 (기본: Ctrl+Shift+B)
      const rightKey = settings?.rightPanelToggleKey || 'Ctrl+Shift+B';
      if (matchesShortcut(rightKey)) {
        e.preventDefault();
        toggleRightPanels();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings?.leftPanelToggleKey, settings?.rightPanelToggleKey, settings?.bulkAddModalKey]);

  // 템플릿에서 작업 생성 핸들러
  const handleTaskCreateFromTemplate = async (template: Template) => {
    try {
      const task = createTaskFromTemplate(template);
      const dailyDataStore = useDailyDataStore.getState();
      await dailyDataStore.addTask(task);

      // 준비된 작업이면 퀘스트 진행
      const isPrepared = !!(task.preparation1 && task.preparation2 && task.preparation3);
      if (isPrepared) {
        await updateQuestProgress('prepare_tasks', 1);
      }

      toast.success(`"${template.name}" 템플릿에서 작업이 추가되었습니다!`);
    } catch (error) {
      console.error('Failed to create task from template:', error);
      toast.error('작업 추가에 실패했습니다.');
    }
  };

  // 상점 구매 성공 핸들러 (와이푸 메시지 표시용)
  const handleShopPurchaseSuccess = (_message: string, waifuMessage?: string) => {
    if (waifuMessage) {
      // TODO: 와이푸에게 메시지를 전달하는 로직 추가
    }
  };

  // 대량 작업 추가 핸들러
  const handleBulkAddTasks = async (tasks: Task[]) => {
    try {
      const dailyDataStore = useDailyDataStore.getState();
      for (const task of tasks) {
        await dailyDataStore.addTask(task);
      }
    } catch (error) {
      console.error('Failed to add tasks:', error);
      throw error;
    }
  };

  if (!dbInitialized) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-2 bg-[var(--color-bg-base)] text-[var(--color-text)]"
        role="status"
        aria-live="polite"
        aria-label="환경 설정 로딩 중"
      >
        <div className="text-lg font-semibold">데이터베이스 초기화 중...</div>
        {initError && <div className="text-sm text-red-500">오류 발생: {initError.message}</div>}
        <div className="text-xs text-[var(--color-text-tertiary)]">개발자 도구(F12)를 열어 로그를 확인해주세요</div>
      </div>
    );
  }


  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg-base)] text-[var(--color-text)]">
      <a href="#main-content" className="skip-to-content">스케줄로 이동</a>
      {!isFocusMode && (
        <TopToolbar
          gameState={gameState}
          onOpenGeminiChat={() => setShowGeminiChat(true)}
          onOpenTemplates={() => setShowTemplates(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}
      {/* XP Progress (레벨/보유 XP 시각화) */}
      {!isFocusMode && (
        <XPProgressBar availableXP={gameState?.availableXP ?? 0} />
      )}
      <main
        id="main-content"
        className="relative flex flex-1 overflow-hidden"
        style={{ display: 'grid', gridTemplateColumns }}
      >
        <LeftSidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={effectiveLeftCollapsed} />
        <CenterContent activeTab={activeTab} dailyData={null} />
        <InsightPanel collapsed={effectiveRightCollapsed} />
        <RightPanel
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          onShopPurchaseSuccess={handleShopPurchaseSuccess}
          collapsed={effectiveRightCollapsed}
        />
      </main>
      <aside
        className={waifuContainerClass}
        data-visibility={visibility}
        aria-label="와이푸 패널"
        role="complementary"
        aria-hidden={visibility !== 'visible'}
      >
        <div className={`waifu-panel-shell relative w-[320px] transform transition-all duration-300 ${waifuVisibilityClass}`}>
          {visibility !== 'visible' && (
            <div
              aria-hidden="true"
              className="absolute left-[-2.5rem] top-1/2 flex min-w-[2.2rem] -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/10 bg-[var(--color-bg-secondary)]/90 px-2 py-3 text-center text-[0.5rem] font-semibold uppercase tracking-[0.25em] text-white/80 shadow-[0_12px_35px_rgba(0,0,0,0.55)] backdrop-blur-md"
            >
              <span className="rotate-90 text-[0.6rem] text-white/70">와이푸</span>
            </div>
          )}
          <WaifuPanel />
        </div>
      </aside>
      <GeminiFullscreenChat isOpen={showGeminiChat} onClose={() => setShowGeminiChat(false)} />
      <BulkAddModal isOpen={showBulkAdd} onClose={() => setShowBulkAdd(false)} onAddTasks={handleBulkAddTasks} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <TemplatesModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onTaskCreate={handleTaskCreateFromTemplate}
      />

      <Toaster
        position="top-right"
        toastOptions={{
          className: '',
          style: {
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            color: '#333',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            borderRadius: '1rem',
            padding: '16px',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
      {syncErrorToasts.map((toast: SyncErrorToastData, index: number) => (
        <SyncErrorToast
          key={toast.id}
          message={toast.message}
          onClose={() => removeSyncErrorToast(toast.id)}
          onRetry={toast.canRetry ? () => handleSyncRetry(toast.retryId) : undefined}
        />
      ))}
      <RealityCheckModal />
      <GlobalTaskBreakdown />
      <XPParticleOverlay />
      <FloatingIgnitionTrigger />
    </div>
  );
}

function XPProgressBar({ availableXP }: { availableXP: number }) {
  const safeXP = Math.max(0, availableXP);
  const level = Math.floor(safeXP / 100);
  const currentXP = safeXP % 100;
  const percent = Math.min(100, currentXP);
  const marks = [25, 50, 75];

  return (
    <div className="px-[var(--spacing-lg)] pb-1 pt-1">
      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-[11px] shadow-[0_8px_20px_rgba(0,0,0,0.2)] backdrop-blur-md">
        <div className="flex items-center justify-center rounded-lg bg-[var(--color-primary)]/15 px-2 py-1 text-[var(--color-text)]">
          <span className="mr-1 text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">Lv.</span>
          <span className="text-base font-extrabold text-[var(--color-primary)]">{level}</span>
        </div>

        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="whitespace-nowrap text-[10px] text-[var(--color-text-secondary)]">다음 레벨</span>
          <div className="relative h-3 flex-1 overflow-visible rounded-full border border-white/10 bg-white/10">
            {marks.map(mark => (
              <div
                key={mark}
                className="absolute top-0 h-full w-[2px] bg-white/35"
                style={{ left: `${mark}%` }}
              >
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-white/70">{mark}</span>
              </div>
            ))}
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] via-amber-500 to-orange-500 transition-[width] duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <span className="whitespace-nowrap tabular-nums text-[11px] font-semibold text-[var(--color-text)]">
            {currentXP} / 100
          </span>
        </div>

        <div className="whitespace-nowrap text-[11px] font-semibold text-[var(--color-text)]">
          {availableXP} XP
        </div>
      </div>
    </div>
  );
}

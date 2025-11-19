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
import type { Template, Task } from '@/shared/types/domain';
import { useXPToastStore } from '@/shared/hooks/useXPToast';
import XPToast from '@/shared/components/XPToast';
import SyncErrorToast from '@/shared/components/SyncErrorToast';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { setErrorCallback, retryNow } from '@/shared/services/sync/firebase/syncRetryQueue';
import { useAppInitialization } from './hooks/useAppInitialization';
import { FocusTimerOverlay } from '@/features/focus/FocusTimerOverlay';
import { RealityCheckModal } from '@/features/feedback/RealityCheckModal';

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
  const [rightPanelTab, setRightPanelTab] = useState<'quest' | 'shop'>('quest');
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

  const gridTemplateColumns = useMemo(() => {
    if (leftSidebarCollapsed && rightPanelsCollapsed) {
      return '0 1fr 0 0';
    }
    if (leftSidebarCollapsed) {
      return '0 minmax(600px, 1fr) 320px 336px';
    }
    if (rightPanelsCollapsed) {
      return '380px minmax(600px, 1fr) 0 0';
    }
    return '380px minmax(600px, 1fr) 320px 336px';
  }, [leftSidebarCollapsed, rightPanelsCollapsed]);

  const leftToggleStyle = { left: leftSidebarCollapsed ? 0 : 380 };
  const rightToggleStyle = { right: rightPanelsCollapsed ? 0 : 656 };

  const { gameState, updateQuestProgress } = useGameState();
  const { toasts, removeToast } = useXPToastStore();
  const { visibility } = useWaifuCompanionStore();

  const waifuVisibilityClass =
    visibility === 'visible'
      ? 'translate-x-0 opacity-100 pointer-events-auto scale-100'
      : visibility === 'peeking'
        ? 'translate-x-[calc(100%-0.35rem)] opacity-60 pointer-events-none scale-95'
        : 'translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none scale-95';

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

  // 디버그 함수 노출
  useEffect(() => {
    if (dbInitialized) {
      exposeDebugToWindow();
    }
  }, [dbInitialized]);

  // F1 단축키: 대량 할 일 추가 모달 열기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowBulkAdd(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

      alert(`"${template.name}" 템플릿에서 작업이 추가되었습니다!`);
    } catch (error) {
      console.error('Failed to create task from template:', error);
      alert('작업 추가에 실패했습니다.');
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
      <TopToolbar
        gameState={gameState}
        onOpenGeminiChat={() => setShowGeminiChat(true)}
        onOpenTemplates={() => setShowTemplates(true)}
      />
      <main
        id="main-content"
        className="relative flex flex-1 overflow-hidden"
        style={{ display: 'grid', gridTemplateColumns }}
      >
        <button
          className="panel-toggle-btn left-toggle absolute top-[80px] z-50 flex h-12 w-12 items-center justify-center rounded border bg-[var(--color-primary)] text-white shadow"
          onClick={toggleLeftSidebar}
          style={leftToggleStyle}
          title={leftSidebarCollapsed ? '좌측 패널 열기' : '좌측 패널 닫기'}
          aria-label={leftSidebarCollapsed ? '좌측 패널 열기' : '좌측 패널 닫기'}
        >
          {leftSidebarCollapsed ? '⟨' : '〈'}
        </button>
        <LeftSidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={leftSidebarCollapsed} />
        <CenterContent activeTab={activeTab} dailyData={null} />
        <InsightPanel collapsed={rightPanelsCollapsed} />
        <RightPanel
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          onShopPurchaseSuccess={handleShopPurchaseSuccess}
          collapsed={rightPanelsCollapsed}
        />
        <button
          className="panel-toggle-btn right-toggle absolute top-[80px] z-50 flex h-12 w-12 items-center justify-center rounded border bg-[var(--color-primary)] text-white shadow"
          onClick={toggleRightPanels}
          style={rightToggleStyle}
          title={rightPanelsCollapsed ? '우측 패널 열기' : '우측 패널 닫기'}
          aria-label={rightPanelsCollapsed ? '우측 패널 열기' : '우측 패널 닫기'}
        >
          {rightPanelsCollapsed ? '⟩' : '〉'}
        </button>
      </main>
      <aside
        className="waifu-panel-container pointer-events-none fixed bottom-0 right-0 z-40 p-4"
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
      <button
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-2xl text-white shadow-lg transition hover:bg-[var(--color-primary-dark)] hover:shadow-xl"
        onClick={() => setShowSettings(true)}
        title="설정"
        aria-label="설정 이동"
      >
        ⚙️
      </button>
      {toasts.map((toast: { id: string; xp: number; message?: string }) => (
        <XPToast
          key={toast.id}
          xp={toast.xp}
          message={toast.message}
          onClose={() => removeToast(toast.id)}
        />
      ))}
      {syncErrorToasts.map((toast: SyncErrorToastData, index: number) => (
        <div key={toast.id} style={{ top: `${80 + index * 100}px` }}>
          <SyncErrorToast
            message={toast.message}
            onClose={() => removeSyncErrorToast(toast.id)}
            onRetry={toast.canRetry ? () => handleSyncRetry(toast.retryId) : undefined}
          />
        </div>
      ))}
      {/* Focus Mode Overlay */}
      <FocusTimerOverlay />
      <RealityCheckModal />
    </div>
  );
}

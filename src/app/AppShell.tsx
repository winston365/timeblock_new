/**
 * AppShell - 앱 전체 레이아웃 및 상태 관리
 *
 * @role 앱의 최상위 컴포넌트로 레이아웃 구성 담당
 * @input 없음 (최상위 컴포넌트)
 * @output 앱 전체 UI (Toolbar, Sidebar, Content, Panels, Modals)
 * 
 * @refactored 2024 - God Component 문제 해결
 *   - Custom Hooks로 로직 분리
 *   - 하위 컴포넌트로 UI 분리
 */

import { useState, useCallback } from 'react';
import { useGameState } from '@/shared/hooks';
import { createTaskFromTemplate } from '@/data/repositories/templateRepository';
import { useAppInitialization } from './hooks/useAppInitialization';
import { useFocusModeStore } from '@/features/schedule/stores/focusModeStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { toast } from 'react-hot-toast';
import type { Template, Task } from '@/shared/types/domain';
import SyncErrorToast from '@/shared/components/SyncErrorToast';

// Custom Hooks
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePanelLayout } from './hooks/usePanelLayout';
import { useSyncErrorHandling } from './hooks/useSyncErrorHandling';
import { useEventBusInit } from './hooks/useEventBusInit';
import { useModalState } from './hooks/useModalState';
import { useWaifuVisibility } from './hooks/useWaifuVisibility';
import { useServicesInit } from './hooks/useServicesInit';

// Layout Components
import TopToolbar from './components/TopToolbar';
import LeftSidebar from './components/LeftSidebar';
import CenterContent from './components/CenterContent';
import RightPanel from './components/RightPanel';
import { TimeBlockXPBar } from './components/TimeBlockXPBar';
import { DailyXPBar } from './components/DailyXPBar';
import { WaifuAside } from './components/WaifuAside';
import { AppToaster } from './components/AppToaster';
import { LoadingScreen } from './components/LoadingScreen';

// Modal Components
import GeminiFullscreenChat from '@/features/gemini/GeminiFullscreenChat';
import BulkAddModal from '@/features/tasks/BulkAddModal';
import SettingsModal from '@/features/settings/SettingsModal';
import TemplatesModal from '@/features/template/TemplatesModal';

// Global Components
import { RealityCheckModal } from '@/features/feedback/RealityCheckModal';
import GlobalTaskBreakdown from '@/features/tasks/GlobalTaskBreakdown';
import { XPParticleOverlay } from '@/features/gamification/components/XPParticleOverlay';
import FloatingIgnitionTrigger from '@/features/ignition/components/FloatingIgnitionTrigger';
import { MemoMissionModal } from '@/shared/components/MemoMissionModal';

/**
 * 앱 셸 컴포넌트 - 전체 앱 레이아웃 및 초기화
 */
export default function AppShell() {
  // ============================================================================
  // 초기화 및 Store 연결
  // ============================================================================
  const { isInitialized: dbInitialized, error: initError } = useAppInitialization();
  const { isFocusMode } = useFocusModeStore();
  const { gameState, updateQuestProgress } = useGameState();
  const { settings } = useSettingsStore();

  // ============================================================================
  // Custom Hooks
  // ============================================================================
  
  // Event Bus 초기화
  useEventBusInit();
  
  // 서비스 초기화 (디버그, 비활동 알림 등)
  useServicesInit(dbInitialized);
  
  // 패널 레이아웃 관리
  const {
    effectiveLeftCollapsed,
    effectiveRightCollapsed,
    gridTemplateColumns,
    toggleLeftSidebar,
    toggleRightPanels,
  } = usePanelLayout(isFocusMode);

  // 모달 상태 관리
  const modals = useModalState();

  // 동기화 에러 처리
  const {
    syncErrorToasts,
    removeSyncErrorToast,
    handleSyncRetry,
  } = useSyncErrorHandling();

  // 와이푸 가시성
  const {
    visibility,
    waifuVisibilityClass,
    waifuContainerClass,
  } = useWaifuVisibility();

  // 키보드 단축키
  useKeyboardShortcuts({
    settings,
    onBulkAdd: modals.openBulkAdd,
    onToggleLeftPanel: toggleLeftSidebar,
    onToggleRightPanel: toggleRightPanels,
  });

  // ============================================================================
  // 탭 상태
  // ============================================================================
  const [activeTab, setActiveTab] = useState<'today' | 'completed' | 'inbox'>('today');
  const [rightPanelTab, setRightPanelTab] = useState<'shop' | 'inventory'>('shop');

  // ============================================================================
  // 이벤트 핸들러
  // ============================================================================

  // 템플릿에서 작업 생성
  const handleTaskCreateFromTemplate = useCallback(async (template: Template) => {
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
  }, [updateQuestProgress]);

  // 상점 구매 성공
  const handleShopPurchaseSuccess = useCallback((_message: string, _waifuMessage?: string) => {
    // TODO: 와이푸에게 메시지를 전달하는 로직 추가
  }, []);

  // 대량 작업 추가
  const handleBulkAddTasks = useCallback(async (tasks: Task[]) => {
    try {
      const dailyDataStore = useDailyDataStore.getState();
      for (const task of tasks) {
        await dailyDataStore.addTask(task);
      }
    } catch (error) {
      console.error('Failed to add tasks:', error);
      throw error;
    }
  }, []);

  // ============================================================================
  // 로딩 화면
  // ============================================================================
  if (!dbInitialized) {
    return <LoadingScreen error={initError} />;
  }

  // ============================================================================
  // 메인 렌더링
  // ============================================================================
  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg-base)] text-[var(--color-text)]">
      {/* Skip Link */}
      <a href="#main-content" className="skip-to-content">스케줄로 이동</a>
      
      {/* Top Bar */}
      {!isFocusMode && (
        <>
          <TopToolbar
            gameState={gameState}
            onOpenGeminiChat={modals.openGeminiChat}
            onOpenTemplates={modals.openTemplates}
            onOpenSettings={modals.openSettings}
          />
          <DailyXPBar
            timeBlockXP={gameState?.timeBlockXP}
            goalPerBlock={settings?.timeBlockXPGoal ?? 200}
          />
          <TimeBlockXPBar
            timeBlockXP={gameState?.timeBlockXP}
            goalXP={settings?.timeBlockXPGoal ?? 200}
            availableXP={gameState?.availableXP ?? 0}
          />
        </>
      )}

      {/* Main Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex flex-1 overflow-hidden"
        style={{ display: 'grid', gridTemplateColumns }}
      >
        <LeftSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          collapsed={effectiveLeftCollapsed} 
        />
        <CenterContent activeTab={activeTab} dailyData={null} />
        <RightPanel
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          onShopPurchaseSuccess={handleShopPurchaseSuccess}
          collapsed={effectiveRightCollapsed}
        />
      </main>

      {/* Waifu Panel */}
      <WaifuAside
        visibility={visibility}
        waifuContainerClass={waifuContainerClass}
        waifuVisibilityClass={waifuVisibilityClass}
      />

      {/* Modals */}
      <GeminiFullscreenChat 
        isOpen={modals.showGeminiChat} 
        onClose={modals.closeGeminiChat} 
      />
      <BulkAddModal 
        isOpen={modals.showBulkAdd} 
        onClose={modals.closeBulkAdd} 
        onAddTasks={handleBulkAddTasks} 
      />
      <SettingsModal 
        isOpen={modals.showSettings} 
        onClose={modals.closeSettings} 
      />
      <TemplatesModal
        isOpen={modals.showTemplates}
        onClose={modals.closeTemplates}
        onTaskCreate={handleTaskCreateFromTemplate}
      />

      {/* Toast & Notifications */}
      <AppToaster />
      {syncErrorToasts.map((toastData) => (
        <SyncErrorToast
          key={toastData.id}
          message={toastData.message}
          onClose={() => removeSyncErrorToast(toastData.id)}
          onRetry={toastData.canRetry ? () => handleSyncRetry(toastData.retryId) : undefined}
        />
      ))}

      {/* Global Overlays */}
      <RealityCheckModal />
      <GlobalTaskBreakdown />
      <XPParticleOverlay />
      <MemoMissionModal />
      {!isFocusMode && <FloatingIgnitionTrigger />}
    </div>
  );
}

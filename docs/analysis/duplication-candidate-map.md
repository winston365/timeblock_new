# Duplication Candidate Map (Cartography)

- Date: 2025-12-13
- Scope: project-wide scan (excluding `node_modules`, build outputs like `dist*` by instruction intent)
- Note: This repository is an Electron + React renderer codebase; **refactors are applied only to frontend/renderer utilities** per workspace rules.

## Groups (by architectural layer / type)

### 1) Root config & meta
- `package.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `electron-builder.json`, `firebase.json`, etc.

### 2) Electron shell (main/preload/resources)
- `electron/main/**`, `electron/preload/**`, `electron/resources/**`

### 3) Renderer app shell (UI composition)
- `src/app/components/**` (layout, panels, top toolbar)
- `src/app/hooks/**` (initialization, keyboard shortcuts, modal/panel layout)

### 4) Feature modules (UI + local logic)
- `src/features/**` (battle, schedule, goals, settings, stats, waifu, weather, tempSchedule, etc.)

### 5) Shared frontend libraries (high-duplication risk)
- `src/shared/lib/**` (cross-cutting helpers: error/log/time/xp)
- `src/shared/utils/**` (small pure utilities)
- `src/shared/services/**` (orchestration + domain services)
- `src/shared/stores/**` (Zustand stores)
- `src/shared/hooks/**` (React hooks)
- `src/shared/components/**` + `src/shared/components/ui/**`
- `src/shared/types/**`, `src/shared/constants/**`, `src/shared/subscribers/**`

### 6) Data layer (local persistence + repositories)
- `src/data/db/**`
- `src/data/repositories/**`

### 7) Serverless/functions + scripts
- `functions/**` (Firebase functions)
- `scripts/**`

### 8) Static assets
- `public/**` (audio, waifu poses, bosses, auth callback HTML)

## Hotspot Groups (most likely to contain duplicates)

1. `src/shared/lib/**` + `src/shared/utils/**`
   - date/time formatting, time-block mapping, id generation, logging, error normalization
2. `src/shared/stores/**` + `src/features/**/stores/**`
   - repeated async try/catch + `loading/error` patterns
3. `src/data/repositories/**`
   - repeated Dexie access patterns, date defaulting, guard/normalization
4. `src/shared/services/**`
   - similar retry/guard/transform pipelines

## Full file list (from workspace scan)

> Below is the raw file path list used for grouping.

```text
vite.config.ts
tsconfig.node.json
tsconfig.json
tsconfig.electron.json
tailwind.config.ts
src/vite-env.d.ts
src/main.tsx
src/styles/design-system.css
src/styles/tailwind.css
src/styles/globals.css
src/App.tsx
README.md
postcss.config.cjs
package.json
package-lock.json
index.html
firebase.json
electron-builder.json
src/app/AppShell.tsx
functions/package-lock.json
functions/index.js
functions/package.json
src/shared/commands/Command.ts
src/shared/components/XPToast.tsx
src/shared/components/SyncErrorToast.tsx
src/shared/types/weather.ts
src/shared/components/MemoMissionModal.tsx
src/shared/types/tempSchedule.ts
src/shared/types/domain.ts
src/shared/subscribers/gameStateSubscriber.ts
src/shared/subscribers/goalSubscriber.ts
src/shared/utils/tokenUtils.ts
src/shared/utils/timeBlockUtils.ts
src/shared/utils/taskFilters.ts
src/shared/subscribers/index.ts
src/shared/utils/taskFactory.ts
functions/shared/constants/resistanceMultipliers.js
src/shared/subscribers/googleSyncSubscriber.ts
src/shared/utils/index.ts
src/shared/utils/gamification.ts
src/shared/utils/firebaseSanitizer.ts
src/shared/utils/firebaseGuard.ts
src/shared/subscribers/waifuSubscriber.ts
src/shared/subscribers/xpSubscriber.ts
src/shared/lib/errorHandler.ts
src/features/goals/WeeklyGoalHistoryModal.tsx
src/shared/stores/inboxStore.ts
src/shared/lib/logger.ts
src/shared/stores/uiStore.ts
src/shared/stores/waifuCompanionStore.ts
src/shared/lib/personaUtils.ts
src/shared/lib/standardError.ts
src/shared/stores/toastStore.ts
src/shared/lib/utils.ts
src/shared/lib/timeBlockXP.ts
src/shared/lib/storeUtils.ts
src/shared/stores/weeklyGoalStore.ts
src/shared/stores/templateStore.ts
src/features/goals/WeeklyProgressBar.tsx
src/features/goals/WeeklyGoalPanel.tsx
src/shared/stores/settingsStore.ts
src/features/goals/WeeklyGoalModal.tsx
src/shared/stores/memoMissionStore.ts
src/shared/services/media/audioService.ts
src/shared/lib/eventBus/types.ts
src/features/tempSchedule/TempScheduleModal.tsx
src/features/waifu/waifuImageUtils.ts
src/features/waifu/waifuImagePreloader.ts
src/features/waifu/WaifuPanel.tsx
src/features/weather/WeatherWidget.tsx
src/shared/lib/eventBus/README.md
src/features/tempSchedule/index.ts
src/shared/services/task/unifiedTaskService.ts
src/shared/services/task/README.md
src/shared/services/task/index.ts
src/features/waifu/base.png
src/features/tempSchedule/stores/tempScheduleStore.ts
src/shared/services/sync/syncLogger.ts
src/shared/services/sync/syncEngine.ts
src/shared/services/rag/vectorStore.ts
src/features/waifu/stores/waifuStore.ts
src/shared/services/sync/firebaseService.ts
src/shared/services/rag/vectorPersistence.ts
src/features/waifu/poses/hyeeun_crying.png
src/features/weather/stores/weatherStore.ts
src/shared/services/rag/README.md
src/shared/services/rag/ragSyncHandler.ts
src/shared/services/rag/ragService.ts
src/shared/services/rag/queryParser.ts
src/shared/services/rag/hybridRAGService.ts
src/shared/services/rag/embeddingService.ts
src/shared/services/rag/directQueryService.ts
src/shared/services/rag/autoTagService.ts
src/features/waifu/poses/hyeeun_drunk.png
src/features/waifu/poses/affectionate/hyeeun_admiring.png
src/features/weather/services/weatherService.ts
src/shared/services/sync/firebase/syncUtils.ts
src/features/weather/services/weatherapi_Introduction.md
src/shared/services/sync/firebase/syncRetryQueue.ts
src/features/weather/services/weatherApi.ts
src/shared/services/sync/firebase/syncCore.ts
src/shared/services/sync/firebase/strategies.ts
src/shared/services/sync/firebase/README.md
src/shared/lib/eventBus/middleware/performance.ts
src/shared/services/sync/firebase/firebaseDebug.ts
src/shared/services/sync/firebase/firebaseClient.ts
src/shared/lib/eventBus/middleware/logger.ts
src/shared/services/sync/firebase/conflictResolver.ts
src/features/waifu/poses/affectionate/hyeeun_blushing shyly.png
src/features/tempSchedule/components/TempScheduleContextMenu.tsx
src/features/waifu/poses/hostile/hyeeun_angry.png
src/features/tempSchedule/components/TemplateModal.tsx
src/features/tempSchedule/components/MonthlyScheduleView.tsx
src/features/tempSchedule/components/AddTempScheduleTaskModal.tsx
src/features/waifu/poses/affectionate/hyeeun_laughing.png
src/features/waifu/poses/affectionate/hyeeun_giggling.png
src/features/waifu/poses/affectionate/hyeeun_embarrassed.png
src/features/waifu/poses/hostile/hyeeun_annoyed.png
src/features/waifu/poses/hyeeun_worried.png
src/features/waifu/poses/hyeeun_suspicious.png
src/features/waifu/poses/hyeeun_surprised.png
src/features/waifu/poses/hyeeun_shocked.png
src/features/tempSchedule/components/TempScheduleTaskList.tsx
src/features/waifu/poses/hyeeun_scared.png
src/features/waifu/poses/hostile/hyeeun_disgusted.png
src/shared/lib/eventBus/index.ts
src/features/tempSchedule/components/WeeklyScheduleView.tsx
src/features/waifu/poses/hostile/hyeeun_serious.png
src/features/waifu/hooks/useWaifu.ts
src/features/waifu/poses/wary/hyeeun_bored.png
src/features/tempSchedule/components/TempScheduleTimelineView.tsx
src/shared/lib/eventBus/EventBus.ts
src/features/goals/WeeklyGoalCard.tsx
src/shared/stores/goalStore.ts
src/features/waifu/poses/wary/hyeeun_depressed.png
src/shared/services/imageStorageService.ts
src/shared/stores/gameStateStore.ts
public/diagnose.html
src/shared/stores/focusStore.ts
src/features/goals/GoalsModal.tsx
src/features/waifu/poses/wary/hyeeun_tired.png
src/features/waifu/poses/wary/hyeeun_thinking.png
src/features/waifu/poses/wary/hyeeun_sleepy.png
src/features/waifu/poses/wary/hyeeun_sad.png
src/features/waifu/poses/wary/hyeeun_disappointed.png
src/shared/stores/dailyDataStore.ts
src/features/goals/GoalPanel.tsx
src/features/waifu/poses/indifferent/hyeeun_smoking.png
src/features/waifu/poses/indifferent/hyeeun_smirking.png
src/features/waifu/poses/loving/hyeeun_winking.png
src/features/waifu/poses/indifferent/hyeeun_smiling.png
src/features/waifu/poses/loving/hyeeun_princess carry.png
src/features/waifu/poses/indifferent/hyeeun_relieved.png
src/features/waifu/poses/indifferent/hyeeun_reading.png
src/features/waifu/poses/loving/hyeeun_kiss.png
src/features/waifu/poses/indifferent/hyeeun_neutral.png
src/features/waifu/poses/loving/hyeeun_joyful.png
src/features/waifu/poses/indifferent/hyeeun_nervous.png
src/features/waifu/poses/loving/hyeeun_hugging.png
src/features/waifu/poses/loving/hyeeun_happy.png
src/features/waifu/poses/indifferent/hyeeun_curious.png
src/features/waifu/poses/loving/hyeeun_happy tears.png
src/features/waifu/poses/indifferent/hyeeun_confused.png
src/features/waifu/poses/loving/hyeeun_excited.png
src/shared/lib/constants.ts
src/features/goals/GoalModal.tsx
src/features/goals/hooks/useCatchUpAlert.ts
public/auth/google/callback/index.html
src/features/template/TemplateModal.tsx
src/shared/services/gameplay/gameService.ts
src/data/db/README.md
src/data/db/dexieClient.ts
src/features/template/TemplatePanel.tsx
src/shared/stores/completedTasksStore.ts
src/features/template/TemplatesModal.tsx
src/features/goals/CatchUpAlertModal.tsx
src/shared/services/calendar/index.ts
src/shared/services/calendar/googleTasksService.ts
src/shared/services/calendar/googleCalendarTypes.ts
src/shared/services/calendar/googleCalendarService.ts
src/shared/services/gameplay/taskCompletion/taskCompletionService.ts
src/shared/services/gameplay/taskCompletion/types.ts
src/shared/services/gameplay/taskCompletion/README.md
src/features/goals/constants/goalConstants.ts
public/audio/ha.mp3
src/shared/services/ai/aiService.ts
src/shared/services/ai/emojiSuggester.ts
public/audio/나랑놀자.mp3
public/audio/꺼져진짜로.mp3
public/audio/귀찮게왜자꾸따라와.mp3
public/audio/귀찮게.mp3
public/audio/개같네.mp3
public/audio/너아직도거기서있었냐.mp3
public/audio/놀아줄까.mp3
public/audio/너나한테뭐빚진거.mp3
public/audio/너가까이서보니.mp3
src/shared/services/ai/geminiApi.ts
src/shared/services/gameplay/taskCompletion/index.ts
public/audio/술사줄돈있어.mp3
public/audio/아시발닿지마.mp3
public/audio/야가서아이스아메리카노.mp3
electron/resources/icon.ico
public/audio/촌티는덜나네.mp3
public/audio/찐따냄새.mp3
electron/resources/icon2.ico
public/audio/하.mp3
public/audio/짜증나게.mp3
public/audio/진짜짜증나.mp3
electron/resources/3.bmp
electron/resources/2.bmp
public/audio/주제파악.mp3
electron/resources/1.ico
electron/resources/README.md
public/audio/야1학년적당히알짱거려.mp3
public/audio/신상백.mp3
public/audio/시발또왔네.mp3
public/audio/뭐야할말없으면비키지.mp3
public/audio/뭐말걸지마.mp3
public/audio/말걸지마기분.mp3
src/features/goals/utils/catchUpUtils.ts
public/audio/또뭐야씨발.mp3
public/audio/딴년.mp3
public/audio/돈없어도되니까.mp3
public/audio/돈도없는게.mp3
public/audio/담배냄새배니까.mp3
public/audio/눈안깔아.mp3
src/shared/services/behavior/procrastinationMonitor.ts
src/shared/services/behavior/inactivityAlertService.ts
src/shared/services/ai/gemini/personaPrompts.ts
src/shared/services/ai/gemini/index.ts
src/shared/services/ai/gemini/apiClient.ts
src/shared/services/behavior/idleFocusModeService.ts
src/shared/services/ai/gemini/README.md
src/features/tasks/TaskBreakdownModal.tsx
src/features/tasks/InboxTab.tsx
src/features/tasks/InboxModal.tsx
src/features/tasks/GlobalTaskBreakdown.tsx
src/features/tasks/CompletedTab.tsx
src/features/tasks/BulkAddModal.tsx
scripts/tmp_replace.py
scripts/verify-rag.ts
scripts/temp_tail.txt
scripts/manual-upload.js
scripts/build-electron.cjs
src/shared/services/ai/gemini/types.ts
src/shared/services/ai/gemini/taskFeatures.ts
src/shared/services/gameplay/gameState/types.ts
src/shared/services/gameplay/gameState/index.ts
src/shared/services/gameplay/gameState/gameStateEventHandler.ts
public/assets/waifu/poses/hyeeun_drunk.webp
public/assets/waifu/poses/hyeeun_scared.webp
src/shared/services/gameplay/taskCompletion/handlers/xpRewardHandler.ts
src/shared/services/gameplay/taskCompletion/handlers/waifuAffectionHandler.ts
public/assets/waifu/poses/hyeeun_crying.webp
public/assets/waifu/poses/hyeeun_shocked.webp
src/shared/services/gameplay/taskCompletion/handlers/questProgressHandler.ts
src/features/stats/StatsTab.tsx
src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts
public/assets/waifu/poses/hyeeun_surprised.webp
public/assets/waifu/poses/hyeeun_suspicious.webp
src/features/stats/StatsModal.tsx
src/shared/services/gameplay/taskCompletion/handlers/blockCompletionHandler.ts
src/features/schedule/CompletionCelebrationModal.tsx
src/features/schedule/TimeBlock.tsx
src/features/schedule/TaskModal.tsx
src/features/schedule/TimerConfirmModal.tsx
src/features/schedule/TaskCard.tsx
src/features/stats/utils/chartColors.ts
public/assets/waifu/poses/indifferent/hyeeun_confused.webp
public/assets/waifu/poses/hostile/hyeeun_serious.webp
public/assets/waifu/poses/hostile/hyeeun_disgusted.webp
public/assets/waifu/poses/hostile/hyeeun_annoyed.webp
public/assets/waifu/poses/hostile/hyeeun_angry.webp
public/assets/waifu/poses/indifferent/hyeeun_curious.webp
src/features/schedule/ScheduleView.tsx
src/features/shop/ShopPanel.tsx
src/features/schedule/MemoModal.tsx
public/assets/waifu/poses/indifferent/hyeeun_nervous.webp
src/features/shop/ShopModal.tsx
src/features/schedule/HourBar.tsx
public/assets/waifu/poses/README.md
src/features/tasks/stores/breakdownStore.ts
src/features/schedule/stores/focusMusicStore.ts
src/features/schedule/stores/scheduleViewStore.ts
src/features/schedule/stores/focusModeStore.ts
src/features/schedule/utils/taskRecommendation.ts
public/assets/waifu/poses/indifferent/hyeeun_smoking.webp
public/assets/waifu/poses/indifferent/hyeeun_smirking.webp
public/assets/waifu/poses/indifferent/hyeeun_smiling.webp
public/assets/waifu/poses/indifferent/hyeeun_relieved.webp
public/assets/waifu/poses/indifferent/hyeeun_reading.webp
public/assets/waifu/poses/indifferent/hyeeun_neutral.webp
src/features/schedule/TimelineView/TimelineTaskBlock.tsx
src/features/schedule/TimelineView/TimelineView.tsx
src/features/schedule/TimelineView/index.ts
public/assets/waifu/poses/hyeeun_worried.webp
src/features/schedule/TimelineView/useTimelineData.ts
electron/main/index.ts
src/features/schedule/hooks/useFocusMusic.ts
src/features/schedule/hooks/useTaskContextSuggestion.ts
src/features/schedule/hooks/useDragDropManager.ts
src/features/schedule/hooks/useDragDrop.ts
public/assets/waifu/poses/wary/hyeeun_tired.webp
public/assets/waifu/poses/wary/hyeeun_thinking.webp
src/features/schedule/hooks/useTimeBlockCalculations.ts
public/assets/waifu/poses/wary/hyeeun_sleepy.webp
public/assets/waifu/poses/wary/hyeeun_sad.webp
public/assets/waifu/poses/wary/hyeeun_disappointed.webp
public/assets/waifu/poses/wary/hyeeun_depressed.webp
public/assets/waifu/poses/wary/hyeeun_bored.webp
src/features/schedule/components/FocusTimer.tsx
public/assets/waifu/poses/loving/hyeeun_joyful.webp
public/assets/waifu/poses/loving/hyeeun_kiss.webp
src/features/schedule/components/NextTaskCard.tsx
src/features/schedule/components/FocusView.tsx
public/assets/waifu/poses/loving/hyeeun_hugging.webp
src/features/schedule/components/FocusTimeline.tsx
public/assets/waifu/poses/loving/hyeeun_happy.webp
src/features/schedule/components/FocusMusicPlayer.tsx
public/assets/waifu/poses/loving/hyeeun_happy tears.webp
src/features/schedule/components/FocusHeroTask.tsx
public/assets/waifu/poses/loving/hyeeun_excited.webp
src/features/schedule/components/DontDoChecklist.tsx
src/features/schedule/hooks/useTimeBlockTimer.ts
public/assets/waifu/poses/loving/hyeeun_princess carry.webp
src/features/schedule/components/BreakView.tsx
src/features/schedule/hooks/useTimeBlockStats.ts
src/features/schedule/components/QuickMemo.tsx
src/features/schedule/components/WarmupPresetModal.tsx
public/assets/waifu/poses/affectionate/hyeeun_admiring.webp
src/features/schedule/components/TimeBlockStatus.tsx
src/features/schedule/components/TimeBlockHeader.tsx
src/features/schedule/components/TimeBlockContent.tsx
public/assets/waifu/poses/loving/hyeeun_winking.webp
src/shared/components/ui/Typewriter.tsx
public/assets/waifu/poses/affectionate/hyeeun_blushing shyly.webp
public/assets/waifu/poses/affectionate/hyeeun_embarrassed.webp
src/shared/components/ui/Toast.tsx
public/assets/bosses/boss_06.webp
public/assets/bosses/boss_11.webp
public/assets/bosses/boss_14.webp
public/assets/bosses/boss_13.webp
public/assets/bosses/boss_12.webp
src/features/inventory/InventoryPanel.tsx
public/assets/bosses/boss_10.webp
public/assets/bosses/boss_09.webp
public/assets/bosses/boss_08.webp
public/assets/bosses/boss_07.webp
public/assets/bosses/boss_05.webp
public/assets/bosses/boss_15.webp
public/assets/bosses/boss_04.webp
public/assets/bosses/boss_03.webp
src/features/pip/PipTimer.tsx
public/assets/bosses/boss_02.webp
src/features/stats/components/tabs/index.ts
public/assets/bosses/boss_01.webp
public/assets/waifu/poses/affectionate/hyeeun_laughing.webp
public/assets/waifu/poses/affectionate/hyeeun_giggling.webp
src/shared/components/ui/NeonCheckbox.tsx
public/assets/bosses/boss_16.webp
public/assets/bosses/boss_18.webp
public/assets/bosses/boss_22.webp
public/assets/bosses/boss_24.webp
public/assets/bosses/boss_25.webp
public/assets/bosses/boss_23.webp
src/features/insight/InsightPanel.tsx
src/features/insight/DailySummaryModal.tsx
public/assets/bosses/boss_21.webp
src/features/stats/components/tabs/XPAnalysisTab.tsx
public/assets/bosses/boss_20.webp
src/features/quickadd/QuickAddTask.tsx
src/features/stats/components/tabs/types.ts
public/assets/bosses/boss_19.webp
src/features/stats/components/tabs/TimeBlocksTab.tsx
src/features/stats/components/tabs/OverviewTab.tsx
public/assets/bosses/boss_17.webp
src/features/stats/components/tabs/InsightsTab.tsx
public/assets/bosses/boss_26.webp
public/assets/bosses/boss_27.webp
public/assets/bosses/boss_28.webp
public/assets/bosses/boss_30.webp
public/assets/bosses/boss_31.webp
public/assets/bosses/boss_29.webp
src/features/settings/SyncLogModal.tsx
src/features/settings/SettingsModal.tsx
src/shared/constants/defaults.ts
src/shared/hooks/useGameState.ts
src/shared/constants/index.ts
src/shared/hooks/useDailyData.ts
src/shared/hooks/useCanvasImage.ts
src/shared/hooks/index.ts
src/shared/hooks/useTimeout.ts
src/shared/hooks/useXPToast.ts
src/shared/hooks/useModalEscapeClose.ts
src/shared/hooks/useKeyboardNavigation.ts
src/features/gemini/GeminiFullscreenChat.tsx
shared/constants/resistanceMultipliers.js
src/features/gamification/stores/xpParticleStore.ts
src/features/battle/utils/xp.ts
src/features/battle/services/battleSoundService.ts
src/features/battle/utils/quotes.ts
src/features/battle/utils/assets.ts
src/features/battle/data/bossData.ts
src/features/battle/data/quotas.md
src/features/battle/constants/index.ts
src/features/battle/constants/battleConstants.ts
src/features/battle/stores/battleStore.ts
CLAUDE.md
src/features/battle/components/BossAlbumModal.tsx
src/features/battle/components/BossDisplay.tsx
src/features/battle/components/BossDefeatOverlay.tsx
src/features/battle/components/BattleSidebar.tsx
.gitignore
src/features/gamification/components/XPParticleOverlay.tsx
src/features/battle/components/MissionModal.tsx
src/features/battle/components/MissionCard.tsx
src/data/repositories/chatHistoryRepository.ts
src/data/repositories/index.ts
src/data/repositories/templateRepository.ts
src/data/repositories/tempScheduleRepository.ts
src/data/repositories/systemRepository.ts
src/data/repositories/shopRepository.ts
src/data/repositories/waifuRepository.ts
src/app/components/WaifuAside.tsx
src/data/repositories/settingsRepository.ts
src/app/components/TopToolbar.tsx
src/data/repositories/weeklyGoalRepository.ts
src/app/components/TimeBlockXPBar.tsx
.github/copilot-instructions.md
src/data/repositories/inboxRepository.ts
src/app/components/RightPanel.tsx
src/data/repositories/globalGoalRepository.ts
src/app/components/LoadingScreen.tsx
src/data/repositories/gameStateRepository.ts
src/app/components/LeftSidebar.tsx
src/features/settings/components/tabs/types.ts
src/features/battle/components/modal/BattleMissionCard.tsx
src/features/settings/components/tabs/styles.ts
src/features/settings/components/tabs/ShortcutsTab.tsx
src/features/settings/components/tabs/ScheduleTab.tsx
src/features/settings/components/tabs/LogsTab.tsx
src/features/settings/components/tabs/index.ts
src/features/settings/components/tabs/GoogleCalendarTab.tsx
src/features/settings/components/tabs/GeminiTab.tsx
src/features/settings/components/tabs/GameplayTab.tsx
src/features/settings/components/tabs/FirebaseTab.tsx
src/features/settings/components/tabs/DontDoTab.tsx
src/features/settings/components/tabs/BattleTab.tsx
src/features/battle/components/modal/MissionCardGrid.tsx
src/features/battle/components/modal/index.ts
.github/instructions/personal.instructions.md
src/features/battle/components/modal/BossPanel.tsx
src/features/battle/components/modal/BossHPBar.tsx
src/features/settings/components/tabs/AppearanceTab.tsx
src/app/components/GlobalModals.tsx
src/data/repositories/dailyGoalRepository.ts
src/app/components/DailyXPBar.tsx
src/app/components/CenterContent.tsx
src/data/repositories/dailyDataRepository.ts
.VSCodeCounter/2025-11-29_16-47-41/details.md
.VSCodeCounter/2025-11-29_16-47-41/diff-details.md
.github/workflows/release.yml
src/app/components/AppToaster.tsx
.VSCodeCounter/2025-11-29_16-47-41/diff.csv
src/data/repositories/battleRepository.ts
src/data/repositories/baseRepository.ts
src/features/battle/components/index.ts
src/features/battle/components/DamageFloatingText.tsx
src/features/battle/components/BossProgressIndicator.tsx
src/features/battle/components/BossHealthBar.tsx
.gitattributes
src/data/repositories/gameState/dayOperations.ts
.firebaserc
.VSCodeCounter/2025-11-29_16-47-41/diff.md
.eslintrc.cjs
.VSCodeCounter/2025-11-29_16-47-41/diff.txt
src/data/repositories/gameState/historyOperations.ts
.VSCodeCounter/2025-11-29_16-47-41/results.txt
.VSCodeCounter/2025-11-29_16-47-41/results.md
src/data/repositories/gameState/xpOperations.ts
src/data/repositories/gameState/questOperations.ts
.VSCodeCounter/2025-11-29_16-47-41/results.json
.VSCodeCounter/2025-11-29_16-47-41/results.csv
src/data/repositories/gameState/index.ts
src/app/hooks/useWaifuVisibility.ts
src/app/hooks/useSyncErrorHandling.ts
src/app/hooks/useServicesInit.ts
src/app/hooks/useModalState.ts
src/app/hooks/usePanelLayout.ts
src/app/hooks/useKeyboardShortcuts.ts
src/app/hooks/useEventBusInit.ts
src/app/hooks/useAppInitialization.ts
src/app/hooks/index.ts
src/features/settings/components/tabs/battle/BossImagePreviewEditor.tsx
src/features/settings/components/tabs/battle/BattleMissionsSection.tsx
src/data/repositories/dailyData/blockOperations.ts
src/data/repositories/dailyData/types.ts
.claude/settings.local.json
src/data/repositories/dailyData/taskOperations.ts
src/data/repositories/dailyData/README.md
src/data/repositories/dailyData/queryHelpers.ts
src/data/repositories/dailyData/index.ts
src/data/repositories/dailyData/coreOperations.ts
```

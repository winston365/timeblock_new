---
ID: 076
Origin: 076
UUID: 7b4e1c9a
Status: Active
---

# Changelog
- 2026-01-07: Initial scan of layout, schedule view, goal/inbox modals, and AI entry points (summary/chat) for removal scope.

# Value Statement and Objective
Assess current UI/layout structure to support removing the right shop sidebar, relocating long-term goals and inbox from modals into the schedule view, and deleting AI summary/chat buttons and features without breaking data flows.

# Context
- AppShell composes the desktop UI with left battle sidebar, optional timeline, center schedule view, and right shop panel. Top toolbar controls modals and layout toggles.
- User intends to: (1) drop right sidebar (shop), (2) surface long-term goals and inbox directly in schedule view (not modals), (3) remove AI summary and AI chat buttons/features.

# Methodology
- Static code inspection of layout, schedule, sidebar, modal, and AI-related components: AppShell, TopToolbar, LeftSidebar, CenterContent, RightPanel, usePanelLayout, useModalState, ScheduleView, TimeBlock, TimelineView, GoalsModal/WeeklyGoalModal/WeeklyGoalPanel, InboxModal/InboxTab, ShopPanel/ShopModal, DailySummaryModal, GeminiFullscreenChat.

# Findings (Confidence: Proven via source)
- **AppShell layout** — [src/app/AppShell.tsx](src/app/AppShell.tsx): grids left sidebar, timeline, center schedule, and right panel; uses `usePanelLayout` to compute `gridTemplateColumns`, collapse states, and timeline visibility. Timeline renders [TimelineView](src/features/schedule/TimelineView/TimelineView.tsx) when enabled. Right panel tab hard-coded to `shop`. Modals managed via `useModalState` (Gemini chat, BulkAdd, Settings, Templates). Toolbar toggles left/right/timeline/always-on-top.
- **Panel layout state** — [src/app/hooks/usePanelLayout.ts](src/app/hooks/usePanelLayout.ts): persists left/right collapse and timeline visibility in `systemRepository`; auto-collapses right <1200px and left <800px; focus mode collapses both panels and hides timeline. Grid columns allocate 320px left, 340px right, 360px timeline when shown.
- **Left sidebar** — [src/app/components/LeftSidebar.tsx](src/app/components/LeftSidebar.tsx): wraps `BattleSidebar` with collapse handling; reads `useBattleStore` for defeated count badge. No dependency on goals/inbox/AI.
- **Right sidebar (shop)** — [src/app/components/RightPanel.tsx](src/app/components/RightPanel.tsx) hosts only `ShopPanel`; collapse controlled by AppShell. Removing this affects grid layout and `usePanelLayout` width assumptions.
- **Shop feature** — [src/features/shop/ShopPanel.tsx](src/features/shop/ShopPanel.tsx) lists purchasable items, uses `useGameState`, `useWaifu`, repositories (`loadShopItems`, `purchaseShopItem`, `useShopItem`), and opens [ShopModal](src/features/shop/ShopModal.tsx) for add/edit. ShopModal opens when `item` prop non-null; ESC/primary hotkeys via `useModalHotkeys`.
- **Center/schedule view entry** — [src/app/components/CenterContent.tsx](src/app/components/CenterContent.tsx) renders [ScheduleView](src/features/schedule/ScheduleView.tsx) only.
- **ScheduleView structure** — [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx): uses `useDailyData` (CRUD), `useGameState`, `useWaifuCompanionStore`, `useSettingsStore`, `useFocusModeStore`, `useScheduleViewStore`, `useScheduleSync`. Renders either `FocusView` for current block or list of `TimeBlock` components for visible blocks (current + optional past). Task modal opens inline (not global). Warmup modal controlled by `useScheduleViewStore`. Drag-drop from inbox supported via `getInboxTaskById`. Timeblocks sorted by order/createdAt.
- **Time block rendering** — [src/features/schedule/TimeBlock.tsx](src/features/schedule/TimeBlock.tsx): per-block card with header/content, drag-drop via `useDragDrop`, timers, stats, lock toggle, toast on perfect plan. Expands current block; collapses past blocks.
- **Timeline view** — [src/features/schedule/TimelineView/TimelineView.tsx](src/features/schedule/TimelineView/TimelineView.tsx): optional column showing hour buckets (05–23), drag/drop to move tasks, inline add via bucket click, context menu for duplicate/delete, overlays temp schedule (useTempScheduleStore). Uses `useTimelineData`, `useDailyDataStore` for updates, `useDragDropManager`. Visibility toggled from toolbar and persisted via panel layout store.
- **Schedule view UI state store** — [src/features/schedule/stores/scheduleViewStore.ts](src/features/schedule/stores/scheduleViewStore.ts): `showPastBlocks` toggle and warmup modal open/close.
- **Long-term goals modal** — [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx): full-screen modal opened from toolbar; embeds [WeeklyGoalPanel](src/features/goals/WeeklyGoalPanel.tsx) plus [WeeklyGoalModal](src/features/goals/WeeklyGoalModal.tsx) for add/edit. Uses goals hotkeys/system state hooks, filter bar, weekly reset card. ESC close via `useModalHotkeys`. State is local; data comes from `useWeeklyGoalStore` inside panel.
- **Weekly goals panel** — [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx): loads goals via `useWeeklyGoalStore`, renders cards (grid), supports quick log/history modals, catch-up banners, compact mode, filterTodayOnly. Opens WeeklyGoalModal internally if parent does not intercept.
- **Inbox modal** — [src/features/tasks/InboxModal.tsx](src/features/tasks/InboxModal.tsx): wraps [InboxTab](src/features/tasks/InboxTab.tsx) in centered modal; ESC handled by `useModalEscapeClose`. InboxTab uses `useInboxController`, `useInboxDragDrop`, renders header/list, opens `TaskModal` for inbox tasks.
- **AI entry points (summary/chat)** — Toolbar CTAs invoke `onOpenGeminiChat` and open Daily Summary: [src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx) renders AI summary button (opens [DailySummaryModal](src/features/insight/DailySummaryModal.tsx)) and AI chat button (calls AppShell modal opener). AppShell renders [GeminiFullscreenChat](src/features/gemini/GeminiFullscreenChat.tsx) based on `useModalState`. `useModalState` tracks only Gemini/BulkAdd/Settings/Templates, so AI chat visibility is isolated here.
- **AI summary modal** — [src/features/insight/DailySummaryModal.tsx](src/features/insight/DailySummaryModal.tsx): Gemini-driven daily report generator using `useDailySummaryController`; supports regen/download; ESC via `useModalEscapeClose`.
- **AI chat modal** — [src/features/gemini/GeminiFullscreenChat.tsx](src/features/gemini/GeminiFullscreenChat.tsx): full-screen chat using `callAIWithContext`, `useSettingsStore` (Gemini key/model), `useGameState`, `useDailyData`, `useWaifu`; persists history via `chatHistoryRepository`; closes on backdrop/ESC.
- **Additional Gemini dependencies** — Gemini configuration surfaces in [SettingsModal](src/features/settings/SettingsModal.tsx) and other features (TaskModal emoji suggestion, stats, weather insights). These are outside the two CTA entry points but share the Gemini service layer.

# Gap Tracking
| # | Unknown | Blocker | Required Action | Owner |
|---|---------|---------|-----------------|-------|
| 1 | Other AI/Gemini entry points beyond toolbar CTAs (e.g., TaskModal emoji, InsightPanel) still desired or also subject to removal? | Scope not specified by user | Confirm scope on non-toolbar Gemini features to avoid unintended removal. | Pending |
| 2 | Target placement details for goals/inbox within schedule view (layout zones, toggles) | UX decision outstanding | Clarify desired placement/toggle behavior to scope refactor accurately. | Pending |

# Analysis Recommendations (next investigation steps)
- Map remaining Gemini-dependent components (TaskModal, InsightPanel, StatsModal, WeatherWidget) to decide if they stay after AI CTA removal.
- Trace `useTimelineData` and schedule drag/drop stores if integrating goals/inbox into the schedule column to ensure DnD interactions remain stable without modals.
- Evaluate `usePanelLayout` grid assumptions when removing RightPanel; adjust grid widths/toggle hotkeys accordingly.

# Open Questions
- Should non-toolbar Gemini features remain active, or is a broader AI deprecation planned?
- How should goals/inbox be toggled or surfaced inside schedule view (tabs, split pane, inlined cards)?
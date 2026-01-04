Status: Planned

## Changelog
- 2025-12-23: UI-only 구현 플랜 수립에 반영됨 (see `agent-output/planning/032-inbox-six-requirements-ui-only-implementation-plan.md`).

# Value Statement and Business Objective
Accelerate inbox usability upgrades (mini HUD, one-tap placement, rapid triage) by mapping where new UI and interactions can hook into the existing React/Zustand/Dexie layers without breaking inbox↔schedule flows.

# Objective
Document where to attach six requested behaviors (mini HUD, status at-a-glance, Today/Tomorrow/NextSlot one-tap placement, immediate feedback, keyboard-only capture→placement, triage mode) in the current inbox codepath, including hotkeys, empty-slot utilities, toast/notification stack, systemState reuse, and top implementation risks.

# Context
- Inbox UI: src/features/tasks/InboxTab.tsx, InboxModal.tsx; uses useInboxStore for CRUD, inline input, drag-drop from schedule, quick block buttons.
- State & data: src/shared/stores/inboxStore.ts (Zustand), src/data/repositories/inboxRepository.ts (Dexie + Firebase sync), src/shared/services/task/unifiedTaskService.ts (location-aware CRUD), src/shared/subscribers/inboxSubscriber.ts (eventBus sync).
- Hotkeys: src/shared/hooks/useModalHotkeys.ts and useModalEscapeClose.ts share modalStackRegistry; no react-hotkeys-hook usage elsewhere found.
- Feedback: react-hot-toast via AppToaster (src/app/components/AppToaster.tsx); local toast store + UI components (toastStore.ts, shared/components/ui/Toast.tsx, SyncErrorToast.tsx, XPToast, etc.). InboxTab currently calls react-hot-toast directly.
- SystemState persistence: createDexieSystemStateStorage + systemRepository.ts (Dexie systemState table) and uiStore.ts (layout persist). Also used in templateTaskService for sort/auto-generate/log flags.
- Schedule utilities: timeBlockBucket.ts / threeHourBucket.ts (block/hour normalization); timeBlockVisibility.ts (current/past/future filtering); no existing “find next empty slot” helper. Task recommendation utility exists but not slot-aware.

# Root Cause / Gap Analysis
The inbox flow is block-agnostic; quick placement exists only as fixed TIME_BLOCK buttons. There is no utility to locate nearest free slot (today/tomorrow/next), no global hotkey layer for inbox capture/placement, and feedback is split between react-hot-toast and custom toast store. Triage mode and mini HUD concepts have no scaffolding.

# Methodology
- Searched codebase for inbox, hotkeys, toast, systemState, and slot utilities.
- Read key inbox UI, store, repository, subscriber, and unified task service files.
- Reviewed schedule utils for slot/visibility capabilities and systemState usage patterns.

# Findings
- (Fact) Inbox UI attachment points: InboxTab renders inline quick-add, per-task quick block buttons using TIME_BLOCKS, and opens TaskModal for full edit. Drag-drop from schedule calls useDailyData.updateTask with timeBlock:null to move into inbox, then reloads inbox.
- (Fact) Stores/services: useInboxStore orchestrates Dexie CRUD via inboxRepository and emits eventBus signals for completions; updateTask hands off to dailyDataStore when timeBlock is set (optimistic removal). unifiedTaskService offers location-agnostic update/delete/toggle; inboxSubscriber listens for inbox:taskRemoved to prune UI.
- (Fact) Hotkeys: Only modal-level handling via useModalHotkeys/useModalEscapeClose with a shared stack; no react-hotkeys-hook integration and no global inbox shortcuts.
- (Fact) Feedback stack: AppToaster mounts react-hot-toast globally; InboxTab uses toast from react-hot-toast for CRUD errors and quick placement success. A separate toast store + UI components exist but are unused here, implying two parallel toast systems.
- (Fact) SystemState pattern: uiStore persists layout (sidebar/panel) through createDexieSystemStateStorage -> systemRepository; templateTaskService stores template sort/order and auto-generate/log flags the same way. Pattern: async get/set/delete via db.systemState with optional in-memory fallback in storage adapter.
- (Fact) Slot utilities: timeBlockBucket/threeHourBucket normalize hourSlot to block boundaries and suggest hourSlot in block, but no function to find empty slots or “next available” across today/tomorrow. timeBlockVisibility only filters blocks by time.
- (Hypothesis) Today/Tomorrow/NextSlot one-tap could wrap useInboxStore.updateTask or unifiedTaskService.updateAnyTask with a new “findNextAvailableSlot” helper placed under schedule/utils or shared/services/schedule to respect existing hourSlot normalization and TIME_BLOCKS.
- (Hypothesis) Mini HUD / triage mode can live above InboxTab (or as a compact overlay component) reusing useInboxStore data and quick block assigners; modal stack hooks already guard ESC behavior.

# Recommendations
- Build a dedicated slot-finder helper (e.g., shared/services/schedule/slotFinder.ts) that inspects dailyData tasks vs TIME_BLOCKS to return first free hourSlot for today/tomorrow/next; reuse timeBlockBucket normalization; surface through unifiedTaskService to keep inbox/daily parity.
- Standardize feedback: either migrate InboxTab to toastStore + UI Toast component or wrap react-hot-toast in a shared notifier so mini HUD and triage actions use one channel.
- Add global hotkeys with react-hotkeys-hook for “capture to inbox” and “place to NextSlot/Today/Tomorrow” and route through useInboxStore/unifiedTaskService; keep modalStackRegistry precedence when modals are open.
- Persist triage filters/sorting via systemState (reuse createDexieSystemStateStorage pattern) to remember triage mode state.

# Open Questions
- What counts as “next available slot” (first empty TIME_BLOCK, or first hour-level gap within block)? Should we respect existing tasks’ hourSlot density or allow stacking?
- Should mini HUD live as a floating widget in ScheduleView or as a detachable component within InboxModal?
- Which toast system should be canonical for inbox/triage actions (react-hot-toast vs custom toast store)?

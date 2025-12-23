# Value Statement and Business Objective
Clarify the Inbox (global unscheduled task bucket) purpose, UX surface, and data flow so future work on scheduling/drag-drop can align with existing patterns and avoid regressions.

## Status
Planned

## Changelog
- 2025-12-23: Initial scope mapping for Inbox UI, state, repository, and tests.
- 2025-12-23: Planned: ROI-based Inbox enhancement proposal drafted (see agent-output/planning/018-inbox-roi-proposals-15.md).

## Objective
Map what Inbox does today: primary UI entry points, data persistence (Zustand/Dexie), inbox↔block transition flows, and current automated tests/pain-point hints.

## Context
Sources reviewed: `src/features/tasks/InboxTab.tsx`, `src/features/tasks/InboxModal.tsx`, `src/features/quickadd/QuickAddTask.tsx`, `src/shared/stores/inboxStore.ts`, `src/data/repositories/inboxRepository.ts`, `src/shared/services/task/unifiedTaskService.ts`, `src/shared/subscribers/inboxSubscriber.ts`, `src/shared/stores/dailyDataStore.ts` (update/toggle sections), `src/shared/services/task/README.md`, `tests/inbox-to-block-immediate.test.ts`, `src/shared/utils/taskFactory.ts`.

## Root Cause / Motivation
Need a consolidated understanding of Inbox scope to guide future UX or integration changes without touching code yet.

## Methodology
Static read-through of key Inbox UI components, stores, repositories, services, and related tests. No runtime changes or edits.

## Findings (facts)
- Purpose: Inbox is the global holding area for tasks with `timeBlock === null`, keeping unscheduled items until assigned to a schedule block.
- UI surfaces:
  - Inbox main tab: `src/features/tasks/InboxTab.tsx` shows list with filters (all/recent/resistance), inline quick add (15m default), TaskModal for add/edit, drag-drop target from schedule, quick block assignment buttons, and quest progress hooks.
  - Modal wrapper: `src/features/tasks/InboxModal.tsx` renders InboxTab in a full-screen modal (ESC via `useModalEscapeClose`).
  - Quick add window: `src/features/quickadd/QuickAddTask.tsx` (global hotkey) creates inbox tasks with tag parsing (Txx/Dx), desktop notification, and closes Electron window.
- State/persistence:
  - Zustand store: `src/shared/stores/inboxStore.ts` manages `inboxTasks`, calls inboxRepository for CRUD, filters out completed on load, triggers emoji suggestions, uses taskCompletionService/eventBus on completion, and defers timeBlock updates to `dailyDataStore` with optimistic removal.
  - Repository: `src/data/repositories/inboxRepository.ts` (Dexie globalInbox + completedInbox). Enforces `timeBlock === null` on add; toggle moves between tables; move helpers `moveInboxTaskToBlock`, `moveTaskToInbox`; Firebase sync via `syncCore` strategies.
  - Unified access: `src/shared/services/task/unifiedTaskService.ts` auto-detects location (inbox vs daily) for update/delete/toggle/get and refreshes stores via dynamic imports.
  - Cross-store sync: `src/shared/subscribers/inboxSubscriber.ts` listens for `inbox:taskRemoved` from dailyDataStore and prunes inboxStore immediately.
  - Daily store interplay: `src/shared/stores/dailyDataStore.ts` `updateTask` detects inbox→block (timeBlock set) vs block→inbox (timeBlock null), performs optimistic add/remove, emits `inbox:taskRemoved`, and background reloads; toggle logic also checks inbox via repository.
- Conversion flow (Inbox→Block): set `timeBlock` on an inbox task (via inboxStore.updateTask or dailyDataStore.updateTask). Optimistic move adds to dailyData.tasks, emits `inbox:taskRemoved`, inboxSubscriber removes from inbox UI, repository update + background revalidate keeps Dexie/Firebase consistent.
- Tests:
  - `tests/inbox-to-block-immediate.test.ts` covers `inbox:taskRemoved` emission/handling and storeUtils optimistic helpers; validates inboxStore updates after event.
- Helper factories: `createInboxTask` and `createTaskFromPartial` enforce `timeBlock: null` defaults for inbox tasks.

## Findings (hypotheses/risks)
- Drag-drop in InboxTab comments hint at split handling between dailyDataStore and inboxStore; may need verification that schedule→inbox path always uses repository/unified service to keep Dexie/Firebase in sync.
- Completed inbox tasks live in `completedInbox`; inboxStore.loadData filters them out—UI for completed inbox items may be absent.

## Recommendations
1) When adjusting Inbox UX, keep repository-mediated flows; avoid touching Dexie directly to preserve sync and event hooks.
2) Reuse `unifiedTaskService` for ambiguous task locations (search, bulk ops) to avoid location drift.
3) For DnD flows, confirm ScheduleView/drag manager paths align with `dailyDataStore.updateTask` so `inbox:taskRemoved` stays consistent.

## Open Questions
- Is there a dedicated UI for completed inbox items, or are they only reachable via search/RAG? (completedInbox stored but not surfaced here.)
- Should quick-add enforce additional validation (e.g., goals, deadline) before inbox insert?
- Are Firebase sync errors surfaced to the user during inbox operations?

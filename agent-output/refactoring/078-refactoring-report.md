---
ID: 078
Origin: 078
UUID: 9c3a1f2b
Status: Active
Files-Refactored:
  - src/app/AppShell.tsx
  - src/app/hooks/usePanelLayout.ts
  - src/app/components/TopToolbar.tsx
  - src/app/components/CenterContent.tsx
  - src/shared/stores/useScheduleViewModeStore.ts
  - src/features/goals/GoalsInlineView.tsx
  - src/features/settings/components/tabs/ShortcutsTab.tsx
  - src/data/db/infra/useAppInitialization.ts
  - tests/schedule-view-mode-store.test.ts
  - tests/rtdb-backfill.test.ts
  - tests/sync-core.test.ts
Complexity-Reduced:
  - Removed dead/commented blocks, reduced repeated setter boilerplate
  - Reduced Zustand-driven re-renders via selectors
  - Fixed persist storage violation (localStorage -> Dexie systemState)
---

# Refactoring Report 078

## Summary

- Removed dead code/comments in UI shell and goals inline view.
- Standardized schedule view mode persistence to Dexie `systemState` (project policy: no new localStorage).
- Reduced avoidable re-renders in `TopToolbar` by switching to Zustand selectors.
- Fixed a11y issue: duplicate `id="main-content"`.
- Restored green gates: `npm test` and `npx tsc --noEmit` now pass.

## Changes

### 1) Dexie systemState persist (policy compliance)

**File:** src/shared/stores/useScheduleViewModeStore.ts

- Changed Zustand `persist` storage from default localStorage to Dexie systemState storage (`createDexieSystemStateStorage`).
- Updated JSDoc to match the actual persistence mechanism.

**Tests updated:** tests/schedule-view-mode-store.test.ts

- Updated persist expectations to read/write `persist:schedule-view-mode` via `systemRepository`.

### 2) Reduce re-renders + remove dead registration stub

**File:** src/app/components/TopToolbar.tsx

- Switched to selector-style Zustand usage for `useBattleStore`, `useScheduleViewStore`, `useTaskBreakdownStore`, `useFocusModeStore`, `useWaifuCompanionStore`, `useScheduleViewModeStore`.
- Replaced the empty `ref` callback stub with a small `XPPositionRegistrar` helper that registers the XP value element position.

### 3) Layout/state cleanup

**File:** src/app/hooks/usePanelLayout.ts

- Extracted magic numbers into named constants (`AUTO_COLLAPSE_WIDTH_PX`, `LEFT_PANEL_WIDTH_PX`, `TIMELINE_WIDTH_PX`).
- Removed stale comments and made async persist calls explicit with `void`.

### 4) UI shell + a11y

**Files:**
- src/app/AppShell.tsx
- src/app/components/CenterContent.tsx

- Removed unused commented-out handler and stale “removed import” comments.
- Removed duplicate `id="main-content"` from `CenterContent` to avoid duplicate IDs.

### 5) Component consistency / boilerplate reduction

**Files:**
- src/features/goals/GoalsInlineView.tsx
- src/features/settings/components/tabs/ShortcutsTab.tsx

- Removed unused state field (`sessionFocus.goalId`) and added `type="button"` where appropriate.
- Introduced small helpers in ShortcutsTab to reduce repeated `setLocalSettings` patterns.

### 6) Typecheck fixes (non-behavioral)

**Files:**
- src/data/db/infra/useAppInitialization.ts
- tests/rtdb-backfill.test.ts
- tests/sync-core.test.ts

- Added a small wrapper to adapt `initializeFirebase` to the `unknown` signature required by startup deps.
- Adjusted `FetchFromFirebaseFn` mocks to satisfy the generic function type.
- Removed an unused `afterEach` import.

## Before/After Snippets (key items)

### schedule view mode persist

**Before**

```ts
persist(..., { name: 'schedule-view-mode' })
```

**After**

```ts
persist(..., {
  name: 'schedule-view-mode',
  storage: createJSONStorage(() => createDexieSystemStateStorage({ prefix: 'persist:' })),
  partialize: (state) => ({ mode: state.mode }),
})
```

## Verification

- `npm test`: PASS (44 test files)
- `npx tsc -p tsconfig.json --noEmit`: PASS
- `npm run lint`: still FAILS due to pre-existing errors outside this refactor scope (see “Remaining opportunities”).

## Remaining opportunities

- ESLint errors currently block `npm run lint` due to issues in:
  - src/features/tasks/BulkAddModal.tsx (unused eslint-disable)
  - src/features/tasks/TaskBreakdownModal.tsx (unused eslint-disable)
  - src/features/tasks/hooks/inbox/useInboxEditing.ts (duplicate react import)
  - src/features/tasks/hooks/inbox/useInboxPlacement.ts (duplicate react import)
  - src/features/tasks/hooks/useInboxHotkeys.ts (no-extra-semi)
  - 레퍼런스/ts-fsrs/** (lint errors in vendored reference code)

- Dead-code candidates worth confirming:
  - src/app/components/GlobalModals.tsx appears unused.
  - src/features/goals/GoalsModal.tsx and src/features/tasks/InboxModal.tsx have no references.

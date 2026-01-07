---
ID: 079
Origin: 079
UUID: c1d2e3f4
Status: Active
---

# Repo Improvement Scan (frontend-only)

## Changelog
- 2026-01-08 – Initial quick audit for duplication/UX/perf/refactor/function ideas; no code changes performed.

## Value Statement & Objective
Surface highest-value frontend-side fixes and cleanups (P0–P2) that reduce ADHD friction, avoid architectural drift, and prevent perf issues in the Electron React client.

## Context
- User request: quick repo-wide scan for improvement ideas (duplication, ADHD-friendly UI/UX, perf/inefficiency, refactor candidates, feature ideas). Backend work out of scope.
- Scope: frontend/Electron UI, hooks, repositories, docs; no implementation.
- Prior memory: earlier audits flagged missing inbox ESC exit and hotkey gaps; revalidated here.

## Methodology
- Manual code reads: [src/app/AppShell.tsx](src/app/AppShell.tsx), [src/app/hooks/useKeyboardShortcuts.ts](src/app/hooks/useKeyboardShortcuts.ts), [src/features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx), [src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts), [src/features/tasks/hooks/inbox/useInboxHotkeysGuards.ts](src/features/tasks/hooks/inbox/useInboxHotkeysGuards.ts), [src/shared/services/sync/syncLogger.ts](src/shared/services/sync/syncLogger.ts), [src/data/repositories/waifuRepository.ts](src/data/repositories/waifuRepository.ts), [src/data/repositories/shopRepository.ts](src/data/repositories/shopRepository.ts), [src/data/repositories/settingsRepository.ts](src/data/repositories/settingsRepository.ts), [src/data/repositories/dailyData/README.md](src/data/repositories/dailyData/README.md).
- Pattern scan: grep for localStorage usage/doc drift; hotkey coverage; always-on-top UI.
- Confidence labels: Proven (testable/logged), Observed (seen in code), Inferred (deduced from structure/comments).

## Findings (prioritized)
- **P0 – ESC in inbox triage does nothing** (Confidence: Observed). `case 'Escape'` only stops propagation without exiting triage, so users can get stuck in triage mode. Evidence: [src/features/tasks/hooks/useInboxHotkeys.ts#L268-L279](src/features/tasks/hooks/useInboxHotkeys.ts#L268-L279).
- **P0 – Triage hotkeys ignore focused inputs** (Confidence: Observed). Guard returns false when triageEnabled, so typing inside inputs still triggers triage keys (t/o/n etc.), risking accidental moves/deletes. Evidence: [src/features/tasks/hooks/inbox/useInboxHotkeysGuards.ts#L20-L35](src/features/tasks/hooks/inbox/useInboxHotkeysGuards.ts#L20-L35).
- **P1 – Triage processed-count placeholder never implemented** (Confidence: Observed). `incrementProcessedCount` is a no-op, so triage throughput cannot be measured. Evidence: [src/features/tasks/hooks/useInboxHotkeys.ts#L140-L170](src/features/tasks/hooks/useInboxHotkeys.ts#L140-L170).
- **P1 – Bulk add modal uses blocking alerts instead of inline/toast feedback** (Confidence: Observed). Success/error/empty states call `alert`, interrupting flow and lacking ADHD-friendly inline feedback. Evidence: [src/features/tasks/BulkAddModal.tsx#L70-L120](src/features/tasks/BulkAddModal.tsx#L70-L120).
- **P1 – Global hotkeys cover only bulk add/left panel/always-on-top** (Confidence: Observed). No inbox/open, search, or triage exit shortcut despite keyboard-first design needs. Evidence: [src/app/hooks/useKeyboardShortcuts.ts#L88-L138](src/app/hooks/useKeyboardShortcuts.ts#L88-L138).
- **P1 – Always-on-top toggle is a 10px full-height strip** (Confidence: Observed). High risk of accidental toggles and low discoverability/accessibility. Evidence: [src/app/AppShell.tsx#L190-L210](src/app/AppShell.tsx#L190-L210).
- **P1 – Always-on-top failures are silent** (Confidence: Observed). Electron API errors are console-only; no UI feedback/toast for failure. Evidence: [src/app/AppShell.tsx#L103-L133](src/app/AppShell.tsx#L103-L133).
- **P1 – Sync logger keeps 10k logs in memory and writes every add** (Confidence: Observed). MAX_LOGS=10,000 with immediate Dexie writes; no throttling or pruning to UX-visible window, risking perf/storage churn. Evidence: [src/shared/services/sync/syncLogger.ts#L31-L160](src/shared/services/sync/syncLogger.ts#L31-L160).
- **P1 – AppShell mixes orchestration with business actions** (Confidence: Observed). Template creation and bulk-add persistence live inside the shell component, making render path handle data mutations and complicating testability. Evidence: [src/app/AppShell.tsx#L140-L180](src/app/AppShell.tsx#L140-L180).
- **P2 – Global overlays always mounted** (Confidence: Observed). `GlobalTaskBreakdown`, `XPParticleOverlay`, `MemoMissionModal` render unconditionally, increasing base render cost even when unused. Evidence: [src/app/AppShell.tsx#L270-L280](src/app/AppShell.tsx#L270-L280).
- **P2 – Docs still describe localStorage fallbacks** (Confidence: Observed). Repository headers and dailyData README mention localStorage despite baseRepository removing it, inviting policy regression. Evidence: [src/data/repositories/waifuRepository.ts#L1-L120](src/data/repositories/waifuRepository.ts#L1-L120), [src/data/repositories/shopRepository.ts#L1-L80](src/data/repositories/shopRepository.ts#L1-L80), [src/data/repositories/settingsRepository.ts#L1-L130](src/data/repositories/settingsRepository.ts#L1-L130), [src/data/repositories/dailyData/README.md#L30-L120](src/data/repositories/dailyData/README.md#L30-L120).
- **P2 – tempSchedule feature remains alongside main schedule** (Confidence: Inferred). Parallel feature folder [src/features/tempSchedule](src/features/tempSchedule) and dedicated tests suggest experiment debt overlapping with TimelineView.
- **P2 – Date parsing/util tests duplicated** (Confidence: Inferred). Multiple similar specs (`tests/temp-schedule-date-parsing.test.ts`, `tests/temp-schedule-date-utils.test.ts`, `tests/date-key-utils.test.ts`) likely cover overlapping scenarios with divergent fixtures.
- **P2 – Inbox hotkey fallback placement is minimal** (Confidence: Observed). Default `placeTaskToSlot` just updates `timeBlock/hourSlot` without slotFinder/validation, risking schedule conflicts when triage is enabled without injected services. Evidence: [src/features/tasks/hooks/useInboxHotkeys.ts#L90-L125](src/features/tasks/hooks/useInboxHotkeys.ts#L90-L125).

## Remaining Gaps
| # | Unknown | Blocker | Required Action | Owner |
|---|---------|---------|-----------------|-------|
| 1 | Actual runtime impact of syncLogger 10k retention on Electron perf | No profiling yet | Profile addSyncLog under load; measure Dexie write time and memory | Pending |
| 2 | Whether tempSchedule is still user-facing | Need product decision | Confirm usage or deprecate with plan | Product/Eng |
| 3 | User expectations for global hotkeys (inbox/open/search) | Needs UX sign-off | Define hotkey map and conflicts | UX/Eng |

## Analysis Recommendations (next steps to deepen inquiry)
- Profile syncLogger and AppShell render costs with overlays toggled to quantify perf impact before proposing caps/lazy mounts.
- Audit all inbox entry points to validate triage mode lifecycle (enter/exit, focus handling) and record repro steps for ESC gap.
- Confirm policy on localStorage mentions; align docs with baseRepository and add lint/check to prevent reintroduction.
- Map schedule vs tempSchedule responsibilities; decide consolidation path and prune redundant tests/fixtures accordingly.

## Open Questions
- Should always-on-top control be surfaced inside toolbar or settings instead of a screen-edge strip for accessibility?
- What metrics are needed for triage efficiency (processed count, drop-offs) to justify instrumenting incrementProcessedCount?
- Are BulkAdd success/error states expected to be non-blocking toasts or inline banners for ADHD-friendly flow?

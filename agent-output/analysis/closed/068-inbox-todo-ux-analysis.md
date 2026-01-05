---
ID: 68
Origin: 68
UUID: 8c9a3bf1
Status: Planned
---

## Changelog
- 2026-01-04: 분석 결과를 기반으로 제안서/계획 초안 작성(Planning: 068-inbox-todo-purpose-proposal-draft-2026-01-04).

## Value Statement and Business Objective
Clarify the current Inbox/할일 experience so we can reduce friction for ADHD users who need fast capture and triage, and align future UI work with the local-first, keyboard-friendly workflow of TimeBlock Planner.

## Objective
Document the current purpose, entry paths, flows (create/edit/complete/archive/block move), hotkeys, and modal rules for Inbox/할일, and surface UX bottlenecks and opportunities.

## Context
- Inbox is a global queue (timeBlock=null) managed by the Zustand inbox store and Dexie repo; Inbox UI lives in a modal wrapping `InboxTab`.
- Keyboard triage is provided by a custom hook; quick placement uses slot finder and dailyData store to move items onto the schedule.
- Entry appears limited to a TopToolbar CTA; no route/tab toggling is wired despite UI store supporting an `inbox` tab.

## Root Cause
The Inbox UX is modal-only and keyboard support is partial: access depends on a toolbar button, triage exit via ESC is declared but not implemented, and quick placement hinges on background slot suggestions without surfacing availability upfront. These patterns create friction for rapid capture/triage.

## Methodology
- Read UI/store/repo sources: Inbox modal/tab/hotkeys, inbox store, inbox repo, TopToolbar CTA, global keyboard shortcuts, quick-add window, inbox subscriber, and dailyData store move logic.
- Reviewed targeted tests: inbox hotkey behaviors and optimistic inbox→block updates.

## Findings (facts vs hypotheses)
- Fact: Inbox UI is a modal opened from the TopToolbar CTA (no routing); content is `InboxTab` with inline add, triage HUD, quick place buttons, and TaskModal for edit/new ([src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx), [src/features/tasks/InboxModal.tsx](src/features/tasks/InboxModal.tsx), [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx)).
- Fact: Entry hotkeys are absent; global shortcut hook only covers bulk add/panels/always-on-top, not Inbox ([src/app/hooks/useKeyboardShortcuts.ts](src/app/hooks/useKeyboardShortcuts.ts)).
- Fact: Inline add uses Enter to add and ESC to clear/blur; TaskModal handles multi-add/edit; undo available for delete via toast ([src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx)).
- Fact: Quick placement (Today/Tomorrow/Next or T/O/N keys) calls slot finder and dailyData updates; success/failure is toast-driven with no pre-check visualization ([src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx), [src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts)).
- Fact: Triage hotkeys (↑/↓/j/k, t/o/n, p, h, d/Backspace, Enter, ESC) capture in capture phase when triageEnabled=true; disabled when modal open; input focus is ignored in triage mode ([src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts), [tests/inbox-hotkeys.test.ts](tests/inbox-hotkeys.test.ts)).
- Fact: ESC is labeled as triage exit in UI copy, but the key handler only prevents default; there is no handler to toggle triageEnabled off ([src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts), [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx)).
- Fact: Inbox data flows through Dexie via inbox repository and Zustand store; moving to a block is optimistic and emits `inbox:taskRemoved` for immediate UI removal, with background revalidation ([src/shared/stores/inboxStore.ts](src/shared/stores/inboxStore.ts), [src/data/repositories/inboxRepository.ts](src/data/repositories/inboxRepository.ts), [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts), [src/shared/subscribers/inboxSubscriber.ts](src/shared/subscribers/inboxSubscriber.ts), [tests/inbox-to-block-immediate.test.ts](tests/inbox-to-block-immediate.test.ts)).
- Fact: QuickAddTask (global Electron window) persists directly to inbox with ESC to close and Ctrl/Cmd+Enter to save ([src/features/quickadd/QuickAddTask.tsx](src/features/quickadd/QuickAddTask.tsx)).
- Hypothesis: Lack of a persistent/in-layout inbox view (only modal) plus no global open hotkey slows access, especially when already keyboard-focused.
- Hypothesis: Triage state and HUD goals are local and non-persisted; losing state between openings may discourage repeated short triage sessions.

## Analysis Recommendations (next discovery steps)
- Trace how users currently open the Inbox (CTA clicks vs quick-add) with instrumentation to validate entry friction assumptions.
- Verify whether ESC is expected to exit triage by design and measure how often users attempt it; confirm with UX copy owners.
- Profile slot finder failures for Inbox quick placement to see how often toasts report “no slot” and whether users abandon triage.
- Check for any unused `inbox` tab routing in legacy UI store consumers to confirm modal-only scope.

## Open Questions
- Should Inbox have a global hotkey or left-panel entry to match other workflows?
- Is ESC intended to exit triage, or should triage stay sticky until toggled? (copy vs behavior gap)
- Are pinned/deferred counts or HUD goals persisted elsewhere, or should they be per-session cues only?
- How often do quick placement operations fail due to slotFinder constraints, and do users receive actionable follow-ups?

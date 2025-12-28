# Value Statement and Business Objective
Give ADHD-friendly weekly-goal interactions clearer keyboard access, lightweight focus context, and lower cognitive load so users can check/add/log without hunting for controls.

**Status:** Planned

---

## Changelog
- 2025-12-28: Initial survey of Goals UI, hotkey stack, modal patterns, and info-density surfaces.
- 2025-12-28: Plan drafted in agent-output/planning/048-goals-hotkeys-focus-preview-density-plan.md.

## Objective
Identify where to add goal hotkeys, session-focus banner, quick history preview, and info-density guardrails without touching backend/sync.

## Context (code map)
- Goals shell modal: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) – opens weekly panel and nested edit modal, uses `useModalHotkeys` for ESC.
- Weekly panel: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) – loads store, renders cards, opens edit/history/catch-up modals.
- Goal card: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) – main info/controls (progress, badges, quick update buttons, quick log popover, direct input, tooltip). Header is keyboard-activatable for history.
- History modal: [src/features/goals/WeeklyGoalHistoryModal.tsx](src/features/goals/WeeklyGoalHistoryModal.tsx) – overlay modal with 5-week chart/stats, closes via ESC/hotkey; no focus trap.
- Edit modal: [src/features/goals/WeeklyGoalModal.tsx](src/features/goals/WeeklyGoalModal.tsx) – add/edit goal, uses `useModalHotkeys` for ESC and Ctrl/Cmd+Enter save.
- Status tooltip: [src/features/goals/components/GoalStatusTooltip.tsx](src/features/goals/components/GoalStatusTooltip.tsx) – hover/focus tooltip, ESC closes.
- Hotkey infra: [src/shared/hooks/useModalHotkeys.ts](src/shared/hooks/useModalHotkeys.ts) + [src/shared/hooks/modalStackRegistry.ts](src/shared/hooks/modalStackRegistry.ts) + [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts) – window keydown with IME guard (`isComposing`/`Process`), top-of-stack enforcement; no react-hotkeys-hook.
- Example list-hotkeys: [src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts) – ignores when modal stack not empty; shows collision-handling pattern.
- Entry point CTA: [src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx) – opens Goals modal; no shortcut.

## Methodology
Grep and file inspection for weekly-goal components, modals, hotkey hooks, and tooltip/hover patterns. Focused on UI-only surfaces and accessibility affordances.

## Findings (facts)
- Goals modal stack: parent Goals modal uses `useModalHotkeys`; nested WeeklyGoalModal also uses it; history modal uses the same stack. Background clicks do not close modals; ESC is wired via the hook, but no focus trapping is present.
- Hotkey infra already ignores IME composition and enforces top-of-stack priority; primary actions use Ctrl/Cmd+Enter when enabled. No react-hotkeys-hook usage in goals flow.
- WeeklyGoalCard exposes: icon/title/weekly target, progress percent badge, quota/danger badges, today-target pill with tooltip, progress bar, quick +/- buttons, quick log popover, direct input toggle. Header is keyboard-activatable to open history modal.
- History UI is a full modal overlay (z=3000) with current-week ring, stats, and reverse-chronological bars; triggered from card header click/Enter/Space. Hover-only interactions are limited to the status tooltip; most controls are buttons.
- Catch-up banner/modal live in the panel; no global “Goals hotkey” binding exists (CTA only in TopToolbar).

## Recommendations (non-binding, UI-only)
- Hotkeys: add global shortcut to open/close Goals modal in TopToolbar; within modal, add focusable list navigation + history open shortcut on card, and hint text rendered near header buttons; reuse modalStackRegistry + IME guards.
- Session-focus banner: lightweight, non-persistent strip at top of WeeklyGoalPanel or GoalsModal header clarifying it is per-session-only; avoid saving to store/Dexie.
- History quick preview: add focusable, click/tap-friendly inline preview (e.g., summary chip or collapsible detail) on cards; ensure it’s not hover-only and respects touch; keep full modal for deep history.
- Info-density guardrail: default to 3 surfaced items on card (title/target, progress badge, today-target pill); gate secondary controls (quick log, direct input, severity detail) behind explicit toggles/tooltips, especially in compact mode.

## Open Questions
- Desired global key combo for opening Goals (avoid conflicts with Inbox triage keys and IME-heavy locales)?
- Should history quick preview show current week only or last N weeks? Any mobile/touch layout constraints?
- Need explicit focus management? (Current modals lack focus trap.)

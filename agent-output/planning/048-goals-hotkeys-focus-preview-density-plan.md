# Plan: Goals Hotkeys + Session Focus + History Preview + Density Guardrails

- Plan ID: plan-2025-12-28-goals-hotkeys-focus-preview-density
- Target Release: **1.0.176** (aligns with existing overall UI improvements release line; current package.json = 1.0.175)
- Epic Alignment: Weekly Goals UX (Keyboard Access + ADHD-friendly info density)
- Status: Draft

## Value Statement and Business Objective
As a keyboard-first (and ADHD-affected) user, I want Goals to be operable with predictable shortcuts, a lightweight session-only focus cue, and lower cognitive load cards, so that I can review and adjust weekly goals quickly without hunting UI affordances.

## Scope and Constraints
- Frontend/UI only.
- No localStorage (theme exception only; not used here).
- No DB schema changes unless absolutely necessary (prefer none).
- Maintain modal policy: ESC closes; backdrop click does not close.
- Keep IME safety: ignore shortcuts while composing (isComposing / key === 'Process').

## Inputs / References
- Analysis: agent-output/analysis/049-goals-hotkeys-ux-analysis.md
- Analysis: agent-output/analysis/048-long-term-goals-purpose-ux-analysis.md
- Existing infra: src/shared/hooks/useModalHotkeys.ts, src/shared/hooks/modalStackRegistry.ts
- Existing global shortcuts infra: src/app/hooks/useKeyboardShortcuts.ts, src/app/components/GlobalModals.tsx

## Work Breakdown (Implementation-ready)
1) Global Goals toggle shortcut + hint (open/close)
2) Modal-internal navigation (card focus move) + history open shortcut + hints
3) IME + collision avoidance strategy hardening (stack-aware, input-aware)
4) Session-only “focus purpose” banner (non-persistent)
5) History quick preview (focus/touch friendly; no hover-only)
6) Info density guardrails on WeeklyGoalCard (default 3 elements; progressive disclosure)
7) Tests (vitest) updates/additions for hotkeys, IME guard, preview, density defaults

## Deliverables
- Keyboard shortcuts implemented and visible via hints.
- Session focus banner shipped with explicit “not saved” messaging.
- Quick history preview shipped (accessible via click/tap/focus).
- WeeklyGoalCard default density reduced with opt-in expansion.

## Risks
- Shortcut collisions with existing app-wide shortcuts and triage mode.
- Modal stacking interactions (GoalsModal + nested WeeklyGoalModal + HistoryModal).
- Accessibility regressions if focus/roving tabindex is not handled consistently.

## Verification (High-level)
- Run `npm run test` and ensure new/updated vitest suites pass.
- Manual smoke: open Goals via hotkey, navigate cards, open/close history, verify IME composition does not trigger shortcuts.

# QA Report: Goals Hotkeys + Session Focus + History Preview + Density Guardrails

**Plan Reference**: `agent-output/planning/048-goals-hotkeys-focus-preview-density-plan.md`
**QA Status**: Test Strategy Development
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-28 | User | Verify Goals file paths + propose QA checklist/tests | Confirmed target file locations; drafted QA checklist and test strategy; flagged likely keyboard focus edge case. |

## Timeline
- **Test Strategy Started**: 2025-12-28
- **Test Strategy Completed**: 2025-12-28
- **Implementation Received**: 2025-12-28 (static code review)
- **Testing Started**: 2025-12-28
- **Testing Completed**: 2025-12-28
- **Final Status**: Test Strategy Development

## Test Strategy (Pre-Implementation)

### User-Critical Workflows (Realistic)
1) Global entry
- Open Goals from toolbar CTA.
- Open/close Goals using Ctrl/Cmd+Shift+G.

2) In-modal keyboard operation (keyboard-first)
- Navigate weekly goal cards using Arrow keys.
- Open History via Enter.
- Open Quick Log via L.
- Toggle hint bar via ?.

3) Collision avoidance & safety
- Shortcuts must not fire while typing in any input/textarea/contenteditable.
- Shortcuts must not fire while IME composing (`isComposing` or key `Process`).
- If another modal is open, Goals global open must not trigger.
- If a child modal is open above Goals, Goals internal navigation must not trigger.

4) Modal policy compliance
- ESC closes the top-of-stack modal.
- Backdrop click must NOT close.

5) ADHD-friendly density & feedback
- Default view should be compact with progressive disclosure.
- “History preview” must not be hover-only; click/keyboard/touch must work.

### Testing Infrastructure Requirements
⚠️ TESTING INFRASTRUCTURE NEEDED (for true UI/hook coverage)

**Test Frameworks Needed**:
- Vitest (already present)

**Testing Libraries Needed**:
- `@testing-library/react`
- `@testing-library/user-event`
- A DOM environment for Vitest (`jsdom` or `happy-dom`)

**Configuration Files Needed**:
- A UI-focused Vitest config (recommended): `vitest.ui.config.ts` using `environment: 'jsdom'` and including `tests/**/*.test.tsx`.

**Build Tooling Changes Needed**:
- Add script: `test:ui` (runs UI tests without changing existing node-only suite)

**Dependencies to Install**:
```bash
npm i -D @testing-library/react @testing-library/user-event jsdom
```

### Required Unit Tests (Node-only, no DOM)
These can be written as “pure decision logic” tests (similar style to `tests/modal-hotkeys.test.ts`).

- Global hotkey matching (Ctrl/Cmd+Shift+G)
  - Triggers only when ctrl/meta + shift + g/G, and NOT alt.
  - Ignores IME composing (`isComposing` or key `Process`).
  - Ignores when target is input/textarea/contenteditable.
  - Open gating: only when `modalStackRegistry.size() === 0`.
  - Close gating: only when `modalStackRegistry.size() === 1`.

- In-modal hotkeys gating
  - Ignores when `modalStackRegistry.size() > 1`.
  - Ignores input focus + IME composing.

- Focus movement algorithm
  - With existing focus, Arrow keys move by ±1 and clamp ends.
  - With NO focused id, first navigation should focus a sensible default (expected: Down/Right -> first, Up/Left -> last).

- Action routing
  - L triggers “open quick log” for focused id.
  - Enter triggers “open history” for focused id.
  - ? toggles hint state.

### Required Integration Tests (UI, jsdom)
- `TopToolbar` + global hotkey opens/closes Goals modal.
- While the session focus input is focused, global hotkeys and in-modal navigation do not fire.
- In Goals modal, Arrow navigation visually moves focus ring between cards (roving focus).
- Pressing L opens the Quick Log popover for the focused card.
- Pressing Enter opens History modal for the focused card.
- When a child modal (WeeklyGoalModal/HistoryModal) is open, Goals internal nav does not run; ESC closes child first.
- Backdrop click does not close Goals modal.

### Acceptance Criteria
- All keyboard shortcuts behave predictably and do not steal input focus.
- Modal stacking remains correct (top-of-stack only reacts).
- No hover-only interactions required for history preview.
- No regressions to existing node-only test suite.

## Implementation Review (Post-Implementation)

### Code Changes Summary (Files in Scope)
- `src/app/components/TopToolbar.tsx`: wires `useGoalsGlobalHotkey` to open/close Goals.
- `src/features/goals/GoalsModal.tsx`: modal container + hint UI + `useGoalsHotkeys` integration + ESC close via `useModalHotkeys`.
- `src/features/goals/WeeklyGoalPanel.tsx`: passes focus state into `WeeklyGoalCard`, plumbs Quick Log / History open requests.
- `src/features/goals/WeeklyGoalCard.tsx`: focus styling, history preview (click/keyboard), density toggle, Quick Log popover.
- `src/features/goals/hooks/useGoalsHotkeys.ts`: global + in-modal key handling; IME/input/modal-stack guards.

### QA Risk / Likely Defect (Static Review)
- In `useGoalsHotkeys` focus movement (`moveFocusBy`), when `focusedGoalId` is null, ArrowDown/ArrowUp currently appears to skip the first/last item (because it uses `baseIndex + delta`).
  - Expected UX: first keypress should land on first (Down/Right) or last (Up/Left).
  - This should be validated manually and, if confirmed, fixed in implementation.

## Test Coverage Analysis
Current test setup is node-only and excludes TSX, so the above UI/hook behaviors are not automatically covered today.

## Test Execution Results
- **Command**: `npm test`
- **Status**: PASS (31 test files, 268 tests)
- **Notes**: Current Vitest config is `environment: 'node'` and excludes `src/**/*.tsx`, so this pass does not validate TSX/runtime hook behavior for the Goals UI.

Handing off to uat agent for value delivery validation

---
ID: 70
Origin: 70
UUID: 9e4b2d71
Status: QA Failed
---

# QA Report: Refactor Phase 2 (Modal & Shared Logic)

**Plan Reference**: `agent-output/planning/070-refactor-3phase-refactoring-plan-v1.0.md`
**QA Status**: QA Failed
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2026-01-05 | Implementer | Phase 2 modal/shared parsing + inbox hotkeys refactor verification | Executed `npm test`, `npm run test:coverage`, `npx tsc --noEmit`, `npx madge --circular`. Tests/coverage pass; typecheck fails with 1 new error in `taskParsing.ts` (TS2677). |

## Timeline
- **Testing Started**: 2026-01-05
- **Testing Completed**: 2026-01-05
- **Final Status**: QA Failed

## Test Strategy (Pre-Implementation)

User-facing risks to validate:
- Shared parser consolidation: parsing rules must not drift across modals.
- Hotkey refactor: triage navigation/edit/delete/defer/pin must remain stable.
- Type safety gate: `tsc --noEmit` must remain clean (Vite/Vitest can still pass with TS errors).

### Testing Infrastructure Requirements
- No new infrastructure required (Vitest + TypeScript already present).
- Note: Coverage is limited by `vitest.config.ts` include rules; UI/feature files may not appear in coverage report even if tested.

## Implementation Review (Post-Implementation)

### Code Changes Summary
- Shared parser: `src/features/tasks/utils/taskParsing.ts` (exports `parseTaskInputText`, `DURATION_OPTIONS`)
- Modals migrated to shared parser:
  - `src/features/tasks/BulkAddModal.tsx`
  - `src/features/tasks/TaskBreakdownModal.tsx`
- Inbox hotkeys split/composition:
  - `src/features/tasks/hooks/useInboxHotkeys.ts` now composes `useInboxNavigation` + `useInboxEditing` (+ guards/placement)
  - New hooks under `src/features/tasks/hooks/inbox/`
- Tests added: `tests/task-parsing.test.ts`

## Test Coverage Analysis

### Adequacy of new unit tests
`tests/task-parsing.test.ts` covers:
- blank-line trimming + defaults
- memo, resistance, duration parsing
- timeblock tag mapping (`@8-11`, `@morning`)
- markdown list prefix stripping option

Coverage gaps (recommended):
- invalid duration tokens (e.g., `[0m]`, `[x]`), fractional hours, unknown timeblock ids (fallback path)
- memo parsing when `|` appears multiple times

### Coverage Comparison (Baseline vs After)
- Baseline (from `agent-output/planning/070-refactor-coverage-baseline.md`): All files lines/stmts **95.59%**
- After (from `agent-output/qa/vitest-coverage.after-phase2.log`): All files lines/stmts **95.59%**
- Result: No regression observed (note: feature files like `src/features/tasks/utils/taskParsing.ts` do not appear in coverage table due to config scope).

## Test Execution Results

### Unit Tests
- **Command**: `npm test -- --reporter=dot`
- **Status**: PASS
- **Result**: **38/38 test files passed**, **504/504 tests passed**
- **Evidence**: `agent-output/qa/vitest-npm-test.log`

### Coverage
- **Command**: `npm run test:coverage`
- **Status**: PASS
- **Coverage**: All files lines/stmts **95.59%**
- **Evidence**: `agent-output/qa/vitest-coverage.after-phase2.log`

### TypeScript
- **Command**: `npx tsc --noEmit`
- **Status**: FAIL
- **Error**: `src/features/tasks/utils/taskParsing.ts(59,49) TS2677` (type predicate not assignable because `TimeBlockId` includes `null`)
- **Evidence**: `agent-output/qa/tsc-noemit.after-phase2.log`

### Circular Dependencies
- **Command**: `npx madge src --circular --extensions ts,tsx --ts-config tsconfig.json`
- **Status**: PASS (no new cycles vs baseline)
- **Result**: 9 cycles found (matches `agent-output/qa/070-madge-circular.log`)
- **Evidence**: `agent-output/qa/madge-circular.after-phase2.log`

## Code Review Checklist
- [x] Shared parsing module <300 LOC (`LINES=191`; evidence: `agent-output/qa/loc-taskParsing.txt`)
- [x] No duplicated `parseInput` between the two modals (both import shared parser)
- [x] Hotkey hook composition present (`useInboxHotkeys` delegates to `useInboxNavigation` + `useInboxEditing`)
- [x] Public API continuity: default exports for modals retained; `useInboxHotkeys` export retained
- [~] JSDoc present but inconsistent depth (file headers and some exported functions documented; new hooks rely mostly on file-level docs)

## Issues Found

### 1) Blocker: TypeScript typecheck failure
- `src/features/tasks/utils/taskParsing.ts(59,49): TS2677`
- Likely fix: update type guard to exclude `null`, e.g. `value is Exclude<TimeBlockId, null>` (or change parameter type to include null and guard accordingly).

### 2) Non-blocking: existing circular dependencies remain
- 9 cycles detected by madge; unchanged from baseline.

### 3) Repo rule risk (non-blocking, needs policy confirmation)
- `taskParsing.ts` uses hardcoded fallback text `'(제목 없음)'`. If project policy requires fallbacks from `src/shared/constants/defaults.ts`, this should be aligned.

## Verdict

**NEEDS_FIXES** (TypeScript gate failing).

---

Handing off to uat agent for value delivery validation.

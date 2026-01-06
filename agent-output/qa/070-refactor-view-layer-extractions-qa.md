---
ID: 70
Origin: 70
UUID: 9e4b2d71
Status: QA Failed
---

# QA Report: View Layer Extractions Verification

**Plan Reference**: `agent-output/planning/070-refactor-3phase-refactoring-plan-v1.0.md`
**QA Status**: QA Failed
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2026-01-05 | User | QA verification for “Phase 1 refactoring” (view-layer extractions) | Executed tests/coverage/tsc/madge + dev server smoke. Tests/coverage/tsc PASS. Found scope mismatch vs requested new files and a modal policy violation in BattleMissionsSection. |

## Timeline
- **Testing Started**: 2026-01-05
- **Testing Completed**: 2026-01-05
- **Final Status**: QA Failed

## Test Strategy (Pre-Implementation)
This verification targets regression risk from UI-layer refactors by:
- Running the full unit/integration test suite.
- Verifying coverage totals against the recorded baseline.
- Running `tsc --noEmit` to catch typing regressions.
- Running a circular dependency scan (`madge --circular`) to detect new cycles.
- Brief dev-server smoke to ensure Vite compiles and starts.

### Testing Infrastructure Requirements
⚠️ TESTING INFRASTRUCTURE NEEDED: none (existing Vitest + coverage is sufficient for this verification).

## Implementation Review (Post-Implementation)

### Code Changes Summary
**Expected by request (not found at these paths in this workspace)**:
- `src/features/tempSchedule/utils/timelineCalculations.ts`
- `src/features/battle/utils/missionCalculations.ts`
- `src/features/battle/hooks/useMissionSlots.ts`

**Observed in this workspace**:
- TempScheduleTimelineView uses extracted utilities from `src/features/tempSchedule/utils/timelinePositioning.ts`.
- BattleMissionsSection does **not** appear to be extracted into battle utils/hooks; logic remains in the component.

### LOC Check
- `src/features/tempSchedule/utils/timelinePositioning.ts`: 131 lines ✅ (<300)
- `src/features/tempSchedule/components/TempScheduleTimelineView.tsx`: 461 lines (info)
- `src/features/settings/components/tabs/battle/BattleMissionsSection.tsx`: 515 lines (still large; extraction goal not met)

## Test Execution Results

### Unit Tests
- **Command**: `npm test`
- **Status**: PASS
- **Result**: 37 test files passed; 499 tests passed.

### Coverage
- **Command**: `npm run test:coverage`
- **Status**: PASS
- **Baseline Reference**: `agent-output/planning/070-refactor-coverage-baseline.md`
- **Totals (from run output)**: All files = 95.59% stmts / 86.59% branch / 96.66% funcs / 95.59% lines
- **Delta vs baseline**: No change observed ✅

### TypeScript
- **Command**: `npx tsc --noEmit`
- **Status**: PASS (no diagnostics)

### Circular Dependencies
- **Command**: `npx madge --circular --extensions ts,tsx src`
- **Status**: FAIL (cycles exist)
- **Found cycles (2)**:
  1) `features/battle/components/BattleSidebar.tsx` → `features/battle/components/MissionModal.tsx` → `features/battle/components/modal/index.ts` → `features/battle/components/modal/BossPanel.tsx`
  2) `shared/services/rag/vectorStore.ts` → `shared/services/rag/vectorPersistence.ts`

Note: These cycles also appear in the existing log `agent-output/qa/070-madge-circular.log` (previously reported 9 cycles). This verification cannot prove “no new cycles introduced” without a tagged baseline run for this exact commit, but the cycles are not in the TempScheduleTimelineView extraction path.

### Dev Server Smoke
- **Command**: `npm run dev` (started briefly, then stopped)
- **Status**: PASS
- **Observed**: Vite server reports “ready” with no stderr output.

## Issues Found

1) **Scope mismatch vs request**
- Requested new files (`timelineCalculations.ts`, `missionCalculations.ts`, `useMissionSlots.ts`) are not present at those paths.
- TempSchedule extraction exists but uses `timelinePositioning.ts` instead.
- BattleMissionsSection extraction (slot-edit/save logic) is not implemented as described (component remains ~515 LOC).

2) **Modal policy violation in BattleMissionsSection**
- `TimeSlotEditor` closes on backdrop click (`onClick={onClose}`), but project rule requires: backdrop click must NOT close; ESC must close via `useModalEscapeClose`.
- Deletion uses `confirm()`; this is often discouraged for UX consistency in Electron apps.

3) **JSDoc / documentation gap for extracted utilities**
- `timelinePositioning.ts` exports multiple functions/types without JSDoc blocks.

## Recommendations (Before Proceeding)
- Clarify whether the intended extraction file names/paths changed; if the request is strict, implement the missing modules or update the plan/spec to match `timelinePositioning.ts`.
- Perform the BattleMissionsSection extraction into `src/features/battle/utils/*` and/or `src/features/battle/hooks/*` and add focused unit tests for the pure parts (slot validation/formatting, stats computation, reordering).
- Fix `TimeSlotEditor` modal behavior to comply with modal rules (ESC closes, backdrop does not).
- Add JSDoc for exported functions in `timelinePositioning.ts`.

## Verdict
**NEEDS_FIXES**

Handing off to uat agent for value delivery validation.

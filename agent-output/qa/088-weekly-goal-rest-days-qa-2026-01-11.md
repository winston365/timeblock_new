---
ID: 88
Origin: 88
UUID: c8d4f2a1
Status: QA Failed
---

# QA Report: Weekly Goals — Rest Days

**Plan Reference**: `agent-output/planning/088-weekly-goal-rest-days-plan-2026-01-11.md`
**QA Status**: QA Failed
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2026-01-11 | User | QA verification for WeeklyGoal restDays feature | Ran tests/coverage, reviewed code paths and edge cases; found logic gaps vs intended rest-day behavior. |

## Timeline
- **Test Strategy Started**: 2026-01-11
- **Test Strategy Completed**: 2026-01-11
- **Implementation Received**: 2026-01-11 (user stated implemented)
- **Testing Started**: 2026-01-11
- **Testing Completed**: 2026-01-11
- **Final Status**: QA Failed

## Test Strategy (Pre-Implementation)

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- vitest (already present)

**Testing Libraries Needed**:
- none beyond existing

**Configuration Files Needed**:
- none beyond existing

### Required Unit Tests
- Rest-days normalization: undefined/empty/duplicates/out-of-range/non-numeric
- Rest-day impact on calculations: today target, remaining days, daily target
- Critical edge cases: all-7 rest days, today is rest day, fractional day indices

### Acceptance Criteria
- Existing data remains compatible when `restDays` is missing.
- `restDays` invalid values are normalized safely.
- When today is a rest day, UI indicates rest-day and today’s allocation is non-pressuring (policy-defined, expected 0 per plan).

## Implementation Review (Post-Implementation)

### Code Changes Summary (Observed)
- Added `WeeklyGoal.restDays?: number[]`
- Added/restored helpers in repository: `normalizeRestDays`, `getActiveDays`, `isRestDay`, `getTodayTarget`, `getRemainingDays`, `getDailyTargetForToday`
- UI: rest day selection in modal; rest day badge on card
- New tests: `tests/weekly-goal-rest-days.test.ts`

### Process Gate: TDD Compliance Evidence
- No dedicated implementation doc found for Plan 088 in `agent-output/implementation/`.
- TDD compliance table (required by QA mode rules) not available.

## Test Coverage Analysis

### New/Modified Code
| File | Function/Class | Test File | Coverage Status |
|------|---------------|-----------|-----------------|
| src/data/repositories/weeklyGoalRepository.ts | rest-days helpers | tests/weekly-goal-rest-days.test.ts | COVERED (unit tests pass) |
| src/features/goals/WeeklyGoalModal.tsx | rest-days UI | (manual) | NOT COVERED |
| src/features/goals/WeeklyGoalCard.tsx | rest-days UI | (manual) | NOT COVERED |

### Coverage Caveat
Vitest coverage config currently *does not include* `src/data/repositories/weeklyGoalRepository.ts`, so coverage percentages do not reflect this feature’s logic.

## Test Execution Results

### Unit Tests
- **Command**: `npm test`
- **Status**: PASS
- **Summary**: 49 test files passed, 569 tests passed

### Coverage
- **Command**: `npm run test:coverage`
- **Status**: PASS (artifacts updated)
- **Totals (json-summary)**: lines 95.88%, statements 95.88%, functions 97.72%, branches 86.40%

## Issues Found

1) **Rest day policy mismatch (today allocation)**
- Plan intent: when today is a rest day, today allocation should be 0 to reduce pressure.
- Current: `getDailyTargetForToday` does not short-circuit on rest day; it computes based on remaining active days.

2) **All-days-rest (`activeDays=0`) behavior produces pressure**
- `getTodayTarget` returns `target` and `getDailyTargetForToday` can return the full remaining amount when remaining active days is 0.
- Likely contradicts “쉬는 날 자동 완료/압박 감소” expectation.

3) **Normalization allows fractional indices**
- `normalizeRestDays` accepts finite numbers in [0..6] without enforcing integers.
- Fractional rest days can reduce `activeDays` but not be recognized by `includes(i)` checks, creating inconsistent calculations.

4) **Coverage configuration gap**
- Coverage include-list excludes the repository file containing rest-day logic; cannot assert feature coverage via coverage metrics.

## Recommendation
- **QA Result**: FAIL
- **Reason**: Core user-facing semantics (rest day allocation + all-days-rest) appear inconsistent with intended behavior; add/adjust tests to lock policy and update implementation accordingly.

Handing off to uat agent for value delivery validation (blocked until above issues resolved).

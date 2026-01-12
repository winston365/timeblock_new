---
ID: 089
Origin: 089
UUID: c9f2a8d1
Status: Active
Files-Refactored:
  - src/data/repositories/weeklyGoalRepository.ts
  - src/features/goals/WeeklyGoalModal.tsx
  - tests/weekly-goal-rest-days.test.ts
Complexity-Reduced:
  - Removed repeated normalization passes in restDays math
  - Removed unnecessary React memoization
---

# Weekly Goal Rest Days – Refactoring Report

## Summary
- Reduced duplicated `normalizeRestDays()` work by normalizing once per calculation path and using internal helpers.
- Simplified modal state derivation by removing unnecessary `useMemo` and avoiding multiple store subscriptions.
- Added/adjusted tests to cover dayIndex normalization edge cases.

## Techniques Applied
- Extract Method: introduced internal helpers for “already-normalized restDays” flows.
- Guard clauses retained to keep behavior identical (target <= 0, rest day, all-rest-days).
- Removed speculative memoization (`useMemo`) for a cheap derived value.

## Before/After (Representative)

### Repeated normalization (repository)

Before:
```ts
const normalized = normalizeRestDays(restDays);
const activeDays = getActiveDays(normalized); // getActiveDays normalized again
```

After:
```ts
const normalizedRestDays = normalizeRestDays(restDays);
const activeDays = getActiveDaysFromNormalizedRestDays(normalizedRestDays);
```

### Unnecessary memoization (modal)

Before:
```ts
const activeDays = useMemo(() => getActiveDays(restDays), [getActiveDays, restDays]);
```

After:
```ts
const activeDays = getActiveDays(restDays);
```

## Test Verification
- `npx vitest run tests/weekly-goal-rest-days.test.ts --reporter verbose` ✅

## Remaining Opportunities (Not changed)
- `WeeklyGoalCard` uses multiple store selectors; could be consolidated with a single selector + shallow compare if re-render profiling shows this is hot.
  - Not changed because restDays math is tiny (max 7 items) and current cost is negligible in typical UI usage.

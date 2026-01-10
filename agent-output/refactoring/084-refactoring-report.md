---
ID: 084
Origin: 084
UUID: b7d9f2a1
Status: Active
Files-Refactored:
  - src/shared/lib/eventBus/middleware/performance.ts
  - src/data/db/infra/syncEngine/queue.ts
Complexity-Reduced: "Small"
---

## Summary

- Removed comment-driven intent by making the code self-explanatory (guard clause, descriptive variable names).
- Eliminated a magic number in SyncEngine rapid-sync logging by introducing a named constant.
- Reduced duplicate computation (`now - lastSync`) by storing the gap in a local variable.

## Changes

### 1) Performance report: avoid empty/noise logs

- File: `src/shared/lib/eventBus/middleware/performance.ts`
- Kept behavior: if there are no stats, `printReport()` returns without logging.
- Refactor: removed inline explanatory comments; made the intent obvious via a direct guard clause and a clearer variable name.

Before:

```ts
// 이벤트가 없으면 로그 출력하지 않음 (콘솔 노이즈 방지)
if (this.stats.size === 0) {
  return;
}
// 평균 실행 시간으로 정렬
const sorted = ...
```

After:

```ts
if (this.stats.size === 0) return;
const entriesByAvgDurationDesc = ...
```

### 2) SyncEngine queue: simplify rapid-sync warning logic

- File: `src/data/db/infra/syncEngine/queue.ts`
- Kept behavior: only warns on rapid consecutive syncs for the same `operationKey`.
- Refactor:
  - Named the threshold (`rapidSyncWarningGapMs = 50`).
  - Avoided duplicate arithmetic by storing `gapMs`.
  - Used `lastSync !== undefined` for Map lookups.

Before:

```ts
const lastSync = lastSyncTimestamps.get(operationKey);
if (typeof lastSync === 'number' && now - lastSync < 50) {
  console.debug(`... ${now - lastSync}ms ...`);
}
```

After:

```ts
const lastSync = lastSyncTimestamps.get(operationKey);
if (lastSync !== undefined) {
  const gapMs = now - lastSync;
  if (gapMs < rapidSyncWarningGapMs) {
    console.debug(`... ${gapMs}ms ...`);
  }
}
```

## Techniques Applied

- Guard clauses
- Extract constant (magic number removal)
- Reduce duplicate expressions
- Improve naming to remove the need for comments

## Verification

- `npm test -- --run tests/performance-middleware-printReport-silent.test.ts tests/sync-engine-queue-rapid-sync-logging.test.ts`
- Result: PASS (2 files, 4 tests)

## Remaining Opportunities

- Optional: if rapid-sync threshold becomes configuration-driven, consider wiring it through options (kept out to avoid API changes).

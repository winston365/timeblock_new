---
ID: 080
Origin: 080
UUID: 9f2c3a1b
Status: Active
Files-Refactored:
  - src/shared/services/sync/firebase/rtdbListenerRegistry.ts
Complexity-Reduced: Extracted shared child-listener trio helper; removed repeated unsubscribe wiring across 3 attach functions.
---

# RTDB Bandwidth Fix – Listener Registry Refactoring (080)

## Summary
- Reduced duplication in child listener setup for date-keyed range subscriptions (and related child-based listeners).
- Preserved external behavior and public exports; refactor is internal wiring only.

## What Was Complex
- Three places repeated the same pattern:
  - `onChildAdded` + `onChildChanged` + `onChildRemoved`
  - build a composite `unsubscribe` that calls all three
- The repetition made it easy to introduce subtle mismatches (e.g., forgetting one unsubscribe or using inconsistent naming).

## Changes
### 1) Extracted helper: `attachChildListenerTrio`
- Added a small helper that wires the three child listeners and returns a single `RtdbUnsubscribe`.
- Hardened teardown: the composite unsubscribe now attempts all three unsubscribes even if one throws, then rethrows the first error so existing outer try/catch logging behavior remains intact.
- Used by:
  - `attachRtdbOnChild`
  - `attachRtdbOnChildKeyRange` (the date-keyed range listener used by SyncEngine)
  - `attachRtdbOnValueKeyRange` (deprecated, but still maintained)

### 2) TypeScript cleanup
- Removed an unnecessary `as Error` cast in the `onValue` cancel callback.

## Before/After (key snippet)
### Before
Repeated blocks like:
```ts
const unsubscribeAdded = onChildAdded(...)
const unsubscribeChanged = onChildChanged(...)
const unsubscribeRemoved = onChildRemoved(...)

entry.unsubscribe = () => {
  unsubscribeAdded();
  unsubscribeChanged();
  unsubscribeRemoved();
};
```

### After
Centralized into:
```ts
entry.unsubscribe = attachChildListenerTrio(queryRef, runConsumers, onError);
```

## Verification
- ✅ `npx vitest run tests/rtdb-listener-registry.test.ts --reporter verbose --no-color`
  - 1 test file, 9 tests passed
- ✅ `npm test`
  - 44 test files, 519 tests passed

## Remaining Opportunities (optional)
- `detachRtdbOnChild` / `detachRtdbOnChildKeyRange` / `detachRtdbOnValueKeyRange` share very similar teardown structure; could be abstracted later, but kept explicit to avoid over-generalization.

---
ID: 73
Origin: 73
UUID: c2ab37f1
Status: QA Failed
---

# QA Report: 073 Firebase RTDB Download Reduction

**Plan Reference**: `agent-output/planning/073-firebase-rtdb-download-reduction-plan-2026-01-07.md`
**QA Status**: QA Failed
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2026-01-07 | User | Verify implementer changes landed + correctness | Verified local diff scope, executed targeted sync tests (PASS), executed full `npm test` (FAIL: 2 unrelated template tests), reviewed RTDB listener/registry changes for root-listener elimination, defaults lookback, dedupe, and DEV gating. |
| 2026-01-07 | User | Final QA verification for complete RTDB bandwidth optimization | Re-verified required artifacts (30-day range listeners + startAt query, on-demand backfill single-shot get with inFlight dedupe, dailyData repository fallback flow, DEV bytes instrumentation). Re-ran full `npm test` (FAIL: same 2 template-system tests; RTDB-related tests PASS). |

## Timeline
- **Test Strategy Started**: 2026-01-07
- **Test Strategy Completed**: 2026-01-07
- **Implementation Received**: 2026-01-07 (local working tree changes; not committed)
- **Testing Started**: 2026-01-07
- **Testing Completed**: 2026-01-07
- **Final Status**: QA Failed (full suite failing)

## Test Strategy (Pre-Implementation)
User-facing risk focus: reduce RTDB download amplification without breaking sync correctness.

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- Existing `vitest` setup is sufficient.

**Configuration Files Needed**:
- None.

### Required Unit Tests
- Listener registry: dedupe/refCount across multiple consumers; stopAll safety; key-range dedupe per (path,startAtKey).
- Sync core: ensure RTDB instrumentation counters are gated; ensure pre-get caching avoids counting cache hits as bandwidth.

### Required Integration Tests
- SyncEngine listeners: ensure date-keyed collections use range-limited subscription and the lookback is sourced from defaults.

### Acceptance Criteria
- Date-keyed large collections do not attach unbounded root `onValue` listeners in SyncEngine.
- Lookback window is sourced from defaults (no ad-hoc hardcoding in listener logic).
- Registry dedupe prevents duplicate Firebase subscriptions.
- DEV-only instrumentation does not run expensive byte estimation or logging in PROD.

## Implementation Review (Post-Implementation)

### Code Changes Summary
Local (uncommitted) modifications detected in:
- `src/data/db/infra/syncEngine/listener.ts`: uses `attachRtdbOnValueKeyRange` for `dailyData`, `completedInbox`, `tokenUsage` with computed `startAtDateKey` based on `FIREBASE_SYNC_DEFAULTS.rtdbDateKeyedLookbackDays`.
- `src/shared/constants/defaults.ts`: introduces `FIREBASE_SYNC_DEFAULTS.rtdbDateKeyedLookbackDays`.
- `src/shared/services/sync/firebase/rtdbListenerRegistry.ts`: adds key-range listener support + dedupe/refCount + consumer exception isolation + stopAll.
- `src/shared/services/sync/firebase/syncCore.ts`: adds pre-get single-flight + 2s TTL cache; instruments reads only on actual network `get()`.
- `src/shared/services/sync/firebase/rtdbBackfill.ts`: introduces on-demand backfill manager using single-shot `fetchFromFirebase(get)` with inFlight dedupe per (userId, collection, key).
- `src/data/repositories/dailyData/coreOperations.ts`: integrates backfill on Dexie miss (Dexie miss → Firebase initialized check → backfillKeyOnce(date) → save to Dexie).
- `tests/rtdb-listener-registry.test.ts`: expands coverage for key-range + stopAll + consumer exception isolation.
- `tests/sync-core.test.ts`: adds coverage for cache vs network metrics, plus existing instrumentation branch tests.

Untracked new files:
- `tests/sync-engine-rtdb-range-listeners.test.ts`: asserts SyncEngine date-keyed listeners use key-range and the `startAt` key is derived from defaults.
- `tests/rtdb-backfill.test.ts`: asserts backfill performs single-shot fetch and dedupes concurrent calls.
- `src/shared/services/sync/firebase/rtdbBackfill.ts`: implementation file must be added to git or it will not ship.

### Sanity Checks (RTDB Listener Requirements)
- **No unbounded root `onValue` for large date-keyed collections (SyncEngine)**: PASS (uses key-range query via `orderByKey()` + `startAt(...)`).
- **Lookback sourced from defaults**: PASS (`FIREBASE_SYNC_DEFAULTS.rtdbDateKeyedLookbackDays`).
- **Registry dedupe works**: PASS (tests cover per-path dedupe and per-(path,startAtKey) dedupe).
- **DEV instrumentation gated**: PASS (`isRtdbInstrumentationEnabled()` uses `import.meta.env.DEV`; byte estimation only runs when enabled).
- **DEV instrumentation records estimated bytes downloaded**: PASS (`recordRtdbOnValue` / `recordRtdbGet` increments `readsEstimatedBytes` using JSON size estimation).

**Known residual risk / out-of-scope but important**:
- `src/shared/services/sync/firebaseService.ts` still contains `enableFirebaseSync()` with a root `onValue` on `users/${userId}/dailyData`. It currently has no call sites, but it violates the strict “no root listener” rule if reintroduced.

## Test Coverage Analysis

| Area | Code | Test | Status |
|------|------|------|--------|
| Registry path dedupe/refCount | `attachRtdbOnValue` | `tests/rtdb-listener-registry.test.ts` | COVERED |
| Registry key-range dedupe | `attachRtdbOnValueKeyRange` | `tests/rtdb-listener-registry.test.ts` | COVERED |
| StopAll + exception isolation | `stopAllRtdbListeners`, consumer fanout | `tests/rtdb-listener-registry.test.ts` | COVERED |
| SyncEngine uses key-range + defaults | `startRtdbListeners` | `tests/sync-engine-rtdb-range-listeners.test.ts` | COVERED |
| SyncCore cache avoids double-counting reads | `getRemoteOnce` | `tests/sync-core.test.ts` | COVERED |

## Test Execution Results

### Targeted Sync Tests
- **Command**: `npx vitest run tests/rtdb-listener-registry.test.ts tests/sync-core.test.ts tests/sync-engine-rtdb-range-listeners.test.ts tests/rtdb-backfill.test.ts --reporter verbose`
- **Status**: PASS
- **Notes**: Expected stderr logs occur in tests that verify exception isolation (consumer throws) and stopAll unsubscribe errors.

### Full Suite
- **Command**: `npm test`
- **Status**: FAIL
- **Failures**:
  - `tests/template-system.test.ts`:
    - `Auto-generate Once-per-Day Logic > should return true when auto-generate already ran today`
    - `Auto-generate Midnight Boundary > should block auto-generate on same local date (even if hours differ)`

**Run summary (latest)**: 40 test files, 512 tests total; 510 passed, 2 failed.

**Assessment**: These failures repro when running the file alone; likely unrelated to RTDB changes.

## Suggested Fixes / Next Actions
- Ensure new test file is added to git: `tests/sync-engine-rtdb-range-listeners.test.ts` is currently untracked.
- Decide policy for legacy root listener: remove/guard `enableFirebaseSync()` root `onValue` to prevent accidental reintroduction.
- Investigate `tests/template-system.test.ts` failures (date boundary / local-date comparison). Likely fix is to make the test clock/timezone deterministic around `getLocalDate()` usage.

---

Handing off to uat agent for value delivery validation

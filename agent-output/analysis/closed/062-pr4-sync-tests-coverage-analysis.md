---
ID: 62
Origin: 62
UUID: e7f4c8a2
Status: Planned
---

Changelog
- 2026-01-03: Initial sync-layer coverage scan for PR4 (성은하).
- 2026-01-03: Marked Planned; converted into PR4 implementation plan in agent-output/planning/ (성은하).

Value Statement and Business Objective
- Map current sync-layer test coverage to surface risk hotspots so PR4 can target high-value reliability cases (offline/online and conflict safety) without guessing.

Objective
- Inventory existing sync-focused tests, map them to modules in src/shared/services/sync, and highlight untested flows (especially Firebase strategies and offline→online transitions).

Context
- Dexie is the primary store; Firebase is used for sync/backup. Sync stack spans [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts), [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts), [src/shared/services/sync/firebase/conflictResolver.ts](src/shared/services/sync/firebase/conflictResolver.ts), [src/shared/services/sync/firebase/syncRetryQueue.ts](src/shared/services/sync/firebase/syncRetryQueue.ts), [src/shared/services/sync/firebase/rtdbListenerRegistry.ts](src/shared/services/sync/firebase/rtdbListenerRegistry.ts), [src/shared/services/sync/syncLogger.ts](src/shared/services/sync/syncLogger.ts), and the facade [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts).
- Current sync-related tests: [tests/sync-core.test.ts](tests/sync-core.test.ts), [tests/sync-retry-queue.test.ts](tests/sync-retry-queue.test.ts), [tests/sync-logger.test.ts](tests/sync-logger.test.ts), [tests/smoke-sync-engine-basic.test.ts](tests/smoke-sync-engine-basic.test.ts), [tests/conflict-resolver.test.ts](tests/conflict-resolver.test.ts), [tests/rtdb-listener-registry.test.ts](tests/rtdb-listener-registry.test.ts).

Root Cause
- Coverage clusters around isolated happy-path behaviors; integrated flows (Firebase strategies, facade fetch/load, instrumentation paths, and listener lifecycle) lack verification, leaving offline→online recovery and conflict determinism under-tested at system level.

Methodology
- Read sync module sources (syncCore, syncRetryQueue, syncLogger, conflictResolver, strategies, rtdbListenerRegistry, firebaseService, syncUtils, firebaseClient, firebaseDebug).
- Reviewed referenced tests to map scenarios and identify unexercised branches.

Findings (Fact vs Hypothesis)
- [Fact] syncCore coverage hits: init guard, duplicate hash skip, remote-newer skip, error→retry enqueue, listener filters own-device, fetch returns null on missing/error, offline enqueue (addToRetryQueue) and hash cache scope, listener re-attach basic fan-out. Missing in tests: getRemoteOnce TTL/cache behavior, instrumentation hooks (rtdbMetrics), custom serialize/getUserId/getSuccessMessage, resolveConflict fallback outputs, rtdbListenerRegistry integration, and unsubscribe error handling.
- [Fact] syncRetryQueue coverage: retryNow missing-id, maxRetries with error callback, success removal, exponential backoff scheduling, retryCount increment on duplicate add, drain sequential count, empty drain, size accounting, drain removes success. Untested: getRetryQueue accessor, DEFAULT_MAX_RETRIES override, scheduleRetry timing correctness boundaries, errorCallback reset/clear interactions, log content.
- [Fact] syncLogger coverage: buffering before init merges into persistent store, subscribe/unsubscribe snapshot, filter by type/action/since, clear resets. Untested: addSyncLog data/error truncation, MAX_LOGS cap behavior, failure paths in repository load/save, listener notification ordering, ensureInitialized error handling.
- [Fact] conflictResolver coverage: LWW tie favors local; GameState merge for XP fields, quests progress/complete, xpHistory date merge; Task array merge newer by updatedAt/createdAt and ordering; determinism assertions. Untested: timeBlockXPHistory merge window (5-day limit), completedTasksHistory truncation (50 cap), defensive handling of malformed arrays.
- [Fact] strategies.ts has zero direct tests; no validation that collection names, resolveConflict mapping, or serialize logic (settingsStrategy) hold.
- [Fact] smoke-sync-engine-basic only asserts initialize idempotency after DB init and applyRemoteUpdate drains pending operations; no coverage of listener wiring, retry queue drain on reconnect, or per-strategy invocation.
- [Fact] rtdbListenerRegistry coverage limited to dedupe/refCount happy path; missing error handling, stopAllRtdbListeners, instrumentation logging branches, consumer error isolation.
- [Fact] firebaseService facade (fetchDataFromFirebase, enableFirebaseSync) has no tests; offline/invalid data handling, syncData unwrap correctness, and deviceId filtering are unverified.
- [Hypothesis] Off→on recovery relies on syncCore error enqueue + external reconnect trigger to drainRetryQueue, but there is no test that reconnection actually calls drainRetryQueue; risk of stranded queue under real network flaps.

Analysis Recommendations (next steps to deepen inquiry)
- Trace syncCore read paths by simulating repeated get() within 2s to confirm getRemoteOnce TTL prevents double fetches and whether hash cache interacts with cache misses.
- Instrumentation branches: run targeted tests enabling isRtdbInstrumentationEnabled to observe recordRtdbGet/Set/Error and listener logs for onValue errors.
- Validate facade behaviors by sandbox tests around fetchDataFromFirebase with malformed SyncData shapes and enableFirebaseSync handling of same-device updates.
- Exercise strategy wiring by contract tests that pass representative domain payloads through syncToFirebase with each strategy (especially settingsStrategy serialize and gameStateStrategy merge).
- Simulate reconnect flow that calls drainRetryQueue after initializeFirebase/connection restore to confirm queue clearance and log expectations.

Open Questions
- Does any higher-level orchestrator currently trigger drainRetryQueue on connectivity restoration, or is that path unused in production flows?
- Are rtdbMetrics instrumentation flags toggled anywhere in runtime, and if so, what thresholds are expected for bytesEstimated to avoid log flood?
- Should time-based windows in mergeXPHistory/timeBlockXPHistory be aligned with any product requirement (7-day/5-day caps), and how would deviations surface during sync?

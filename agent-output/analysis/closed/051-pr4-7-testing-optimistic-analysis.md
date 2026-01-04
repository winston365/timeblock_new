Value Statement and Business Objective
- Strengthen test coverage for task orchestration and sync to prevent regressions before adding optimistic updates and visibility changes; ensure offline-first guarantees stay intact.

Status: Planned

Changelog
- 2025-12-28: Initial deep-dive for PR4–PR7 (unifiedTaskService tests, sync scenarios, visibility suite merge, optimistic update entry point).
- 2025-12-28: Planned PR4–PR7 detailed task list in agent-output/planning (implementer-ready breakdown).

Context
- Scope covers [src/shared/services/task/unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts), sync stack under [src/shared/services/sync](src/shared/services/sync), visibility tests [tests/time-block-visibility.test.ts](tests/time-block-visibility.test.ts) and [tests/timeblock-visibility.test.ts](tests/timeblock-visibility.test.ts), plus task update flow across stores and repositories.

Methodology
- Read service/store/repository implementations and current tests (unified-task-service, sync-core, sync-retry-queue, sync-logger, conflict-resolver, smoke-sync-engine-basic, rtdb-listener-registry, visibility suites).
- Mapped behaviors to identify untested branches (partial failures, edge dates, listener reuse, retry backoff, conflict resolution) and optimistic write paths.

Findings (facts)
- Unified task service: find→update/delete/toggle use repositories with store refresh; no optimistic writes; falls back across inbox → today dailyData → recent 7 days; errors wrapped with standard codes. Tests in [tests/unified-task-service.test.ts](tests/unified-task-service.test.ts) cover happy paths, skipRefresh flags, and error wrapping only for findTaskLocation.
- Sync core: [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts) guards on isFirebaseInitialized, hash dedupe, LWW resolver, retry enqueue on set failure, and listener ignores same device. Tests in [tests/sync-core.test.ts](tests/sync-core.test.ts) exercise init-off, hash dedupe, remote-newer skip, retry enqueue, listener same-device filter, fetch null/error.
- Retry queue: [src/shared/services/sync/firebase/syncRetryQueue.ts](src/shared/services/sync/firebase/syncRetryQueue.ts) keeps Map with exponential backoff; tests in [tests/sync-retry-queue.test.ts](tests/sync-retry-queue.test.ts) cover missing item, max retries, success removal, backoff scheduling, duplicate id increments.
- Conflict resolution: [src/shared/services/sync/firebase/conflictResolver.ts](src/shared/services/sync/firebase/conflictResolver.ts) LWW, mergeGameState deltas, mergeTaskArray by id/time; tests in [tests/conflict-resolver.test.ts](tests/conflict-resolver.test.ts) cover cumulative fields, quest merge, xpHistory merge, sorting, deviceId choice.
- Listener registry: [src/shared/services/sync/firebase/rtdbListenerRegistry.ts](src/shared/services/sync/firebase/rtdbListenerRegistry.ts) dedupes onValue and refCounts; test verifies dedupe/refcount only.
- Sync engine smoke: [tests/smoke-sync-engine-basic.test.ts](tests/smoke-sync-engine-basic.test.ts) only checks idempotent initialize and queue drain via applyRemoteUpdate; no offline/reconnect scenarios.
- Visibility: hyphenated file covers current-only and hide-future sanity only; non-hyphen file covers full matrix (block boundaries, isBlockPast/Future/Current, shouldShowBlock modes, visibleBlocks for all/hide-past/current-only) and more edge cases (out-of-range hours, current-only empty when off-range).
- Stores: [src/shared/stores/inboxStore.ts](src/shared/stores/inboxStore.ts) uses optimistic removal when moving inbox→block (delegates to dailyDataStore), otherwise reloads after repo writes. [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts) implements optimistic add/update/delete/toggle with rollback and background revalidate; integrates eventBus, behavior tracking, emoji suggestion. unifiedTaskService bypasses store optimism and triggers refresh after repo writes.
- Repositories write directly to Dexie and sync via Firebase strategies; no transactional rollback across inbox/daily boundaries.

Gaps / Current Problems by PR
- PR4 unifiedTaskService: missing tests for (a) recent-date fallback search in findTaskLocation (non-today, dateHint), (b) not_found branches returning null/false, (c) repository error wrapping for update/delete/toggle (only find covered), (d) daily vs inbox precedence when both contain id, (e) getAnyTask/getAllActive/getUncompleted aggregation integrity, (f) behavior when loadDailyData returns malformed data or empty tasks array.
- PR5 sync scenarios: no tests for offline mode with queued retries draining on reconnect, listener reattach after disconnect, stopAllRtdbListeners safety, retryQueue persistence/aging, multi-collection conflict resolution with strategies (globalInbox/completedInbox/dailyData), hash cache eviction or TTL, fetchDataFromFirebase fallback paths, or combined syncEngine flows with Firebase service facade. Collision tests limited to pure mergeTaskArray/mergeGameState; no scenario-level determinism/idempotency assertions.
- PR6 visibility integration: suites duplicate current-only behavior; unique coverage split—hide-future only in hyphen file; hide-past/all/shouldShowBlock predicates only in non-hyphen file. No tests for malformed hours (non-integer/NaN), empty TIME_BLOCKS guard, or parameter validation. Import paths differ (alias vs relative), increasing maintenance drag.
- PR7 optimistic update entry: unifiedTaskService currently non-optimistic and forces store refresh after Dexie writes; optimistic logic already lives in dailyDataStore/inboxStore. Optimism at service level could double-apply with store optimism, or conflict with background revalidate/loadData. No invariant tests ensuring Dexie+store consistency when inbox↔block moves or when repository throws after optimistic set.

Recommendations / Implementation Cautions
- PR4: add contract tests around findTaskLocation recent-date loop, precedence when inbox/daily both have the id, and ensure TASK_* error codes propagate for update/delete/toggle failures. Add aggregation tests for getAllActive/getUncompleted to guard data integrity across repositories. Mock malformed dailyData to ensure null-safe path.
- PR5: add scenario tests covering offline → retryQueue enqueue → reconnect drain (verify backoff, max retries, errorCallback signals); listener lifecycle (stopAllRtdbListeners + reattach) with dedupe; conflict resolution end-to-end using strategies for inbox/dailyData (remote newer vs local newer); hash dedupe cache TTL behavior; fetchDataFromFirebase error/missing data fallbacks; syncEngine applyRemoteUpdate ordering/idempotency under concurrent updates.
- PR6: merge into single suite using alias imports; keep all unique cases and add table-driven cases for hide-future/hide-past/current-only across boundary hours. Add negative inputs (non-integer hour, NaN) and guard for empty TIME_BLOCKS to avoid silent failures. Remove duplicated tests once merged.
- PR7: favor optimistic updates at store layer (dailyDataStore/inboxStore) where rollback utilities exist; if exposing optimistic helpers in unifiedTaskService, ensure it delegates to store methods instead of duplicating Dexie writes to avoid double state mutation. Respect existing skipStoreRefresh semantics and background revalidate to keep Dexie/store parity. Consider invariant tests that compare Dexie state after optimism + failure rollback, especially for inbox↔block moves.

Open Questions / Risks
- Should unifiedTaskService remain a thin repository facade with store refresh, or should it route to stores for optimism and event emission? Decision affects duplication and rollback coverage.
- Is there a TTL/cleanup for lastSyncHash and remoteCache in syncCore to prevent stale skip on long-lived sessions? Tests absent.
- How should conflict resolution handle partial failures across multiple collections in a single logical sync cycle (e.g., inbox success, dailyData fail)? No orchestration tests.
- Visibility modes: should invalid hours throw or clamp? Current utilities silently return null/empty; adding tests may force decision.

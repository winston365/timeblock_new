---
ID: 083
Origin: 083
UUID: a1c4e6f9
Status: Active
---

## Changelog
| Date (UTC) | Author | Change |
| --- | --- | --- |
| 2026-01-10 | Analyst | Initial analysis draft |

## Value Statement and Business Objective
- Surface the true impact of the reported log spam (sync, Firebase keys, calendar auth, CSP, task lookup) so we can prevent silent data loss and prioritize stabilization work across sync and calendar integrations.

## Objective
- Map each log line to its code path, judge likely severity/impact, and enumerate unknowns to de-risk fixes.

## Context
- Logs: repeated `📊 [Performance] No events recorded yet.`, `⚠️ SyncEngine: Rapid sync detected for dailyData:2026-01-10 (14ms gap)`, `[FirebaseSanitizer] Invalid key detected: "timeBlockStates.morning"`, CSP frame block for `https://s-gke-usc1-nssi3-9.firebaseio.com/`, `[GoogleCalendar] Token refresh failed: Token has been expired or revoked.`, `[UnifiedTaskService] Task not found: task-e3689f49-5470-4839-8708-443bb6d7d466`.

## Root Cause (current best evidence)
- Performance log spam is emitted by the auto-report timer when no events were recorded yet in dev mode.
- Rapid sync warning fires when multiple remote updates for the same operationKey arrive within 100ms; dailyData key was hit by a burst.
- Firebase sanitizer warning indicates outgoing payload still contains flattened dotted keys (e.g., timeBlockStates.*) before being nested.
- CSP block stems from default-src/frame-src excluding firebaseio.com while RTDB creates a hidden iframe during fallback.
- Calendar refresh failure aligns with expired/revoked refresh tokens or missing Electron refresh bridge; no auto-recover beyond one retry.
- Task-not-found arises when the service cannot locate the task in inbox or daily data (today + last 7 days) before acting.

## Methodology
- Reviewed middleware and sync code: [src/shared/lib/eventBus/middleware/performance.ts](src/shared/lib/eventBus/middleware/performance.ts#L60-L105), [src/app/hooks/useEventBusInit.ts](src/app/hooks/useEventBusInit.ts#L15-L32), [src/data/db/infra/syncEngine/queue.ts](src/data/db/infra/syncEngine/queue.ts#L17-L71), [src/shared/utils/firebaseSanitizer.ts](src/shared/utils/firebaseSanitizer.ts#L94-L139), [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts#L31-L187), [src/shared/services/calendar/googleCalendarService.ts](src/shared/services/calendar/googleCalendarService.ts#L140-L210), [src/shared/services/task/unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts#L58-L207) + [L402-L450](src/shared/services/task/unifiedTaskService.ts#L402-L450), [index.html](index.html#L8-L13), [src/data/repositories/dailyData/types.ts](src/data/repositories/dailyData/types.ts#L27-L76).
- Grep for log strings to confirm exact emitters and line numbers.
- Retrieved prior memory noting earlier sync TTL and sanitizer coverage gaps.

## Findings
### Facts
- Performance middleware auto-reports every 60s when enabled in dev; if no events exist, it logs `No events recorded yet` repeatedly ([performance.ts](src/shared/lib/eventBus/middleware/performance.ts#L86), [useEventBusInit.ts](src/app/hooks/useEventBusInit.ts#L15-L32)).
- Sync queue warns when two operations with the same operationKey arrive <100ms apart; this sets `isSyncingFromRemote` and records lastSyncTimestamps ([queue.ts](src/data/db/infra/syncEngine/queue.ts#L17-L71)). Observed key `dailyData:2026-01-10` implies clustered RTDB updates.
- Firebase sanitizer warns and nests dotted keys like `timeBlockStates.morning` before upload ([firebaseSanitizer.ts](src/shared/utils/firebaseSanitizer.ts#L108-L135)). Flattened keys are already handled on read via normalization helpers, suggesting a local payload carried the flattened shape during write.
- CSP meta lacks frame-src allowances, so RTDB fallback iframe to firebaseio.com violates CSP ([index.html](index.html#L8-L13)).
- Google Calendar refresh logs failure when Electron refresh bridge returns success=false; it then aborts with no further recovery ([googleCalendarService.ts](src/shared/services/calendar/googleCalendarService.ts#L140-L210)).
- UnifiedTaskService logs `Task not found` when lookup fails across inbox and daily data (today + recent 7 days) before acting ([unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts#L128-L182)).

### Hypotheses (evidence-backed, unproven)
1) RTDB startup/reconnect emits multiple snapshots per date (e.g., initial child_added plus subsequent merge) causing <100ms gaps for the same operationKey, triggering rapid-sync warnings; needs event trace to confirm burst pattern.
2) Legacy or partial updates wrote flattened `timeBlockStates.*` keys into Dexie; when syncing, sanitizeForFirebase warns while nesting them, implying inconsistent local schema and possible partial overwrites; verify Dexie rows for flattened keys.
3) Calendar refresh failure is due to an expired/revoked refresh token (log text matches Google response) or running outside Electron where `googleOAuthRefresh` is undefined; results in disabled calendar sync until re-login.

## Analysis Recommendations (next steps to deepen inquiry)
- Capture RTDB listener event timeline for a single date key (child events + operationKey) to see why 14ms gaps occur and whether they are benign duplicates or true races.
- Inspect Dexie dailyData rows for any keys matching `timeBlockStates.*`; confirm normalizeTimeBlockStates is applied before writes and whether sanitizer nesting changes payload shape.
- Reproduce calendar refresh in Electron with valid credentials and record error payload when refresh fails to separate env vs token issues.
- Evaluate CSP impact by allowing frame-src to firebaseio.com in a controlled run and observing RTDB connection mode (websocket vs iframe fallback).
- Count actual event bus traffic in dev to decide whether to disable or defer performance auto-report when idle.

## Open Questions
- Are multiple windows or reconnect loops issuing duplicate RTDB events for the same dailyData key?
- Which user flow referenced task-e3689f49-5470-4839-8708-443bb6d7d466, and was it recently deleted/migrated?
- Does the CSP block force RTDB into degraded polling mode or fully block initial handshake in this environment?

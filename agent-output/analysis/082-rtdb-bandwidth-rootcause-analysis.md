---
ID: 82
Origin: 82
UUID: b5f1c3a4
Status: Active
---

## Changelog
- 2026-01-10: Full code inspection of Firebase RTDB listeners, registry, and Firebase-using repositories; corrected prior assumption about startup bulk fetch; enumerated listener scope and potential bandwidth amplifiers.

## Value Statement and Business Objective
Identify why RTDB downloads exceed 100MB/hour despite ~3.4MB stored data, by mapping all listeners, their scopes, and data flows so subsequent work can target the actual bandwidth drivers with evidence.

## Context
- App: local-first Electron with RTDB sync via `SyncEngine` and listener registry.
- Startup now skips bulk fetch: `runStartupFirebaseInitialRead` returns `null` after init; `fetchDataFromFirebase` facade is unused.
- Prior mitigations: listener registry with refCount, retry queue, hash cache, Firebase gating helpers.

## Methodology
- Read listener registry and SyncEngine (`src/shared/services/sync/firebase/*`, `src/data/db/infra/syncEngine/*`).
- Scanned Firebase-dependent repositories under `src/data/repositories/*` for sync patterns and collection vs item scope.
- Searched for polling/timers and extra RTDB clients.

## Findings (observed code paths)
1) **Wide listener surface with partial device filtering**
- `startRtdbListeners` attaches eight RTDB listeners for a single user: dailyData (child+range), completedInbox (child+range), tokenUsage (child+range), gameState (onValue full), settings (onValue full), templates (child on `/templates/data`), shopItems (child on `/shopItems/data` and `/shopItems/all/data`), globalInbox (child on `/globalInbox/data` and `/globalInbox/all/data`).
- DeviceId skip is applied only to dailyData/completedInbox/tokenUsage/gameState/settings; **templates/shopItems/globalInbox lack device filtering**, so every local write triggers a downstream onChild read of the entire item payload even on the same device.
- Legacy-shape listeners (`/all/data`) run alongside current ones, so if both trees exist they duplicate event traffic.

2) **Collection-level writes amplify readback**
- SyncEngine hooks sync full collections on Dexie change (dailyData per date, gameState root, templates array, shopItems array, globalInbox array, completedInbox grouped, tokenUsage per date, settings root). Many repositories still call `syncToFirebase` with full arrays (e.g., tempSchedule `all`, weeklyGoal reorder, globalInbox/completedInbox sync, battle missions/settings, chat history). Each write is followed by the listener echo download (see #1), doubling traffic per update.

3) **Range listeners replay 30-day windows on reconnect**
- Date-keyed listeners use `startAt` with a 30-day lookback (from `FIREBASE_SYNC_DEFAULTS`) set once at startup. Any reconnect or re-attach replays the entire 30-day window for dailyData/completedInbox/tokenUsage, which can be large if the user has heavy history.

4) **Leader lock is best-effort only**
- `acquireFirebaseSyncLeaderLock` falls back to `isLeader: true` when `navigator.locks` is unavailable; in such environments multiple windows can attach the full listener set, multiplying traffic. No runtime detection/telemetry of lock availability.

5) **No polling loops, but retry timers exist**
- No setInterval polling in sync paths; only retry-queue setTimeout backoff and the leader-lock 50ms timeout. Bandwidth spikes are likely from listener payload size/duplication, not timer polling.

6) **CompletedInbox merge rewrites local table per event**
- Each completedInbox child event rebuilds the union map and clears/re-bulkPuts Dexie. While this is local I/O, it magnifies the cost of each remote child payload because the listener runs on every date event and applies the full merged set.

## Listener Inventory
| Path | Attach type | File | Notes |
| --- | --- | --- | --- |
| users/{uid}/dailyData (startAt 30d) | onChildAdded/Changed/Removed | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) | DeviceId skip; downloads each date payload; 30-day window replays on reconnect |
| users/{uid}/gameState | onValue | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) | Full snapshot per change; deviceId skip |
| users/{uid}/templates/data | onChild* | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) | No deviceId filter; self-echo on local writes |
| users/{uid}/shopItems/data | onChild* | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) | No deviceId filter; full item payload each change |
| users/{uid}/shopItems/all/data | onChild* | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) | Legacy shape; duplicates if both trees exist |
| users/{uid}/globalInbox/data | onChild* | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) | No deviceId filter; array stored as child list => multiple child events per write |
| users/{uid}/globalInbox/all/data | onChild* | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) | Legacy shape; potential duplication |
| users/{uid}/completedInbox (startAt 30d) | onChildKeyRange | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) | DeviceId skip; merges all dates on each event |
| users/{uid}/tokenUsage (startAt 30d) | onChildKeyRange | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) | DeviceId skip; 30-day window replay |
| users/{uid}/settings | onValue | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) | Full snapshot per change; deviceId skip |

## Data Flow (text)
RTDB (onValue/onChild) → `rtdbListenerRegistry` (dedupe, setObservedRemote) → SyncEngine listener callbacks → `applyRemoteUpdate` queue (sets `isSyncingFromRemote`) → Dexie writes → Dexie hooks (skip if `isSyncingFromRemote` false) → `syncToFirebase` uploads full collection/key → RTDB triggers listener echoes.

## Open Questions / Gaps
- Actual bytes per path are unknown; need runtime metrics to confirm which listeners dominate bandwidth.
- Does `navigator.locks` work in the deployed Electron runtime? If not, multiple windows may double listeners.
- Dataset sizes for 30-day dailyData/completedInbox/tokenUsage windows and for collection-wide datasets (globalInbox, templates, tempSchedule, chatHistory) are not measured.
- Frequency of background Dexie writes (e.g., day resets, auto-generation) during “idle” sessions is unclear; these may trigger upload+echo cycles without user action.

## Analysis Recommendations (non-solution)
- Instrument `recordRtdbOnValue/recordRtdbGet/recordRtdbSet` telemetry per path in production-like sessions to capture MB/hour by listener.
- Capture a 60-minute idle trace with logging of listener attach/reconnect events and lock acquisition outcomes to see if reconnections are replaying 30-day windows.
- Log Dexie-to-Firebase sync calls by collection to correlate upload bursts with download spikes and confirm whether local background tasks are firing during idle.
- Validate whether both legacy (`/all`) and current trees hold data in production; if yes, quantify duplicate event volume.

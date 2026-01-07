---
ID: 75
Origin: 75
UUID: 0f6c9ab2
Status: Active
---

## Changelog
- 2026-01-07: Initial RTDB bandwidth scan via code inspection (no runtime capture yet).

## Value Statement and Business Objective
Reduce RTDB bandwidth waste (136MB/hour) by identifying where our client still pulls large, unconstrained datasets so subsequent planning can target the real hotspots.

## Context
- Existing mitigation: date-keyed listeners use startAt lookback (30 days) plus listener dedup registry; on-demand backfill lives elsewhere.
- Concern: non-date collections and startup flows may still fetch full subtrees, amplifying download volume.

## Methodology
- Searched for all firebase/database usages, onValue/onChildAdded/ref patterns, SyncEngine init triggers, and polling hooks.
- Reviewed startup path (useAppInitialization) and SyncEngine listener wiring.
- Classified findings using Analysis Methodology confidence levels.

## Findings
- **Observed (Level 2)**: Startup loads *entire* Firebase subtree once via fetchDataFromFirebase, covering dailyData, gameState, globalInbox, completedInbox, shopItems, waifuState, templates, tokenUsage, settings without any range/filter. Immediately afterward, SyncEngine.startListening attaches RTDB listeners, triggering a second full snapshot delivery from Firebase (initial onValue). Evidence: [src/shared/services/sync/firebaseService.ts#L46-L148](src/shared/services/sync/firebaseService.ts#L46-L148) and [src/data/db/infra/useAppInitialization.ts#L74-L275](src/data/db/infra/useAppInitialization.ts#L74-L275).
- **Observed (Level 2)**: Non-date collections listen to full subtrees with no query constraints. GameState, templates, shopItems, globalInbox, settings each use attachRtdbOnValue (plain ref) so any change downloads the entire collection payload. Evidence: [src/data/db/infra/syncEngine/listener.ts#L67-L214](src/data/db/infra/syncEngine/listener.ts#L67-L214).
- **Observed (Level 2)**: Date-keyed listeners are range-limited but still use full snapshot payloads within range. DailyData, completedInbox, and tokenUsage use orderByKey + startAt(startAtDateKey), meaning ~30 days of history are always re-downloaded on each remote change. Evidence: [src/data/db/infra/syncEngine/listener.ts#L45-L207](src/data/db/infra/syncEngine/listener.ts#L45-L207).
- **Observed (Level 2)**: Listener registry attachRtdbOnValue is an unconstrained onValue over ref(path); dedup covers multiplicity but not scope, so consumers pulling large roots (globalInbox/templates/settings) still receive full payloads each event. Evidence: [src/shared/services/sync/firebase/rtdbListenerRegistry.ts#L65-L154](src/shared/services/sync/firebase/rtdbListenerRegistry.ts#L65-L154).
- **Observed (Level 2)**: syncToFirebase issues a get() before every write (2s TTL single-flight) to detect conflicts, causing an extra read per path per burst; for large collections (globalInbox/templates) this doubles traffic on write-heavy flows. Evidence: [src/shared/services/sync/firebase/syncCore.ts#L70-L210](src/shared/services/sync/firebase/syncCore.ts#L70-L210).
- **Observed (Level 2)**: Legacy enableFirebaseSync still defines two unbounded onValue listeners on full dailyData and gameState roots (no range, no per-date key). Currently not referenced elsewhere, but any lingering call site would bypass range limits. Evidence: [src/shared/services/sync/firebaseService.ts#L178-L213](src/shared/services/sync/firebaseService.ts#L178-L213).
- **Observed (Level 2)**: Direct Firebase calls outside the sync layer remain: dayOperations reads/writes `users/user/system/lastTemplateGeneration` via get/set, and firebaseDebug reads full dailyData/gameState for console debugging. These are smaller scope but bypass the listener registry. Evidence: [src/data/repositories/gameState/dayOperations.ts#L160-L232](src/data/repositories/gameState/dayOperations.ts#L160-L232), [src/shared/services/sync/firebase/firebaseDebug.ts#L24-L76](src/shared/services/sync/firebase/firebaseDebug.ts#L24-L76).
- **Observed (Level 2)**: No setInterval polling or auth-state listeners in the sync layer; setInterval usages are UI-only, so bandwidth spikes are unlikely from polling loops.
- **Observed (Level 2)**: SyncEngine.init/startListening guarded by flags and only invoked via useAppInitialization in AppShell, so duplicate init from rerenders is unlikely. Evidence: [src/app/AppShell.tsx#L12-L80](src/app/AppShell.tsx#L12-L80), [src/data/db/infra/useAppInitialization.ts#L46-L275](src/data/db/infra/useAppInitialization.ts#L46-L275).

## Remaining Gaps
| # | Unknown | Blocker | Required Action | Owner |
|---|---------|---------|-----------------|-------|
| 1 | Per-collection payload sizes (dailyData within 30-day window, globalInbox, templates, settings, completedInbox) | No telemetry on bytes per onValue/get | Capture RTDB bytes by path (instrument recordRtdbOnValue/recordRtdbGet) or export sizes from Firebase console | TBD |
| 2 | Share of bandwidth from startup double-download vs ongoing listener events | No network trace yet | Profile startup network (initial Promise.all get vs initial onValue) for a typical user dataset | TBD |
| 3 | Whether any runtime path still calls enableFirebaseSync or syncCore.listenToFirebase | Static search only | Add runtime instrumentation or grep deployed bundles to confirm zero usage | TBD |
| 4 | Impact of pre-write getRemoteOnce on high-frequency writers (e.g., globalInbox churn) | No request counters per operation key | Log getRemoteOnce hits per collection during active use to quantify read amplification | TBD |

## Analysis Recommendations (next steps to deepen inquiry)
- Instrument RTDB metrics to log estimated bytes per path for both get() and onValue initial/update events over a 30–60 minute session; prioritize dailyData, globalInbox, templates, settings, completedInbox, tokenUsage.
- Capture a startup network trace to separate initial Promise.all fetch cost from the first onValue snapshot cost; compare totals to the 136MB/hour observation.
- Add temporary telemetry to count getRemoteOnce invocations per collection to see how often conflict-precheck doubles reads during write bursts.
- Verify at runtime that enableFirebaseSync and listenToFirebase are never invoked (e.g., add dev-only console.warn if called) to rule out legacy full-root listeners.

## Open Questions
- How large are typical datasets for globalInbox/templates/settings/completedInbox in production (task counts, kb/MB)?
- Are users restarting the app frequently (making the startup double-download a major contributor), or is the bandwidth spike during steady state?
- Do we expect high-frequency writes to globalInbox/templates that would trigger frequent pre-write getRemoteOnce calls?
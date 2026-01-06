---
ID: 73
Origin: 73
UUID: c2ab37f1
Status: Planned
---

# Changelog
- 2026-01-07: Created initial RTDB bandwidth diagnostic.
- 2026-01-07: Marked Planned; implementation plan created in agent-output/planning.

# Value Statement and Business Objective
Reduce Firebase RTDB download waste so the desktop app remains cost-effective and resilient for local-first sync users.

# Objective
Identify concrete code paths that over-read RTDB (listeners/queries) and explain how they inflate download volume in normal use.

# Context
- Focus on Electron renderer sync stack (RTDB). Backend changes out of scope.
- Current sync is local-first (Dexie) with RTDB fan-out via SyncEngine and legacy firebaseService facade.

# Methodology
- Static review of RTDB entry points: sync engine listeners, initialization flow, facade fetch/sync helpers.
- Searched for onValue/ref/get usage and fan-out paths.
- Mapped where listeners attach, what subtree they cover, and when they (re)initialize.

# Findings (facts)
- SyncEngine attaches onValue at collection roots with no query constraints; every change re-delivers the full subtree:
  - dailyData root at [src/data/db/infra/syncEngine/listener.ts#L38-L87](src/data/db/infra/syncEngine/listener.ts#L38-L87) fan-outs per date but each onValue sends the entire dailyData map.
  - Other collection roots follow the same pattern: gameState [#L60-L90](src/data/db/infra/syncEngine/listener.ts#L60-L90), templates [#L92-L108](src/data/db/infra/syncEngine/listener.ts#L92-L108), shopItems [#L109-L124](src/data/db/infra/syncEngine/listener.ts#L109-L124), globalInbox array [#L126-L148](src/data/db/infra/syncEngine/listener.ts#L126-L148), completedInbox date map [#L150-L178](src/data/db/infra/syncEngine/listener.ts#L150-L178), tokenUsage date map [#L180-L202](src/data/db/infra/syncEngine/listener.ts#L180-L202), settings singleton [#L204-L236](src/data/db/infra/syncEngine/listener.ts#L204-L236). Each update (even local) triggers full-branch download from RTDB.
- App startup always pulls whole collections before listeners even fire: fetchDataFromFirebase requests nine top-level nodes in one Promise.all (dailyData, gameState, globalInbox, completedInbox, shopItems, waifuState, templates, tokenUsage, settings) at [src/shared/services/sync/firebaseService.ts#L46-L143](src/shared/services/sync/firebaseService.ts#L46-L143). Large dailyData/completedInbox growth directly scales download size on every app launch.
- Startup also attaches the root listeners once firebase config exists; useAppInitialization calls fetchDataFromFirebase then syncEngine.startListening on every boot at [src/data/db/infra/useAppInitialization.ts#L88-L270](src/data/db/infra/useAppInitialization.ts#L88-L270). RTDB’s initial onValue fires immediately with full snapshots for each attached root, doubling startup downloads.
- Legacy enableFirebaseSync (unused elsewhere) still listens to the entire dailyData subtree and gameState without filters at [src/shared/services/sync/firebaseService.ts#L178-L214](src/shared/services/sync/firebaseService.ts#L178-L214). If invoked, it would duplicate broad listeners outside SyncEngine.
- syncToFirebase performs a remote get before each set (single-flight + 2s TTL) to resolve conflicts [src/shared/services/sync/firebase/syncCore.ts#L82-L156](src/shared/services/sync/firebase/syncCore.ts#L82-L156). For collection-wide writes (globalInbox/templates/completedInbox), each write downloads the full server value; the subsequent onValue echo then re-downloads the same subtree, amplifying reads per local change.

# Root Cause
RTDB listeners and fetches operate at collection roots with no query/child scoping, so any change (including local writes) causes full-branch snapshots (dailyData, completedInbox, globalInbox, etc.) to be repeatedly downloaded. Startup compounds this by fetching all collections and then receiving immediate onValue snapshots for each root listener, making total downloaded bytes scale with historical data size rather than delta changes.

# Analysis Recommendations
- Measure bytes per onValue event per collection in DEV (rtdbMetrics) while performing a single small change to confirm the amplification factor from root listeners.
- Reproduce startup in a profile session to separate initial fetch cost vs. immediate onValue snapshots; log which collections dominate bytes.
- Trace a local write on globalInbox/templates/completedInbox to quantify the get→set→onValue triple-hit currently incurred per update.

# Open Questions
- Are multiple renderer windows ever active (leader lock skipped), potentially adding parallel root listeners?
- How large are real-world dailyData/completedInbox datasets (date count, tasks per date)? This size dictates download blow-up magnitude.
- Is the legacy enableFirebaseSync used in any flows/tests that would double-listen outside SyncEngine?

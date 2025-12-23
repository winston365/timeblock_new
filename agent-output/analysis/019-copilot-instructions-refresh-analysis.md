Value Statement and Business Objective
- Updating .github/copilot-instructions.md will reduce agent ramp-up time and prevent regressions around storage, defaults, and sync. Clear, current guidance keeps contributions aligned with the local-first repository pattern and Firebase sync architecture.

Status
- Active (analysis draft)

Changelog
- 2025-12-23: Initial analysis of instruction sources and architecture docs.

Objective
- Extract project-specific conventions, data flow patterns, and integration points from existing instruction sources and code docs to propose an updated Copilot guidance set.

Context and Inputs
- Scanned: .github/copilot-instructions.md, CLAUDE.md, README.md, src/shared/lib/eventBus/README.md, src/shared/services/{task,r ag, gameplay/taskCompletion, sync/firebase, ai/gemini}/README.md, src/data/{db, repositories/dailyData}/README.md, public/assets/waifu/README.md, public/assets/waifu/poses/README.md, agent-output/qa/README.md.

Methodology
- Single glob search for instruction-related files; parallel reads of all matches; synthesized recurring patterns and rules.

Findings (facts)
- Architecture: Electron + React client, feature-first folders; entry src/main.tsx → AppShell; Zustand stores → repository layer → Dexie → Firebase async sync.
- Storage policy: .github/copilot-instructions.md and CLAUDE.md forbid localStorage except theme; dailyData README still documents localStorage as secondary fallback (conflict).
- Defaults: Centralized defaults in src/shared/constants/defaults.ts; avoid hardcoded fallbacks.
- Persistence: All CRUD must go through repositories; Dexie schema documented to v11 in db README, but Copilot guide claims v12 (conflict). Migrations must be idempotent and version-bumped.
- Task placement: Scheduled tasks in dailyData.tasks; unscheduled in globalInbox; unifiedTaskService for location-agnostic ops.
- EventBus: Type-safe pub/sub; emit from stores only; subscribers in src/shared/subscribers; naming [domain]:[action]; avoid UI emits.
- Sync: Firebase sync uses strategy + syncToFirebase/listenToFirebase in syncCore; conflictResolver handles LWW; retry queue in sync module.
- Gameplay pipeline: Task completion runs handlers (GoalProgress, XPReward, QuestProgress, WaifuAffection, BlockCompletion) in order.
- AI/RAG: Gemini module with persona prompts and taskFeatures; Hybrid RAG routes structured queries to direct Dexie queries and semantic to vector store.
- Assets: Waifu assets live under public/assets/waifu with tiered poses folders.

Recommendations
- Update Copilot instructions with the essential rules above; explicitly resolve storage policy (remove localStorage fallback mentions) and Dexie version inconsistency once confirmed.
- Add note that an automated Vitest suite now exists (contradicts “no tests” note in CLAUDE.md/README.md).

Open Questions
- What is the authoritative Dexie schema version (v11 vs v12)?
- Should localStorage fallback documented in dailyData README be removed in favor of Dexie-only policy?
- Confirm test expectations: should Copilot instructions mention Vitest? 

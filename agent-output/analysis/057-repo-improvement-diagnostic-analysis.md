---
ID: 57
Origin: 57
UUID: 8f4c1a9b
Status: Active
---

## Value Statement and Business Objective
Equip the team with an evidence-backed, prioritized improvement map that reduces duplication, clarifies layering, and mitigates ADHD-related UX risk so future work lands faster with fewer regressions.

## Objective
First-pass diagnostic of repo hotspots (duplication, UX risk, inefficiency, layering drift, maintenance debt) using current structure and test surface. Flag facts vs hypotheses and propose where to dig next.

## Context
- No source files opened; evidence is directory/test surface only. Claims marked Hypothesis need code confirmation.
- Architecture guardrails: Dexie-first, repos mandatory, no Firebase from UI, modal ESC/backdrop rules, ADHD-friendly UX expectations.

## Methodology
- Inspected top-level analysis backlog in [agent-output/analysis](agent-output/analysis) and counter [.next-id](agent-output/.next-id).
- Scanned test surface in [tests](tests) and feature/data/service layouts in [src/features](src/features), [src/data/repositories](src/data/repositories), [src/shared/services](src/shared/services), [src/shared/stores](src/shared/stores), [src/shared/subscribers](src/shared/subscribers).

## Findings (Top 10, priority-ordered)
1) Sync test sprawl and likely overlap (Fact)
- Impact: Longer CI, brittle maintenance, unclear coverage.
- Evidence: Multiple suites targeting sync stack: [tests/sync-core.test.ts](tests/sync-core.test.ts), [tests/sync-retry-queue.test.ts](tests/sync-retry-queue.test.ts), [tests/sync-logger.test.ts](tests/sync-logger.test.ts), [tests/rtdb-listener-registry.test.ts](tests/rtdb-listener-registry.test.ts), [tests/smoke-sync-engine-basic.test.ts](tests/smoke-sync-engine-basic.test.ts), [tests/smoke-rag-sync-handler.test.ts](tests/smoke-rag-sync-handler.test.ts).
- Recommendation: Build coverage matrix and merge/parametrize overlapping cases; centralize fixtures/mocks.
- Difficulty: Medium. Effect: Faster CI, less drift.

2) Temp schedule sprawl and staleness risk (Hypothesis)
- Impact: Confusing backlog, duplicate pathways, unowned code.
- Evidence: Feature folder [src/features/tempSchedule](src/features/tempSchedule), repository [src/data/repositories/tempScheduleRepository.ts](src/data/repositories/tempScheduleRepository.ts), three temp-schedule test suites ([tests/temp-schedule-date-parsing.test.ts](tests/temp-schedule-date-parsing.test.ts), [tests/temp-schedule-date-utils.test.ts](tests/temp-schedule-date-utils.test.ts), [tests/temp-schedule-should-show-on-date.test.ts](tests/temp-schedule-should-show-on-date.test.ts)).
- Recommendation: Confirm ownership and intent; either graduate into schedule domain or archive/remove with migration notes.
- Difficulty: Medium. Effect: Reduced cognitive load.

3) Layering drift risk between stores → repos → services → sync (Hypothesis)
- Impact: Harder to reason about persistence, higher bug surface.
- Evidence: Parallel concerns across stores [src/shared/stores](src/shared/stores), repositories [src/data/repositories](src/data/repositories), services [src/shared/services/sync](src/shared/services/sync), [src/shared/services/schedule](src/shared/services/schedule), [src/shared/services/template](src/shared/services/template), and subscribers [src/shared/subscribers](src/shared/subscribers).
- Recommendation: Trace a few critical flows (e.g., dailyData, inbox, template) to ensure UI never touches Dexie directly and sync boundaries are clean; document the canonical path.
- Difficulty: Large (audit). Effect: Reliability and onboarding speed.

4) ADHD UX guardrails may be uneven across inbox and modal surfaces (Hypothesis)
- Impact: Higher cognitive load for ADHD users; inconsistent ESC/backdrop/hotkeys.
- Evidence: Tests exist but coverage breadth unknown: [tests/inbox-hotkeys.test.ts](tests/inbox-hotkeys.test.ts), [tests/inbox-to-block-immediate.test.ts](tests/inbox-to-block-immediate.test.ts), [tests/modal-hotkeys.test.ts](tests/modal-hotkeys.test.ts). UX-sensitive features in [src/features/inbox](src/features/inbox) and modal-heavy flows elsewhere.
- Recommendation: Re-check modal escape/backdrop policy and hotkey discoverability; add UX acceptance criteria per flow.
- Difficulty: Medium. Effect: Lower user overwhelm.

5) Sync logging and observability duplication (Hypothesis)
- Impact: Noise, storage churn, harder signal detection.
- Evidence: Dedicated repo [src/data/repositories/syncLogRepository.ts](src/data/repositories/syncLogRepository.ts), service stack [src/shared/services/sync](src/shared/services/sync), plus targeted tests [tests/sync-logger.test.ts](tests/sync-logger.test.ts).
- Recommendation: Inventory log emitters and retention; align levels/rotation and ensure CI only asserts on structured fields.
- Difficulty: Medium. Effect: Cleaner diagnostics.

6) Event subscriber side-effects untracked (Hypothesis)
- Impact: Hidden coupling, duplicate triggers.
- Evidence: Multiple subscribers [src/shared/subscribers](src/shared/subscribers) (gameState, googleSync, inbox, waifu, xp).
- Recommendation: Map events → subscribers; ensure idempotency and explicit ordering; add minimal smoke tests per event.
- Difficulty: Medium. Effect: Fewer heisenbugs.

7) Legacy or niche feature spread (Hypothesis)
- Impact: Maintenance overhead on low-value domains (battle, gamification, waifu, weather) vs core scheduling.
- Evidence: Feature folders [src/features/battle](src/features/battle), [src/features/gamification](src/features/gamification), [src/features/waifu](src/features/waifu), [src/features/weather](src/features/weather).
- Recommendation: Revalidate product priority; consider modularization or optional loading to keep core lean.
- Difficulty: Large (product decision). Effect: Focus on core UX.

8) Template system complexity (Hypothesis)
- Impact: Rework risk and drift between template UX and persistence.
- Evidence: Feature [src/features/template](src/features/template), repository [src/data/repositories/templateRepository.ts](src/data/repositories/templateRepository.ts), service [src/shared/services/template](src/shared/services/template), test [tests/template-system.test.ts](tests/template-system.test.ts).
- Recommendation: Audit template lifecycle (create/edit/apply) for validation and sync; check for duplication with schedule/time-block flows.
- Difficulty: Medium. Effect: Lower regression risk.

9) Documentation and analysis backlog hygiene (Fact)
- Impact: Harder handoffs; duplicated investigations.
- Evidence: Large analysis backlog in [agent-output/analysis](agent-output/analysis) plus standalone probes (e.g., [agent-output/analysis/dexie-violations-scan.txt](agent-output/analysis/dexie-violations-scan.txt)). [.next-id](agent-output/.next-id) currently at 57.
- Recommendation: Triage stale analyses, move terminal-status docs to closed/, and roll insights into README/architecture notes.
- Difficulty: Quick win. Effect: Faster onboarding.

10) Test naming and scope clarity (Hypothesis)
- Impact: Future duplication and unclear coverage boundaries.
- Evidence: Single visibility suite [tests/time-block-visibility.test.ts](tests/time-block-visibility.test.ts); past memory of duplicate naming suggests drift risk. Numerous domain-specific suites (weekly goals, three-hour buckets, slot finder) without manifest.
- Recommendation: Create a test manifest mapping domain → suite to prevent future duplicates; ensure alias imports are consistent.
- Difficulty: Quick win. Effect: Lower test drift risk.

## Quick Wins vs Medium vs Large
- Quick wins (1–2 days): (9) analysis backlog hygiene, (10) test manifest/naming guardrail.
- Medium (3–7 days): (1) sync test consolidation, (2) temp schedule decision and cleanup, (4) modal/inbox ADHD UX audit, (5) sync logging inventory, (6) event subscriber mapping, (8) template lifecycle audit.
- Large (2 weeks+): (3) layering trace across core flows, (7) legacy/niche feature modularization.

## Proposed Metrics
- Performance: CI wall-clock for vitest suites (focus on sync group); Dexie query/transaction counts per hot path once instrumented.
- UX: Time-to-complete for inbox triage and modal flows; hotkey discovery rate; ESC/backdrop compliance rate under manual checks.
- Quality: Test duplication ratio (unique domains/tests), sync failure rate in smoke suites, log volume vs error signal ratio.

## Analysis Recommendations (next steps to deepen inquiry)
- Open representative files per hotspot (sync tests, tempSchedule repo, modal/inbox components) to confirm duplication and layering compliance.
- Build a one-page system map tracing store → repo → Dexie → sync for dailyData and inbox.
- Run targeted vitest with coverage focus on sync stack to measure overlap.
- UX ride-along: record modal/inbox flows to score ADHD friction (steps, hotkey visibility, interruption risk).

## Open Questions
- Which sync behaviors are still flaky or slow in CI today?
- Is tempSchedule meant for migration, experiment, or deprecation?
- Are battle/gamification/waifu/weather in active roadmap or should they be optional modules?
- Do modal/inbox flows currently enforce ESC-only close and no backdrop dismiss?

## Changelog
- 2026-01-03: Initial diagnostic drafted from repository structure; no source files opened.

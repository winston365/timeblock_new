---
ID: 74
Origin: 74
UUID: 2f8c9a1b
Status: Active
---

## Value Statement and Business Objective
Local-first analytics must respect user-local dates and architectural boundaries so XP/battle stats, task search, and sync flows remain correct across time zones and layers. This audit checks for UTC/local drift, async safety, and storage-layer bypasses that could silently degrade user trust.

## Objective
Identify concrete UTC/local mismatches, null/async safety gaps, Firebase/Dexie boundary violations, and potential listener leaks in the current codebase; produce evidence-backed findings and next investigative steps.

## Context
Scope per user request: (1) UTC vs local date mismatches, (2) null/undefined safety, (3) async/await issues, (4) Firebase/Dexie safety, (5) event cleanup. Project rules: UI/Stores → Repositories → Dexie → Firebase; avoid direct Firebase from UI/features; prefer getLocalDate/local-aware utilities.

## Methodology
- Searched repo for risky date patterns (toISOString slicing, Date("YYYY-MM-DD")) and Firebase/Dexie usage hotspots.
- Read targeted files: StatsModal, BossAlbumModal (stats tab), battleRepository (stats), unifiedTaskService helpers, scheduleOrchestrator, useAppInitialization.
- Checked listener usage for cleanup patterns.

## Findings (fact)
1) Battle stats generated with UTC dates but stored with local dates (mismatch). getRecentBattleStats builds date keys via new Date().toISOString().slice(0,10) while updates use getLocalDate, causing off-by-one-day gaps and wrong “today” highlighting in BossAlbum for non-UTC users. Evidence: battleRepository getRecentBattleStats, cleanupOldBattleStates, and BossAlbum isToday check.
2) StatsModal weekly comparisons use UTC-derived date strings against local-keyed XP history. lastWeekDateStr and weekStartStr rely on toISOString().slice(0,10), so weekly comparisons and goal progress can shift a day for users not on UTC. Evidence: StatsModal weekly comparison and weekly goal progress sections.
3) Task lookup fallback uses UTC dates; recent task search can miss items. unifiedTaskService.getRecentDates builds recent date strings with toISOString().slice(0,10), while daily data keys are local. findTaskLocation’s fallback scan may fail near day boundaries. Evidence: unifiedTaskService getRecentDates and findTaskLocation usage.
4) Firebase access bypasses repository/Dexie layer in a feature service. scheduleOrchestrator calls fetchFromFirebase/syncToFirebase directly from the feature service instead of through a repository/Dexie cache, violating the mandated UI→Repo→Dexie→Firebase flow and risking divergent data handling/logging.

## Analysis Recommendations (next investigative steps)
- Replace UTC-derived date strings with local-aware helpers (e.g., getLocalDate / local date arithmetic) in battleRepository stats generation, BossAlbum “today” check, StatsModal weekly computations, and unifiedTaskService.getRecentDates; add regression tests around timezone offsets (e.g., UTC+9, UTC-7) for stats, task lookup, and XP goals.
- Confirm whether any other stats/reporting components reuse getRecentBattleStats or StatsModal logic; trace shared consumers to ensure consistent date keys.
- Review schedule/warmup preset sync flow with Architect/Planner to re-route through repository/Dexie and ensure sync logging/error handling is consistent with other data domains.

## Open Questions
- Are battle stats or XP history consumed elsewhere (mobile/other views) that could inherit the UTC/local drift? Need inventory of consumers.
- Do existing tests cover timezone offsets? If not, which suites should add coverage (battle stats, XP goals, task lookup)?

## Changelog
- 2026-01-07: Initial scan and findings recorded.

---
ID: 61
Origin: 61
UUID: d3b9a4e2
Status: Planned
---

## Changelog
- 2026-01-03: Initial analysis of unifiedTaskService test coverage and gaps.
- 2026-01-03: Planned PR3 test hardening (see agent-output/planning/061-pr3-unified-task-service-test-hardening-plan-2026-01-03.md).

## Value Statement and Business Objective
Ensure the unifiedTaskService—the gateway for all task CRUD and aggregation—has test coverage aligned with data integrity and UX expectations before PR3 changes proceed.

## Objective
Map current tests to exported APIs, identify untested behaviors (including error/edge flows and ADHD-friendly user flows), and flag the reason for the existing skipped test.

## Context
- Test source: [tests/unified-task-service.test.ts](tests/unified-task-service.test.ts)
- Service under test: [src/shared/services/task/unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts)
- Prior memory notes flagged coverage around ~58.88% with missing error branches; optimistic flows were added later with a known skipped test.

## Root Cause / Risk Being Investigated
Potential blind spots in unifiedTaskService tests could mask regressions in core task routing (inbox vs daily), optimistic updates, and move operations, directly impacting data integrity and ADHD-friendly flows (triage, micro-steps cadence).

## Methodology
- Static review of the current test suite to count scenarios and classify by public method.
- Cross-check against exported functions in unifiedTaskService for coverage and edge/error handling.
- Note any skipped or placeholder tests and implied untested branches.

## Findings
- Facts:
  - Tests defined: 45; skipped: 1 (`it.skip` for non-optimistic `moveInboxToBlock` missing-inbox branch). One placeholder test (`moveBlockToInbox with optimistic=false calls repo when task found`) runs but only asserts `expect(true).toBe(true)`.
  - Exported methods: `findTaskLocation`, `updateAnyTask`, `deleteAnyTask`, `toggleAnyTaskCompletion`, `getAnyTask`, `getAllActiveTasks`, `getUncompletedTasks`, `moveInboxToBlock`, `moveBlockToInbox`. Helpers `getRecentDates` and merge/find cores are unexported.
  - Coverage mapping (by behavior):
    - `findTaskLocation`: inbox hit, today daily hit, fallback to recent 7 days (hit found, exhausted -> not_found), dateHint path, error wrapping to `TASK_LOCATION_FIND_FAILED`, not_found return, inbox priority when duplicate IDs.
    - `updateAnyTask`: inbox and daily happy paths (store refresh toggle via `skipStoreRefresh`), not_found returns null + warn, repo error -> `TASK_UPDATE_FAILED`, daily date propagation, optimistic paths for inbox/daily with store delegation, optimistic result expectation.
    - `deleteAnyTask`: inbox happy path, not_found returns false + warn, repo error -> `TASK_DELETE_FAILED`, daily path happy, skip refresh for toggle test shared, optimistic path for inbox/daily, move-out/in tests partially cover non-optimistic branch.
    - `toggleAnyTaskCompletion`: inbox path with skipStoreRefresh, daily path, not_found warns/null, repo error -> `TASK_TOGGLE_COMPLETION_FAILED`, optimistic store delegation + expected result.
    - `getAnyTask`: success via `findTaskLocation`, error propagation check (sees inner `TASK_LOCATION_FIND_FAILED`).
    - `getAllActiveTasks`: combines inbox+daily, handles null/undefined tasks, empty sources, date param, repo error -> `TASK_GET_ALL_ACTIVE_FAILED`.
    - `getUncompletedTasks`: filters mixed completed/uncompleted, handles empty sources, date param; no explicit error-path test (relies on `getAllActiveTasks`).
    - `moveInboxToBlock`: optimistic=true success; optimistic=false success (inbox->daily) with refreshes; skipped non-optimistic not-found branch.
    - `moveBlockToInbox`: optimistic=true success; optimistic=false success branch placeholder (no behavior asserted); non-optimistic not-found branch covered with warn/false; no repo-error coverage.
  - ADHD-related flows: inbox triage/micro-step-specific behaviors are not present in this service; current tests focus on storage routing and optimistic UX responsiveness.
- Hypotheses / Gaps (need confirmation):
  - Non-optimistic move paths lack behavioral assertions (success path placeholder, not-found inbox branch skipped); potential untested repo error wrapping for move functions.
  - `getUncompletedTasks` error propagation (through `getAllActiveTasks`) not directly asserted; failure path coverage relies on upstream test only.
  - `getRecentDates` helper untested; minor risk unless refactored.

## Analysis Recommendations (next-step inquiries)
- Validate non-optimistic move paths with real assertions (successful repo calls, refresh sequencing, error wrapping) to close the skipped and placeholder cases.
- Capture coverage numbers per exported method (line/branch) from latest run to confirm whether optimistic vs non-optimistic branches meet thresholds.
- Probe error wrapping for move functions (`TASK_MOVE_INBOX_TO_BLOCK_FAILED`, `TASK_MOVE_BLOCK_TO_INBOX_FAILED`) to ensure consistency with other CRUD operations.
- Confirm whether any ADHD-focused behaviors (e.g., inbox triage counts, micro-step timers) intersect with these APIs; if so, trace their callers for additional edge cases.

## Open Questions
- Why was the non-optimistic `moveBlockToInbox` test reduced to a placeholder—environmental limitation or behavior uncertainty? Can isolation be improved to assert repo calls?
- Is the skipped `moveInboxToBlock` not-found case still reproducible with current mocks, or does it require refactoring the test harness?
- Do upstream consumers rely on error codes from move functions; should their coverage be verified separately?

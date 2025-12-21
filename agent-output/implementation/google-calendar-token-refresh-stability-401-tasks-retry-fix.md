# Plan Reference
- No explicit plan document referenced for this hotfix; targeted test failure fix discovered via `vitest-all.log`.

# Date
- 2025-12-21

# Changelog
| Date | Handoff/Request | Summary |
|---|---|---|
| 2025-12-21 | Fix failing vitest | Preserve legacy mapping before calendar deletion so Tasks API 401 retry triggers refresh |

# Implementation Summary
- Fixes failing test `Google Calendar token refresh stability > retries once on 401 for Tasks API calls after refresh (via deleteGoogleTask)` by capturing the legacy task mapping before `deleteCalendarEvent()` runs.
- This delivers value by ensuring the intended 401-handling behavior (single refresh + retry) is exercised for the Google Tasks delete path, without changing API behavior beyond the ordering.

# Milestones Completed
- [x] Reproduce failure and capture exact stack location
- [x] Implement minimal fix
- [x] Re-run vitest suite and confirm green

# Files Modified
| Path | Changes |
|---|---|
| src/shared/services/calendar/googleTasksService.ts | Capture mapping before calendar deletion to avoid early-return and skipped Tasks API call |

# Files Created
| Path | Purpose |
|---|---|
| agent-output/implementation/google-calendar-token-refresh-stability-401-tasks-retry-fix.md | Implementation report for the fix |

# Code Quality Validation
- [x] TypeScript compile: not explicitly run (no TS build errors observed during vitest)
- [x] Linter: not run (not requested)
- [x] Tests: `npx vitest run --reporter verbose --no-color` via task `vitest verbose`

# Value Statement Validation
- Original: Ensure Tasks API path refreshes token and retries once on 401.
- Delivered: `deleteGoogleTask()` now still attempts the Tasks API delete after calendar deletion (which may remove mappings), so 401 triggers refresh + retry using updated token.

# Test Coverage
- Unit/Integration: Existing test `tests/google-calendar-token-refresh-stability.test.ts` covers the 401->refresh->retry behavior through `deleteGoogleTask()`.

# Test Execution Results
- Command: `npx vitest run --reporter verbose --no-color`
- Result: `Test Files 24 passed (24)`, `Tests 123 passed (123)`

# Outstanding Items
- Potential schema mismatch exists between GenericCalendarMapping vs TaskCalendarMapping usage for `taskCalendarMappings`. Not addressed in this minimal fix.

# Next Steps
- QA: verify no regression in Google Calendar/Tasks delete flows.
- If desired: unify mapping schema usage across calendar repository and googleCalendarService wrappers.

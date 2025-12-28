Value Statement and Business Objective
Status: Planned
Changelog:
- 2025-12-28: 로드맵/PR 분해 계획에 반영되어 Status를 Planned로 전환.
- (undated): Initial analysis for modal hotkey consistency, repository boundary, and coverage gaps (unifiedTaskService, conflictResolver, syncCore).

## Objective
Document current patterns and gaps for modal ESC/Ctrl+Enter behavior, Dexie repository boundary, and coverage shortfalls in unifiedTaskService, conflictResolver, and syncCore to guide implementation work without code changes.

## Context
- Scope limited to frontend/UI; no backend modifications.
- Lint work already completed; focus on partial fixes and unresolved issues.
- Modal standards: useModalHotkeys / useModalEscapeClose with modalStackRegistry to guard top-of-stack and IME composition.

## Methodology
- Searched workspace for modal components named in request and hotkey hooks.
- Read component implementations and shared hooks (useModalHotkeys, useModalEscapeClose).
- Reviewed unifiedTaskService implementation and its current tests.
- Reviewed conflictResolver and syncCore plus existing tests to identify untested branches.
- Verified package.json for RTL test dependencies.

## Findings (Facts)
- QuickAddTask: uses window keydown listener for ESC and Ctrl+Enter; not registered with modalStackRegistry; lacks IME composition guard and can fire while other modals are active.
- GoalsModal, BossAlbumModal, WeeklyGoalModal, tempSchedule TemplateModal, template TemplateModal all use useModalHotkeys. Goals/BossAlbum do not define primaryAction; WeeklyGoalModal and both TemplateModals do.
- template TemplateModal passes isOpen: true (component relies on parent mount for visibility). Hotkeys always active while component mounted.
- Dexie imports from 'dexie' exist only under src/data/** (dexieClient, baseRepository, syncEngine infra). No direct Dexie usage in src/shared or features.
- unifiedTaskService tests cover: inbox/daily location detection for today, inbox updates/deletes/toggles, skipStoreRefresh (inbox), daily update, error wrapping, and toggle inbox.
- unifiedTaskService untested areas: recent-date fallback search (getRecentDates loop), not_found return branch, daily delete/toggle branches, getAnyTask, getAllActiveTasks, getUncompletedTasks, daily skipStoreRefresh branch, warning logging branches.
- conflictResolver tests cover: resolveConflictLWW happy paths; mergeGameState cumulative XP fields, quest merge, xpHistory merge, updatedAt/deviceId selection; mergeTaskArray newer-overrides and createdAt sort. Untested: timeBlockXPHistory merge, completedTasksHistory merge (dedupe/limit), mergeGameState fallback to remote baseData when remote is newer, task merge when remote has newer task than local, handling of missing arrays.
- syncCore tests cover: Firebase not initialized early-return; duplicate hash skip; remote newer resolver skip; error enqueue; listenToFirebase remote-only update; fetchFromFirebase load/missing/error. Untested: serialize option, sanitizeForFirebase effects, getRemoteOnce single-flight/TTL cache, instrumentation (rtdbMetrics, syncLogger success message), listenToFirebase when Firebase not initialized (no-op unsubscribe), syncToFirebase success path writing and log contents when resolver chooses local, lastSyncHash per key differentiation.
- package.json has no @testing-library/react dependency (RTL not present).

## Recommendations (for Implementer)
- Migrate QuickAddTask to useModalHotkeys with onEscapeClose/onPrimary instead of window keydown; ensure composition guard and modalStackRegistry participation.
- Confirm template TemplateModal mounting strategy or pass isOpen from parent to avoid always-on hotkeys when hidden.
- Add unit tests for unifiedTaskService covering: getRecentDates search hit on past day; not_found; daily delete/toggle with store refresh + skip; getAnyTask; getAllActiveTasks/uncompleted; warning branches; skipStoreRefresh on daily path.
- Add conflictResolver tests for timeBlockXPHistory merge, completedTasksHistory merge cap, remote-newer base data selection, mergeTaskArray when remote task is newer and when arrays contain missing fields.
- Add syncCore tests for serialize hook and sanitize behavior, getRemoteOnce cache/inFlight guarding, success logging path (resolver keeps local), listenToFirebase when Firebase uninitialized returns no-op, lastSyncHash key variance, and rtdbMetrics guards.
- If RTL tests planned, add @testing-library/react to devDependencies and set up render utilities.

## Open Questions
- Should QuickAddTask participate in modalStackRegistry even though it is a standalone window? If not, is a narrower window-level guard acceptable?
- For template TemplateModal, is there a parent-level isOpen boolean we can forward to useModalHotkeys to avoid active listeners when not visible?

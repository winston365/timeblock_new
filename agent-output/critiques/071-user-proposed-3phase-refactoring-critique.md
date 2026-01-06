```markdown
---
ID: 71
Origin: 71
UUID: a7c3e891
Status: OPEN
---

# Critique: User-Proposed 3-Phase Refactoring Plan

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2026-01-05 | User → Critic | Critical review of proposed 3-phase refactoring plan | Identified structural misalignment with existing v1.1 plan, architectural concerns, and risk assessment |

## Artifact Under Review
- **Source**: User request (not a formal planning doc)
- **Date**: 2026-01-05
- **Status**: Initial Review

---

## Value Statement Assessment

**⚠️ PARTIAL - Implicit but not explicit**

The user's request implies a value statement:
> "Split large files (500-700 LOC) into smaller, testable units to reduce regression risk."

**Gap**: No explicit user story format. Missing "So that..." clause defining user-visible benefit.

**Recommendation**: Add explicit value statement before implementation, e.g.:
> "As a maintainer, I want monolithic service/modal/view files split into focused modules, so that changes in one area don't cascade regressions and debugging is faster."

---

## Overview

The user proposes a 3-phase refactoring targeting 10 files across services, modals, and views.

### Proposed Structure (User's Request)

| Phase | Focus | Target Files |
|-------|-------|--------------|
| Phase 1 | Service Layer | unifiedTaskService, googleCalendarService, IdleFocusModeService |
| Phase 2 | Modal & Shared Logic | TaskBreakdownModal, BulkAddModal, useInboxHotkeys |
| Phase 3 | View Layer | ScheduleView, FocusView, TempScheduleTimelineView, BattleMissionsSection |

---

## Critical Issues

### C1: Conflicting with Existing Approved Plan (Status: OPEN)
| Status | OPEN |
|--------|------|
| **Issue** | An approved and QA-complete plan already exists at [070-refactor-3phase-refactoring-plan-v1.0.md](../planning/070-refactor-3phase-refactoring-plan-v1.0.md) with different scope. User's proposed files overlap but diverge significantly. |
| **Impact** | Proceeding with this proposal would create parallel refactoring tracks, risking merge conflicts, wasted effort, and unclear ownership. |
| **Current v1.1 Scope** | domain.ts, syncEngine, BulkAddModal, TaskBreakdownModal, TemplateModal, TaskModal, StatsModal (Phase 1); dailyDataStore, InboxTab, useInboxHotkeys, WeeklyGoalCard, TemplatesModal, BossAlbumModal (Phase 2); TempSchedule views, DailySummaryModal (Phase 3) |
| **User's Scope** | unifiedTaskService, googleCalendarService, IdleFocusModeService, TaskBreakdownModal, BulkAddModal, useInboxHotkeys, ScheduleView, FocusView, TempScheduleTimelineView, BattleMissionsSection |
| **Overlap** | Only TaskBreakdownModal, BulkAddModal, useInboxHotkeys, TempScheduleTimelineView are common |
| **Recommendation** | Either: (1) Extend v1.1 with additional files as Phase 4+, or (2) Create a new plan explicitly superseding v1.1 with justification |

### C2: Service Layer Files Not in Priority 1 (Status: OPEN)
| Status | OPEN |
|--------|------|
| **Issue** | The structural scan analysis ([070-refactor-structural-scan-analysis.md](../analysis/closed/070-refactor-structural-scan-analysis.md)) categorizes `unifiedTaskService` (563 LOC), `googleCalendarService` (554 LOC), and `idleFocusModeService` (526 LOC) as **Priority 2** (400-600 LOC), not Priority 1 (>600 LOC). |
| **Impact** | Prioritizing these over larger Priority 1 files (InboxTab 827 LOC, WeeklyScheduleView 842 LOC, TempScheduleTimelineView 804 LOC, DailySummaryModal 781 LOC) misallocates effort. |
| **Data** | According to structural scan: unifiedTaskService 563 LOC, googleCalendarService 554 LOC, idleFocusModeService 526 LOC |
| **Recommendation** | Defer service layer refactoring to Phase 4+ or create separate "Service Hardening" epic after Priority 1 UI files are addressed |

### C3: Phase Order Rationale Missing (Status: OPEN)
| Status | OPEN |
|--------|------|
| **Issue** | User asks "Does the phase order make sense?" but provides no justification for Services → Modals → Views ordering. The existing v1.1 plan uses Foundation/Types → Stores → Components order with explicit dependency reasoning. |
| **Impact** | Without dependency analysis, phases may conflict. E.g., ScheduleView depends on dailyDataStore (Phase 2 in v1.1); refactoring ScheduleView before store slicing may require rework. |
| **Recommendation** | Document import dependencies between proposed targets. Recommended order based on existing analysis: Types/Foundation → Stores → Services → Views (views depend on everything else) |

---

## High-Risk Items

### H1: unifiedTaskService is a Cross-Cutting Orchestrator (Status: OPEN)
| Status | OPEN |
|--------|------|
| **Issue** | `unifiedTaskService` is heavily coupled to both `dailyDataStore` and `inboxStore`. Existing v1.1 plan explicitly addresses dailyDataStore slicing BEFORE any service that depends on it. |
| **Evidence** | From import graph: `data/repositories/index.ts > shared/services/task/unifiedTaskService.ts > shared/stores/inboxStore.ts` forms a circular dependency chain |
| **Risk** | Splitting unifiedTaskService without first stabilizing store boundaries may: (1) introduce new circular deps, (2) require rework when dailyDataStore is sliced, (3) break optimistic update path (ADR-008/009) |
| **Mitigation** | Complete dailyDataStore consumer mapping and slicing (v1.1 Phase 2) before touching unifiedTaskService |

### H2: googleCalendarService OAuth Coupling (Status: OPEN)
| Status | OPEN |
|--------|------|
| **Issue** | User proposes "Separate OAuth/token from event CRUD" but tokenRefresh has in-flight deduplication (`refreshInFlight` variable) and cross-function state sharing. Naive split may break token refresh concurrency guarantees. |
| **Evidence** | `refreshInFlight` module variable guards concurrent token refresh; `refreshAccessToken` uses `finally` cleanup |
| **Risk** | Splitting file into oauth.ts + events.ts without careful state sharing may cause duplicate token refreshes or race conditions |
| **Mitigation** | Keep `refreshInFlight` and related state in a single module. Consider splitting only pure functions (taskToCalendarEvent, getResistanceLabel) as utils |

### H3: IdleFocusModeService is a Class with Internal State (Status: OPEN)
| Status | OPEN |
|--------|------|
| **Issue** | Unlike typical services, `IdleFocusModeService` is a class with instance state (timers, countdowns, running flag). User proposes "Split calc/timers/UI/store" which conflicts with OOP encapsulation. |
| **Evidence** | Class has: `idleTimer`, `countdownTimer`, `isRunning`, `isInCountdown`, `lastActivityTime`, `handleActivity` as instance properties |
| **Risk** | Extracting timers to separate module breaks encapsulation and requires cross-module coordination |
| **Mitigation** | Extract only stateless helper functions (calculateThresholdMs, shouldActivateFocusMode, shouldProcessActivity). Keep class structure intact |

### H4: ScheduleView and FocusView are Tightly Coupled (Status: OPEN)
| Status | OPEN |
|--------|------|
| **Issue** | FocusView is a child component of ScheduleView sharing task state, edit handlers, and toggle callbacks. Refactoring them in same phase may cause cascading changes. |
| **Evidence** | FocusView props include: `onToggleTask`, `onEditTask`, `onUpdateTask`, `onCreateTask` from parent ScheduleView |
| **Risk** | Splitting ScheduleView and FocusView simultaneously multiplies regression surface |
| **Mitigation** | Refactor one at a time. Recommend ScheduleView first (parent), stabilize interface, then FocusView |

---

## Medium-Risk Items

### M1: No Coverage Baseline for Proposed Files (Status: OPEN)
| Status | OPEN |
|--------|------|
| **Issue** | Existing coverage baseline ([070-refactor-coverage-baseline.md](../planning/070-refactor-coverage-baseline.md)) only covers v1.1 scope files. User's proposed files (googleCalendarService, IdleFocusModeService, ScheduleView, FocusView, BattleMissionsSection) have unknown coverage. |
| **Impact** | Cannot measure regression. Some files may have 0% coverage. |
| **Recommendation** | Run `npm run test:coverage` and document coverage for proposed files before any changes |

### M2: 9 Existing Circular Dependencies (Status: OPEN)
| Status | OPEN |
|--------|------|
| **Issue** | Import graph shows 9 pre-existing circular dependencies including chains involving `unifiedTaskService`, `dailyDataStore`, and `inboxStore`. |
| **Evidence** | From [070-refactor-import-graph.md](../planning/070-refactor-import-graph.md): `dailyDataStore > repositories/index > unifiedTaskService > inboxStore` is a cycle |
| **Risk** | Any extraction from these files may inadvertently break or multiply cycles |
| **Mitigation** | Run `npx madge --circular` after each extraction. Document acceptable cycles vs new violations |

### M3: BattleMissionsSection Location and Dependencies Unknown (Status: OPEN)
| Status | OPEN |
|--------|------|
| **Issue** | User mentions "BattleMissionsSection (534 LOC)" but structural scan shows different battle files. Need to verify actual LOC and dependencies. |
| **Location** | `src/features/settings/components/tabs/battle/BattleMissionsSection.tsx` |
| **Recommendation** | Include in analysis with actual LOC measurement and dependency mapping before planning |

---

## Architectural Alignment Assessment

### ⚠️ Optimistic Update Path Risk
ADR-008 and ADR-009 mandate `updateTask` flows through store → repository chain. User's proposal to split `unifiedTaskService` (which orchestrates this flow) risks fragmenting the update path.

**Recommendation**: Any unifiedTaskService split must preserve the single entry point for task mutations.

### ⚠️ EventBus Boundaries
ADR-005 requires emit from stores/orchestrators only. IdleFocusModeService emits toasts directly—this is acceptable as UI feedback, but extraction must not move toast calls to pure utility modules.

### ✅ Repository Pattern
No direct DB access proposed in target files. Alignment maintained.

### ⚠️ Facade Pattern Gap
Existing v1.1 plan mandates Facade pattern (re-exports from original file) to preserve import paths. User's proposal doesn't mention this.

**Recommendation**: Add explicit Facade requirement to preserve backward compatibility.

---

## Scope Assessment

| Aspect | Assessment | Notes |
|--------|------------|-------|
| **File Count** | 10 files | Similar to v1.1's 15+ files across 3 phases |
| **LOC Range** | 517-567 LOC | Below Priority 1 threshold (>600) for most files |
| **Priority Alignment** | ⚠️ Mixed | Only TempScheduleTimelineView (804 LOC) is Priority 1 |
| **Dependency Complexity** | ⚠️ High | Services depend on stores; Views depend on services+stores |
| **Time Estimate** | Not provided | Recommend 1-2h per extraction task as in v1.1 |

---

## Risk Matrix

| Phase | Risk Level | Key Concerns | Mitigation Required |
|-------|------------|--------------|---------------------|
| Phase 1 (Services) | **HIGH** | Circular deps, store coupling, optimistic update path | Complete store slicing first (v1.1 Phase 2) |
| Phase 2 (Modals) | **MEDIUM** | parseInput duplication (already in v1.1), behavioral divergence | Characterization tests before consolidation |
| Phase 3 (Views) | **MEDIUM-HIGH** | Parent-child coupling (Schedule/Focus), large LOC targets | Sequential refactoring, not parallel |

---

## Strengths of Proposed Plan

1. **Identifies real hotspots**: All mentioned files are genuinely large (400-800 LOC)
2. **Logical grouping**: Services/Modals/Views is a reasonable conceptual division
3. **Raises right questions**: Atomic runnability, rollback, test coverage awareness

---

## Weaknesses/Gaps

1. **No formal document**: Proposal exists only as user request, not traceable plan
2. **Conflicts with approved v1.1**: Creates parallel track without resolution
3. **Priority mismatch**: Most files are Priority 2, not Priority 1
4. **Missing dependency analysis**: Phase order not justified by import graph
5. **No pre-requisites**: Missing coverage baseline, import graph, consumer mapping
6. **No rollback strategy**: No git tags or verification gates defined
7. **No Facade requirement**: Import path stability not addressed

---

## Recommendations

### Immediate Actions

1. **CRITICAL**: Decide whether this supersedes v1.1 or extends it
   - If supersedes: Document justification and update v1.1 status to "Superseded"
   - If extends: Create formal Phase 4-6 extension to v1.1

2. **CRITICAL**: Reorder phases based on dependency analysis
   ```
   Recommended: Views → Modals → Services
   (Reverse of proposal, because services are upstream)
   OR: Follow v1.1's Foundation → Stores → Components pattern
   ```

3. **HIGH**: Defer service layer to later phase
   - `unifiedTaskService` depends on store boundaries being stable
   - `googleCalendarService` has complex token state
   - `IdleFocusModeService` is self-contained, could be last

4. **HIGH**: Add pre-implementation checklist (adopt from v1.1):
   - [ ] Coverage baseline for all target files
   - [ ] Import graph snapshot
   - [ ] Consumer mapping for each file
   - [ ] Git tags for rollback

### Suggested Modified Plan

**Option A: Extend v1.1**
- Keep v1.1 Phases 1-3 as-is (already QA complete)
- Add Phase 4: ScheduleView + FocusView
- Add Phase 5: BattleMissionsSection + service utilities extraction
- Add Phase 6: Service layer splitting (after store maturity)

**Option B: New Plan with Correct Priority**
Replace proposal with Priority-1-first approach:
- Phase 1: InboxTab (827 LOC), WeeklyScheduleView (842 LOC) - from existing scan
- Phase 2: TempScheduleTimelineView (804 LOC), DailySummaryModal (781 LOC)
- Phase 3: Service utilities extraction only (pure functions, not orchestrators)

---

## Questions for User

1. Is this proposal meant to replace the approved v1.1 plan or extend it?
2. What is the urgency? v1.1 already addresses TaskBreakdownModal, BulkAddModal, useInboxHotkeys, TempScheduleTimelineView
3. Is there a specific pain point driving service layer priority over larger UI files?
4. Are there upcoming features that depend on these specific files being smaller?

---

## Revision History

| Revision | Date | Summary |
|----------|------|---------|
| Initial | 2026-01-05 | First critique of user-proposed 3-phase refactoring |

---

*Critique prepared by: Critic Agent*
*Next step: User decision on plan relationship to v1.1; if proceeding, create formal planning doc*

```

---
ID: 70
Origin: 70
UUID: 9e4b2d71
Status: OPEN
---

# Critique: Refactoring Plan v1.0

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2026-01-05 | Planner → Critic | Initial review of 3-phase refactoring plan | Identified critical gaps, missing files, risk areas, and architectural concerns |

## Artifact Under Review
- **Plan**: [agent-output/planning/070-refactor-3phase-refactoring-plan-v1.0.md](../planning/070-refactor-3phase-refactoring-plan-v1.0.md)
- **Analysis**: [agent-output/analysis/closed/070-refactor-structural-scan-analysis.md](../analysis/closed/070-refactor-structural-scan-analysis.md)
- **Date**: 2026-01-05
- **Status**: Initial Review

---

## Value Statement Assessment

**✅ PASS with minor observations**

> "As a power user with ADHD, I want large, mixed-responsibility UI/store modules to be split into small, testable units, so that the app stays predictable (fewer regressions), faster to change, and easier to debug."

- **Strength**: Clear user story format with explicit ADHD-friendliness tie-in
- **Strength**: Connects structural improvement to user-visible outcomes (predictability, debuggability)
- **Observation**: Value is internally focused (developer velocity) rather than end-user feature delivery. This is acceptable for structural refactoring but should be acknowledged.

---

## Overview

The plan proposes a 3-phase structural refactoring approach targeting monolithic files identified in the structural scan analysis. It follows a logical progression:
- **Phase 1**: Foundation extraction (types, sync engine, parsers, modal controllers)
- **Phase 2**: Store slicing and core UI decomposition
- **Phase 3**: Remaining component splits and integration verification

**Positive aspects:**
- Respects existing patterns (Repository, EventBus, Zustand boundaries)
- Enforces 400 LOC guardrail for new files
- Maintains public API via Facade pattern
- Atomic runnability constraint (build/test per step)

---

## Critical Issues (MUST fix before implementation)

### C1: BossAlbumModal Missing from Plan (689 LOC, Priority 1)
| Status | OPEN |
|--------|------|
| **Issue** | [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx) (689 LOC) is listed as Priority 1 in the analysis but is absent from all three phases. |
| **Impact** | Incomplete structural improvement; this file has the same mixed UI+logic pattern as other Priority 1 targets. |
| **Recommendation** | Add BossAlbumModal to Phase 3 alongside DailySummaryModal, or justify exclusion (e.g., battle feature deprecation planned). |

### C2: Test Coverage Baseline Not Established
| Status | OPEN |
|--------|------|
| **Issue** | Plan lacks test coverage requirements before and after refactoring. Analysis notes unifiedTaskService at 58.91% coverage; other targets have unknown coverage. |
| **Impact** | Refactoring without coverage baseline increases regression risk. Changes to stores/services without tests may introduce silent bugs. |
| **Recommendation** | Add pre-requisite: "Capture per-file line/branch coverage for all scoped files before Phase 1 starts. Block refactoring on files with <60% coverage until minimal tests exist." |

### C3: Circular Dependency Risk Between Phases Not Addressed
| Status | OPEN |
|--------|------|
| **Issue** | Phase 2 (dailyDataStore slicing) and Phase 3 (TempSchedule components) both consume Phase 1 outputs. However, there's no explicit import graph analysis to detect potential circular dependencies. |
| **Impact** | If Phase 1 utilities import from Phase 2 stores (even transitively), build will fail or require unplanned refactoring. |
| **Recommendation** | Add verification step after Phase 1: "Run `madge --circular` to confirm no cycles introduced. Document allowed import directions: Phase 1 → Phase 2 → Phase 3 (no reverse)." |

---

## High-Risk Items (Need mitigation strategy)

### H1: dailyDataStore is a Central Coupling Point
| Status | OPEN |
|--------|------|
| **Issue** | dailyDataStore (729 LOC) is imported by 15+ components and stores. Slicing it risks breaking consumers if slice boundaries don't match current access patterns. |
| **Impact** | High regression risk; may require coordinated updates across many files. |
| **Mitigation** | Before slicing, generate import map with `grep -r "from.*dailyDataStore"` and document which actions each consumer uses. Slice boundaries should align with consumer groups. |

### H2: syncEngine Tight Coupling to Toast Store
| Status | OPEN |
|--------|------|
| **Issue** | Analysis notes syncEngine has "tight coupling to Dexie, Firebase, toast store." Extracting modules may require breaking this coupling. |
| **Impact** | Toast notifications may become inconsistent if coupling is broken incorrectly. |
| **Mitigation** | Keep toast emission at orchestration layer (syncEngine entry point), not in sub-modules. Document this constraint in Phase 1 Task 2. |

### H3: TemplateModal Has Two Instances
| Status | OPEN |
|--------|------|
| **Issue** | File search reveals two TemplateModal files: `src/features/template/TemplateModal.tsx` and `src/features/tempSchedule/components/TemplateModal.tsx`. Plan only addresses the first. |
| **Impact** | Confusion about scope; the tempSchedule version may have similar issues. |
| **Mitigation** | Clarify in plan: "This plan addresses `features/template/TemplateModal.tsx`. The `tempSchedule/components/TemplateModal.tsx` is a separate component with different scope." If both need refactoring, add tempSchedule version to Phase 3. |

### H4: Rollback Strategy Absent
| Status | OPEN |
|--------|------|
| **Issue** | No rollback strategy defined if a phase introduces regressions that are discovered late. |
| **Impact** | If Phase 2 breaks functionality and Phase 3 has started, rollback becomes complex. |
| **Mitigation** | Add: "Each phase ends with a git tag (e.g., `refactor-p1-complete`). If Phase N+1 reveals issues, revert to Phase N tag and reassess. No phase starts until previous phase is verified in `npm run electron:dev` for 1 session." |

---

## Medium-Risk Items

### M1: Priority 2 Files Not Addressed
| Status | OPEN |
|--------|------|
| **Issue** | Analysis lists Priority 2 files (400-600 LOC) including ScheduleView.tsx (568 LOC), FocusView.tsx (567 LOC), WeatherWidget.tsx (582 LOC). None are in the plan. |
| **Impact** | Partial structural improvement; these files may become the new "worst offenders" after Priority 1 is addressed. |
| **Recommendation** | Either add to Phase 3 or explicitly state: "Priority 2 files are deferred to a follow-up Epic (1.0.186+)." |

### M2: parseInput Duplication Fix May Have Divergent Behavior
| Status | OPEN |
|--------|------|
| **Issue** | Plan Task 3 (Phase 1) consolidates parseInput from BulkAddModal and TaskBreakdownModal. Analysis confirms similar implementations but didn't verify behavioral equivalence. |
| **Impact** | If implementations differ subtly (edge cases, validation rules), consolidation may change behavior. |
| **Recommendation** | Add: "Before consolidation, write unit tests capturing current parseInput behavior for both modals. Ensure consolidated version passes all tests." |

### M3: Verification Steps Lack Specificity
| Status | OPEN |
|--------|------|
| **Issue** | Verification is limited to `npm run build`, `npm run test`, TypeScript errors. No E2E or smoke test requirements. |
| **Impact** | Structural changes may pass unit tests but break runtime behavior (modal opening, drag/drop, etc.). |
| **Recommendation** | Add per-phase smoke test checklist: "Manually verify: (1) Open each modified modal, (2) Complete primary action, (3) ESC to close. Document in PR description." |

---

## Suggestions (Nice-to-have improvements)

### S1: Add Estimated LOC Reduction Per Task
**Rationale**: Would help prioritize tasks and validate 400 LOC guardrail is achievable.
**Example**: "Task 1: domain.ts 706 LOC → ~5 files × 150 LOC avg + 20 LOC facade"

### S2: Include File Size Metrics in Deliverables
**Rationale**: Makes verification objective.
**Example**: "Deliverable: `src/shared/types/domain/tasks.ts` (max 200 LOC)"

### S3: Document Facade Deprecation Timeline
**Rationale**: Facades are maintenance overhead. Plan should state whether facades are permanent or will be removed after consumers migrate.
**Example**: "Facade files (domain.ts, syncEngine.ts) will be deprecated in 1.0.190 after all consumers migrate to direct imports."

### S4: Add Visual Dependency Graph
**Rationale**: Would clarify phase dependencies and import directions for reviewers.

---

## Missing Files/Tasks (Gaps in Coverage)

### Files in Analysis Not in Plan

| File | LOC | Analysis Priority | Status |
|------|-----|-------------------|--------|
| [BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx) | 689 | Priority 1 | **MISSING** |
| [ScheduleView.tsx](src/features/schedule/ScheduleView.tsx) | 568 | Priority 2 | Deferred |
| [FocusView.tsx](src/features/schedule/components/FocusView.tsx) | 567 | Priority 2 | Deferred |
| [WeatherWidget.tsx](src/features/weather/WeatherWidget.tsx) | 582 | Priority 2 | Deferred |
| [googleCalendarService.ts](src/shared/services/calendar/googleCalendarService.ts) | 554 | Priority 2 | Deferred |
| [unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts) | 563 | Priority 2 | Deferred |

### Clarification on User's Query

User asked about:
- **TaskCreateModal** (711 LOC) - This file does not exist in codebase. Likely refers to `TaskModal.tsx` (663 LOC) which IS in plan.
- **GoalListPanel** (679 LOC) - This file does not exist. Closest is `WeeklyGoalPanel.tsx` which is NOT in plan but is only 300-400 LOC (not a Priority 1 target).
- **AIAssistantModal** (781 LOC) - This file does not exist. Likely confusion with `DailySummaryModal.tsx` (781 LOC) which IS in plan.

---

## Architectural Alignment Assessment

### ✅ Repository Pattern Respected
Plan explicitly maintains Facade pattern and doesn't introduce new direct DB access.

### ✅ EventBus Boundaries Maintained
Plan delegates event emission to store/orchestrator layer per ADR-005.

### ✅ Zustand Patterns Followed
Store slicing approach (Phase 2) creates sub-modules while keeping single store export.

### ⚠️ Watch: Optimistic Update Path
ADR-008 and ADR-009 define store-centric optimistic updates. Ensure Phase 2 dailyDataStore slicing doesn't fragment the update path. Recommend: "Keep updateTask action in main store; slice only read-only selectors and helper computations."

---

## Scope Assessment

| Aspect | Assessment |
|--------|------------|
| **Task Granularity** | Appropriate for single implementer per phase |
| **Time Estimates** | Not provided - **recommend adding** |
| **Dependencies** | Mostly clear, but need circular dependency check |
| **Semver Alignment** | Target 1.0.185 is reasonable for structural work |

---

## Technical Debt Risks

### Risk: Facade Proliferation
Each phase creates facades for backward compatibility. Without deprecation timeline, codebase may accumulate unused indirection layers.

**Recommendation**: Add `TODO(refactor): remove facade after 1.0.188` comments in facade files.

### Risk: 400 LOC Threshold May Be Too Aggressive
Some utilities (especially type files) may need more lines for cohesion. Rigid 400 LOC cap could lead to artificial splits.

**Recommendation**: Amend to "400 LOC soft limit with justification for exceptions up to 500 LOC."

---

## Unresolved Open Questions

The plan contains 2 OPEN QUESTIONs that are **NOT RESOLVED**:

### OQ1: Target Release Versioning
> "Target Release를 1.0.185로 두는 것이 맞을까요, 아니면 1.0.183~1.0.184로 더 앞당겨 "Phase별 릴리즈 분할"이 필요할까요?"

**Critic Position**: Phase-per-release (1.0.183, 1.0.184, 1.0.185) is safer. Allows rollback at release boundary. Recommend 1 phase = 1 minor version increment.

### OQ2: Additional Modules
> "사용자 요약의 파일명(예: TaskCreateModal, WeeklyPlannerGrid 등)과 현재 코드베이스 실파일명이 다릅니다."

**Critic Position**: Analysis already resolved this. The plan correctly uses actual file names from the structural scan. No additional modules needed beyond BossAlbumModal noted above.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation Status |
|------|------------|--------|-------------------|
| dailyDataStore regression | High | High | ⚠️ Needs import map |
| Circular dependencies | Medium | High | ⚠️ Needs madge check |
| Test coverage gaps | High | Medium | ❌ No baseline |
| Facade accumulation | Low | Low | ⚠️ Needs timeline |
| Phase 2→3 blocking | Low | Medium | ✅ Dependencies clear |

---

## Recommendations Summary

1. **CRITICAL**: Add BossAlbumModal.tsx to Phase 3
2. **CRITICAL**: Establish test coverage baseline before Phase 1
3. **CRITICAL**: Add circular dependency verification step
4. **HIGH**: Document rollback strategy with git tags
5. **HIGH**: Generate dailyDataStore import map before slicing
6. **MEDIUM**: Add smoke test checklists per phase
7. **MEDIUM**: Write unit tests for parseInput before consolidation
8. **SUGGESTION**: Add LOC estimates and time estimates
9. **SUGGESTION**: Document facade deprecation timeline

---

## Questions for Planner

1. Is BossAlbumModal intentionally excluded (battle feature deprecation)? If not, which phase should include it?
2. What is the expected duration for each phase? (Days/weeks?)
3. Should Priority 2 files be added to a follow-up plan document?
4. Is there a preferred approach for the two TemplateModal files?

---

## Revision History

| Revision | Date | Summary |
|----------|------|---------|
| Initial | 2026-01-05 | First critique of Refactoring Plan v1.0 |

---

*Critique prepared by: Critic Agent*
*Next step: Address CRITICAL and HIGH findings before approving for implementation*

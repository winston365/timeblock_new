# 035 - Lint Cleanup Prioritized Execution Plan

**Status:** Draft  
**Created:** 2025-12-23  
**Source Analysis:** [034-lint-duplicate-imports-report-analysis.md](../analysis/034-lint-duplicate-imports-report-analysis.md)  
**Scope:** Frontend/UI only (no backend, Supabase, or Electron IPC logic)

---

## Value Statement

> As a developer, I want all lint warnings resolved with zero-warning CI policy maintained, so that builds remain green and code quality stays consistent without blocking UI iteration velocity.

---

## Executive Summary

Analyst findings confirm:
- **No duplicate-import errors remain** (prior fixes resolved these)
- **4 lint warnings** currently block CI (`max-warnings=0` policy)
- **Modal hotkey inconsistencies** create potential UX bugs
- **Coverage gaps** in critical services remain unaddressed

This plan provides a prioritized, implementable execution order.

---

## Scope Guardrails (What NOT To Change)

| ❌ Out of Scope | Rationale |
|----------------|-----------|
| Backend logic (`functions/`, Firebase Cloud Functions) | Not frontend/UI |
| Supabase schema or auth flows | Backend concern |
| Electron IPC handlers (`electron/main/`, `electron/preload/`) | Platform layer |
| Sync engine internals (`syncCore`, `conflictResolver` internals) | Requires backend knowledge |
| Repository pattern refactoring | Architectural change beyond lint scope |
| Coverage improvements for sync services | Requires integration test infrastructure |
| Relaxing `max-warnings=0` policy | Policy decision, not implementation |

| ✅ In Scope | Rationale |
|-------------|-----------|
| React components in `src/features/*` | UI layer |
| Custom hooks in `src/features/*/hooks/*` | UI behavior |
| Test file cleanup in `tests/*.test.ts` | Developer tooling |
| Modal hotkey hook usage in UI components | UX consistency |

---

## Priority Breakdown

### P0 — CI Blocker (Must Fix Immediately)

**Risk:** HIGH — CI fails, blocks all PRs  
**Effort:** LOW — 4 isolated warnings, straightforward fixes  
**ETA:** < 30 minutes

| # | Issue | File | Line(s) | Fix |
|---|-------|------|---------|-----|
| 1 | `todayTasks` dependency instability | `src/features/tasks/InboxTab.tsx` | L52 | Wrap `todayTasks` in `useMemo` before passing to callbacks |
| 2 | Unused `incrementProcessedCount` | `src/features/tasks/InboxTab.tsx` | L78 | Either wire to progress UI or remove destructure |
| 3 | `todayTasks` dependency instability | `src/features/tasks/hooks/useInboxHotkeys.ts` | L102 | Memoize `todayTasks` reference |
| 4 | Unused `createTask` helper | `tests/slot-finder.test.ts` | L15 | Delete import or add test using it |

**Acceptance Criteria:**
- [ ] `npm run lint -- --max-warnings=0` passes with 0 warnings
- [ ] No new warnings introduced
- [ ] Existing tests pass (`npm run test`)

---

### P1 — Partial Fixes / UX Consistency (Should Fix This Sprint)

**Risk:** MEDIUM — Inconsistent ESC/hotkey behavior causes user confusion  
**Effort:** MEDIUM — Requires careful hook migration without breaking modals  
**ETA:** 1-2 hours

These modals use `useModalHotkeys` instead of `useModalEscapeClose`, creating inconsistent ESC stack behavior:

| # | Issue | File | Line(s) | Fix |
|---|-------|------|---------|-----|
| 1 | ESC via `useModalHotkeys` not `useModalEscapeClose` | `src/features/goals/GoalsModal.tsx` | L56 | Migrate to `useModalEscapeClose` or document compliance |
| 2 | Custom ESC/close logic | `src/features/battle/components/BossAlbumModal.tsx` | L525-538 | Align with `useModalEscapeClose` pattern |
| 3 | Mixed hotkey handling | `src/features/template/TemplateModal.tsx` | L52-77 | Standardize on shared hook |
| 4 | Similar pattern | `src/features/goals/WeeklyGoalModal.tsx` | L41-69 | Standardize on shared hook |
| 5 | **Window listener bypassing stack** | `src/features/quickadd/QuickAddTask.tsx` | L137-158 | Replace global `window.addEventListener` with shared hook |

**Acceptance Criteria:**
- [ ] All listed modals close correctly on ESC press
- [ ] ESC respects modal stack (topmost closes first)
- [ ] No double-handler execution in QuickAddTask
- [ ] Manual test: open nested modal → ESC closes topmost only
- [ ] `useModalEscapeClose` or `useModalHotkeys` used consistently (pick one, document)

---

### P2 — Unresolved Issues / Technical Debt (Backlog)

**Risk:** LOW (short-term) — No immediate user impact  
**Effort:** HIGH — Requires test infrastructure and domain knowledge  
**ETA:** Defer to dedicated sprint

| # | Issue | Area | Recommendation |
|---|-------|------|----------------|
| 1 | Coverage gap: `unifiedTaskService` (58.88% lines, 69.04% branches) | Service layer | Add branch-focused tests for dual-storage edge cases |
| 2 | Coverage gap: `conflictResolver` (93.65% lines, 58.82% branches) | Sync layer | Add conflict-type branch tests |
| 3 | Coverage gap: `syncCore` (62.74% branches) | Sync layer | Add retry/failure branch tests |
| 4 | Repository boundary watchlist | Architecture | Add CI grep check for direct `dexieClient` imports outside `data/*` |
| 5 | `useModalHotkeys` vs `useModalEscapeClose` standardization decision | Architecture | Decide canonical pattern, update all modals |

**Acceptance Criteria (for future sprint):**
- [ ] Branch coverage for listed services ≥ 80%
- [ ] CI includes `dexieClient` import boundary check
- [ ] Modal hotkey pattern documented in architecture decision record

---

## Execution Checklist

```markdown
## P0 — CI Blocker (Do First)
- [ ] Fix InboxTab.tsx todayTasks memoization (L52)
- [ ] Fix/remove incrementProcessedCount (L78)
- [ ] Fix useInboxHotkeys.ts todayTasks dependency (L102)
- [ ] Fix/remove slot-finder.test.ts createTask (L15)
- [ ] Run `npm run lint -- --max-warnings=0` → 0 warnings
- [ ] Run `npm run test` → all pass

## P1 — Modal Hotkey Consistency (Do This Sprint)
- [ ] Review useModalEscapeClose vs useModalHotkeys semantics
- [ ] Migrate GoalsModal.tsx
- [ ] Migrate BossAlbumModal.tsx
- [ ] Migrate TemplateModal.tsx
- [ ] Migrate WeeklyGoalModal.tsx
- [ ] Refactor QuickAddTask.tsx window listener
- [ ] Manual test: nested modal ESC behavior

## P2 — Deferred (Backlog)
- [ ] Create coverage improvement ticket
- [ ] Create boundary check CI ticket
- [ ] Create ADR for modal hotkey pattern
```

---

## Open Questions (For Planner/Architect)

1. **useModalHotkeys compliance:** Should `useModalHotkeys` be considered compliant with ESC stack policy, or must all modals migrate to `useModalEscapeClose`?
   - *Impact:* P1 scope changes significantly based on answer

2. **QuickAddTask isolation:** For Electron window context, can we safely integrate `modalStackRegistry` or should we isolate via per-window listener with teardown tests?
   - *Impact:* Affects P1 fix approach

3. **Zero-warning policy flexibility:** Do we want to temporarily relax `max-warnings` to unblock other PRs while fixes land, or maintain strict policy?
   - *Impact:* P0 urgency level

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| P0 fix breaks existing behavior | Low | High | Run full test suite before merge |
| P1 modal migration causes ESC regression | Medium | Medium | Manual test each modal individually |
| P1 QuickAddTask refactor affects Electron context | Medium | Medium | Test in dev Electron build |
| P2 coverage work expands scope | High | Low | Strictly timebox; defer if needed |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-23 | Critic (via Analyst findings) | Initial draft |

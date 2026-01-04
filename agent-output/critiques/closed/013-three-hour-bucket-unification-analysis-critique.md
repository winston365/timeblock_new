# 013-three-hour-bucket-unification-analysis — Critique

- Artifact path: `agent-output/analysis/013-three-hour-bucket-unification-analysis.md`
- Related analysis: `agent-output/analysis/014-three-hour-bucket-ui-surfaces-analysis.md`
- Date: 2025-12-20
- Status: Revision 1

## Changelog
| Date | Handoff/Request | Summary |
|---|---|---|
| 2025-12-20 | User: “예고한 문서 작업 완성(리스크/테스트/숨은 의존성)” | Focus/Timeline/Mission/hourSlot cap/drag payload 기준으로 PR 체크리스트형 리스크·테스트·의존성 정리 추가 |
| 2025-12-20 | User: “Phase 2(FocusView/Timeline/Battle 등) 리스크/핫스팟 평가” | 화면/모듈별 리스크 등급(High/Medium/Low), 깨짐 핫스팟, 의존성/부수효과, 권장 변경 순서를 Phase 2 범위로 재정리 |

## Value Statement Assessment
- Value statement exists and is user-facing: unify time surfaces to 3-hour buckets while preserving `hourSlot` storage.
- Risk: “preserve hourSlot model” is underspecified (what does `hourSlot` mean post-unification: raw hour vs “bucket start hour”?). This ambiguity directly affects Timeline grouping, overtime math, calendar export semantics, and any feature that assumes hour precision.

## Phase 2 Scope Fit (UI-only, keep data model)
- Constraint is feasible: current code already demonstrates “write bucket start hour into hourSlot” in multiple entry points (e.g., Timeline add/drop, Focus inline add, Mission add).
- Primary risk is not storage, but **semantic drift**: `hourSlot` stops representing an exact hour and becomes “bucket anchor”. Downstream features won’t crash, but will behave differently.

## Overview
- Strengths: points to concrete hotspots (FocusView/TimelineView/MissionModal/HourBar) and existing utils (`threeHourBucket.ts`).
- Gaps: lacks explicit acceptance criteria (what must be true in Focus/Timeline/Mission after change), and lacks a single canonical policy for “max tasks” (per-hour vs per-bucket vs per-block).
- Update from 014: FocusView and MissionModal are already largely bucketized in data writes; TimelineView writes are bucketized but **visual scaffolding is still hour-granular**.

## Architectural Alignment
- Aligned with stated architecture constraints: keep `hourSlot` persistence but bucketize UI with shared utils.
- Misalignment risk: current implementation already mixes `hourSlot` and `bucketStart` in drag payload/location checks; without a clear contract, UI layers will diverge further.

## Scope Assessment
- Scope is appropriate for a migration inventory, but it mixes “direction” with implicit implementation behavior changes (caps, snapping, labels). Recommend explicitly calling those out as product-level rules.

## Module Risk Grades (Phase 2)

### FocusView — **Medium**
- Current state: bucket-scoped tasks and inline add are already bucket-based, but `slotLabel` still includes exact clock “HH:MM” (`formatBucketRangeLabel(...) · HH:MM`).
- Main risk: user mental model/UI text mismatch; functional breakage risk is moderate because FocusView also drives “active task”, memo autosave, PiP payloads and break transitions within the “current bucket task set”.

### TimelineView (incl. useTimelineData) — **High**
- Current state: add/click/drop paths normalize `hourSlot` to bucket start, but `useTimelineData` groups tasks by exact `hourSlot` into per-hour rows; rendering uses hourly grid and calculates overtime per hour.
- Main risk: shifting UI from 24 rows/hourGroups to bucket rows changes core layout assumptions and can cascade into DnD hit-testing, empty-slot click semantics, overtime warnings, and “show past blocks” visibility.

### MissionModal (Battle) — **Low**
- Current state: insertion already uses `currentBucketStartHour` for `hourSlot` and toasts, but error/mental model still says “현재 시간대”.
- Main risk: copy/edge handling when no block exists for current hour; limited blast radius.

### HourBar (legacy) — **Low → Medium (depends on usage)**
- If truly unused: low risk (dead code + stale persisted collapse keys only).
- If still reachable anywhere: medium risk because it enforces hour-based interactions/caps and can conflict with bucket UX.

### TempScheduleTimelineView — **Low**
- Uses `hourSlot * 60` for “main snapshot” positioning. This won’t crash if hourSlot becomes a bucket anchor, but it compresses tasks into bucket starts (semantic drift).

### timeBlockVisibility — **Low**
- Operates at 3h time-block level already; not directly impacted by bucket unification except where callers pass “current hour” derived from now. Tests exist and will catch regressions.

### googleCalendarService.taskToCalendarEvent — **Medium (semantic risk)**
- Export uses `task.hourSlot` as event start hour. If Phase 2 causes more tasks to share the bucket-start hour, calendar timelines will show collisions/stacking at e.g. 08:00.
- Likely not a runtime failure, but a user-visible behavior change.

### taskFactory — **Low**
- Default `hourSlot` is `block.start` when missing. This aligns with “bucket start as anchor” and should remain stable.

## Technical Debt Risks
- Drag payload contract ambiguity (hour vs bucket) can create non-deterministic DnD behavior across views.
- Hard-coded defaults (e.g., 15min) in Timeline/Mission can drift from `TASK_DEFAULTS`.
- Persisted HourBar collapse state may become orphaned if HourBar is removed/bucketized.
- Timeline’s hour-based grouping (`useTimelineData.hourGroups`) becomes a structural debt once most writers normalize `hourSlot` to bucket start; the UI will increasingly display “empty” hours.

## Findings
### Critical
- **Ambiguous drop target semantics (hourSlot vs bucketStart)** (OPEN)
  - Description: `DragData` includes both `sourceHourSlot` and `sourceBucketStart`. `isSameLocation` compares `targetHourSlot` against either field; callsites sometimes pass a bucket start hour (e.g., `ThreeHourBucket`), sometimes an actual hour slot (e.g., TimelineView).
  - Impact: false “same location” => drop ignored; or false “different” => cap enforcement triggers unexpectedly.
  - Recommendation: define a single canonical meaning for drop targets (either two explicit params or a normalized target struct) + add a pure util test matrix.

- **Max tasks policy diverges across surfaces** (OPEN)
  - Description: FocusView/HourBar enforce 3 per hour; ThreeHourBucket enforces 3 per bucket; Timeline modal/add path appears to bypass both.
  - Impact: inconsistent user constraints, overflow scenarios, and hard-to-debug “why can’t I add here?” toasts.
  - Recommendation: central policy (per bucket or per hour) enforced in one place (service/store), reused by all entry points.

### Medium
- **TimelineView overtime + grouping are still 1-hour primitives** (OPEN)
  - Description: `useTimelineData` groups by each `hour` and TimelineView calculates overtime minutes as `totalDuration - 60` per hour row.
  - Impact: once `hourSlot` is bucket start, overtime signals become misleading (only bucket-start rows can show overtime); “24행/시간대” UI diverges from schedule buckets.
  - Recommendation: define whether Timeline becomes bucket-row UI (8-ish rows) or stays hourly UI with a different, explicit meaning.

- **Orphaned HourBar collapse state** (OPEN)
  - Impact: stale `SYSTEM_KEYS.COLLAPSED_HOUR_BARS` data persists and may confuse future features.
  - Recommendation: migration/cleanup or compatibility shim.

- **Calendar export semantics change as hourSlot anchors** (OPEN)
  - Impact: users who rely on hour-precise exports will see events aligned to bucket start hours.
  - Recommendation: call this out as an intentional UX change or keep Timeline/hourSlot hour-precision in export-facing flows.

### Low
- **Tooltip/labels reinforce 1-hour mental model** (OPEN)
  - Impact: UX mismatch (bucket UI + hour tooltip).
  - Recommendation: show bucket range label.

- **FocusView slotLabel mixes bucket + exact clock** (OPEN)
  - Impact: user sees “버킷 기반”이면서도 여전히 시각 중심(HH:MM)으로 인지할 수 있어, ‘3시간 버킷 통일’ 목표와 충돌.
  - Recommendation: bucket range 중심으로 라벨을 단순화(또는 clock 표시는 보조 UI로 분리).

## Questions
- What is the post-migration invariant for `task.hourSlot` in UI-created tasks? (raw hour vs “bucket anchor”) 특히 Calendar export/Timeline grouping과의 관계는?
- Does the 3-task cap become per-bucket, per-hour, or per-block? (needs a single answer)
- For Timeline: is the goal “UI row model becomes buckets” or “UI stays hourly but actions are bucketized”? (현재는 후자에 가까움)
- Should MissionModal wording be “현재 버킷”으로 고정되나, 사용자가 다른 버킷을 선택할 수 있어야 하나?

## Risk Assessment
- Overall risk: High (multiple entry points; drag/drop contract ambiguity; user-visible policy drift)

## Breakage Hotspots (where changes most likely to break)
- TimelineView rendering contract: `hourLabels` + `hourGroups.find(g => g.hour === hour)` + overtime math (`totalDuration - 60`). Any migration to bucket rows breaks these assumptions.
- Timeline interactions: empty-click seeds `selectedHourSlot`, drop normalizes target; if UI row model changes, hit targets and “selectedHourSlot meaning” must stay consistent.
- Cross-feature semantics: calendar export uses `hourSlot` as absolute hour; Phase 2 increases the probability that many tasks share the same start hour.
- Legacy HourBar: if mounted, it can reintroduce hour-based writes/caps.

## Dependencies / Side Effects
- Tests:
  - Bucket helpers have direct tests (`tests/three-hour-bucket-utils.test.ts`).
  - Block visibility has direct tests (`tests/timeblock-visibility.test.ts`, `tests/time-block-visibility.test.ts`).
  - There are no obvious dedicated tests for Timeline UI grouping/overtime, so regressions may be integration/UX-only.
- Stores/repositories:
  - Timeline show/hide past blocks persists via `SYSTEM_KEYS.TIMELINE_SHOW_PAST` in systemRepository; bucketization should not change persistence semantics.
  - Daily task writes go through store/repository; Phase 2 is UI-only but will increase reliance on `threeHourBucket` utilities.
- Other features:
  - Gemini persona prompts include “현재 시간대” phrasing and current-hour concepts; not requested, but wording drift may become noticeable if product terminology standardizes on “버킷”.

## Recommended Change Order (safest → riskiest)
1) **MissionModal copy/alignment** (Low): wording “현재 버킷” + edge-case messaging; minimal dependencies.
2) **FocusView label cleanup** (Medium-low): keep bucket filtering; reduce HH:MM emphasis; validate PiP/memo/active task behavior stays bucket-scoped.
3) **Legacy HourBar confirmation** (Low/Medium): verify it is unused; if used, decide to deprecate or gate before Timeline refactor.
4) **Calendar export decision** (Medium): explicitly decide whether exports remain bucket-anchor-based or need hour precision; this avoids “silent behavior change” later.
5) **TimelineView structural unification** (High): decide row model (bucket rows vs hourly rows) first; then refactor `useTimelineData` grouping and overtime logic accordingly.

## Notes / Process Gaps
- Required reviewer doc `.github/chatmodes/planner.chatmode.md` was not found in this workspace path; unable to verify additional reviewer constraints beyond current mode instructions.

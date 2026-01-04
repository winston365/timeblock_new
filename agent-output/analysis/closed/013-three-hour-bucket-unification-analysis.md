# Value Statement and Business Objective
Unify every time-based surface to the 3-hour bucket presentation so users see a consistent schedule model (Focus, Timeline, battle/mission handoffs). Preserve the existing `hourSlot` data model but render and interact in 3h buckets to reduce cognitive load and prevent misaligned actions across screens.

# Objective
Inventory remaining 1-hour-centric UI/logic, rank remediation priority, and point to reusable 3h bucket utilities for migration.

# Context
- Schedule view already ships 3h buckets (`ThreeHourBucket`, `TimeBlockContent`) while retaining `hourSlot` per task.
- Prior decision: keep `hourSlot` for compatibility; bucketize UI via `floor(hour/3)*3`.

# Methodology
- Grep for `hourSlot`, `HourBar`, `currentHour`, hour labels, bucket helpers.
- Read Focus/Timeline/Battle/TempSchedule components and schedule utilities.

# Findings (facts)
- **FocusView (High)**: Still strictly 1h scoped. Current slot label and task filters use `currentHour` and `(currentHour + 1)` window; inline add enforces 3-task cap per hour and writes `hourSlot=currentHour` ([src/features/schedule/components/FocusView.tsx#L95-L192](src/features/schedule/components/FocusView.tsx#L95-L192)). PiP payloads and auto-completion logic also depend on the current hour task set.
- **TimelineView (High)**: Vertical timeline renders hour labels per hour and handles drag/drop by `hour` granularity; modal defaults `selectedHourSlot=hour` and drop updates `hourSlot=targetHour` ([src/features/schedule/TimelineView/TimelineView.tsx#L59-L250](src/features/schedule/TimelineView/TimelineView.tsx#L59-L250)). Overtime warnings and empty-slot clicks are computed per hour, not per bucket.
- **HourBar (Medium/Legacy)**: 1h UI component with per-hour task cap, collapse state, and current-hour toasts ([src/features/schedule/HourBar.tsx#L16-L200](src/features/schedule/HourBar.tsx#L16-L200)). Collapse state persisted as `collapsedHourBars` in system repository ([src/data/repositories/systemRepository.ts#L22](src/data/repositories/systemRepository.ts#L22)). If still mounted anywhere, it fights bucket UX; if unused, dead code + stale state keys remain.
- **MissionModal (Battle) (Medium)**: "Add to current hour" uses `now.getHours()`, derives block via `getBlockIdFromHour`, and writes `hourSlot=currentHour` with hour-formatted toast ([src/features/battle/components/MissionModal.tsx#L214-L230](src/features/battle/components/MissionModal.tsx#L214-L230)). Still hour-specific.
- **TempScheduleTimelineView (Low, editor)**: Preview and layout derive start minutes from `hourSlot * 60` or block start ([src/features/tempSchedule/components/TempScheduleTimelineView.tsx#L109-L116](src/features/tempSchedule/components/TempScheduleTimelineView.tsx#L109-L116)). Secondary surface; hour-based assumption persists.
- **TimelineTaskBlock tooltip**: Shows `hourSlot` label in title (`hh:00`) ([src/features/schedule/TimelineView/TimelineTaskBlock.tsx#L37-L66](src/features/schedule/TimelineView/TimelineTaskBlock.tsx#L37-L66)), reinforcing 1h mental model.
- **Existing 3h utilities to reuse**: `getBucketStartHour`, `getBucketEndHour`, `getBucketStartHoursForBlock`, `getEffectiveHourSlotForBucketInBlock` ([src/features/schedule/utils/threeHourBucket.ts#L1-L40](src/features/schedule/utils/threeHourBucket.ts#L1-L40)). Already used by `TimeBlockContent`/`ThreeHourBucket` for schedule UI ([src/features/schedule/components/TimeBlockContent.tsx#L26-L108](src/features/schedule/components/TimeBlockContent.tsx#L26-L108)). Drag/drop helper `useDragDrop` captures `sourceBucketStart` but still updates by `hourSlot` ([src/features/schedule/hooks/useDragDrop.ts#L27-L86](src/features/schedule/hooks/useDragDrop.ts#L27-L86)).

# Analysis (hypotheses)
- FocusView logic (recommendations, PiP, auto-complete) should pivot to bucket-scoped task sets; otherwise users see a different task list than schedule buckets show.
- TimelineView hour-level markers may stay for visual precision, but interactions (empty click, drag target, modal default) likely need bucket mapping to avoid misplacing tasks relative to bucketed schedule UI.
- HourBar collapse state might linger in Dexie/system state; migrating/removing it avoids conflicting persistence once buckets dominate.
- MissionModal should probably drop tasks into the current bucket start (or allow bucket select) to align with schedule UI; otherwise missions appear in an hour slice that is visually hidden.

# Recommendations (direction only)
1) **FocusView**: Replace per-hour window with 3h bucket window using `getBucketStartHour(now.getHours())` and `getBucketEndHour`. Filter tasks by bucket start, adjust inline add cap to per-bucket, and update PiP/auto-complete/recommendation sets to bucket scope.
2) **TimelineView**: Keep minute-level geometry but snap interactions to bucket start: empty click seeds `hourSlot=getBucketStartHour(hour)`, drop target uses bucket start, modal defaults bucket start. Consider rendering bucket headers instead of 24 labels to reduce cognitive dissonance. Update tooltips to show bucket ranges.
3) **HourBar**: Confirm usage. If obsolete, deprecate and clean `collapsedHourBars` state; if still needed (e.g., legacy view), wrap it as a 3h bucket component or gate behind feature flag.
4) **MissionModal**: Map current time to bucket start before creating tasks; update toast copy to 3h wording (e.g., `08:00-11:00 버킷`). Optionally allow choose bucket.
5) **TempSchedule/Editor**: Low priority; align `hourSlot` usage to bucket start for snapshots or clarify as raw-hour editor-only behavior.
6) **Tooltip/labels**: Replace hour-specific labels in timeline/task blocks with bucket range labels to match main schedule visuals.
7) **Leverage existing utils**: Standardize on `threeHourBucket` helpers for all mappings; avoid introducing new bucket math.

# Open Questions
- Should FocusView show only the active bucket or allow paging between buckets within the current block?
- What cap replaces the "3 tasks per hour" rule—per bucket or per block?
- For TimelineView, do we still need per-minute drag precision inside a bucket, or should snaps be to bucket start?
- Any feature flags needed for HourBar removal to avoid breaking stored UI state?
- Should MissionModal allow selecting a different bucket than "current" to avoid late-night null-block cases?

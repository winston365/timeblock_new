Value Statement and Business Objective
- Keep UI grouping aligned with canonical TIME_BLOCKS (05-08, 08-11, …, include wrap-around) to avoid user-visible regressions from artificial 0/3/6 buckets while preserving existing hourSlot data and minimizing front-end churn.

Changelog
- Initial analysis for reverting UI bucketing to TIME_BLOCKS; no code changes.

Objective
- Identify all places assuming fixed 3-hour (0/3/6/…) buckets.
- Propose TIME_BLOCKS-based helpers and wrap-around handling for UI grouping/labels.
- Outline low-risk change order across Schedule list/Timeline/Focus/Mission modal and test adds.

Context
- Current UI bucketing introduced via threeHourBucket utilities (size=3). Timeline/Focus/Mission derive labels, capacities, and colors from bucketStartHour multiples of 3. TIME_BLOCKS in domain.ts still defines 05-08 … 20-23 (no 23-05), and task.timeBlock already exists.

Root Cause
- threeHourBucket abstractions normalized hourSlot to 3-hour buckets independent of TIME_BLOCKS, hardcoding 0/3/6 boundaries (BLOCK_BOUNDARIES, BLOCK_BACKGROUND_COLORS) and labels, causing divergence from product-defined TIME_BLOCKS and missing wrap-around handling.

Methodology
- Read schedule utilities and views, focus view, mission modal, TIME_BLOCKS definitions, and existing timeBlockUtils mapping functions.

Findings (facts)
- 3h bucket helpers define size=3, boundary math, labels, and capacity checks in [src/features/schedule/utils/threeHourBucket.ts](src/features/schedule/utils/threeHourBucket.ts#L1-L84).
- Timeline uses 3h assumptions: BLOCK_BOUNDARIES [0,3,…,24] in [src/features/schedule/TimelineView/useTimelineData.ts](src/features/schedule/TimelineView/useTimelineData.ts#L18-L131); bucket grid/label rendering and color map keyed by 0/3/6… in [src/features/schedule/TimelineView/TimelineView.tsx](src/features/schedule/TimelineView/TimelineView.tsx#L17-L890), notably BLOCK_BACKGROUND_COLORS at L46-L56 and bucketStartHours generation at L375-L379.
- Focus view derives current slot label/timer and capacity from bucketStartHour math in [src/features/schedule/components/FocusView.tsx](src/features/schedule/components/FocusView.tsx#L28-L195).
- Mission modal adds missions into current bucket via getBucketStartHour and capacity check in [src/features/battle/components/MissionModal.tsx](src/features/battle/components/MissionModal.tsx#L29-L235).
- Task-level drag/drop and inline add normalize to bucketStartHour (TaskCard, ThreeHourBucket, useDragDrop) reinforcing 3h boundaries; TaskCard sourceBucketStart in [src/features/schedule/TaskCard.tsx](src/features/schedule/TaskCard.tsx#L18-L130), ThreeHourBucket inline add/drop in [src/features/schedule/components/ThreeHourBucket.tsx](src/features/schedule/components/ThreeHourBucket.tsx#L1-L120).
- TIME_BLOCKS canonical list still 05-08 … 20-23 without wrap-around in [src/shared/types/domain.ts](src/shared/types/domain.ts#L856-L863); timeBlockUtils exposes getBlockIdFromHour without wrap in [src/shared/utils/timeBlockUtils.ts](src/shared/utils/timeBlockUtils.ts#L104-L121).

Findings (hypotheses)
- Adding wrap-around block (23-05) to TIME_BLOCKS is required for faithful mapping; otherwise hours 23-04 will map to null, forcing fallback to artificial buckets.
- UI coloring and boundary lines should derive from TIME_BLOCKS start hours; current BLOCK_BACKGROUND_COLORS will misalign once TIME_BLOCKS-driven ranges are non-uniform.
- Capacity rules likely remain per bucket but need to follow TIME_BLOCKS-aligned groupings (possibly variable durations if TIME_BLOCKS change length).

Recommendations
- Introduce TIME_BLOCKS-based helpers (likely in timeBlockUtils or new timeBlockBucketUtils): getTimeBlockForHour(hour) with wrap support; getTimeBlockStartHour(hour) returning block.start; formatTimeBlockLabel(block) using block.label; optionally map hourSlot→block using TIME_BLOCKS and task.timeBlock as primary.
- Update TIME_BLOCKS to include wrap-around entry (e.g., { id: '23-5', start: 23, end: 5, label: '23:00 - 05:00' }) and ensure getBlockIdFromHour supports start>end wrap.
- Replace threeHourBucket usage in UI surfaces with TIME_BLOCKS helpers: Timeline bucket grid generation from TIME_BLOCKS starts, colors keyed by block ids/start hours, labels from formatTimeBlockLabel; Focus current slot and remainingMinutes from TIME_BLOCKS duration; Mission modal scheduling chooses block via getTimeBlockForHour and capacity within that block.
- Prioritize task.timeBlock when present; if missing, derive from hourSlot via getTimeBlockForHour to avoid mis-binning legacy data.
- Keep hourSlot model intact but store normalized hourSlot as block.start (or effective slot within wrap) for consistent ordering; ensure wrap case maps 23-05 hours to 23.

Minimal-Risk Change Order
1) Utilities: add TIME_BLOCKS-based helpers + wrap-aware getBlockIdFromHour; add wrap block to constants; maintain existing threeHourBucket until migration complete.
2) Timeline: swap bucketStartHours and BLOCK_BOUNDARIES/BLOCK_BACKGROUND_COLORS to TIME_BLOCKS-driven ranges; labeling via formatTimeBlockLabel; drop THREE_HOUR_BUCKET_SIZE coupling.
3) Focus: compute current slot, remainingMinutes, capacity using TIME_BLOCKS helper and block duration.
4) Mission modal & Task add/drag: use new helpers for block detection and capacity; normalize hourSlot to block.start.
5) Remove/retire threeHourBucket once all consumers migrated.

Test Points (vitest, pure utils where possible)
- Utility: getTimeBlockForHour and getTimeBlockStartHour covering wrap (22→20-23, 23→23-05, 2→23-05, 5→5-8) and null outside defined blocks if any.
- Labeling: formatTimeBlockLabel returns TIME_BLOCKS labels including wrap.
- Capacity mapping: countItemsInBucket replacements correctly bin hourSlot within wrap block; ensure drag/drop normalization respects wrap start.
- Timeline rendering helpers: bucket generation from TIME_BLOCKS preserves ordering and handles wrap without duplicates.

Open Questions
- Should TIME_BLOCKS gain explicit 23-05 entry, or is an existing config elsewhere expected to supply it? If lengths vary, does capacity stay fixed at MAX_TASKS_PER_BUCKET?
- Do color schemes need per-block overrides once ranges are TIME_BLOCKS-based rather than every 3 hours?
- For tasks lacking timeBlock but with hourSlot outside TIME_BLOCKS (e.g., 00-04 currently null), should we auto-assign to wrap block or leave unassigned?

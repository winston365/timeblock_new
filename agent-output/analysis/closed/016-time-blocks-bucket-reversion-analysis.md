# Value Statement and Business Objective
Restore the canonical TIME_BLOCKS (05–08, 08–11, 11–14, 14–17, 17–20, 20–23) across scheduling UIs so users see their familiar labels/ranges while the hour bar is removed, preventing misaligned 3-hour buckets and capacity checks that distort scheduling.

# Changelog
- Reviewed canonical TIME_BLOCKS definition and time block utilities.
- Inspected bucket utilities and UI consumers using fixed 0/3/6 buckets.
- Mapped affected components (TimelineView, ThreeHourBucket, FocusView, MissionModal) and noted existing TIME_BLOCKS-aware helper (timeBlockBucket).

# Objective
Identify current TIME_BLOCKS structure and pinpoint files/functions that still rely on fixed 3-hour buckets, outlining where to swap to TIME_BLOCKS-based boundaries and labels.

# Context
- TIME_BLOCKS is the canonical definition: [src/shared/types/domain.ts#L436-L443](src/shared/types/domain.ts#L436-L443).
- There are two bucket helpers:
  - Fixed 3-hour helper using floor(hour/3): [src/features/schedule/utils/threeHourBucket.ts#L1-L61](src/features/schedule/utils/threeHourBucket.ts#L1-L61).
  - TIME_BLOCKS-aware helper that normalizes to block.start and labels via TIME_BLOCKS: [src/features/schedule/utils/timeBlockBucket.ts#L1-L52](src/features/schedule/utils/timeBlockBucket.ts#L1-L52).

# Root Cause
Legacy migration introduced a fixed 0/3/6 bucket helper (threeHourBucket) and wired TimelineView/ThreeHourBucket to it. This overrides the canonical TIME_BLOCKS boundaries (05–08…), leading to mismatched bucket starts, labels, and capacity checks versus the intended blocks.

# Methodology
Read and compared domain constants and bucket utilities, then traced bucket usage in key UI surfaces: TimelineView (schedule view), ThreeHourBucket component, FocusView, and MissionModal.

# Findings
- Fact: TIME_BLOCKS are 6 blocks with ids `5-8`, `8-11`, `11-14`, `14-17`, `17-20`, `20-23` with labels matching those ranges ([src/shared/types/domain.ts#L436-L443](src/shared/types/domain.ts#L436-L443)).
- Fact: threeHourBucket uses `Math.floor(hour/3)*3` start hours and labels like `00:00-03:00`, not the canonical TIME_BLOCKS boundaries ([src/features/schedule/utils/threeHourBucket.ts#L1-L33](src/features/schedule/utils/threeHourBucket.ts#L1-L33)).
- Fact: ThreeHourBucket component renders labels via `formatBucketRangeLabel` from the fixed helper and sets `hourSlot`/drop targets to those 0/3/6 buckets ([src/features/schedule/components/ThreeHourBucket.tsx#L7-L114](src/features/schedule/components/ThreeHourBucket.tsx#L7-L114)).
- Fact: TimelineView builds `bucketStartHours` using `THREE_HOUR_BUCKET_SIZE` (3) and normalizes drop targets via the fixed helper; its labels also come from that helper, so the UI grid is 0/3/6-based despite TIME_BLOCKS awareness elsewhere ([src/features/schedule/TimelineView/TimelineView.tsx#L31-L131](src/features/schedule/TimelineView/TimelineView.tsx#L31-L131)).
- Fact: A TIME_BLOCKS-based bucket helper already exists (`timeBlockBucket`) that returns block.start and labels via TIME_BLOCKS, but TimelineView/ThreeHourBucket are not using it ([src/features/schedule/utils/timeBlockBucket.ts#L1-L52](src/features/schedule/utils/timeBlockBucket.ts#L1-L52)).
- Fact: FocusView capacity uses `isBucketAtCapacity(currentBlockTasks.length)` without per-bucket grouping; it passes `currentBlock.start` when creating tasks, so it is aligned to TIME_BLOCKS starts but ignores intra-block buckets ([src/features/schedule/components/FocusView.tsx#L67-L122](src/features/schedule/components/FocusView.tsx#L67-L122)).
- Fact: MissionModal adds tasks at `block.start` and caps using total tasks in the block, not per bucket; there is also a stray duplicated `hourSlot` assignment near insertion ([src/features/battle/components/MissionModal.tsx#L120-L174](src/features/battle/components/MissionModal.tsx#L120-L174)).
- Hypothesis: Bucket grouping in useTimelineData likely still assumes 3-hour fixed segments; swapping TimelineView to TIME_BLOCKS helper may require parallel updates there to keep group boundaries consistent.

# Recommendations
- Replace imports of `threeHourBucket` in TimelineView and ThreeHourBucket with the TIME_BLOCKS-aware `timeBlockBucket` (or a renamed `getTimeBlockForHour` wrapper) so bucket starts/labels come from TIME_BLOCKS. Generate bucketStartHours from TIME_BLOCKS boundaries rather than `THREE_HOUR_BUCKET_SIZE`.
- Use TIME_BLOCKS labels (or `block.label`) for bucket headings instead of computed `00:00-03:00` ranges; fallback to range when outside defined blocks.
- Ensure drop normalization and capacity checks leverage TIME_BLOCKS block.start (existing normalizeDropTargetHourSlot in timeBlockBucket covers this).
- Audit useTimelineData grouping logic to align its bucket groups with TIME_BLOCKS starts/ends after the swap.
- Clean MissionModal insertion to a single `hourSlot: block.start` and, if per-bucket caps are required, switch to countItemsInBucket; otherwise document that it caps per block.

# Open Questions
- Should capacity remain per block (as in FocusView/MissionModal) or per TIME_BLOCK bucket? Clarify expected limit semantics.
- Are tasks allowed outside 05–23? If yes, what labels/ranges should apply for off-hours once threeHourBucket is removed?
- Should TimelineView still show any grid for hours outside TIME_BLOCKS (e.g., night), or hide them entirely with hour bar removal?

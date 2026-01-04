## Meta
- Date: 2025-12-23
- Status: Planned
- Changelog:
	- 2025-12-23: Schedule task limit 제거 + Inbox→TimeBlock 즉시 반영(PR 계획) 범위에서 이 분석을 참조하도록 상태 업데이트.

# Value Statement and Business Objective
- Align Focus, Timeline, and Battle mission flows to the 3-hour bucket model so task surfacing, creation, and drag/drop stay consistent across the app, reducing user confusion and over-allocation within a bucket.

# Objective
- Map where 1-hour or current-hour assumptions remain in FocusView, Timeline, and MissionModal.
- Clarify how each surface currently derives and uses hourSlot/current-hour state.
- Anticipate code touchpoints when shifting to 3-hour buckets.

# Context
- Schedule view already introduced three-hour bucket helpers (getBucketStartHour, normalizeDropTargetHourSlot, MAX_TASKS_PER_BUCKET). Other surfaces may still assume 1-hour slots or per-hour grouping.
- Prior memory: FocusView and Timeline still lean on per-hour concepts; MissionModal adds to current hour.

# Methodology
- Code read of Focus, Timeline, MissionModal, and supporting timeline hook/components.
- Grep scan for hourSlot/currentHour usage across features.

# Findings (fact unless marked "hypothesis")

## FocusView (Focus screen)
- Current time state: derives currentHour/minute from now, converts to bucket start/end via getBucketStartHour/getBucketEndHour, and displays slotLabel combining bucket range + exact HH:MM clock [src/features/schedule/components/FocusView.tsx#L96-L183].
- Task scope: filters tasks to current bucket by bucket start hour and sorts by order; recommendedTask and upcomingTasks operate only inside that bucket [src/features/schedule/components/FocusView.tsx#L114-L170].
- Capacity: prevents inline add when bucket at MAX_TASKS_PER_BUCKET and uses bucket start hour when creating inline tasks [src/features/schedule/components/FocusView.tsx#L154-L178].
- Progress UI: completionPercentage and header text label the bucket but copy still says "현재 버킷"; logic counts only tasks in current bucket [src/features/schedule/components/FocusView.tsx#L380-L430].
- PiP and break logic: PiP payloads reference current bucket tasks; no explicit per-hour assumptions beyond current clock display [src/features/schedule/components/FocusView.tsx#L200-L360].
- Net: FocusView mostly bucketized, but the user-facing slot label and mental model still surface the exact current hour, not the 3-hour bucket label alone.

## Timeline (Schedule TimelineView)
- Layout: hourGroups build a map for every visible hour (05-23) and group tasks by exact hourSlot; visibleStartHour hides past blocks based on current block start but grouping stays per hour [src/features/schedule/TimelineView/useTimelineData.ts#L24-L140].
- Rendering: hourLabels renders 24 hourly rows; block backgrounds use 3-hour boundaries, but tasks and overtime markers remain hour-granular [src/features/schedule/TimelineView/TimelineView.tsx#L70-L210, L240-L340].
- Interaction: clicking empty hour opens TaskModal with selectedHourSlot set to getBucketStartHour(hour); modal save normalizes bucket and enforces per-bucket capacity, but the UI still shows per-hour rows [src/features/schedule/TimelineView/TimelineView.tsx#L200-L270].
- Drag/drop: drag data captures sourceBucketStart; drop normalizes targetHour to bucket start, enforces bucket capacity, and updates task.hourSlot to bucket start hour [src/features/schedule/TimelineView/TimelineView.tsx#L280-L350].
- TimelineTaskBlock tooltip: shows bucket label derived from task.hourSlot bucket start, but still one block per hour row [src/features/schedule/TimelineView/TimelineTaskBlock.tsx#L60-L110].
- Net: Data writes are bucketized, but UI scaffolding (hour rows, overtime calc per hour, grouping in useTimelineData) remains 1-hour based. Bucket counts are enforced when adding/dropping, yet overflow warning (overtimeHours) is per hour rather than per bucket.

## Battle / MissionModal
- Availability: mission filtering uses shouldShowMissionByTime with current Date; tier logic unrelated to hourSlot [src/features/battle/components/MissionModal.tsx#L61-L150].
- Add to schedule: handleAddMissionToSchedule picks currentHour, derives currentBucketStartHour, finds blockId via getBlockIdFromHour(currentHour), enforces bucket capacity via countItemsInBucket on that block, and writes task.hourSlot as currentBucketStartHour [src/features/battle/components/MissionModal.tsx#L178-L238].
- UX text: success toast references bucket label; error when no block for current hour [src/features/battle/components/MissionModal.tsx#L205-L236].
- Net: Mission insertion already targets bucket start but the trigger concept is "현재 시간대" tied to exact hour; assumes a block exists covering current hour.

## Other hourSlot / 1-hour surfaces (scan highlights)
- Hour-based grouping persists in useTimelineData (hourGroups) and overtime checks per hour [src/features/schedule/TimelineView/useTimelineData.ts#L60-L140].
- HourBar legacy component uses hour-level drag/drop hourSlot writes [src/features/schedule/HourBar.tsx#L260-L320].
- timeBlockVisibility helpers treat "currentHour" as hour precision for past/current/future checks [src/features/schedule/utils/timeBlockVisibility.ts#L45-L80].
- Google Calendar export fallback uses hourSlot or block.start (hour) defaults, no bucket mapping [src/shared/services/calendar/googleCalendarService.ts#L260-L300].
- TempScheduleTimelineView positions tasks by hourSlot*60 minutes; no bucket awareness [src/features/tempSchedule/components/TempScheduleTimelineView.tsx#L100-L140].
- Defaults/taskFactory calculate hourSlot from block.start (hour) when absent; bucket-neutral but stays 1-hour granularity [src/shared/utils/taskFactory.ts#L90-L200].

# Expected Change Impact (3-hour bucket unification)
- FocusView: keep bucket filtering; adjust user-facing labels to emphasize bucket range (e.g., 08-11) and reconsider progress text that says "이번 버킷" while still showing exact HH:MM. Ensure any future logic (e.g., recommended task cap) references bucket size not hour.
- Timeline: major UI shift needed—hour rows and hourGroups should be bucket or 3-hour segments if full unification is desired. Overtime and empty-state hints should aggregate per bucket, and drag targets may need to expose bucket-sized drop zones instead of every hour line. Modal defaults already bucketize but grouping/rendering does not.
- MissionModal: concept text could align to bucket ("현재 버킷"), and block resolution should consider bucket start; if timeline UI moves to buckets, the existence check for block should align with bucket spans.
- Cross-surface: HourBar, temp schedule timeline, calendar export, and timeBlockVisibility still reason in 1-hour increments; they may need bucket mapping or explicit decision to remain hour-based.

# Open Questions
- Should Timeline display collapse to bucket rows (8 buckets) or retain 24-hour granularity with bucketized operations only?
- Do overtime warnings move to bucket-level sums or stay per hour?
- For MissionModal, should "현재 시간대" snap to the bucket containing now (already does in data) and should error messaging reference bucket instead of hour?
- Should legacy HourBar and temp schedule views be deprecated or re-bucketized to avoid conflicting mental models?

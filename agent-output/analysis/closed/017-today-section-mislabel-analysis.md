Value Statement and Business Objective
- Prevent date-boundary mislabeling so the “오늘” section always reflects the correct local-day tasks across day/week/month schedule views, avoiding user trust erosion near midnight and in UTC+ offsets.

Changelog
- New analysis doc capturing reproduction steps, top 3 hypotheses, and verification points for the “오늘” section showing yesterday’s tasks.

Objective
- Provide minimal reproduction for day/week/month schedule views, surface top 3 root-cause hypotheses, and identify where/how to instrument logs to confirm.

Context
- The schedule list with “오늘/내일/지난 일정” labels lives in TempScheduleModal’s right panel. Date grouping and “today” detection rely on custom helpers rather than shared local-date utilities.
- Key code points:
  - UTC-based today string and grouping in [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx#L45-L72) and [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx#L224-L276).
  - Navigation that sets selectedDate via UTC strings in [src/features/tempSchedule/stores/tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts#L296-L329).
  - Week/month date grids generated with UTC strings in [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx#L24-L37) and [src/features/tempSchedule/components/MonthlyScheduleView.tsx](src/features/tempSchedule/components/MonthlyScheduleView.tsx#L32-L56).

Methodology
- Read TempSchedule task list grouping, TempSchedule store navigation, weekly/monthly date builders, and supporting utils (getLocalDate vs toISOString usage) to trace where “today” is derived and how sections are grouped.

Reproduction Steps (minimal, per view)
- Preconditions: System timezone UTC+9 (KST-like). Create a one-time temp schedule task dated “yesterday” (e.g., 23:00–23:30). Set system clock to 00:05 local.
- Day view: Open TempSchedule (Ctrl+Shift+Space if wired), ensure view mode = 일간. Observe right-panel “오늘” 그룹이 어제 일정 포함.
- Week view: In the same state, switch to 주간. Right-panel “오늘” 그룹 여전히 어제 일정 포함 (same list component reused); weekly grid may highlight previous-day column if go-to-today was used near midnight.
- Month view: Switch to 월간. Right-panel “오늘” 그룹 동일 증상. Calendar grid “오늘” badge may also lag if selectedDate was set via goToToday around midnight.

Root-Cause Hypotheses (Top 3)
1) UTC-based today detection in list grouping (highest confidence): getTodayStr uses `new Date().toISOString().split('T')[0]`, so in UTC+ offsets between local 00:00–09:00, “today” resolves to the previous calendar day. Grouping then treats yesterday’s scheduledDate as diff=0 → label “오늘”. Code: [TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx#L45-L72) and grouping at [TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx#L224-L276).
2) Navigation and date builders use UTC strings (medium confidence): goToPrevious/goToNext set selectedDate via `toISOString().split('T')[0]` ([tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts#L296-L329)), and week/month grids also emit date strings via toISOString ([WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx#L24-L37), [MonthlyScheduleView.tsx](src/features/tempSchedule/components/MonthlyScheduleView.tsx#L32-L56)). Around midnight in UTC+ zones, pressing “오늘”/prev/next or recomputing week ranges can shift selectedDate one day back, aligning the list to yesterday.
3) Mixed UTC parsing with Math.ceil day diff (lower confidence): getDaysDiff builds Date objects from `YYYY-MM-DD` (parsed as UTC) and applies Math.ceil. Combined with UTC “today”, tasks without scheduledDate (falling back to UTC-today) can drift across boundaries and be grouped into “오늘/지난 일정” incorrectly when local time crosses midnight.

Verification / Logging Plan
- Hypothesis 1: Add temporary console.trace in groupTasksByDate to log `{ local: getLocalDate(), utcIso: new Date().toISOString(), todayStr: getTodayStr(), scheduledDate, diff }` before grouping, during local 00:00–01:00. File point: [TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx#L224-L276).
- Hypothesis 2: Log selectedDate transitions inside goToPrevious/goToNext/goToToday and after calculateWeekDates/calculateMonthDates generation (first element, last element) to detect UTC-backshift. Files: [tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts#L296-L329), [WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx#L24-L37), [MonthlyScheduleView.tsx](src/features/tempSchedule/components/MonthlyScheduleView.tsx#L32-L56).
- Hypothesis 3: Log getDaysDiff inputs/outputs when scheduledDate is null or equals yesterday vs today around midnight; confirm whether Math.ceil produces unexpected 0/1 with UTC bases. File: [TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx#L53-L69).

Findings (fact vs hypothesis)
- Fact: today string for grouping is UTC-based; not aligned with shared getLocalDate. (Hypothesis 1 → strong.)
- Fact: navigation and week/month builders emit UTC date strings; goToToday uses local date, creating mixed bases. (Hypothesis 2 → plausible contributor.)
- Hypothesis: Math.ceil + UTC parsing could exacerbate off-by-one when baseDate is already UTC-shifted. (Hypothesis 3 → needs data.)

Recommendations
- First confirm hypothesis 1 via midnight logging; if reproduced, switch today/selected-date derivation to getLocalDate for grouping and navigation.
- Capture before/after logs when toggling “오늘” button vs prev/next near midnight to see selectedDate drift.
- If Math.ceil proves noisy, consider floor with normalized local midnight, but only after confirming with real timestamps.

Open Questions
- Do users report the issue only around local midnight, or also in other timezones (UTC- offsets)?
- Are scheduledDate values always user-entered local dates, or can external sync (Google Tasks) inject UTC-normalized strings that differ from local intent?
- Is the issue observed in main ScheduleView (daily tasks) or only in TempSchedule modal? If main view also mislabels, additional audit of other toISOString usages (TimelineView) is needed.

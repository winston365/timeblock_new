# Value Statement and Business Objective
Accurately identifying and labeling the current day in the schedule list avoids user-facing mislabels (e.g., blank/incorrect "오늘") and prevents date-shift bugs caused by UTC-based keys.

## Changelog
- Located frontend code paths that generate schedule list section labels and determine the notion of "today".
- Identified UTC-based date key creation spots likely to drift from local day boundaries.

## Objective
Map the concrete frontend code locations that (a) build the schedule list section labels (오늘/지난 일정 등) and (b) define the "today" baseline used by calendar/navigation. Surface high-risk UTC date key usages.

## Context
User reported a mislabel/blank issue for "오늘" in the schedule list. Scope limited to frontend UI/utils (no backend/IPC). Need file paths, function names, and candidate UTC date-key lines.

## Root Cause (current understanding)
Not yet confirmed. Potential mismatch between local-day calculations (getLocalDate) and UTC-sliced ISO strings (toISOString().split('T')[0]) that can shift keys around midnight.

## Methodology
- Regex search for 오늘/지난 일정/isToday/toISOString/YY-MM-DD/dayKey/dateKey.
- Focused read of schedule UI (TempScheduleTaskList, TimelineView), date selection store, and shared date utils/defaults.

## Findings (facts unless noted)
- **Schedule list grouping & labels**: [src/features/tempSchedule/components/TempScheduleTaskList.tsx#L242-L307](src/features/tempSchedule/components/TempScheduleTaskList.tsx#L242-L307) `groupTasksByDate` computes `diff = getDaysDiff(date)` and assigns labels/emoji/sortOrder for `past -> '지난 일정'`, `diff===0 -> '오늘'`, `diff===1 -> '내일'`, `diff<=7 -> '이번 주'`, else `다가오는 일정`. Uses `getTodayStr()`→`getLocalDate()` as baseline.
- **Relative day math**: [src/features/tempSchedule/components/TempScheduleTaskList.tsx#L45-L89](src/features/tempSchedule/components/TempScheduleTaskList.tsx#L45-L89) defines `getTodayStr()` (delegates to `getLocalDate()`), `getDaysDiff()` (local Date parse, ceiling day diff), and `getDDayLabel()` (returns '오늘', '내일', etc.). This is the core day-key logic feeding grouping.
- **Schedule list header/right panel**: [src/features/tempSchedule/components/TempScheduleTaskList.tsx#L495-L566](src/features/tempSchedule/components/TempScheduleTaskList.tsx#L495-L566) `TempScheduleTaskListComponent` renders the right-panel header "📋 스케줄 목록" and per-group section headers with counts and styling for '오늘' vs '지난 일정'.
- **Selected date / navigation baseline**: [src/features/tempSchedule/stores/tempScheduleStore.ts#L269-L335](src/features/tempSchedule/stores/tempScheduleStore.ts#L269-L335) the Zustand store initializes `selectedDate` to `getLocalDate()`, provides `setSelectedDate(date)`, and `goToToday()` which resets `selectedDate` to `getLocalDate()`. Prev/next navigation adjusts the stored date then normalizes via `getLocalDate(current)`.
- **Timeline overlay today key (temp schedule)**: [src/features/schedule/TimelineView/TimelineView.tsx#L95-L114](src/features/schedule/TimelineView/TimelineView.tsx#L95-L114) computes `const today = getLocalDate();` with a comment warning that UTC `toISOString` keys misalign with local days. This `today` key is passed to `getTempTasksForDate(today)` to draw ghost blocks.

## High-risk UTC "today key" usages (exact lines)
- [src/shared/constants/defaults.ts#L123-L127](src/shared/constants/defaults.ts#L123-L127): `getDefaultDeadline: () => new Date().toISOString().split('T')[0],`
- [src/features/tempSchedule/components/MonthlyScheduleView.tsx#L54-L60](src/features/tempSchedule/components/MonthlyScheduleView.tsx#L54-L60): `dates.push(d.toISOString().split('T')[0]);`
- [src/features/tempSchedule/components/WeeklyScheduleView.tsx#L30-L36](src/features/tempSchedule/components/WeeklyScheduleView.tsx#L30-L36): `dates.push(d.toISOString().split('T')[0]);`

## Recommendations
- Align all day keys to `getLocalDate()` (or an equivalent timezone-safe helper) instead of `toISOString().split('T')[0]`, especially in defaults and calendar views.
- Cross-check whether schedule grouping uses the same baseline as calendar navigation; if not, standardize on the local-date helper.

## Open Questions
- Does the reported mislabel occur near local midnight, indicating UTC drift? Need reproduction time context.
- Are any other date keys (e.g., persisted Dexie fields) populated via `toISOString().split('T')[0]` in the schedule domain beyond the identified lines?

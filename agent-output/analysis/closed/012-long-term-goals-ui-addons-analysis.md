Value Statement and Business Objective
- Strengthen the weekly long-term goals experience so ADHD users can see what matters today, recover when behind, and celebrate progress without friction.

Status: Planned

Changelog
- 2025-12-23: Initial analysis of long-term goal UI, store, and repository to identify UX add-on opportunities.
- 2025-12-23: Drafted structured proposal doc in agent-output/planning for Now/Next/Later UX enhancements.

Objective
- Map current long-term goal flow (UI + store), surface pain points, and prepare UI/UX enhancement options that are frontend-only.

Context (facts)
- Goals are weekly; auto-reset on Monday with prior week archived (weeklyGoalRepository: getWeekStartDate, resetWeeklyGoals).
- State via useWeeklyGoalStore (CRUD, progress updates, day-index helpers) fed from weeklyGoalRepository (Dexie + Firebase sync guard).
- UI entry: GoalsModal shows WeeklyGoalPanel only (daily goals removed). Panel loads goals on mount, shows grid of WeeklyGoalCard plus add/edit modal and history modal.
- WeeklyGoalCard: quick +/- buttons, direct input, daily target and catch-up severity (safe/warning/danger) using catchUpUtils and WeeklyProgressBar (7-slice bar highlighting today and expected-to-date amount).
- Catch-up alert: useCatchUpAlert opens CatchUpAlertModal once per day on app start when behind goals; uses systemRepository flag.
- History modal: last 5 weeks; shows completion count, average %, max progress.

Methodology
- Code inspection of store, repository, domain types, and UI components under src/features/goals plus shared store/repository/types.

Findings (pain points/hypotheses)
- Flow is write-heavy: progress adjusted via manual buttons or direct numeric input; no quick “log activity” wizard tied to tasks or time.
- Catch-up alert is one-shot per day; no gentle inline nudges or widget on main view.
- No concept of sub-goals/milestones or streaks; history is passive and hidden behind modal.
- Daily target explanation is implicit; users may not know why catch-up is warning/danger.
- Creation/edit modal resets defaults each time; no templates/presets beyond unit list; no guidance on scope sizing.
- Deletion is irreversible (confirm + history deletion) with no undo.
- Accessibility/ADHD: multiple modal layers (GoalsModal -> WeeklyGoalModal -> History) could overwhelm; colors only convey severity; no textual badges on cards beyond small labels.

Recommendations (frontend-only scope)
- Add lightweight inline reminders and tooltips that explain daily target and catch-up thresholds.
- Introduce milestone or checkpoint fields (non-functional suggestion) in UI to chunk weekly goals; record in state for later backend alignment.
- Provide quick “log session” overlay on card (time or quantity) to reduce manual math.
- Add celebratory micro-feedback on completing daily target, not only full completion.
- Surface streak/completion rate summary inline on cards and in panel header to keep context visible.
- Offer safe undo for last change per goal (UI-level optimistic revert) to reduce fear of mistakes.
- Consider preset templates (study/fitness/health) in add modal for faster setup and better sizing guidance.

Open Questions
- Do users want goal-task linkage (e.g., attach blocks to goals) or keep goals high-level?
- Preferred reminder frequency beyond startup alert?
- Should catch-up severity consider weekend buffer or custom week start?

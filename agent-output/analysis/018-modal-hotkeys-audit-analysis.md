Status: Active

Changelog
- 2025-12-22: Initial modal hotkey audit across repo.

Value Statement and Business Objective
- Ensure every modal follows the unified hotkey UX (ESC to close, Ctrl/Cmd+Enter for clear primary actions) to reduce user friction and avoid inconsistent behaviors, especially in keyboard-heavy flows like task entry.

Objective
- Inventory modal-like components, classify current hotkey coverage, and surface where ESC or Ctrl/Cmd+Enter primary actions are missing or ad-hoc.

Context
- Policy: all modals must support ESC close; background clicks should not close. Primary actions should map to Ctrl/Cmd+Enter when unambiguous. useModalHotkeys/unified stack is the standard; useModalEscapeClose is ESC-only.

Methodology
- Searched for *Modal.tsx and role="dialog" plus createPortal usage. Grepped for useModalHotkeys/useModalEscapeClose. Read each modal render/handlers to determine primary actions and hotkey wiring.

Findings (facts)
- Category A (useModalHotkeys with ESC + primary already wired): TemplateModal (templates/add-edit), BulkAddModal, ShopModal, TaskBreakdownModal, AddTempScheduleTaskModal, TempSchedule TemplateModal (templates manager, components/), SettingsModal, TimerConfirmModal, MemoModal, WarmupPresetModal, WeeklyGoalModal, TaskModal, CatchUpAlertModal. Primary actions already mapped to Ctrl/Cmd+Enter.
- Category B (ESC only via hook; primary missing): TemplatesModal (template list), TempScheduleModal, InboxModal, StatsModal, SyncLogModal, CompletionCelebrationModal, DailySummaryModal, WeeklyGoalHistoryModal, MissionModal, MemoMissionModal, GoalsModal, BossAlbumModal. Most are read-only dashboards; MemoMissionModal and TemplatesModal have clear Save/Complete actions but no Ctrl/Cmd+Enter.
- Category C (ad-hoc keydown handlers beyond the hooks): TempScheduleModal (global N/D/W/M/T/arrow shortcuts), StatsModal (Tab cycles tabs). ESC handled via hook but primary still absent.
- Category D (missing ESC entirely): BossDefeatOverlay (role="dialog", closes on backdrop click/timers only).

Recommendations
- Add Ctrl/Cmd+Enter primary mapping where action is clear and non-destructive:
  - MemoMissionModal: map Ctrl/Cmd+Enter to handleComplete when eligible; keep ESC for cancel.
  - TemplatesModal (template manager): map Ctrl/Cmd+Enter to handleSave when canSave && !isSaving; allowInInput to work inside name field.
  - DailySummaryModal: optional—map Ctrl/Cmd+Enter to regenerate (handleRegenerate) when report exists and not loading; ensure disabled during fetch to avoid double calls.
  - CompletionCelebrationModal: optional—map Ctrl/Cmd+Enter to onClose (ack). Low risk but not strictly required.
- Close gaps on ESC:
  - BossDefeatOverlay: add useModalEscapeClose/useModalHotkeys so ESC closes (or selects default) instead of relying on backdrop click/timers; keep backdrop non-closing if policy requires.
- Leave read-only dashboards without Ctrl/Cmd+Enter: InboxModal, StatsModal, SyncLogModal, WeeklyGoalHistoryModal, MissionModal, BossAlbumModal, GoalsModal, TempScheduleModal, DailySummary landing state—no single primary action.

Open Questions
- Should BossDefeatOverlay backdrop click remain closing, or align with policy (no backdrop close) and rely on explicit button/ESC?
- For DailySummaryModal, which action is the canonical “primary” when report is loaded (regenerate vs download)?

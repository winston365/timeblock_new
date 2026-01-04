Status: Active

# 029-template-modal-recurrence-bug-analysis.md

## Changelog
- 2025-12-23: Initial investigation of TemplateModal 3-step flow and recurrence UX regressions.

## Value Statement and Business Objective
Ensure the 3-step TemplateModal reliably reaches the recurrence step and correctly preloads existing recurrence settings so users can create or edit recurring templates without hidden states or unexpected modal exits. This reduces churn in template creation and prevents loss of recurrence metadata for auto-generated tasks.

## Objective
Identify why the TemplateModal sometimes exits or stalls when advancing to step 3, and why recurring templates reopen with the recurrence toggle off. Deliver hypotheses tied to concrete code points plus verification guidance.

## Context
- Frontend-only scope; TemplateModal uses Zod validation per step and relies on parent TemplatesModal for open/close.
- Recurrence UI is gated by `autoGenerate` and `recurrenceType` states; legacy templates may lack `autoGenerate`.
- Modal hotkeys use `useModalHotkeys` (ESC, Ctrl/Cmd+Enter) with shared modal stack; parent uses `useModalEscapeClose` when child closed.

## Methodology
- Read TemplateModal step logic, validation calls, and state initialization.
- Reviewed template recurrence Zod schema and refinements.
- Inspected TemplatesModal open/close flow and clone defaults.

## Findings (facts vs hypotheses)
- Fact: TemplateModal initializes `autoGenerate` from `template.autoGenerate` without fallback; recurrenceType defaults to `template.recurrenceType || 'none'`. Legacy templates with recurrenceType set but autoGenerate missing/false will render with toggle off and recurrence UI hidden.
- Fact: Cloning in TemplatesModal hardcodes `autoGenerate=false` and `recurrenceType='none'`, dropping recurrence on copies; editing those copies shows "set recurrence" even if original was recurring.
- Fact: Step navigation uses `validateCurrentStep()`; recurrence validation fails when `autoGenerate=true` but recurrenceType remains 'none' or weeklyDays empty. Errors persist in state until validation passes; when returning from step 3 to 2, hitting Next again re-runs recurrence validation (currentPage still 2) -> passes, but if currentPage is 3 with stale errors Next/submit no-ops.
- Hypothesis: Users perceiving "Next closes modal" may be hitting Ctrl/Cmd+Enter (primary hotkey) on earlier steps; handlePrimaryAction guards `currentPage!==3`, so requestSubmit is skipped, but ESC remains active. Alternatively, validation failure on step 1 (baseDuration NaN after clearing input) closes nothing but leaves modal on step 1 with no toast; perceived as no-op.

## Recommendations
1) Add safe fallback for legacy templates: when mounting, if `template.recurrenceType !== 'none'` but `template.autoGenerate` is falsy/undefined, set autoGenerate true to show recurrence UI.
2) Preserve recurrence on clone/defaults: copy `autoGenerate`, `recurrenceType`, `weeklyDays`, `intervalDays` when cloning; avoid forcing 'none'.
3) Surface validation feedback consistently: show global error banner on steps 1-2 when validation fails; ensure recurrence errors clear when toggling off autoGenerate.
4) Instrument logs around step transitions and validation result to confirm whether requestSubmit or onClose fires unexpectedly.

## Open Questions
- Do stored templates from older versions omit autoGenerate while keeping recurrenceType? Need sample data to confirm.
- Are users triggering primary hotkey (Ctrl/Cmd+Enter) on step 1/2, leading to perceived close/no-op events?
- Is there any parent-level close trigger on backdrop click in TemplatesModal being re-enabled while child modal is open?

# 029 TemplateModal Recurrence/Step3 Bug Fix

| Item | Value |
|------|-------|
| Plan ID | plan-2025-12-23-template-modal-recurrence-step3-bugfix |
| Date | 2025-12-23 |
| Status | QA Complete |
| Scope | Frontend/UI only (TemplateModal 3-step flow + Zod validation mapping) |

## Goal
- Prevent TemplateModal step 3 (recurrence) from becoming a no-op / hidden state.
- Ensure legacy templates (recurrence set, autoGenerate missing) reopen with recurrence UI correctly enabled.
- Ensure invalid numeric input does not break step transitions; show validation errors instead.

## Key Fix Points
- Legacy fallback: infer `autoGenerate=true` when `recurrenceType !== 'none'` and `autoGenerate` is missing.
- NaN guards for numeric inputs that can become invalid via user editing.
- Zod validation error paths: map recurrence validation failures to concrete fields so the UI can render errors.

## Files Touched
- src/features/template/TemplateModal.tsx
- src/shared/schemas/templateSchemas.ts
- tests/template-system.test.ts

## QA Notes
- See QA report: agent-output/qa/029-template-modal-recurrence-step3-bugfix-qa.md

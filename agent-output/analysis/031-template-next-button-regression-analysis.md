Status: Active

# 031-template-next-button-regression-analysis.md

## Changelog
- 2025-12-23: Initial analysis of TemplateModal "다음" 버튼 무반응/모달 종료 보고.

## Value Statement and Business Objective
템플릿 생성·수정 3단계 플로우에서 "다음" 버튼이 일관되게 작동해 사용자가 반복 주기(주기 설정) 단계까지 도달하고 저장을 완료하도록 보장한다. 이는 템플릿 기반 자동 생성의 신뢰성을 높이고 반복 작업 손실로 인한 사용자 피로도를 줄인다.

## Objective
- "다음" 버튼이 무반응이거나 모달이 닫힌다는 제보를 재현 가능한 시나리오로 구체화한다.
- 발생 가능성이 높은 코드 포인트를 3개 내로 좁히고, 각 가설별 확인 방법을 제시한다.

## Context (scope constraints)
- 대상 UI: 3단계 템플릿 추가/편집 모달 [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx).
- 부모 컨테이너: 템플릿 전체 모달 [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx) 및 사이드바 패널 [src/features/template/TemplatePanel.tsx](src/features/template/TemplatePanel.tsx).
- 상태·검증: 단계별 Zod 검증 [src/shared/schemas/templateSchemas.ts](src/shared/schemas/templateSchemas.ts); 저장은 저장소/리포지토리 경유.
- 분석 전제: 코드는 읽기 전용, 수정/실행 금지.

## Reproduction Scenarios (3 cases)
1) 신규 템플릿, 주기 설정 없음: TemplatesModal 또는 TemplatePanel에서 "+ 추가" → 1단계 필수값만 입력(이름, 소요시간) → "다음"(1→2), 2단계 입력 없이 "다음"(2→3). 기대: 주기 설정 단계 진입. 제보: 버튼 무반응 또는 머무름.
2) 기존 템플릿(자동 생성/주기 설정 있음) 편집: 리스트에서 수정 → 1,2단계 그대로 두고 "다음" → 제보: 모달이 즉시 닫히거나 3단계로 진입하지 않음.
3) 템플릿 복제 또는 수정 후 재편집: 복제(또는 빠른 저장)로 생성된 템플릿을 다시 수정 → "다음" → 제보: 모달이 닫히거나 3단계가 비어 있음.

## Top 3 Cause Hypotheses (code-point aligned)
1) **Legacy/clone recurrence flags drop recurrence UI**: Cloning and some legacy records reset `autoGenerate=false` and `recurrenceType='none'`, stripping weekly/interval metadata. Editing such templates replays step 1–2, but step 3 renders with recurrence 토글 꺼짐 (기대한 주기 탭이 비어 보임). Relevant code: clone defaults in [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx) and initial state in [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx) (autoGenerate fallback). Users may perceive "다음"이 주기 탭으로 안 넘어갔다/닫혔다 because recurrence content disappears.
2) **Validation short-circuit with silent errors on step 3**: `handleNextPage`/`handleSubmit` gate on `validateCurrentStep`; recurrence validation fails when `autoGenerate=true` but `recurrenceType='none'` or `weeklyDays` empty (weekly). Errors are set in state but only rendered inside 3단계 카드. If user returns to 2단계 then hits "다음" again, stale errors can keep `validateCurrentStep` false (currentPage remains 3) → perceived 무반응. Code: `validateRecurrenceStep` superRefine rules in [src/shared/schemas/templateSchemas.ts](src/shared/schemas/templateSchemas.ts); navigation in [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx).
3) **Parent modal close triggered by onClose(false) when losing focus/escape**: While in TemplatesModal, `useModalEscapeClose` keeps ESC on the parent disabled only when `isTemplateModalOpen=true`. If child TemplateModal toggles `onClose(false)` via header ✕/취소 or hotkey stack mis-order (modalStackRegistry), parent may also close, giving the impression "다음" 클릭 후 모달이 닫힘" (especially if Ctrl+Enter primary hotkey is pressed on step 1/2 where `handlePrimaryAction` early-returns). Code: parent ESC gating in [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx); hotkey handling in [src/shared/hooks/useModalHotkeys.ts](src/shared/hooks/useModalHotkeys.ts).

## Verification/Instrumentation Plan
- **State snapshot logs**: In TemplateModal `handleNextPage` and `handleSubmit`, log `currentPage`, `autoGenerate`, `recurrenceType`, `weeklyDays`, `errors`. Confirms hypothesis #2 (validation short-circuit) and whether state shows hidden recurrence.
- **Clone/legacy data check**: Log `template.autoGenerate`, `template.recurrenceType`, `template.weeklyDays`, `template.intervalDays` in the edit `useEffect` to see if incoming data already lacks recurrence. Confirms hypothesis #1.
- **Modal stack trace**: Add console traces to `useModalHotkeys` and parent `useModalEscapeClose` to capture which modal is top-of-stack when "다음" is clicked; check if `onClose(false)` fires unexpectedly (hypothesis #3). Include click handlers for "다음" to ensure no propagation.

## Open Questions
- 실제 데이터에 autoGenerate=false + recurrenceType≠'none' 조합이 얼마나 남아 있는지? (legacy 여부)
- 보고된 "닫힘"이 부모 TemplatesModal까지 닫힘을 의미하는지, 아니면 자식 TemplateModal만 닫힘인지 명확한 UX 재현 필요.
- 사용자 제보 시 키보드 단축키(Ctrl/Cmd+Enter, ESC) 사용 여부 확인 필요.

## Status
Active – 추가 로그/재현 확인 대기.

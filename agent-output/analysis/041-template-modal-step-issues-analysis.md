Status: Active

# 041-template-modal-step-issues-analysis.md

## Value Statement and Business Objective
템플릿 추가/수정 3단계 플로우가 끊기지 않고 주기 설정까지 도달하도록 원인을 좁혀, 반복 템플릿 작성 성공률을 높인다. 이는 자동 생성 신뢰성과 사용자 피로도 감소로 직결된다.

## Objective
- 제보된 "다음 클릭 시 3단계로 이동하지 않거나 모달이 닫힘"을 최소 시나리오로 재현한다.
- 단계 전환/주기 표시 불일치의 상위 3개 가설과 검증 포인트를 정의한다.

## Context
- 대상 UI: 템플릿 3단계 모달 [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx)
- 부모: 전체 모달 [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx), 사이드바 패널 [src/features/template/TemplatePanel.tsx](src/features/template/TemplatePanel.tsx)
- 검증: 단계별 Zod ([src/shared/schemas/templateSchemas.ts](src/shared/schemas/templateSchemas.ts))
- 상태: TemplateStore ([src/shared/stores/templateStore.ts](src/shared/stores/templateStore.ts)), Repository ([src/data/repositories/templateRepository.ts](src/data/repositories/templateRepository.ts))

## Reproduction Scenarios (minimal)
1) 신규 + 기본값: TemplatesModal에서 "+ 추가" → 이름/소요시간만 입력 → 1→2→3 단계 이동 시도. 기대: 3단계 진입. 관찰: 무반응/머무름 또는 모달 닫힘 제보.
2) 기존 주기 템플릿 편집: 자동생성 ON + weekly/interval 템플릿을 수정 클릭 → 1,2단계 건드리지 않고 "다음". 기대: 기존 주기 노출. 관찰: 3단계에서 "주기를 설정" 메시지(토글 OFF) 또는 즉시 닫힘.
3) 복제/빠른저장 후 편집: 복제본 또는 빠른 저장 템플릿을 즉시 수정 → 1→2→3 이동. 기대: 복제된 주기 보존. 관찰: 3단계 비어 있음/무반응.

## Top 3 Cause Hypotheses (with evidence)
1) **Legacy/복제 데이터가 autoGenerate=false로 저장되어 주기 UI가 꺼짐**: TemplateModal 초기화가 `autoGenerate`를 그대로 사용하고, 부모 복제 로직은 `autoGenerate=false`, `recurrenceType='none'`으로 덮어씀. 주기 정보가 사라져 3단계에서 "주기를 설정"이 뜸. 근거: TemplateModal 초기 useEffect & TemplatesModal 복제 로직, repository 기본값이 weeklyDays/intervalDays를 비움.
2) **3단계 검증(superRefine) 실패로 네비게이션/완료 무반응**: `handleNextPage`/`handleSubmit`가 `validateRecurrenceStep` 결과에 따라 바로 리턴. autoGenerate ON + recurrenceType 'none' 또는 weeklyDays 비었을 때 errors만 세팅되고 버튼은 무반응처럼 보임. 근거: templateSchemas superRefine와 TemplateModal의 `validateCurrentStep` → `handleNextPage`/submit 경로.
3) **모달 스택/ESC 핸들링 충돌로 의도치 않은 onClose(false)**: parent TemplatesModal은 `useModalEscapeClose(isOpen && !isTemplateModalOpen)`로 ESC를 막는데, child TemplateModal은 `useModalHotkeys`로 ESC를 활성화. 스택 순서가 어긋나면 ESC/단축키로 부모까지 닫혀 "다음" 직후 모달 종료처럼 인식될 수 있음. 근거: modalStackRegistry 공유, child는 항상 isOpen=true 메모, parent는 child 닫혔다고 판단하면 ESC 재활성.

## Verification Plan (what to log/watch)
- **TemplateModal step handler logs**: console in `handleNextPage` and `handleSubmit` to log `{currentPage, autoGenerate, recurrenceType, weeklyDays, intervalDays, errorsKeys}` to confirm 가설 #2 (검증 리턴) vs 정상 증가.
- **Edit-mode initialization**: log inside TemplateModal `useEffect(template)` the incoming `{template.id, autoGenerate, recurrenceType, weeklyDays, intervalDays}` to 확인 가설 #1 (legacy/복제 데이터).
- **Clone path**: log in TemplatesModal `handleCloneTemplate` the cloned flags to see if recurrence is dropped (가설 #1 확인).
- **Modal stack tracing**: instrument modalStackRegistry top-of-stack changes and `onEscapeClose` calls in TemplatesModal/TemplateModal to see if ESC/핫키가 child→parent 순서로 닫히는지 (가설 #3).
- **Schema outcome**: temporarily surface `validateRecurrenceStep` errors in a toast or global banner to verify user-visible feedback (가설 #2 체감도 확인).

## Open Questions
- 실제 저장 데이터에 autoGenerate=false + recurrenceType≠'none' 조합이 얼마나 남아있는가? (legacy 비율)
- 제보된 "닫힘"이 부모(TemplatesModal)까지 닫힘인지, child만 닫힘인지? UI 관찰 필요.
- 사용자가 Ctrl/Cmd+Enter, ESC 단축키를 누른 직후 증상이 발생했는지 로그 필요.

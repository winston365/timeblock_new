Status: Active

# 042-template-modal-stack-hotkey-analysis.md

## Changelog
- 2025-12-23: Initial ESC/모달 스택 관점 분석 (TemplatesModal ↔ TemplateModal).

## Value Statement and Business Objective
템플릿 추가/편집 플로우에서 사용자가 "다음" 단계를 진행할 때 예기치 않게 모달이 닫히지 않도록, 모달 스택과 ESC/단축키 처리 경로를 명확히 파악해 신뢰할 수 있는 다단계 입력 경험을 보장한다.

## Objective
- 부모/자식 모달의 ESC 및 핫키 등록·우선순위를 구조적으로 파악한다.
- "다음" 클릭 직후 모달이 닫힌다는 제보가 ESC/핫키 경로와 연관될 수 있는지 여부를 명시한다.
- 부모 TemplatesModal의 onClose 트리거 경로를 모두 나열한다.

## Context
- 부모: [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx#L24-L78)
- 자식: [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx#L23-L87)
- ESC 전용 훅: [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts#L1-L53)
- 스택 레지스트리: [src/shared/hooks/modalStackRegistry.ts](src/shared/hooks/modalStackRegistry.ts#L23-L54)

## Root Cause Analysis (ESC/단축키 관점)
- **부모 ESC 비활성 조건**: 부모는 `useModalEscapeClose(isOpen && !isTemplateModalOpen, onClose)`로 ESC 리스너를 등록하며, 자식 모달가 열리면 `isTemplateModalOpen=true`로 평가되어 부모의 ESC 핸들러가 제거된다. 따라서 자식 오픈 상태에서는 부모 ESC가 스택에 남지 않는다 ([TemplatesModal.tsx#L68-L86](src/features/template/TemplatesModal.tsx#L68-L86)).
- **자식 ESC 단독 처리**: 자식은 `useModalHotkeys`를 통해 별도 Symbol로 스택에 추가되며, `isTop` 검증 후 ESC 시 `onClose(false)`를 호출한다 ([TemplateModal.tsx#L63-L87](src/features/template/TemplateModal.tsx#L63-L87)). 부모가 스택에서 내려가므로 ESC 입력은 자식만 소비한다.
- **스택 우선순위 규칙**: `modalStackRegistry`는 삽입 순서를 유지하는 `Set`이며 마지막 추가된 ID가 top으로 판정된다. 자식 오픈 시 부모가 먼저 제거되고 자식이 추가되므로 top은 항상 자식이다 ([modalStackRegistry.ts#L23-L54](src/shared/hooks/modalStackRegistry.ts#L23-L54)). 부모/자식 동시 반응 경로는 없음.
- **Enter/Ctrl+Enter 경로**: 자식의 primary hotkey는 Ctrl/Cmd+Enter + `currentPage===3`일 때만 동작하며 `requestSubmit`을 호출한다 ([TemplateModal.tsx#L71-L87](src/features/template/TemplateModal.tsx#L71-L87)). "다음" 버튼(1→2→3) 클릭은 이 핫키와 무관하며 onClose를 호출하지 않는다.
- **"다음" 직후 닫힘 가능성**: 모달 스택/ESC 관점에서 "다음" 버튼 클릭 자체로 부모 onClose가 호출될 경로는 없음. 닫힘이 발생하려면 (a) 자식 ESC 핸들러가 트리거되었거나, (b) 자식 내부 onClose(false/true) 호출(취소/X/ESC/저장) 또는 (c) 부모 ESC가 재등록된 상태에서 ESC 입력이 발생해야 한다. 현 구조상 (c)는 자식 오픈 중에는 배제됨.

## Parent onClose Trigger Inventory
- ESC 키 입력 시(단, 자식 모달 미오픈 상태) → `useModalEscapeClose` → `onClose()` ([TemplatesModal.tsx#L68-L86](src/features/template/TemplatesModal.tsx#L68-L86)).
- 부모 헤더 ✕ 버튼 클릭 → `onClose()` ([TemplatesModal.tsx#L190-L213](src/features/template/TemplatesModal.tsx#L190-L213)).
- 부모 외부 다른 경로 없음(오버레이 클릭 닫기 미구현, 자식 onClose는 부모 상태만 변경).

## Findings (facts vs hypotheses)
- **Fact**: 자식 모달이 열리면 부모 ESC 핸들러가 스택에서 제거되어 중복 ESC 반응이 발생하지 않는다.
- **Fact**: 자식 ESC 핸들러는 항상 활성이며, `isSaving`이 아닐 때 ESC 입력을 받으면 즉시 `onClose(false)`를 호출한다. "다음" 버튼과 직접 연결된 onClose 호출은 없다.
- **Hypothesis**: 제보된 "다음 → 모달 닫힘"은 ESC 입력(사용자 무의식적 ESC, 혹은 ESC를 단축키로 사용하는 다른 플로우)과 시간상 연속되어 발생했을 가능성이 높다. 스택/우선순위 상 부모가 닫힐 경로는 확인되지 않았다.

## Recommendations
- 재현 세션에서 ESC 입력 유무 및 타임라인 로깅: `useModalHotkeys`/`useModalEscapeClose`에 ESC 처리 로그 추가 후 "다음" 클릭 시점 비교.
- 자식 모달에서 ESC 비활성 옵션 제공 검토: 검증 실패 후 즉시 닫힘을 막기 위해 특정 단계(예: 3단계) 또는 특정 상태(검증 실패 직후)에서는 ESC를 잠시 무시하는 플래그를 도입할 수 있음.
- 부모 모달도 `useModalHotkeys`로 통일하여 스택 관리 로깅/일관성 확보(주요 원인과 직접 관계는 없으나 모니터링 단순화 목적).

## Open Questions
- 제보 상황에서 사용자가 ESC를 눌렀는지, 또는 다른 글로벌 단축키/포커스 전환이 있었는지 확인 필요.
- 자식 모달 외 다른 오버레이/모달이 동시에 열려 있었는지(스택에 제3의 모달이 있었다면 ESC 소모 순서가 달라질 수 있음). 

## Status
Active – ESC/단축키 로깅 필요.

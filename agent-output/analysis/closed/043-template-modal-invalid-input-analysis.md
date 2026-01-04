Status: Active

# 043-template-modal-invalid-input-analysis.md

## Changelog
- 2025-12-23: 초기 분석 작성. 사용자 제보(다음 클릭 시 Invalid input 토스트, 두 번째 클릭 시 3단계 건너뜀) 기반 재현 시나리오와 가설 도출.

## Value Statement and Business Objective
템플릿 생성/편집 3단계 플로우가 예측 가능하게 동작하도록 원인과 재현 조건을 명확히 하여, 사용자가 주기 설정 단계까지 안전하게 이동하고 저장하도록 돕는다. 이는 반복 템플릿 완성률을 높여 자동 생성 신뢰성과 일정 관리 효율을 개선한다.

## Objective
- Invalid input 토스트와 3단계 스킵·즉시 저장 증상을 재현 가능한 시나리오로 2~3개 정리한다.
- 메시지/동작의 상위 3개 원인 가설을 코드 포인트로 연결한다.
- 확인용 로그·브레이크포인트 위치를 제안한다.
- 사용자 요구(다음 버튼 제거, 탭 전환, 3단계에만 완료)에 맞는 최소 변경 방향을 제시한다.

## Context
- UI: 템플릿 3단계 모달 [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx#L135-L660)
- 검증: 단계별 Zod 스키마 [src/shared/schemas/templateSchemas.ts](src/shared/schemas/templateSchemas.ts#L130-L195)
- 핫키: ESC/Ctrl+Enter 제어 [src/shared/hooks/useModalHotkeys.ts](src/shared/hooks/useModalHotkeys.ts#L11-L133)
- 모달 트리거/복제: 부모 [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx)

## Methodology
- 컴포넌트·스키마 코드 정적 점검 (제약: 실행/수정 금지).
- 기존 분석 기록(031, 041, 042)와 비교해 증상 특화 포인트만 추출.
- `handleNextPage` → `validateCurrentStep` → Zod 에러 토스트 흐름과 버튼 타입/핫키 경로를 추적.

## Reproduction Procedures (가설 기반)
1) 신규 템플릿 + 숫자 필드 비우기: TemplatesModal에서 +추가 → 1단계에서 소요 시간 입력 후 전부 삭제 → 바로 "다음" 클릭. 관찰 예상: Zod가 number 필드를 문자열로 인식해 Invalid input 토스트 발생, currentPage는 1에 머무름.
2) 자동생성 OFF 상태에서 빠른 진행: 1단계 필수값만 입력 → 2단계에서 값 비운 채 "다음" 두 번 연속 클릭. 첫 클릭 후 에러 없으면 currentPage=3으로 전환되지만 3단계 내용이 짧아 사용자가 인지 못한 채 같은 위치의 버튼을 다시 클릭 → `handleSubmit` 실행으로 즉시 저장되어 3단계를 건너뛴 것처럼 보임.
3) 기존 템플릿 편집(레거시/문자형 숫자): 주기 설정이 있는 템플릿을 수정 → 1단계 필드를 건드리지 않고 "다음". 데이터에 문자열 baseDuration/intervalDays가 남아 있으면 Zod 타입 미스매치로 Invalid input 토스트 후 페이지 정지. 직후 다시 "다음"을 누르면 state가 숫자로 덮여 3단계로 넘어가고 완료 버튼이 즉시 제출.

## Findings (facts)
- 3단계 네비게이션은 `handleNextPage`에서 `validateCurrentStep` 성공 시에만 currentPage를 +1 하며, 실패 시 첫 에러 메시지를 토스트로 노출 [src/features/template/TemplateModal.tsx#L135-L215](src/features/template/TemplateModal.tsx#L135-L215).
- Zod 스키마는 number 필드 타입 미스매치 시 기본 메시지 "Invalid input"을 반환하며, TemplateModal은 이를 그대로 토스트에 사용한다 [src/shared/schemas/templateSchemas.ts#L130-L195](src/shared/schemas/templateSchemas.ts#L130-L195).
- 3단계 폼 제출은 버튼 타입 submit과 `requestSubmit`(Ctrl/Cmd+Enter)로만 트리거되며, currentPage !== 3이면 조기 return 되어 Next 클릭은 submit을 직접 호출하지 않는다 [src/features/template/TemplateModal.tsx#L199-L260](src/features/template/TemplateModal.tsx#L199-L260).

## Top 3 Cause Hypotheses
1) **숫자 필드 타입 미스매치**: baseDuration/intervalDays가 문자열(NaN) 상태로 Zod에 전달되면 기본 메시지 "Invalid input"이 토스트로 표시된다. 재현: 숫자 입력을 비우거나 레거시 데이터에서 문자열 숫자가 로드된 경우.
2) **3단계 최소 UI로 인한 단계 스킵 인지 오류**: autoGenerate가 false면 3단계 콘텐츠가 짧고 버튼 라벨만 "완료"로 바뀌므로, 2단계에서 연속 클릭 시 사용자가 3단계 진입을 인지하지 못하고 즉시 제출했다고 느낀다.
3) **이전 에러 상태 유지 후 재시도**: 1차 클릭에서 Zod 에러로 currentPage가 정지된 뒤, 동일 값을 다시 클릭하면 state 보정(숫자 디폴트, trim)으로 검증 통과 → 바로 3단계로 전환되고 두 번째 클릭에서 submit 실행. 사용자에게는 "두 번째 다음에서 바로 완료"로 보임.

## Verification Points
- 브레이크포인트/로그: `validateCurrentStep` 호출 직후 `{currentPage, baseDuration, intervalDays, errors}` 확인 [src/features/template/TemplateModal.tsx#L135-L215](src/features/template/TemplateModal.tsx#L135-L215).
- 데이터 타입 확인: edit useEffect에서 로드된 `template.baseDuration`/`intervalDays` 타입 콘솔 출력 [src/features/template/TemplateModal.tsx#L67-L118](src/features/template/TemplateModal.tsx#L67-L118).
- 토스트 메시지 원본: Zod issues에서 message가 "Invalid input"인지, path가 number 필드인지 확인 [src/shared/schemas/templateSchemas.ts#L130-L195](src/shared/schemas/templateSchemas.ts#L130-L195).
- 버튼/핫키 경로: Next 버튼은 type="button"이며 submit을 직접 호출하지 않음, Ctrl/Cmd+Enter는 currentPage===3에서만 `requestSubmit` 실행 [src/features/template/TemplateModal.tsx#L199-L270](src/features/template/TemplateModal.tsx#L199-L270) [src/shared/hooks/useModalHotkeys.ts#L11-L133](src/shared/hooks/useModalHotkeys.ts#L11-L133).

## Recommendations (사용자 요구 반영 최소 변경 방향)
- 네비게이션 방식을 상단 탭 클릭 전환으로 변경하고 Next 버튼 제거. 탭 변경 시 `validateCurrentStep`을 호출해 실패하면 탭 이동 차단 및 에러 노출(1→2, 2→3). 3단계 탭에서만 submit 버튼을 노출.
- 숫자 필드 입력을 문자열/빈값에서도 즉시 number로 강제 캐스팅하여 Zod 타입 에러(Invalid input) 노출을 줄이기. 필요 시 `safeParse` 전 `Number()` 강제 변환 + NaN fallback.
- 3단계 진입 시 배너/헤더에 "3단계: 반복 주기 설정" 표시를 넣어 단계 전환을 시각적으로 확실히 보여주고, 완료 버튼 위치를 탭 영역 하단에 고정.

## Open Questions
- 레거시 템플릿 데이터에 문자열 숫자 타입이 얼마나 존재하는지? (샘플 점검 필요)
- 사용자가 실제로 3단계 UI를 스킵했다고 느낀 순간의 화면/입력 상태 스냅샷이 있는지?
- 탭 전환 시 어느 단계까지 미입력 허용(예: 2단계 비워도 통과)할지 정책 결정 필요.

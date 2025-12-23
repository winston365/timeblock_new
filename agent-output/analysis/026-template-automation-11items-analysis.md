# Value Statement and Business Objective
템플릿 기반 작업 생성(수동/자동)을 한 곳에서 신뢰성 있게 제어하고, ADHD 사용자가 실수를 줄이면서 빠르게 오늘 할 일을 만들 수 있도록 11개 개선 항목의 현황을 정리한다.

# Status
Active

# Changelog
- 2025-12-23: 초기 작성 — 템플릿→오늘 작업 파이프라인, 자동생성 트리거/미리보기/로그/정렬/폼 UX 현황 맵핑

# Objective
- 11개 개선 항목 각각에 대해 현행 동작, 코드 위치, 영향 범위, 필요한 데이터/키를 식별한다.
- 정책 준수 포인트(localStorage 금지, defaults.ts 사용, optional chaining, 모달 UX 규칙)를 명시한다.

# Context
- 템플릿 UI: [src/features/template/TemplatePanel.tsx](src/features/template/TemplatePanel.tsx) (사이드바, 리포 직접 호출, 현재 미사용), [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx) (글로벌 모달, useTemplateStore 기반), [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx) (3단계 폼).
- 상태/저장: [src/shared/stores/templateStore.ts](src/shared/stores/templateStore.ts) (Zustand), [src/data/repositories/templateRepository.ts](src/data/repositories/templateRepository.ts) (CRUD, auto-generate 주기/lastGeneratedDate), [src/data/repositories/gameState/dayOperations.ts](src/data/repositories/gameState/dayOperations.ts) (자동생성 트리거), [src/app/AppShell.tsx](src/app/AppShell.tsx#L150-L210) (템플릿→Task 추가 핸들러), [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts) (기본값), [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts) (Dexie systemState 래퍼).

# Methodology
- 템플릿 관련 UI/스토어/리포지토리/게임 상태 초기화 경로를 정독.
- auto-template 생성 경로와 실행 타이밍을 추적(generateTasksFromAutoTemplates → dayOperations → gameStateStore loadData).
- 기존 분석/플랜 문서(023, 017) 재검토로 요구 정의와 현재 구현 간 간극을 식별.

# Findings (per improvement item)
1) 단일 파이프라인 통합: TemplatesModal은 useTemplateStore+addTemplate/updateTemplate, TemplatePanel은 리포 직접 호출+useState, AppShell의 handleTaskCreateFromTemplate에서 createTaskFromTemplate→dailyDataStore.addTask. Entry가 분리되고 TemplatePanel은 실제 마운트 없음(검색 결과 단독 파일). 데이터 흐름 불일치/중복 로딩 리스크.
2) 자동생성 트리거 명확화: generateTasksFromAutoTemplates(templateRepository) 호출을 dayOperations.initializeNewDay에서 실행하며, gameStateStore.loadData가 lastLogin 변경 시에만 initializeNewDay를 호출. 같은 날 앱 재시작 시 자동생성 스킵, 부팅 즉시 1회 실행/중복 방지(lastGeneratedDate + Firebase 체크) 구조는 있으나 ‘오늘 최초 부팅’ 보장은 없음.
3) 자동생성 미리보기/확인: 현재 버튼 누르면 즉시 onTaskCreate → dailyDataStore.addTask; 미리보기/인라인 확인 UI 없음. 모달 중첩 대신 인라인 패널 요구와 불일치.
4) 실행 로그/최근 생성 기록 + 학습: 템플릿 실행 로그 저장 경로 부재. systemRepository/systemState는 다른 기능(Timeline showPast, syncLogs 등)만 사용. 생성 이력/예상-실제 시간 기록 없음.
5) 빠른 생성(1단계): TemplateModal은 3단계 구조에서 페이지 3에서 submit; text 필수, baseDuration min=1 외 추가 검증 없음. 즉시 저장/후속 유도 흐름 없음.
6) 진입점 통합: TemplatePanel과 TemplatesModal이 서로 다른 데이터 경로/상태 관리; TemplatePanel UI가 현재 렌더되지 않아 상태 일치 검증 어려움. 진입 상태/필터/정렬/토스트 일치 실패 가능.
7) 폼 유효성+즉시 오류: TemplateModal은 text 없을 때 alert, 나머지 필드는 제한 없음(weeklyDays 빈 배열, intervalDays<1 허용). 인라인 에러/가이드 미비.
8) 정렬+기억+오늘 집중: TemplatesModal 기본 정렬은 ‘다음 발생까지 일수’ 우선, systemState에 정렬/필터 기억 없음. 오늘 생성 배지(✅)는 lastGeneratedDate만으로 표시. Dexie systemState 키 미정.
9) Panel 검색/필터: TemplatePanel은 카테고리 탭만 제공, 검색/즐겨찾기/주기 필터 없음. TemplatesModal 수준으로 이식 필요.
10) 3단계 폼 UX 정리: 단계별 안내/오류 일관성 부족, 안내 문구 적고 에러는 alert. optional chaining 사용 소극적, defaults.ts 미사용.
11) 카드 요약+액션 정리: TemplatePanel 카드엔 name/text/memo/duration/resistance/timeBlock/XP, autoGenerate=“매일 반복” 배지만 존재(주기/준비/즐겨찾기 요약 부족). TemplatesModal 카드도 준비/preparation 노출 없음, 액션(수정/복제/삭제/추가)이 hover 영역에 분산.

# Recommendations (what to verify next)
- TemplatePanel 사용 여부 확인 후 제거/통합 결정; 모든 경로를 useTemplateStore와 unifiedTaskService(또는 dailyDataStore) 일관 호출로 정리.
- 자동생성 트리거를 “앱 부팅 시 1회 + 날짜 변경 시”로 명문화하고, lastGeneratedDate/Firebase 체크 외에 Dexie systemState로 ‘오늘 실행 여부’ 캐시 고려.
- 미리보기/확인 인라인 패널을 TemplatesModal에 추가하고 onTaskCreate 전에 diff/중복 검출 로직을 넣을 위치 결정.
- systemState 키 설계(예: template:sortOrder, template:filters, template:executionLog)와 defaults.ts에 기본값 정의 필요.
- TemplateModal에 Zod 기반 검증/인라인 에러를 추가하고 interval/weekly 조합 가이드라인 작성.

# Open Questions
- TemplatePanel이 실제 UI 어디에도 마운트되지 않는 현 상태가 의도인지? 제거 vs 재활용 결정 필요.
- 자동생성 대상 Task를 인박스/블록 어디에 둘지, 중복 생성 시 사용자 확인이 필요한지 정책 확정 필요.
- 실행 로그/예상-실제 시간 비교를 어디서 노출할지(TemplatesModal, Panel, 혹은 별도 히스토리 뷰).

Value Statement and Business Objective
- 템플릿 기능의 현재 정의와 UX·데이터 흐름을 명확히 파악해 반복 작업 생성 경험을 안정화하고, 로컬 퍼스트 철학에 맞는 확장 여지를 찾는다.

Status: Planned

Changelog
- 2025-12-23: 최초 정리 (현재 템플릿 기능 구조·흐름 분석)
- 2025-12-23: 최종 제안서(15개) 플래닝에 반영됨 (agent-output/planning/017-template-improvements-15-proposals-final.md)

Objective
- 템플릿 기능의 의미, UI/동작/데이터 흐름, 제약과 기회 영역을 조사·정리한다.

Context
- 로컬 퍼스트 Electron + React 앱. 데이터는 Dexie를 1차 소스, Firebase를 보조로 사용.
- 템플릿 관련 주요 파일: [src/shared/types/domain.ts](src/shared/types/domain.ts), [src/data/repositories/templateRepository.ts](src/data/repositories/templateRepository.ts), [src/shared/stores/templateStore.ts](src/shared/stores/templateStore.ts), [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx), [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx), [src/features/template/TemplatePanel.tsx](src/features/template/TemplatePanel.tsx), 템플릿 카테고리 연동 [src/data/repositories/settingsRepository.ts](src/data/repositories/settingsRepository.ts).

Root Cause / Why Now
- 템플릿 기능 목적·동작이 명확히 문서화되지 않아 UX 개선이나 스펙 변경 시 리스크가 존재함.

Methodology
- 템플릿 관련 타입, 저장소, 스토어, UI 컴포넌트 코드를 정독하여 데이터 흐름·UX 상호작용을 추출.

Findings (Fact vs Hypothesis)
- [Fact] Template 타입은 반복 주기(RecurrenceType), autoGenerate, weeklyDays/intervalDays, lastGeneratedDate, 준비(preparation1~3), 카테고리, 즐겨찾기, 이미지 썸네일 필드를 가진다: 반복 작업 템플릿 + 자동 생성 메타데이터를 모두 포함 ([src/shared/types/domain.ts](src/shared/types/domain.ts)).
- [Fact] 저장소는 Dexie db.templates를 1차로 사용하고 비어 있을 때만 Firebase fetch를 시도하며, sanitizeTemplate으로 누락 필드를 기본값으로 채운다. CRUD 외에 템플릿→Task 변환(createTaskFromTemplate/AutoTemplate)과 자동 생성 주기 계산(shouldGenerateToday, generateTasksFromAutoTemplates)을 제공 ([src/data/repositories/templateRepository.ts](src/data/repositories/templateRepository.ts)).
- [Fact] 상태 관리: useTemplateStore가 템플릿 목록·카테고리 로드, add/update/delete, refresh를 제공하며 Dexie/Firebase 저장소와 settingsRepository 카테고리를 호출한다 ([src/shared/stores/templateStore.ts](src/shared/stores/templateStore.ts)).
- [Fact] UI 표면: (1) TemplatePanel은 사이드바용 목록/카테고리 탭/오늘 할 일 추가/CRUD를 제공하며 저장소 직접 호출(loadTemplates, delete) + TemplateModal을 연다; (2) TemplatesModal은 전체 화면 모달로 검색·카테고리/즐겨찾기/반복·7일 필터, 복제, 오늘 추가, delete, add/edit 모달 호출을 제공하며 useTemplateStore를 사용한다; (3) TemplateModal은 3단계 생성/편집 폼(기본 정보→준비→반복)으로 createTemplate/updateTemplate, 카테고리 추가를 직접 저장소에서 호출한다 ([src/features/template/*](src/features/template)).
- [Fact] 단축키/ESC: TemplatesModal은 useModalEscapeClose를 통해 ESC로 닫기, TemplateModal은 useModalHotkeys로 ESC/primary action을 처리해 모달 UX 규칙(ESC 닫기)을 따른다. 배경 클릭 닫기는 구현되지 않아 규칙(배경 클릭 금지)을 지킨다.
- [Fact] 자동 생성 주기는 daily/weekly/interval을 지원하며 lastGeneratedDate 기반 중복 생성을 막는다. generateTasksFromAutoTemplates는 오늘 생성해야 하는 템플릿을 Task로 만들고 lastGeneratedDate를 업데이트하지만, 호출 트리거(스케줄러)는 코드 상에서 확인되지 않는다 ([src/data/repositories/templateRepository.ts](src/data/repositories/templateRepository.ts)).
- [Hypothesis] 사용자 의도는 “자주 반복되는 작업(루틴)을 템플릿으로 저장하고, 필요 시 수동으로 ‘오늘 할 일’에 추가하거나 주기 설정을 통해 자동 생성”하는 것. 준비(preparation) 필드는 ADHD 방해 요소 대응용 체크리스트 성격.
- [Hypothesis] 상태 관리 경로가 둘로 나뉜다: TemplatesModal은 useTemplateStore를, TemplatePanel/TemplateModal은 저장소를 직접 호출. 이로 인해 동일 템플릿 데이터라도 동기화 타이밍·에러 처리·옵티미스틱 업데이트 일관성이 깨질 수 있다.

Recommendations
- 템플릿 데이터 접근 경로를 useTemplateStore로 일원화하고 저장소 직접 호출을 줄여 상태 불일치/이중 로드 리스크를 완화한다.
- generateTasksFromAutoTemplates 실행 지점을 명문화(앱 부팅 스케줄러, 백그라운드 잡 등)하고 테스트를 추가해 자동 생성 신뢰도를 확보한다.
- TemplateModal 폼 검증(예: baseDuration 최소값, weeklyDays 빈 배열 방지, intervalDays 최소값 등)을 보강하고 에러 메시지 UX를 개선한다.
- 카테고리/즐겨찾기/이미지/반복 필터를 TemplatePanel에도 일부 노출하거나 TemplatesModal과 상호 네비게이션을 제공해 발견성을 높인다.
- 파일명·주석의 인코딩 깨짐(garbled 한글 주석)과 코드 스타일을 정리해 가독성을 향상한다.

Open Questions
- generateTasksFromAutoTemplates는 어디서/언제 호출되는가? (예: 데일리 리셋, 앱 시작 시, 백그라운드 타이머)
- TemplatePanel의 onTaskCreate 콜백은 어떤 저장소/서비스를 통해 오늘 할 일에 삽입하는가? (unifiedTaskService 사용 여부 확인 필요)
- 템플릿 공유/검색/정렬 요구사항이 있는가? 현재 기능 범위는 로컬 관리 + 단순 필터링에 국한.
- 템플릿 카테고리와 Settings templateCategories 필드의 스키마/동기화 규칙은 무엇인가? (Firebase sync 포함 여부)
- 자동 생성 시 goal 연계, XP 계산/보상 파이프라인(handlers) 트리거가 필요한가?

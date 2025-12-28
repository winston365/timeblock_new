# 034 — 프론트 구조 개선 대안 Option A/B (Repo-tailored)

> Date: 2025-12-23  
> Scope: Frontend/UI only (React Renderer).  
> Out of scope: backend/Supabase 구현, Electron IPC 구현(설계 고려만).  

## Inputs (근거 문서)
- .github/copilot-instructions.md
- agent-output/architecture/system-architecture.md
- agent-output/architecture/003-frontend-structural-improvements-architecture-findings.md
- agent-output/analysis/dexie-violations-scan.txt
- agent-output/critiques/033-repo-top10-improvements-risk-prioritization.md
- agent-output/analysis/012-modal-ux-escape-ctrlenter-analysis.md

---

## Problem Summary (왜 구조 개선이 필요한가)

---

## 대안 A — Boundary Hardening (경계 재정착)

### 이름(짧게)
- Boundary Hardening

### 목표
- UI-only 범위에서 “경계 위반(직접 DB 접근/이벤트 발행 드리프트)”을 멈추고, 상태 불일치/회귀 범위를 최소화한다.

### 핵심 아이디어 (3~5)
1) **DB 접근은 Repository 단일 관문**: `src/data/repositories/*` 외부의 `db` 직접 접근을 단계적으로 제거한다.
2) **systemState는 단일 저장소로 수렴**: localStorage 금지(테마 예외 유지), 토글/플래그는 system repository로만 읽고/쓴다.
3) **EventBus 규칙을 구조로 강제**: emit은 store(orchestrator)에서만, subscribe는 `src/shared/subscribers/*`에서만 수행한다.
4) **IO/side-effect를 경계 밖으로 밀어낸다**: `src/shared/services/*`는 가능한 순수 함수/도메인 로직으로 유지하고, IO는 repo 또는 subscriber로 위임한다.
5) **가드레일로 재발 방지**: boundary 테스트/규칙을 확장해 “다시 새는 것”을 막는다(구현은 별도 작업으로 분리).

### 적용 범위 (주로 어느 레이어/폴더)
- 주 대상: `src/shared/stores/*`, `src/data/repositories/*`, `src/shared/subscribers/*`
- 보조 대상: `src/features/*`(UI 핸들러가 repo/db를 직접 치지 않도록 정리), `src/shared/services/*`(직접 db 접근 제거)

### 마이그레이션 단계 (3~6 step)
1) **경계 위반 인벤토리 확정**: 직접 `db` 접근/emit 위치를 목록화하고 “임시 예외 리스트”를 명시한다.
2) **systemState 수렴**: 모든 UI 토글/플래그는 system repository 경유로 치환한다(테마 예외만 유지).
3) **핫패스부터 repo 관문 재정착**: Tasks/Schedule/Sync 등 사용자 체감이 큰 경로부터 `db` 직접 접근을 repo 호출로 치환한다.
4) **EventBus 발행 위치 정리**: repository/service에서의 emit을 제거하고, store(orchestrator)에서만 emit하도록 경로를 수렴한다.
5) **subscriber 집중화**: 부수효과(동기화/파이프라인 트리거)는 `src/shared/subscribers/*`로 모은다.
6) **정리(선택)**: 안정화 후 dead code/중복 경로를 제거한다(롤백 가능성 보존).

### Pros (5개 이내)
- 폴더 이동 없이도 ROI가 높다(호출 경로 치환 중심).
- 상태 불일치(특히 store 미갱신) 회귀를 빠르게 줄인다.
- “UI-only 제약”과 충돌하지 않는다.
- boundary 테스트/규칙과 궁합이 좋아 재발 방지가 쉽다.
- 롤백이 비교적 단순하다.

### Cons (5개 이내)
- store(orchestrator) 비대화 위험이 남는다.
- “유스케이스 계층”을 명시적으로 분리하는 장기 설계까지는 도달하지 못한다.
- 경계 수렴 과정에서 일시적으로 wrapper가 늘 수 있다.

### 회귀 위험 포인트 (2~4)
- Tasks 이동(예: Inbox→Block, Block→Inbox) 경로가 store 단일 경로로 수렴되지 않으면 UI 반영 누락이 재발할 수 있다.
- sync/logging처럼 side-effect가 많은 영역은 emit 위치 변경 시 이벤트 순서/중복 트리거가 발생할 수 있다.
- systemState 키 수렴 과정에서 기존 키/기본값(defaults) 불일치로 토글 상태가 뒤바뀔 수 있다.

---

## 대안 B — Vertical Slices + Usecase Facade (세로 슬라이스 + 유스케이스 파사드)

### 이름(짧게)
- Vertical Slices

### 목표
- feature 단위로 UI/상태 전이/유스케이스를 응집시켜 “변경 범위”와 “이해 비용”을 줄인다(ADHD 친화: 어디를 고쳐야 하는지 더 명확).

### 핵심 아이디어 (3~5)
1) **feature 내부에 UI·model·usecase를 co-locate**: `src/features/<feature>/{ui,model,usecases}`로 기능 단위 응집도를 올린다.
2) **UI는 usecase만 호출**: 화면 이벤트 핸들러가 store/repo를 직접 섞지 않고, usecase 파사드로 수렴한다.
3) **Repository 패턴 유지**: DB 접근은 여전히 `src/data/repositories/*` 단일 관문을 유지한다(경계는 더 엄격).
4) **shared는 cross-cutting만**: 모달 훅/공용 UI/공용 lib 같은 “진짜 공유”만 `src/shared/*`에 남기고, feature 종속 코드는 feature로 이동한다.
5) **EventBus 규칙 동일 적용**: emit은 feature store(orchestrator)에서, subscribe는 `src/shared/subscribers/*`에서만.

### 적용 범위 (주로 어느 레이어/폴더)
- 주 대상: `src/features/*` (폴더 구조/소유권 재정의)
- 보조 대상: `src/shared/*` (cross-cutting만 남기도록 정리), `src/shared/stores/*`(feature-local로 이동하거나 얇게 유지)

### 마이그레이션 단계 (3~6 step)
1) **핵심 2~3개 feature부터 시범 적용**: 예를 들어 schedule/tasks(goals 포함) 같이 변화가 잦은 영역부터 시작한다.
2) **usecase 파사드 도입**: UI 이벤트는 usecase만 호출하도록 경로를 바꾼다(내부에서 store+repo 조합).
3) **model 응집**: 해당 feature에서 쓰는 store/selectors/types를 `model/*`로 묶는다.
4) **shared 축소**: feature 종속 서비스/유틸은 해당 feature로 이동하거나 feature adapter로 래핑한다.
5) **경계 재검증**: DB 접근/emit 규칙이 여전히 지켜지는지 boundary 테스트로 확인한다.

### Pros (5개 이내)
- 기능별 변경 범위가 좁아져 “수정 위치 찾기”가 쉬워진다.
- UI/상태/유스케이스가 응집돼 신규 기능 추가 속도가 오른다.
- shared가 얇아져 cross-cutting 코드의 품질/정책(모달/핫키 등)을 더 선명하게 유지할 수 있다.

### Cons (5개 이내)
- 파일 이동이 많아질수록 충돌/리뷰 비용이 급증한다.
- shared vs feature 공통화 기준이 흔들리면 중복이 늘 수 있다.
- 한 번에 크게 바꾸면 import 경로/순환 참조 회귀가 발생하기 쉽다.

### 회귀 위험 포인트 (2~4)
- 폴더 이동으로 인해 import 경로가 크게 바뀌며, “바렐 export”에 의존한 영역에서 빌드/런타임 문제가 날 수 있다.
- feature 간 의존이 많은 경우(model/usecase가 서로 물려) 순환 참조가 생길 수 있다.
- shared 축소 과정에서 공용 유틸의 중복/불일치가 잠깐 생기기 쉽다.

### Boundaries (목표 구조)

## Recommendation (요약)
- **1차 추천: 대안 A**(경계 재정착 + 규칙 강제)로 “새는 것부터” 막는다.
- **2차(선택): 대안 B**를 특정 feature부터 점진 적용해 장기적 생산성을 끌어올린다.

## North-star principles (5–8)
- DB 접근은 `src/data/repositories/*` 단일 관문으로 수렴한다.
- EventBus emit은 store(orchestrator)만, subscriber는 `src/shared/subscribers/*`만.
- 정책은 코드로 강제한다: localStorage 금지(테마 예외), defaults 단일 출처, 모달 ESC/백드롭 규칙.
- “핫패스부터” 고친다: 사용자 체감/데이터 무결성에 직결되는 경로(Tasks, Schedule, Sync, systemState).
- 변경은 단계적으로, 롤백 가능한 단위로 쪼갠다(폴더 이동은 마지막).
- 기능 경계는 사용자 행동 단위로 정의한다(예: Inbox→Block, Complete Task, Edit Schedule).
- 테스트는 구조의 안전망이다: boundary + 핵심 usecase 위주로 우선 강화한다.

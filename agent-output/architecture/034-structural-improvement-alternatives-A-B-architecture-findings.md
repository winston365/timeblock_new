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
- 의도된 레이어(Features → Stores → Repositories → Dexie → Sync)는 존재하지만, 현실에서 `db` 직접 접근이 `src/shared/services/*`, `src/app/hooks/*`, 일부 `src/features/*`로 새어 나가 결합도/회귀 범위가 커졌다.
- EventBus emit 규칙(emit은 store(orchestrator), subscribe는 subscribers)이 일관되지 않으면 “상태 반영/부수효과” 경로가 분기되어 디버깅이 어려워진다.
- UI 정책(ESC/모달 스택, defaults 단일 출처, localStorage 금지)을 구조적으로 강제할 장치가 약해 ‘정책 드리프트’가 반복된다.

---

## Option A — Boundary Hardening (현 구조 유지 + 경계 재정착)

### Boundaries (소유권/경계 정의)
- `src/features/*`: UI 컴포넌트 + 화면 조합 + feature-local hooks만. DB/Sync 접근 금지.
- `src/shared/stores/*`: UI에서 호출하는 “상태 전이(유스케이스에 준하는 오케스트레이션)”의 1차 관문. EventBus emit은 여기(또는 동등한 orchestrator)에서만.
- `src/data/repositories/*`: Dexie CRUD 단일 관문. 순수 데이터 접근/영속화만.
- `src/shared/subscribers/*`: 이벤트 기반 부수효과 집중(동기화/리포팅/파이프라인 트리거 등).
- `src/shared/services/*`: (가능하면) 순수 함수/도메인 서비스(외부 IO 최소). IO가 필요한 경우에도 repository를 통해서만.
- `src/data/db/*`: Dexie 스키마/클라이언트만.

### Migration steps (프론트/UI-only, 단계적)
1) **DB 접근 경계 인벤토리 + 예외 목록(임시) 선언**
   - `agent-output/analysis/dexie-violations-scan.txt` 기반으로 “직접 db 접근 파일” 목록을 기준선으로 확정.
2) **systemState 수렴**
   - 모든 토글/플래그는 `src/data/repositories/systemRepository.ts`를 통해서만 읽고/쓴다(테마 예외는 유지).
3) **핫패스부터 repo 관문 재정착**
   - `syncEngine`, `useAppInitialization`, `syncLogger`, `unifiedTaskService` 순서로 직접 `db` 접근 제거(우선은 wrapper/위임 방식).
4) **EventBus 규칙 정리**
   - repository에서 emit 제거/금지(가능한 곳부터), store(orchestrator)에서만 emit.
5) **가드레일(재발 방지) 설계만 추가**
   - (구현은 별도) boundary lint/테스트 규칙 제안: `tests/db-access-boundary.test.ts` 범위를 확장하는 방식으로 유지.

### Pros
- 변경 폭이 작고(폴더 이동 없음), UI 기능 작업과 병행하기 쉽다.
- 회귀/롤백이 쉽다(호출 경로 치환 중심).
- 테스트(특히 boundary test)로 규칙을 빠르게 고정할 수 있다.

### Cons
- store가 계속 비대해질 수 있다(오케스트레이션이 store에 남음).
- 장기적으로 “도메인/유스케이스 계층”의 명확한 분리까지는 도달하지 못한다.

---

## Option B — Vertical Slices + Usecase Facade (feature 단위 모듈화 강화)

### Boundaries (목표 구조)
- 각 feature를 “세로 슬라이스”로 정리해 **UI와 상태 전이를 co-locate**하되, DB 접근은 여전히 repo 관문을 유지한다.
- 제안(예시):
  - `src/features/<feature>/ui/*` : 컴포넌트
  - `src/features/<feature>/model/*` : store/selectors/types (feature-local)
  - `src/features/<feature>/usecases/*` : 화면에서 호출하는 작업(예: moveTask, completeTask) 파사드
  - `src/features/<feature>/api/*` : repository 호출 어댑터(단순 래핑)
- `src/shared/*`는 정말로 cross-cutting(모달 훅, 공통 UI, 공통 lib)만 남기고 축소.

### Migration steps (점진, 파일 이동 최소로 시작)
1) **2~3개 핵심 기능부터 파일 공동 배치**
   - 예: `schedule`, `tasks(inbox)`, `goals`.
2) **feature entrypoint를 usecase로 수렴**
   - UI 이벤트 핸들러는 `usecases/*`만 호출(내부에서 store+repo 조합).
3) **shared/services 축소/정리**
   - 특정 feature에 종속된 서비스(예: 일부 rag, calendar 연동 래퍼)는 해당 feature로 이동하거나 feature adapter로 래핑.
4) **테스트도 feature 단위로 확장**
   - 기존 tests는 유지하되, feature usecase의 단위 테스트를 추가하는 방향(구현은 별도 작업).

### Pros
- 기능별 변경 범위가 좁아져 ADHD 친화적으로 “어디를 고치면 되는지” 찾기 쉬워진다.
- UI/상태/유스케이스가 한 곳에 모여 신규 기능 추가가 빨라진다.
- 장기적으로 B안은 클린아키텍처(Bigger refactor)로 가기 전 “중간 단계”로 적당하다.

### Cons
- 폴더/파일 이동이 늘어날수록 충돌/리뷰 비용이 급증한다.
- 공통화 기준이 흐리면(shared vs feature) 오히려 중복이 늘 수 있다.
- 레포가 이미 큰 편이라, 일괄 전환은 위험(반드시 단계적이어야 함).

---

## Recommendation
- **추천: Option A를 1차로 채택(경계 재정착 + 규칙 강제)**, 이후 UX/기능 작업이 안정화되면 **Option B를 특정 기능(scheduler/tasks/goals)부터 점진 적용**.
- 이유:
  - 현재 리스크의 대부분은 “기능 부족”이 아니라 “경계 위반으로 인한 상태 불일치/회귀”에서 온다(Top10/리스크 레지스터 근거).
  - Option A는 UI-only 범위에서 가장 ROI가 높고, 기존 테스트(특히 boundary 성격 테스트)와도 잘 맞는다.
  - Option B는 효과가 크지만 이동 비용이 커서, A로 ‘부채 확산을 멈춘 다음’ 착수하는 편이 안전하다.

---

## North-star principles (5–8)
- DB 접근은 `src/data/repositories/*` 단일 관문으로 수렴한다.
- EventBus emit은 store(orchestrator)만, subscriber는 `src/shared/subscribers/*`만.
- 정책은 코드로 강제한다: localStorage 금지(테마 예외), defaults 단일 출처, 모달 ESC/백드롭 규칙.
- “핫패스부터” 고친다: 사용자 체감/데이터 무결성에 직결되는 경로(Tasks, Schedule, Sync, systemState).
- 변경은 단계적으로, 롤백 가능한 단위로 쪼갠다(폴더 이동은 마지막).
- 기능 경계는 사용자 행동 단위로 정의한다(예: Inbox→Block, Complete Task, Edit Schedule).
- 테스트는 구조의 안전망이다: boundary + 핵심 usecase 위주로 우선 강화한다.

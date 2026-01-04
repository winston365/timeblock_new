# 059 — 전체 아키텍처 개선 정리 (Architecture Assessment)

> **Date:** 2026-01-03  
> **Status:** Active  
> **Scope:** Electron Renderer(React + TS) 중심. Local-first.  
> **Out of scope (이 문서에서 ‘나중 PR’로만 제안):** 서버/백엔드(Supabase 등), Electron IPC/메인 프로세스 변경, Firebase 보안 규칙/인덱스 변경.

## Goals (사용자 요청)
1) 현재 구조의 강점/리스크를 명확히 한다.
2) 리팩토링이 필요한 영역을 레이어별로 식별한다.
3) “지금(프론트/UI 중심) 가능한 것”과 “나중(DB/Sync/백엔드)로 미뤄야 할 것”을 구분한다.

## Assumptions (추정/불확실성 표시)
- Firebase는 **Sync/Backup**이며, 앱 기능의 Source of Truth는 **Dexie**로 유지된다.
- UI-only 단계에서도 repository/store/service/test는 수정 가능하지만, **Electron main/preload** 및 **서버/보안 규칙**은 변경하지 않는다.
- 멀티 윈도우(QuickAdd 등) 시나리오가 존재하며, Sync 리스너 중복이 비용을 키우는 주요 원인 중 하나다(이미 완화 구현 있음).

---

## 1) 현재 아키텍처 진단

### 좋은 점 (Strengths)
- **Local-first 소스 오브 트루스가 명확**: Dexie 우선, Sync는 사후 반영 구조로 ‘오프라인에서도 망가지지 않는’ 기본 전제가 좋다.
- **경계(Policy)가 문서/테스트로 존재**: UI/Store에서 Firebase 직접 호출 금지, localStorage 금지(테마 예외), defaults 단일 출처, 모달 UX 정책 등은 제품 안정성을 높인다.
- **Repository + 전략 기반 Sync 구조**: 스키마/동기화 변경을 “전략”으로 통제할 수 있어 장기 유지보수에 유리하다.
- **EventBus + subscribers로 side-effect를 분리**: 확장성(새 핸들러/구독 추가)이 좋고, UI를 상대적으로 순수하게 유지할 수 있다.
- **핫패스(Tasks 이동/Sync) 중심 테스트 투자가 이미 시작됨**: Optimistic Update와 RTDB 리스너 완화가 ‘기능 안정성’ 방향으로 들어가 있다.

### 나쁜 점/리스크 (Risks)
- **경계 드리프트가 재발하기 쉬움**: db 직접 접근, repository/service에서의 event 발행, systemState 키/기본값 분산은 시간이 지날수록 회귀를 만든다.
- **Orchestrator(스토어/유스케이스) 비대화 위험**: “단일 경로”를 세우려다 store가 ‘모든 것’이 되기 쉬움. 규칙 없으면 God-store로 변한다.
- **Sync 안정성의 정의가 구현/테스트에 비해 늦음**: 커버리지 수치만으로는 실패 모드(재시도/역순/중복/다중 창)를 충분히 보호하기 어렵다.
- **시간/날짜 처리(로컬 vs UTC)가 취약 영역**: TempSchedule에서 이미 리그레션이 발생했으며, 비슷한 패턴이 다른 스케줄/리마인더에서도 재발할 수 있다.

---

## 2) 레이어별 리스크와 리팩토링 제안

### A. Store (Zustand)
**리스크**
- store가 repo 호출 + UI 상태 + 이벤트 발행 + 롤백을 동시에 책임지면 결합도가 폭증.
- 화면별로 동일 유스케이스(예: Inbox→Block 이동)가 다른 코드 경로로 존재하면 상태 불일치가 재발.

**리팩토링 제안 (UI-only에서 가능)**
- **유스케이스 단일 진입점 확립**: 사용자 의도 단위 API를 `unifiedTaskService` 같은 usecase에 모으고, UI는 그 API만 호출.
- **emit 규칙 강제**: event 발행은 store/usecase에서만. repository는 데이터만.
- **store 역할 정의 문서화**: “UI state store” vs “domain orchestrator store”를 구분하고, 신규 기능은 둘 중 어디에 넣을지 기준을 둔다.

**검증 체크리스트(열어볼 곳)**
- store 목록/교차 호출: src/shared/stores/
- Inbox/Task 이동 경로: src/shared/services/task/unifiedTaskService.ts
- event 발행 위치: src/shared/lib/eventBus/ 및 emit 호출부

### B. Repository
**리스크**
- repository가 event를 emit하거나, UI-friendly 형태로 변환을 과도하게 맡으면 계층 붕괴.
- systemState 키가 여러 군데에서 관리되면 기본값/마이그레이션 지옥.

**리팩토링 제안 (UI-only에서 가능)**
- **Dexie 단일 관문 강제(확장)**: boundary 테스트 + eslint 규칙(또는 CI 스캔)으로 `db` direct import를 repo 외부에서 차단.
- **systemState “키 인벤토리”를 단일 파일로**: system repository가 키/기본값/마이그레이션 규칙을 소유.

**검증 체크리스트**
- repos: src/data/repositories/
- Dexie schema/버전: src/data/db/dexieClient.ts
- boundary 테스트: tests/db-access-boundary.test.ts

### C. DB (Dexie)
**리스크**
- 스키마 버전 업 시점에 정책(기본값/nullable/마이그레이션)이 분산되면 데이터 손상이 난다.
- 날짜/시간 포맷이 섞이면 쿼리/표시/동기화가 엉킨다.

**리팩토링 제안 (부분적으로 UI-only에서 가능)**
- **날짜/시간 규약 ADR 고정**: 저장은 ISO(local date string vs timestamp) 중 하나로 통일하고, 파싱/포맷 유틸을 단일 경로로 강제.
- **마이그레이션 규칙 강화**: “필드 추가는 optional + defaults에서 채움” 같은 최소 규칙을 문서화.

**검증 체크리스트**
- 로컬 날짜 유틸 사용 여부: src/shared/utils/ (또는 getLocalDate 정의 위치)
- TempSchedule 날짜 처리: src/features/tempSchedule/components/

### D. Services (도메인 서비스/유틸)
**리스크**
- 서비스가 IO(db, firebase)를 직접 만지면 테스트/교체가 어렵고, 경계가 무너진다.

**리팩토링 제안 (UI-only에서 가능)**
- **순수 함수화 우선**: conflictResolver 등은 좋은 방향. ‘입력→출력’ 계약을 강화하고 테스트를 먼저 늘린다.
- **서비스는 usecase에 흡수하지 말고, usecase가 서비스를 조합**하게 유지(응집/재사용 균형).

**검증 체크리스트**
- task completion handlers: src/shared/services/gameplay/taskCompletion/
- conflict/sync core: src/shared/services/sync/firebase/ 및 관련 tests

### E. Subscribers (EventBus 구독자)
**리스크**
- subscriber가 repo를 호출하며 부수효과가 연쇄되면, 이벤트 순서/중복 처리 버그가 발생.
- “어떤 이벤트가 어떤 구독자를 트리거하는지” 추적성이 떨어지면 디버깅이 힘들다.

**리팩토링 제안 (UI-only에서 가능)**
- **subscriber 인벤토리/매핑 문서**: 이벤트 타입 → 구독자 → side-effect 목록.
- **idempotency 원칙**: 동일 이벤트가 두 번 와도 결과가 같아야 한다(특히 멀티 창/재시도).

**검증 체크리스트**
- subscribers: src/shared/subscribers/
- event types: src/shared/lib/eventBus/types.ts

### F. Tests
**리스크**
- 커버리지 숫자만 올리면 ‘실패 모드’를 놓친다.

**리팩토링 제안 (UI-only에서 가능)**
- **시나리오 기반 테스트로 재정의**: Sync는 네트워크 실패/중복/역순/재시도, Task 이동은 inbox↔dailyData 불변조건 중심.
- **정책 테스트를 1급으로**: db direct import 금지, 모달 ESC/백드롭 정책(가능하면 RTL), defaults 하드코딩 금지 등.

**검증 체크리스트**
- 테스트 스위트: tests/
- Optimistic Update 관련: tests/optimistic-update.test.ts
- Sync 리스너/리더락: tests/rtdb-listener-registry.test.ts

---

## 3) 의존성 방향성 원칙 5개 (깨지기 쉬운 규칙)

1) **UI/Feature → Store/Usecase → Repository → Dexie** 방향만 허용(역방향 금지).
2) **Repository는 순수 데이터 계층**: event emit/Toast/UI state/React 훅 의존 금지.
3) **Sync는 ‘사후’**: UI/Usecase는 Sync 성공을 전제로 흐름을 설계하지 말고, 실패를 정상 상태로 취급.
4) **EventBus는 Store/Usecase에서만 emit**하고, 구독자는 src/shared/subscribers/에만 둔다(확산 금지).
5) **기본값은 defaults 단일 출처**: 하드코딩/분산 기본값은 “조용한 데이터 손상”의 씨앗이다.

---

## 4) 지금 가능한 PR vs 나중 PR

### 지금 단계에서 가능한 PR (프론트/UI 범위)
- **Boundary Hardening**: db direct import 제거/차단(테스트+규칙), systemState 키 수렴.
- **Usecase 단일 경로 강화**: Inbox↔Block, Task 업데이트를 `unifiedTaskService` 중심으로 수렴.
- **모달 UX 정책 자동화**: ESC 닫기/백드롭 금지의 정책 테스트(가능하면 RTL 도입), 공용 훅 확산.
- **Sync 관측성/가드레일(클라이언트-only)**: 리스너 레지스트리/리더락 유지, DEV 계측을 “설정 토글”로 노출(단, systemState 저장).
- **시간/날짜 규약 표준화**: `YYYY-MM-DD` 파싱 금지 테스트를 다른 캘린더/스케줄에도 확장.

### 나중에 해야 하는 PR (DB/Sync/백엔드/IPC 포함)
- **증분 동기화/부분 리스너 모델 전환**: 루트 onValue를 쿼리 기반/증분 수신으로 바꾸는 작업(데이터 모델/서버 규칙 영향).
- **충돌 정책(멀티 디바이스) 정교화**: LWW 한계를 넘어서는 도메인 규칙(머지 전략) 도입.
- **보안/쿼터/인덱스 최적화**: Firebase Rules, 인덱싱, 백업 정책.
- **Electron IPC 기반 전역 단축키/OS 연동**: globalShortcut, 알림, 백그라운드 동작 등(현재 단계 제외).

---

## Concrete Verification Checklist (Repo에서 실제로 확인할 것)

### 구조/경계
- src/data/repositories/ 외부에서 `db` import가 남아있는지 grep
- tests/db-access-boundary.test.ts가 최신 예외/허용 경로를 반영하는지
- src/shared/lib/eventBus/에서 emit 호출이 store/usecase로만 제한되는지

### Schedule/TempSchedule 날짜
- src/features/tempSchedule/components/가 `Date('YYYY-MM-DD')`를 쓰지 않는지
- tests/temp-schedule-date-parsing.test.ts가 실패 모드를 충분히 잡는지

### Sync
- src/data/db/infra/syncEngine.ts에서 start/stop 생명주기가 모든 앱 종료 경로에 붙었는지
- src/shared/services/sync/firebase/rtdbListenerRegistry.ts가 path 단위 단일화(refCount) 보장하는지

### UX 정책
- 모달들에서 ESC/백드롭 규칙 준수 여부(수동 + 자동 테스트)


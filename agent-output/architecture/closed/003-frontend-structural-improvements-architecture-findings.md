# 003 — Architecture Findings: 프론트 구조적 개선 대안 2개 + 추천안

Date: 2025-12-17
Mode: Architect (no-memory)
Scope: Frontend/UI 중심(React Renderer). Electron IPC/Supabase는 “향후 확장 고려” 수준으로만 다룸.

## No-Memory Mode
Flowbaby memory가 사용 불가하여, 본 문서는 레포 내 문서/코드 스캔 기반으로 작성됨.

## 1) 현재 구조 지도

### 1.1 레이어 요약(의도된 구조)
- UI/Feature: 기능 단위 UI와 화면 로직 (src/features/**)
- App Shell: 레이아웃/패널/최상위 초기화 오케스트레이션 (src/app/**, src/App.tsx, src/main.tsx)
- State: Zustand stores + feature-local store/hook (src/shared/stores/** 및 feature 내 store/hook)
- Data Access: Repository 패턴(원칙상 모든 CRUD의 관문) (src/data/repositories/**)
- Persistence: Dexie(IndexedDB) 스키마/클라이언트 (src/data/db/dexieClient.ts)
- Sync: Firebase Sync 서비스/전략(Strategy) 기반 (src/shared/services/sync/**, src/shared/services/sync/firebase/**)

### 1.2 데이터 플로우(대표 시나리오)
- Task CRUD(일반)
  - UI(예: Schedule/TaskModal 등) → Zustand Store (src/shared/stores/dailyDataStore.ts, inboxStore.ts)
  - Store → Repository (src/data/repositories/dailyDataRepository.ts, inboxRepository.ts 등)
  - Repository → Dexie (src/data/db/dexieClient.ts)
  - (선택) Store emit → EventBus → Subscribers에서 부수효과 처리

- Task 완료(Completion Pipeline)
  - 트리거: dailyDataStore.toggleTaskCompletion()
  - 서비스: src/shared/services/gameplay/taskCompletion/taskCompletionService.ts
  - 핸들러 체인: goal/xp/quest/waifu/block 등의 side effects
  - 주의: taskCompletion 서비스는 “EventBus 미사용(직접 호출)” 원칙을 명시(README)

- Task 저장소 이원화(dual store)
  - dailyData.tasks: timeBlock !== null (스케줄된 작업)
  - globalInbox: timeBlock === null (대기 작업)
  - 통합 접근 API는 문서상 “@/data/repositories에서 updateAnyTask/getAnyTask 제공”이 정본
  - 현실: 통합 서비스가 src/shared/services/task/unifiedTaskService.ts에 존재하며 db를 직접 조회하는 형태가 남아 있어(원칙 대비) 경계가 흐려짐

- UI 토글/소규모 상태 영속화(systemState)
  - 원칙: localStorage 금지(테마 예외), Dexie systemState 사용
  - 정석 관문: src/data/repositories/systemRepository.ts (SYSTEM_KEYS 포함)

### 1.3 실제 폴더 매핑(핵심)
- UI/Feature
  - src/features/schedule/** (ScheduleView/TimelineView 등)
  - src/features/tempSchedule/** (Weekly/Monthly UI)
  - src/features/goals/** (GoalsModal 등)
- Cross-cutting
  - EventBus: src/shared/lib/eventBus/**, subscribers: src/shared/subscribers/**
  - Task Completion: src/shared/services/gameplay/taskCompletion/**
  - Sync: src/shared/services/sync/**
- Data
  - Repositories: src/data/repositories/**
  - DB schema/client: src/data/db/dexieClient.ts

### 1.4 경계 위반/부채 패턴(스캔 결과)
> “규칙 vs 현실”의 갭이 구조 개선의 직접 원인입니다.

- Repository bypass: src/shared/stores/**, src/shared/subscribers/**, src/shared/services/** 일부에서 src/data/db/dexieClient.ts의 db를 직접 import하여 table에 직접 접근
  - 예: src/shared/stores/dailyDataStore.ts, src/shared/subscribers/googleSyncSubscriber.ts, src/shared/services/task/unifiedTaskService.ts
- EventBus 규칙 위반 가능성: EventBus README는 Store→Subscriber 패턴을 강하게 권장하지만, 일부 repository가 eventBus.emit을 수행
  - 예: src/data/repositories/tempScheduleRepository.ts
- systemState 접근 혼재: systemRepository.ts가 있음에도 db.systemState 직접 접근이 여러 곳에서 발견(분산된 키/폴백/마이그레이션 위험)
  - 예: src/shared/services/sync/syncLogger.ts 등

요약: “레이어는 정의되어 있으나, ‘DB 접근’과 ‘이벤트 발행’이 경계 밖으로 새어 나가며 결합도가 증가”한 상태.

---

## 2) 구조 개선 대안 A/B

### A안: 최소 변경(리스크 낮음) + 점진적 정리

#### 핵심 아이디어
- 폴더 구조는 유지하되, **경계 규칙을 실제 코드에 재정착**시킨다.
- 목표: UI/Store/Subscriber/Service 어디에서도 db 직접 접근을 금지하고, Repository를 단일 관문으로 만든다.
- EventBus emit의 소유권을 “Store(또는 orchestrator service)만”으로 정리한다.

#### Pros
- 회귀 리스크 최소: 기능/UX 변화 없이 “호출 경로”만 정리 가능
- 롤백 용이: 변경이 파일 단위로 국소화(특히 systemState, task/inbox 접근)
- 디버깅 개선: 문제 발생 지점이 Repository/Subscriber로 수렴
- 중장기 B안으로의 기반 마련(‘Port/Adapter’ 도입 전 단계)

#### Cons
- 구조적 ‘정돈’이지만 근본 분리(도메인/유스케이스 계층)까지는 못 감
- 일부 store가 비대해질 수 있음(오케스트레이션이 store에 남는 경우)
- 단기간에 “완전한 0 direct db import” 달성은 어렵고, 단계적 타협이 필요

#### 마이그레이션 전략(단계)
1) 인벤토리화 & 기준선 설정
   - direct db import 사용처 목록화(파일 단위)
   - “허용 레이어”를 문서로 고정: src/data/repositories/**(및 src/data/db/**)만 db import 허용
2) systemState 수렴
   - db.systemState 직접 접근을 systemRepository.ts(get/set/delete + SYSTEM_KEYS)로 치환
   - 키 네이밍은 SYSTEM_KEYS로 집중(새 키 추가도 여기서만)
3) Task dual-store 수렴
   - Store/Subscriber/Service에서 globalInbox/dailyData 직접 탐색 로직을 통합 API로 치환
   - 정본 위치를 src/data/repositories/index.ts exports로 맞추고, src/shared/services/task/unifiedTaskService.ts는 “내부 구현” 또는 “repo로 이동” 중 한 방향으로 정리(둘 중 하나로 단일화)
4) EventBus 규칙 정합성 회복
   - repository 내부 eventBus.emit 제거(또는 deprecate)
   - Store에서 emit하고 subscriber가 반응하도록 재배치(이벤트가 ‘데이터 변경 후 side effect’를 의미하도록 일관화)
5) 가드레일(재발 방지)
   - 아키텍처 정책: “db import 금지 레이어 목록”을 system-architecture.md에 불변 규칙으로 명시
   - (구현은 추후 단계) ESLint/TS boundary rule로 강제 권장

#### 되돌리기 전략(rollback)
- 단계별 PR/커밋 분리(각 단계는 ‘호출 경로 치환’만 포함)
- Repository API 시그니처는 유지(호출부만 변경) → revert가 쉬움
- 치환 작업은 “기존 함수 유지 + 내부 위임” 패턴을 우선 적용(추후 삭제는 안정화 후)

#### 성공 기준
- “db import 허용 경계” 준수: src/data/** 외부에서 db import가 0(또는 예외 목록 최소화)
- EventBus emit 규칙 준수: emit은 store(orchestrator)에서만, subscribe는 src/shared/subscribers/**로 집중
- Task 관련: task 위치 감지가 단일 API를 통해서만 이루어짐(중복 탐색 로직 제거)
- 회귀 없음: `npm test` 통과 + “주요 화면 smoke check(수동)”에서 크래시/데이터 손실 없음

---

### B안: 더 과감한 구조(중장기)

#### 핵심 아이디어
- “Feature(UI) / Application(Use-case) / Domain / Infrastructure”로 명확히 분리하는 **Port & Adapter(클린 아키텍처에 준함)** 방향.
- 현재의 store/repo/service가 섞여 있는 오케스트레이션을 “유스케이스 계층”으로 이동하고, UI는 유스케이스 호출 + 상태 바인딩만 담당.

#### 제안 구조(개념)
- UI/Feature: src/features/** (UI만)
- Application(Use-cases): 예) src/shared/usecases/** 또는 src/domain/usecases/**
  - 예: CompleteTaskUseCase, UpdateAnyTaskUseCase, ToggleWarmupAutoGenerateUseCase
- Ports(interfaces): 예) TaskRepositoryPort, SystemStatePort, SyncPort
- Infra(adapters):
  - Dexie adapter: 기존 src/data/repositories/**를 infra로 재분류하거나(이동), 최소한 “Dexie-specific 코드”를 여기로 격리
  - Firebase sync adapter: src/shared/services/sync/**를 “SyncPort 구현체”로 취급

#### Pros
- 테스트/유지보수성 상승: 도메인/유스케이스는 UI와 독립적으로 단위 테스트 가능
- 향후 확장(Electron IPC, 다른 sync backend 등) 시 교체가 쉬움
- 레이어 경계가 강해져 “규칙 위반 재발”이 크게 줄어듦

#### Cons
- 리팩터링 규모 큼: 이동/재export/의존성 재배치로 충돌 가능성 높음
- 단기 속도 저하: UI 개선보다 구조 작업이 우선되어야 하는 기간이 생김
- 롤백이 어렵다: 파일 이동/공개 API 변화가 많아 revert 비용이 커짐

#### 마이그레이션 전략(단계)
1) 포트 정의부터 시작(코드 이동 최소)
   - 기존 repository/service를 그대로 둔 채, 그 위에 Use-case API만 추가
2) hot path부터 유스케이스로 감싸기
   - Task completion, unified task operations, systemState 토글 등
3) 점진적 이동
   - feature는 store/service 대신 usecase만 호출하도록 치환
4) 인프라 재배치(마지막)
   - repository 폴더 재구성(이름/경로 변경)은 최후에 수행

#### 되돌리기 전략(rollback)
- “포트/유스케이스 추가” 단계는 비교적 롤백 가능(기존 호출 유지)
- 하지만 “폴더 이동/공개 API 교체”가 시작되는 순간부터 롤백 비용 급증 → 이 구간은 별도 안정화 기간/릴리즈 분리 필요

#### 성공 기준
- UI 레이어에서 data 접근/side effect가 사라지고, usecase 호출로 수렴
- Dexie/Firebase 교체가 가능한 ‘경계(Port)’가 문서/코드 모두에 존재
- 기능 회귀 없이 성능/디버깅 경험 개선(이벤트/로그/동기화 추적성)

---

## 3) 최종 추천안(가정 + 트레이드오프 포함)

### 추천: A안(최소 변경 + 경계 재정착) 우선, B안은 90일 이후 평가

#### 가정
- 지금 단계의 목표는 “프론트/UI 안정화 + 회귀 위험 최소화”이며, 신규 UX/대규모 기능 확장은 당장 하지 않는다.
- Firebase/Dexie/동기화 전략을 당장 바꾸지 않는다(현 구조 유지).

#### 왜 A안인가
- 현재 가장 큰 문제는 ‘새 기능 부재’가 아니라 **경계 위반으로 인한 결합도 증가**이며, 이는 A안의 “단일 관문/단일 emit 규칙”만으로도 체감 개선이 크다.
- 특히 UI 변경이 잦은 상황에서 B안 수준의 이동은 충돌/회귀 비용이 높아, 제품 속도를 떨어뜨릴 가능성이 크다.

#### 무엇을 포기하나(트레이드오프)
- (포기) 90일 내 완전한 클린 아키텍처/포트 분리 달성
- (수용) 일부 store의 오케스트레이션 역할이 당분간 남을 수 있음
- (대신) 규칙 강제(Repository-only DB access, Store-only emit)를 먼저 세워 “부채 확산”을 멈춤

---

## 4) 90일 로드맵(큰 마일스톤)

- Day 0–30: 경계 재정의 + systemState/Task hot-path 수렴
  - db.systemState direct access 제거(가능한 범위)
  - unified task access 경로 단일화(문서와 실제 위치 불일치 해소)
  - repository eventBus.emit 정리 방향 결정 및 1~2개 핵심 이벤트부터 교정

- Day 31–60: DB 접근 경계 강제 + Subscriber/Service 정리
  - src/shared/stores/**, src/shared/subscribers/**의 direct db import 제거 확대
  - “Store→Subscriber” 패턴으로 side effect 집중(동기화/XP/goal 등)
  - 규칙 재발 방지 장치(문서 고정 + lint/boundary rule 도입 검토)

- Day 61–90: 중장기(B안) 준비 여부 결정
  - Use-case(응용 계층) 얇게 도입할지 평가(핵심 2~3 유스케이스만)
  - Electron IPC/향후 backend 교체를 대비한 Port 후보 확정
  - 필요 시 “B안으로의 전환 계획(별도 승인)” 작성

## Verdict
APPROVED_WITH_CHANGES
- A안은 즉시 진행 가능(리스크 낮음)하며, UI-only 제약과도 정합.
- B안은 중장기 가치가 있으나, 현재 시점에서는 리스크/비용 대비 우선순위가 낮음(90일 이후 재평가 권장).

# Critique — 012-global-goals-removal-pr-breakdown

Artifact: agent-output/planning/012-global-goals-removal-pr-breakdown.md  
Date: 2025-12-21  
Status: Initial

## Changelog
| Date | Handoff/Request | Summary |
|---|---|---|
| 2025-12-21 | User: “PR 시퀀스 리뷰(리스크/우선순위/회귀 포인트 + 가드레일)” | PR 순서 적합성 검토, Dexie/Firebase/eventBus/task 모델/UI 영향에 대한 리스크 및 가드레일 권고 정리 |

## Value Statement Assessment (MUST)
- ✅ Value Statement는 명확함: “weekly goals만 유지, global goals 레거시 전체 제거”로 코드/데이터/동기화/백그라운드 비용을 줄이고 혼선을 제거.
- ⚠️ 다만 “완전 제거”는 Dexie 스키마/원격 데이터/구버전 앱과의 상호작용 때문에 **릴리즈/롤백 정책**이 함께 정의되지 않으면 사용자 데이터 손실 또는 다운그레이드 불가 같은 운영 리스크가 발생할 수 있음.

## Overview
플랜의 큰 흐름(런타임 비활성화 → UI 연결 제거 → repo/sync 제거 → Dexie 테이블 제거 → 잔재 정리)은 [agent-output/architecture/system-architecture.md](../architecture/system-architecture.md)의 “표면(엔트리) 제거 → 안정화 후 정리” 원칙(ADR-003)과도 정합적이며, 특히 PR#4(스키마 제거)를 후반으로 미룬 점은 올바른 방향이다.

다만 사용자가 요청한 ‘완전 제거’가 **(A) 기능 비활성화 + (B) 코드/동기화 제거 + (C) 로컬 DB 스키마 삭제 + (D) 원격 데이터 제거**까지 포함하는지 수준이 다르므로, PR#4/PR#3에서 “되돌릴 수 없는 단계”가 되는 지점을 더 엄격히 관리할 필요가 있다.

## Architectural Alignment
- ✅ Repository 경계/이벤트 발행 규칙/Local-first 원칙과 큰 충돌은 없음.
- ⚠️ Firebase Sync는 ‘초기 full fetch + 경로별 listen + 컬렉션 전체 업로드 가능성’ 구조 리스크가 문서화되어 있음([agent-output/architecture/004-firebase-rtdb-mitigation-phased-architecture-findings.md](../architecture/004-firebase-rtdb-mitigation-phased-architecture-findings.md)). 따라서 PR#3에서 payload shape 변경은 단순 삭제가 아니라 **원격 데이터의 “덮어쓰기(set)” 여부**에 따라 과거 데이터가 의도치 않게 삭제/충돌될 수 있어 검증이 필요.

## Scope / Priority Assessment
- ✅ “weekly↔task 의미론 통합(Option C) 금지”가 명시되어 범위 통제가 잘 되어 있음.
- ⚠️ 반대로, task의 `goalId`를 “미사용 레거시 데이터”로 둘지 제거할지는 회귀 범위를 크게 좌우. 이번 Epic은 ‘레거시 제거’이므로 **타입/모델 필드 제거는 원칙적으로 DEFER**가 더 안전(특히 데이터 마이그레이션이 필요해지는 순간 PR#4와 동일하게 forward-only 성격이 커짐).

## Technical Debt / Regression Risks (핵심 4가지)

### 1) Dexie 스키마 테이블 제거 위험 (업그레이드/다운그레이드/데이터 손실)
**위험 요약**
- IndexedDB/Dexie 스키마 변경은 사실상 forward-only 성격이 강함. 배포 후 사용자가 구버전으로 “다운그레이드”할 경우:
  - 구버전 코드가 `globalGoals` store 존재를 가정하면 런타임에서 DB open/접근 실패 또는 크래시 가능.
  - 테이블 drop 시 로컬 데이터는 삭제(또는 접근 불가)되어 복구 불가.

**안전장치(가드레일) 권고**
- Release/PR 정책:
  - PR#4는 가능하면 “별도 릴리즈”로 분리(= PR#1~#3을 먼저 ship/soak)하거나, 최소한 ‘스키마 제거 포함 릴리즈는 롤백 불가(다운그레이드 비권장)’를 릴리즈 노트/운영 정책으로 명시.
- Migration guard:
  - upgrade 단계에서 `globalGoals` 레코드 수를 집계해 SyncLog/로컬 로그로 남겨 “무슨 데이터가 사라졌는지” 관측 가능하게.
  - upgrade 완료 후 `systemState`에 마이그레이션 마커(예: `db.migrations.dropGlobalGoalsAtVersion`)를 저장해 필드 리포트 시 추적 가능하게.
- Fail-safe:
  - DB open 실패/마이그레이션 실패 시 “로컬 only 세이프모드(동기화 off)”로라도 앱이 부팅되도록(Local-first 원칙 준수) 운영 가이드 필요.

### 2) eventBus/subscriber 제거가 다른 기능(quest/xp/waifu/배틀)로 번질 가능성
**위험 요약**
- PR#1에서 `GoalProgressHandler` 제거가 task completion handler 체인의 순서/사이드이펙트에 영향을 줄 수 있음.
- `goal:progressChanged` 타입 삭제는 event bus 타입 맵/유니온에 연결되어 있을 가능성이 있어 “컴파일은 통과하지만 특정 subscriber 등록/초기화 로직이 깨지는” 형태의 회귀가 발생할 수 있음.

**안전장치(가드레일) 권고**
- 우선순위 조정(작은 재정렬 제안):
  - PR#1에서 ‘emit/subscribe 중단’과 ‘event 타입 정의 삭제’를 분리하는 것을 권장.
    - 1차(PR#1a): GoalProgressHandler 제거 + subscriber unregister + emit 제거(행동 변화)
    - 2차(PR#1b 또는 PR#5로 이동): event type 제거(정리)
  - 이유: 타입 삭제는 “연쇄 컴파일 에러”를 만들기 쉬워 회귀 탐지가 어렵고, 반면 emit/subscribe 중단은 런타임 영향만 검증하면 되기 때문.
- 테스트 가드레일:
  - `tests/task-completion.test.ts`, `tests/task-completion-handlers.test.ts`는 필수.
  - 추가로 quest/xp/waifu/battle 관련 핸들러가 붙어 있는지(그리고 여전히 호출되는지)를 확인하는 스모크 테스트 1개를 권장(‘goal 제거가 다른 보상을 끊지 않는다’).
- 런타임 관측:
  - task completion 실행 후 핵심 도메인 이벤트(예: `task:completed`, xp 지급, 퀘스트 진행)가 정상 emit 되는지 최소 로그/SyncLog로 확인 포인트를 남길 것.

### 3) task 모델의 goalId/색상 연동 제거가 UI/UX에 미치는 영향
**영향 요약(의도된 변경 포함)**
- TaskModal에서 goal 선택 UI 제거 시 사용자는 기존에 사용하던 ‘목표 태깅’ 기능을 상실.
- Timeline 색상 매핑 제거는 정보 밀도를 낮추며, 특히 기존 task가 `goalId`를 가진 경우 “색/아이콘이 갑자기 사라짐”으로 인지될 수 있음.

**회귀 포인트**
- 기존 task 데이터에 `goalId`가 남아 있어도 UI가 그 필드를 읽지 않도록 완전히 분리되어야 함(남아있는 참조가 있으면 undefined 접근/크래시).
- 색상 계산 로직이 goalColorMap에 의존했다면, 제거 후 기본 색상/스타일이 비어 보이거나 접근성 대비가 깨질 수 있음(디자인 시스템 토큰 사용 전제).

**안전장치(가드레일) 권고**
- PR#2 검증 체크를 “기능 동작”뿐 아니라 “기존 데이터가 있는 계정에서 크래시 없이 렌더링”으로 명확히 강화.
- PR#5에서 `task.goalId` 필드 자체를 제거하는 것은 이번 Epic에서는 DEFER 권장(데이터 마이그레이션/타입 연쇄 영향이 큼).

### 4) Firebase sync 스키마 변화가 과거 데이터와 충돌할 가능성
**위험 요약**
- PR#3에서 `globalGoals` fetch/strategy 제거는 ‘새 클라이언트가 이 필드를 더 이상 읽지 않는다’는 의미로는 안전하지만,
  - 동기화가 “전체 스냅샷 set(덮어쓰기)” 패턴이라면, 새 클라이언트가 업로드할 때 `globalGoals`를 누락시켜 원격에서 해당 노드를 삭제할 수 있음(구버전/다중 디바이스 시나리오에서 충돌/데이터 손실처럼 보일 수 있음).
- 구버전 앱이 여전히 `globalGoals`를 쓰는 경우, 새 버전에서 로컬 Dexie에 해당 테이블을 제거(PR#4)했다면 “원격에는 존재하지만 로컬에는 없는 데이터”가 생기고, 초기 fetch/리스너 로직이 그 데이터를 어떻게 다루는지에 따라 오류가 날 수 있음(특히 파싱/정규화 단계).

**안전장치(가드레일) 권고**
- PR#3에서 최소한의 호환성 원칙:
  - 초기 fetch 파서가 원격에 남아있는 `globalGoals` 키를 “무시(선택적)”하도록 유지(= optional chaining + default empty)하여 과거 데이터가 있어도 안전.
  - 업로드가 덮어쓰기(set)인지 merge/update인지 확인 후, set이라면 `globalGoals` 누락이 원격 삭제로 이어지지 않도록 전략 변경/가드가 필요(플랜에 검증 항목으로 명시).
- SyncLog 관측:
  - `globalGoals` 관련 업로드/다운로드가 “0이 되었는지”를 확인하는 체크리스트(회귀 탐지) 추가.

## Suggested PR Sequence Adjustments (if needed)
현재 순서는 대체로 합리적이나, “되돌릴 수 없는 변경”을 더 뒤로 보내는 관점에서 아래 조정을 권장한다.
- 권장: PR#1(행동 변화만) → PR#2(UI 연결 제거) → PR#3(sync/repo 제거, 단 파서는 호환 유지) → (릴리즈/soak) → PR#4(Dexie 테이블 제거) → PR#5(정리/타입/문서)
- 특히 PR#4는 **별도 릴리즈**가 가장 안전(운영 롤백/다운그레이드 리스크 때문).
- PR#5에서 `task.goalId` “필드 제거”는 DEFER(별도 Epic) 권장. 이번 Epic에서는 “사용처 0”과 “UI/동기화 미사용”만으로도 목적 달성이 가능.

## Guardrails per PR (tests / asserts / logs)
### PR#1 — 런타임 훅 제거(파이프라인/이벤트/구독자)
- Tests: `tests/task-completion*.test.ts` 필수 + quest/xp/waifu/battle 관련 스모크 1개 권장
- Runtime: task completion 후 핵심 side-effect(xp/quest/waifu)가 여전히 발생하는지 확인 로그 포인트
- Rollback: 코드 revert만으로 복구 가능(타입 삭제는 후순위로 미루면 더 안전)

### PR#2 — UI에서 global goals 연결 제거
- Tests: 기존 테스트 통과 + (가능하면) goalId가 있는 task 렌더 스모크(크래시 방지)
- Runtime: 기존 사용자 데이터(목표/goalId 존재)에서 타임라인/모달이 안전하게 열리는지 수동 체크리스트

### PR#3 — Repo + Firebase sync 제거
- Tests: sync-core/sync-engine 관련 스모크 테스트(동기화 시작/초기 fetch) 우선
- Runtime/Logs: SyncLog에서 `globalGoals` 경로 read/write가 0이 되었는지 확인
- Compatibility: 원격에 남아있는 `globalGoals` 키를 파서가 안전하게 무시하는지(과거 데이터 호환) 체크리스트에 포함

### PR#4 — Dexie `globalGoals` 테이블 제거
- Tests: DB 관련 스모크(오픈/마이그레이션) + 기존 사용자 환경에서 부팅 수동 검증 필수
- Migration log: drop 전 레코드 수/마이그레이션 마커 저장 권장(진단 가능성)
- Ops note: 이 릴리즈는 다운그레이드 위험(사실상 forward-only) 명시 권장

### PR#5 — 잔재 정리
- Tests: 전역 검색 기반 ‘사용처 0’ 체크 + 전체 테스트
- Scope guard: `task.goalId` 필드 삭제는 별도 Epic으로 분리(이번 PR은 “사용처 제거/타입 최소 정리”까지만)

## Questions (to unblock / reduce risk)
1) “완전 제거”에 Firebase 원격 `globalGoals` 노드 삭제까지 포함인가요, 아니면 ‘더 이상 읽지/쓰지 않음(방치)’이면 충분한가요?
2) Electron 배포 특성상 사용자 다운그레이드를 허용해야 하나요? 허용한다면 PR#4(Dexie drop) 릴리즈 전략을 분리하는 것이 사실상 필수입니다.
3) Timeline 색상/아이콘 제거로 인한 UX 변화는 릴리즈 노트/공지에 포함할까요(사용자 혼란 최소화)?

## Risk Assessment
- Overall: Medium → High (PR#4 포함 시 High)
- Highest risks: Dexie 스키마 drop(롤백/다운그레이드), Firebase 업로드가 덮어쓰기(set)일 경우 원격 데이터 삭제/충돌
- Mitigation: PR#4 분리 릴리즈 + sync 업로드 semantics 검증 + event 타입 삭제는 후순위로 이동

## Recommendations (actionable, plan-level)
- PR#4는 가능한 한 마지막 + 별도 릴리즈(soak)로 운영 리스크를 분리.
- eventBus 타입 삭제는 행동 변화 검증 이후로 미루고, 1차는 emit/subscribe 중단에 집중.
- `task.goalId` 필드 제거는 이번 Epic에서 제외(사용처 0 + 동기화 미사용으로 충분히 목적 달성).

## Revision History
- Initial: 2025-12-21 — First critique created.

---

### Note on missing process artifact
- Critic 모드 지침에 따라 `.github/chatmodes/planner.chatmode.md`를 읽으려 했으나, 본 workspace의 `.github/`에는 해당 경로가 존재하지 않았습니다. (대체 문서가 있다면 위치를 알려주면 다음 Revision에서 준수 반영하겠습니다.)

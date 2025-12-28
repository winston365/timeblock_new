# 008 — Critic 우선순위 리스트 아키텍처 검토 (Architecture Findings)

> **Date:** 2025-12-28  
> **Status:** DecisionRecord  
> **Verdict:** **APPROVED_WITH_CHANGES** (아래 조건/수정 반영 시)

## Scope / Constraints
- Renderer(UI) 중심 변경만 허용.
- Repository 경계 준수: DB(Dexie) 직접 접근/ Firebase 직접 호출은 금지(Repository/Sync service 경계 내부에서만).
- 모달 UX 표준: 배경 클릭으로 닫지 않음 + ESC로 닫힘.
- localStorage 금지(테마 예외).

---

## Reviewed Priority List (Critic 제안)
1) Lint 오류 수정 (CI 차단 해제)
2) 배경 클릭 정책 위반 수정 (ADHD UX)
3) `unifiedTaskService` 테스트 확대 (데이터 안전)
4) Sync 모듈 브랜치 커버리지 향상 (동기화 안정성)
5) 테스트 중복 통합 (`time-block-visibility`)
6) Optimistic Update 적용 (ADHD UX)
7) ADHD UX 개선 (항상-위 토글 툴바 이동)
8) 경로 스타일 통일 (alias)
9) 가드 클로즈 추가 (안정성)

### Architecture Verdict (순서 자체)
- **1~2는 그대로 승인**: CI unblock + UX 정책 위반 해소는 리스크 대비 가치가 매우 큼.
- **3~6의 묶음은 ‘의존관계’를 명시해야 승인 가능**: Optimistic Update는 (데이터 경계 + 테스트 안전망 + Sync 보완) 없이 들어가면 “일시적 UX 개선 ↔ 장기 데이터 부채”로 바뀜.
- **5는 3~4 앞당겨도 됨(권고)**: 테스트 중복은 커버리지 작업의 유지비를 낮추므로, 실무적으로는 3~4 전에 정리하는 편이 효율적.
- **9는 2와 결합 권고**: ‘가드 클로즈’가 모달/오버레이 종료 안정성(ESC/stack)과 관련이면 2와 같이 처리하는 편이 정책/테스트가 단단해짐.

### Required Changes (승인 조건)
- Optimistic Update(6)는 **Store-only 또는 Repo-only**로 단순화하지 말고, 아래 ‘권장 패턴(Usecase/Orchestrator + Repo 원칙)’을 따라야 함.
- Sync 커버리지(4)는 “브랜치 %”가 아니라, 아래 ‘Sync 불변조건(Invariants) + 시나리오 테스트’까지 포함하는 방향으로 정의해야 함.

---

## Review Point 1 — Optimistic Update: 어디에 두는 게 맞나?

### 결론
- **Optimistic Update의 ‘의미(UX 즉시 반영)’는 Store/Usecase(오케스트레이터) 레벨에 둔다.**
- **실제 상태 변경(소스 오브 트루스)은 Repository → Dexie 트랜잭션으로 즉시 커밋한다.**
- Firebase Sync는 “사후”이며, 성공/실패/충돌 결과를 다시 Dexie에 반영한다.

즉, 이 프로젝트에서 Optimistic Update는 전통적인 “서버 반영 전 임시 메모리 상태”가 아니라,
**Dexie에 먼저 쓰고(UI는 그 결과를 즉시 반영), Sync는 나중에 따라오는 Local-first write-through**로 정의하는 게 가장 안전하다.

### 권장 패턴: Usecase/Orchestrator + Transactional Outbox(개념)
- **Usecase/Orchestrator(예: store action 또는 `unifiedTaskService`)**
  - “사용자 의도” 단위 API를 제공(예: Inbox↔Block 이동, 완료 토글, 삭제).
  - UI에 즉시 반영되도록 store의 in-memory snapshot을 갱신(현재 구조가 dailyDataStore를 구독하므로 필요).
  - 이벤트 발행이 필요하면 여기서 수행(Repository는 emit 금지 원칙 유지).
- **Repository**
  - Dexie에 원자적으로 반영(가능하면 트랜잭션).
  - Sync에 필요한 metadata(예: updatedAt, deviceId 등)를 일관되게 세팅.
  - (가능 시) Sync 재시도/로그 같은 부가정보는 Sync service 쪽으로 한정.

> 핵심: “UI 즉시 반영”은 Orchestrator 책임, “DB 일관성/원자성”은 Repository 책임.

### 왜 Store 레벨 단독(메모리만) 또는 Repo 레벨 단독이 위험한가
- **Store 단독(메모리만)**: 앱 재시작/다른 표면/다른 store 구독과 쉽게 불일치가 생김.
- **Repo 단독**: Repo가 UI 상태/이벤트를 직접 알게 되면 경계가 붕괴(테스트/변경 비용 급증).

### Acceptance Criteria (Optimistic Update)
- 실패 시 롤백은 “메모리 롤백”이 아니라, **Dexie 롤백 또는 재조정(reconcile) + UI 재반영**으로 정의.
- Inbox↔Block 이동은 **단일 코드 경로**를 보장(어느 화면에서 실행해도 동일).

---

## Review Point 2 — Sync 안정성: 브랜치 커버리지는 충분조건인가?

### 결론
- **브랜치 커버리지는 ‘필요조건’에 가깝고, ‘충분조건’이 아니다.**
- Sync 견고함을 보장하려면 커버리지 목표를 “실패 모드/충돌 모드/재시도 모드” 중심의 **시나리오 기반 계약(Contract) + 불변조건(Invariants)**로 재정의해야 한다.

### 추가로 필요한 아키텍처적 보완(최소)
- **불변조건(Invariants) 명문화**
  - 예: “같은 op를 두 번 적용해도 결과는 동일(idempotent)”, “local 변경은 Dexie에 남고, sync 실패는 큐/로그로 추적된다”, “충돌 해결은 결정적(deterministic)이다”.
- **시나리오 테스트 코퍼스**
  - 네트워크 실패/타임아웃/재시도/중복 이벤트/역순 적용(out-of-order)/동시 수정(두 디바이스) 같은 실제 모드가 최소 셋업으로 재현 가능해야 함.
- **관측성(Observability) 가드레일**
  - Sync 로그(이미 존재)를 기준으로 “실패 → 재시도 → 성공/포기”의 상태 전이가 추적 가능해야 함.

> 참고: `conflictResolver`는 이미 순수 함수로 분리되어 있어(테스트 친화), “엔진/큐/리스너 생명주기” 쪽이 실제 취약점이 될 가능성이 큼.

---

## Review Point 3 — 데이터 무결성: `unifiedTaskService` 테스트 확대면 충분한가?

### 결론
- **`unifiedTaskService` 테스트 확대는 ‘핵심 안전망’이지만, 단독으로 데이터 무결성을 보장하긴 부족하다.**

### 이유
- 서비스 레벨 테스트는 “의도한 연산이 올바른 저장소(dailyData vs inbox)에 반영되는가”를 보장하지만,
  다음 영역은 별도 보강이 필요하다.
  - **경계 테스트**: Repository가 Dexie에 저장하는 형태 자체가 항상 유효한가(스키마/필드/updatedAt 규칙).
  - **교차-집합 불변조건**: task가 inbox와 dailyData에 동시에 존재/유령 상태가 되는지.
  - **실패 모드**: 중간 실패(한쪽 저장 성공, 다른쪽 실패) 시 일관성.

### 보완 제안(아키텍처 요구)
- `unifiedTaskService` 테스트는 “기능 단위(usecase) 계약 테스트”로 정의하고,
  Repository/Sync 쪽에는 “불변조건/실패 모드” 테스트를 별도로 둬야 한다.

---

## Review Point 4 — `AppShell` 리팩토링 보류는 기술부채가 되나?

### 관찰(현재 상태)
- `AppShell`은 이미 custom hooks로 로직을 분리해 ‘God component’ 위험을 크게 낮춘 상태.
- 다만 ‘항상-위 토글’처럼 UI/설정/IPC 호출이 엮이는 기능은 AppShell에 남기 쉬워, **추가 기능이 계속 쌓이면 다시 비대화될 위험**이 있다.

### 결론
- 지금 우선순위에서 AppShell 대규모 리팩토링을 뒤로 미루는 건 합리적이다(테스트/정합성/CI unblock이 우선).
- 대신 **가드레일(규칙)**을 명시해야 기술부채로 번지지 않는다.

### 가드레일(필수)
- AppShell은 “Composition Root”로 유지하고, 신규 side-effect는 hook/service로 내린다.
- 새로운 기능을 AppShell에 추가해야 한다면, 반드시 “hook으로 캡슐화 + 테스트 가능 형태”로 넣는다.

---

## Final Verdict
**APPROVED_WITH_CHANGES**
- 우선순위 방향은 대체로 옳고, 특히 1~2를 최우선으로 둔 판단은 아키텍처적으로도 타당.
- 다만 6(Optimistic Update)은 반드시 “Dexie write-through + Orchestrator(단일 코드 경로)” 패턴을 따르고,
  4(Sync 커버리지)는 “브랜치 %”가 아니라 “시나리오/불변조건” 중심으로 목표를 재정의해야 한다.

# Plan Header
- Plan ID: plan-2025-12-28-pr4-7-detailed-task-list
- Target Release: **1.0.171** (reference: agent-output/planning/049-foundation-roadmap-pr-stack-2025-12-28.md)
- Epic Alignment: 회귀 방지(테스트) + 동기화 안정성 + Visibility 일관성 + Optimistic Update 안전 도입
- Status: Draft (Pending approval)

## Changelog
- 2025-12-28: Draft created from agent-output/analysis/051-pr4-7-testing-optimistic-analysis.md and agent-output/planning/049-foundation-roadmap-pr-stack-2025-12-28.md.

## Value Statement and Business Objective
As a 사용자(특히 ADHD 사용자), I want task 이동/업데이트와 동기화가 “실패해도 망가지지 않게” 테스트로 보호되고, visibility 규칙이 한 곳에서 확정되며, optimistic update가 롤백까지 안전하게 동작해서, so that 계획/실행 흐름이 끊기지 않고 데이터 무결성과 개발 속도가 함께 올라간다.

## Scope & Constraints
- 범위: PR4~PR7에 해당하는 테스트/유틸/서비스·스토어 변경. (Renderer/Frontend 중심)
- 제외: Electron IPC/백엔드/서버 구현, 새로운 원격 스키마 변경
- 정책: localStorage 금지(theme만 예외), defaults 단일 출처 사용, nested access는 optional chaining 우선

## Naming Note (Important)
- 이 문서의 “PR4~PR7” 번호는 **오빠가 요청한 PR 스택 기준**이다.
- 기존 로드맵 문서(049)에서는 PR 번호 체계가 다를 수 있으니, 구현/리뷰 시 제목(예: “PR 7 (Optimistic Update)”)을 기준으로 매칭한다.

## Recommended Order / Dependencies
1) PR4 (unifiedTaskService 테스트) → 2) PR5 (sync 시나리오 테스트) → 3) PR6 (visibility 테스트 통합) → 4) PR7 (optimistic update)
- PR7은 리스크가 크므로 PR4~PR6이 먼저 들어가는 것을 강력 권장(안전망).

---

# PR 4 — unifiedTaskService 테스트 확대

## 목표
- dual-storage(inbox/daily) + 최근 7일 fallback + 에러 래핑 계약을 테스트로 고정해 회귀 위험을 낮춘다.

### Task 4.0 (Prep) — 기준선 확인 및 테스트 스캐폴딩 정리
- 수행 내용
  - 기존 테스트가 어떤 repository/store mock 패턴을 쓰는지 확인하고, 재사용 가능한 fixture/헬퍼(작업 생성, 날짜 생성, inbox/daily 세팅)를 정리한다.
  - coverage 기준선(현재 unifiedTaskService line/branch)을 기록해 PR 종료 시 개선 확인이 가능하게 한다.
- 대상 파일
  - tests/unified-task-service.test.ts
  - src/shared/services/task/unifiedTaskService.ts
  - (필요 시) tests/setup.ts
- 완료 조건
  - `npx vitest run tests/unified-task-service.test.ts` 통과
  - PR4에 포함될 “추가할 테스트 영역 체크리스트”가 문서/PR 설명에 5~10줄로 정리됨

### Task 4.1 — not_found 및 에러 코드 전파 테스트 추가
- 수행 내용
  - not_found 경로(찾지 못함)가 명확히 `null`/`false` 등 계약대로 반환되는지 테스트로 고정한다.
  - update/delete/toggle 등 “쓰기” 경로에서 repository 오류가 표준 에러 코드로 래핑/전파되는 계약을 테스트로 고정한다.
- 대상 파일
  - tests/unified-task-service.test.ts
  - src/shared/services/task/unifiedTaskService.ts (테스트 가능하도록 최소 수준의 구조 정리만 허용)
- 완료 조건
  - 신규 테스트가 기존 계약을 깨지 않고 통과
  - 실패 경로(예: repo throw, not-found)가 테스트로 커버됨(브랜치 커버리지 상승 확인)

### Task 4.2 — inbox vs daily 중복 ID 우선순위 + 최근 7일 fallback 검색 테스트
- 수행 내용
  - 동일 taskId가 inbox와 daily에 동시에 존재할 때 “어느 쪽이 우선인지”를 테스트로 명시한다.
  - today가 아닌 날짜에 있을 수 있는 task를 찾기 위한 최근 7일 fallback 탐색(날짜 힌트 포함)이 의도된 순서대로 동작하는지 테스트로 고정한다.
- 대상 파일
  - tests/unified-task-service.test.ts
  - src/shared/services/task/unifiedTaskService.ts
- 완료 조건
  - 우선순위 규칙이 테스트로 명확히 드러나고(회귀 방지), 변경 시 테스트가 깨질 수 있는 형태로 보호됨
  - 최근 7일 fallback 탐색 분기(검색 히트/미스)가 테스트로 커버됨

### Task 4.3 — getAllActive/getUncompleted 집계 무결성 + 빈 데이터 방어 테스트
- 수행 내용
  - getAllActive/getUncompleted가 inbox + daily 데이터를 합산할 때 중복/누락 없이 집계되는지 테스트한다.
  - 빈 데이터/부분 데이터(예: dailyData.tasks 비어있음, undefined/예상치 못한 형태)에 대해 안전하게 동작하는지 방어 테스트를 추가한다.
- 대상 파일
  - tests/unified-task-service.test.ts
  - src/shared/services/task/unifiedTaskService.ts
- 완료 조건
  - 집계 결과의 기본 무결성(중복 방지/누락 방지)이 테스트로 보호됨
  - 빈/부분 데이터 입력에서도 예외 없이 동작하거나(계약에 따라) 예측 가능한 결과를 반환함

---

# PR 5 — Sync 시나리오 테스트 추가

## 목표
- “오프라인→재시도 큐→재연결 드레인”, “리스너 라이프사이클/중복 방지”, “전략 기반 충돌 해결 결정성”을 시나리오 단위로 보호한다.

### Task 5.0 (Prep) — 시나리오 테스트용 공통 harness 정리
- 수행 내용
  - 기존 sync-core/sync-retry-queue 테스트의 mock 패턴을 재사용 가능한 형태로 정리한다.
  - 타이머/백오프가 포함되므로 fake timers 사용 여부를 결정하고, 테스트가 flaky하지 않도록 표준 패턴을 정한다.
- 대상 파일
  - tests/sync-core.test.ts
  - tests/sync-retry-queue.test.ts
  - (신규 가능) tests/sync-scenarios.test.ts
- 완료 조건
  - 시나리오 테스트 추가가 가능한 최소 공통 세팅이 준비됨(중복 mock 제거)
  - 기존 sync 관련 테스트 전부 통과

### Task 5.1 — 오프라인 → 재시도 큐 적재 → 재연결 시 드레인(Drain) 흐름 테스트
- 수행 내용
  - sync write 실패(오프라인/네트워크 실패 가정) 시 retry queue에 적재되는지 확인한다.
  - “재연결/재시도 트리거”가 발생했을 때 큐가 의도대로 드레인되고, 성공/실패에 따라 항목이 유지/삭제되는지 시나리오로 고정한다.
- 대상 파일
  - src/shared/services/sync/firebase/syncCore.ts
  - src/shared/services/sync/firebase/syncRetryQueue.ts
  - tests/sync-core.test.ts 또는 tests/sync-scenarios.test.ts
- 완료 조건
  - 오프라인→enqueue→재연결→drain 흐름이 테스트로 재현되고 안정적으로 통과
  - backoff/max retries 같은 핵심 분기가 적어도 1회 이상 시나리오 커버됨

### Task 5.2 — 리스너 재부착/중복 방지 및 해시 캐시(Dedupe) 검증 테스트
- 수행 내용
  - disconnect/재초기화 상황을 가정하고 listener가 중복으로 붙지 않는지(attach/reuse, refCount) 시나리오로 고정한다.
  - 동일 payload 반복 수신/적용 시 해시 dedupe로 “중복 적용이 방지”되는지 확인한다.
- 대상 파일
  - src/shared/services/sync/firebase/rtdbListenerRegistry.ts
  - src/shared/services/sync/firebase/syncCore.ts
  - tests/rtdb-listener-registry.test.ts
  - tests/sync-core.test.ts 또는 tests/sync-scenarios.test.ts
- 완료 조건
  - 리스너 중복 방지/재부착 안전성이 테스트로 보호됨
  - 동일 데이터 반복 수신 시 적용이 중복되지 않는 계약이 테스트로 고정됨

### Task 5.3 — 전략별(LWW, mergeTaskArray 등) 충돌 해결 결정성 테스트
- 수행 내용
  - 동일 입력(local/remote/base)이 여러 번 들어와도 항상 같은 결과가 나오는 “결정성(determinism)”을 보장하는 테스트를 추가한다.
  - 전략별로 대표 merge 경로(특히 task array merge, timestamp 비교, 필드 누락)를 시나리오 또는 단위 테스트로 보강한다.
- 대상 파일
  - src/shared/services/sync/firebase/conflictResolver.ts
  - tests/conflict-resolver.test.ts
  - (신규 가능) tests/sync-strategy-determinism.test.ts
- 완료 조건
  - 결정성(같은 입력→같은 출력)이 테스트로 고정됨
  - 전략별 핵심 분기 커버리지가 의미 있게 증가

---

# PR 6 — Visibility 테스트 통합

## 목표
- 중복 테스트 파일을 1개로 통합하고, 엣지 케이스를 보강하며, 테스트 임포트를 `@/` alias로 통일한다.

### Task 6.0 (Prep) — Windows 케이스-인센서티브 충돌 리스크 점검
- 수행 내용
  - tests/time-block-visibility.test.ts 와 tests/timeblock-visibility.test.ts 는 Windows에서 파일명 케이스 충돌/혼동 위험이 있다.
  - 통합 시 git rename/delete 순서를 안전하게 가져가도록 작업 순서를 정한다.
- 대상 파일
  - tests/time-block-visibility.test.ts
  - tests/timeblock-visibility.test.ts
- 완료 조건
  - 통합 PR에서 파일 rename/delete가 안전하게 반영되는 절차가 PR 설명에 명시됨

### Task 6.1 — 두 테스트 파일 통합 (파일명: tests/time-block-visibility.test.ts 권장)
- 수행 내용
  - 두 파일의 “고유 커버리지”를 하나의 canonical 테스트 스위트로 합친다.
  - 중복 케이스는 제거하되, hide-past/hide-future/current-only/all 모드가 한 파일에서 모두 보이도록 정리한다.
- 대상 파일
  - tests/time-block-visibility.test.ts (최종)
  - tests/timeblock-visibility.test.ts (삭제)
- 완료 조건
  - `npx vitest run` 통과
  - visibility 관련 테스트가 단일 파일로만 존재(중복 제거)

### Task 6.2 — 경계 시간/out-of-range/NaN/비정수 입력 등 엣지 케이스 테스트 보강
- 수행 내용
  - 경계 시간(블록 시작/끝), 범위를 벗어난 hour, NaN/비정수 hour 같은 입력에 대한 현재 계약을 테스트로 고정한다.
  - (결정 필요 시) “throw vs clamp vs empty 반환” 중 프로젝트 정책에 맞는 방향으로 명시한다.
- 대상 파일
  - tests/time-block-visibility.test.ts
  - (필요 시) src/features/schedule/utils/timeBlockVisibility.ts
- 완료 조건
  - 엣지 입력이 테스트로 커버되고, 결과가 예측 가능하게 문서화됨(테스트가 곧 계약)

### Task 6.3 — 모든 임포트 경로를 `@/` alias로 통일
- 수행 내용
  - visibility 테스트(및 필요 시 관련 테스트)에서 상대경로 import를 제거하고 `@/` alias로 통일한다.
- 대상 파일
  - tests/time-block-visibility.test.ts
- 완료 조건
  - 테스트 파일 내 import 스타일이 일관됨(상대경로 제거)
  - `npx vitest run` 통과

---

# PR 7 — Optimistic Update

## 목표
- unifiedTaskService 업데이트 경로에 optimistic 옵션을 도입하되, 기존 store의 optimistic/rollback 로직과 충돌하지 않게 “위임 구조”로 설계한다.

### Task 7.0 (Decision) — optimistic의 책임 위치 확정(서비스 vs 스토어)
- 수행 내용
  - unifiedTaskService가 “직접 optimistic 상태를 만들지” 아니면 “스토어(dailyDataStore/inboxStore)에 위임할지”를 확정한다.
  - 분석(051) 권고대로, 중복 상태 변이를 피하기 위해 **스토어 위임**을 기본안으로 둔다.
- 대상 파일
  - src/shared/services/task/unifiedTaskService.ts
  - src/shared/stores/dailyDataStore.ts
  - src/shared/stores/inboxStore.ts
- 완료 조건
  - PR 설명에 ‘optimistic 책임 위치’가 5~10줄로 명확히 기록됨
  - 기존 optimistic(스토어)와 서비스 경로가 중복 적용되지 않는 구조로 합의됨

### Task 7.1 — unifiedTaskService 업데이트 메서드에 optimistic 옵션 추가 및 Store 위임 구조 설계
- 수행 내용
  - update/delete/toggle 등 “쓰기” 메서드에 optimistic 옵션을 추가한다.
  - optimistic=true일 때는 store의 optimistic API(rollback/재검증 포함)를 호출하도록 위임한다.
  - optimistic=false(기본)일 때는 기존 동작(Repo write → store refresh)을 유지한다.
- 대상 파일
  - src/shared/services/task/unifiedTaskService.ts
  - src/shared/stores/dailyDataStore.ts
  - src/shared/stores/inboxStore.ts
- 완료 조건
  - 기존 호출부가 깨지지 않음(기본값 보존)
  - optimistic=true 경로가 store 위임으로만 동작(중복 Dexie write 방지)

### Task 7.2 — Dexie 커밋 전/후 Store 상태 정합성 검증 테스트 작성
- 수행 내용
  - optimistic 적용 시점(커밋 전)과 커밋 성공/실패 이후(커밋 후/롤백 후) store 상태가 일관적인지 검증하는 테스트를 작성한다.
  - 테스트는 “스토어 상태”와 “Dexie 상태”가 불일치로 남지 않는 것을 목표로 한다.
- 대상 파일
  - (신규 가능) tests/optimistic-update.test.ts
  - (참조/보강) tests/db-access-boundary.test.ts
  - src/shared/stores/dailyDataStore.ts
  - src/shared/stores/inboxStore.ts
- 완료 조건
  - optimistic 성공/실패(롤백) 모두에서 store↔Dexie 정합성이 테스트로 보호됨
  - `npx vitest run` 통과

### Task 7.3 — inbox ↔ block 이동 시 낙관적 갱신 및 롤백 시나리오 구현
- 수행 내용
  - inbox에서 timeBlock 배치(=block 이동) 시 UI가 즉시 반영되도록 optimistic 갱신을 적용한다.
  - 저장 실패 시 원래 위치로 되돌아가는 롤백과, 후속 revalidate/refresh가 중복 상태를 만들지 않도록 정리한다.
- 대상 파일
  - src/shared/stores/inboxStore.ts
  - src/shared/stores/dailyDataStore.ts
  - src/shared/services/task/unifiedTaskService.ts
  - (필요 시) src/features/tasks/InboxTab.tsx
  - tests/optimistic-update.test.ts
- 완료 조건
  - inbox→block 이동이 즉시 반영되고, 실패 시 롤백이 안정적으로 동작
  - 중복 task/유령 task가 남지 않는 것이 테스트로 보호됨

---

## Validation (High-level)
- 테스트: `npx vitest run`
- 커버리지 확인(권장): `npx vitest run --coverage` (unifiedTaskService/syncCore/conflictResolver 브랜치 상승 확인)

## Version / Release Artifacts (Milestone)
- PR4~PR7 자체는 기능/테스트 PR이며, 버전 bump는 배치 릴리즈 PR에서 처리하는 것을 권장한다.
- Reference: agent-output/planning/049-foundation-roadmap-pr-stack-2025-12-28.md (Target Release 1.0.171, split 여부는 OPEN QUESTION)

## OPEN QUESTION (승인 필요)
1) 오빠, 이번 배치를 1.0.171 한 번에 묶을까요, 아니면 PR6~PR7(Visibility/Optimistic)을 1.0.172+로 분리할까요?
2) Visibility: invalid hour 입력(NaN/비정수/out-of-range)에서 “현재 계약”을 유지(빈 결과/false)로 고정할까요, 아니면 throw/clamp로 바꿀까요?
3) PR7: optimistic 책임은 “스토어 위임”을 기본으로 가도 괜찮을까요? (서비스가 직접 Dexie+store를 둘 다 만지면 중복 변이 위험이 큼)

## Handoff
- Critic 리뷰 요청: 범위 과대/PR 쪼개기 수준/OPEN QUESTION 처리 순서를 점검한 뒤 Implementer에게 전달한다.

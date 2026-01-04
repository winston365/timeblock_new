# 005 — Long-term Goals (Weekly) Frontend Architecture Findings

Date: 2025-12-21
Status: DecisionRecord
Scope: Frontend/Renderer 중심(React + TS). **백엔드·Supabase·Electron IPC 구현은 범위 밖**.

## Changelog
| Date | Handoff/Request | Outcome Summary |
|---|---|---|
| 2025-12-21 | User: “장기목표 기능 개선 추천안(프론트/UI 중심) — 모델/상태/UI 분리 + 이벤트/사이드이펙트 연동 지점” | 현 구조 기반 옵션 3개(A/B/C) 제시. 권고안: A(저위험 하드닝 + 기능-우선 분리) 채택, B는 후속 강화로 분리. |

## Current State (as-is) — What exists
**도메인 의미론이 2개로 분리**되어 있음.

- Weekly goals (장기목표/주간): 수동 카운터 모델
  - Type: [src/shared/types/domain.ts](../../src/shared/types/domain.ts)
  - UI: [src/features/goals/WeeklyGoalPanel.tsx](../../src/features/goals/WeeklyGoalPanel.tsx), [src/features/goals/WeeklyGoalCard.tsx](../../src/features/goals/WeeklyGoalCard.tsx), [src/features/goals/WeeklyGoalModal.tsx](../../src/features/goals/WeeklyGoalModal.tsx)
  - Store: [src/shared/stores/weeklyGoalStore.ts](../../src/shared/stores/weeklyGoalStore.ts)
  - Repo: [src/data/repositories/weeklyGoalRepository.ts](../../src/data/repositories/weeklyGoalRepository.ts)
  - Side-effect: repo가 load 시점에 weekStartDate 경계(월요일) 자동 reset + history append + Firebase bulk sync 수행

- Global goals (작업 기반/오늘 정합): task(goalId) 연결 기반
  - Store: [src/shared/stores/goalStore.ts](../../src/shared/stores/goalStore.ts)
  - Repo: [src/data/repositories/globalGoalRepository.ts](../../src/data/repositories/globalGoalRepository.ts)
  - Side-effect: 오늘 날짜에 한해 scheduled tasks(timeBlock != null)로 planned/completed 재계산

- Event / pipeline 연동
  - Task completion pipeline는 global goal만 업데이트: [src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts](../../src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts)
  - EventBus subscriber도 global goal만 재계산: [src/shared/subscribers/goalSubscriber.ts](../../src/shared/subscribers/goalSubscriber.ts)
  - Weekly goal은 task completion/eventbus와 **연동 없음** (순수 수동 증감)

## Key Problems (frontend architecture lens)
1) **경계 검증(Validation) 체계가 일관되지 않음**
- WeeklyGoal은 TS interface 기반이며, repo에 normalize 함수(부분 방어)가 있으나 “명시적인 DTO/스키마”가 없음.
- 앱 정책상 중첩 optional chaining/기본값 단일 출처가 중요한데, WeeklyGoal UI는 하드코딩 색상/기본값이 산재.

2) **UI 규칙 위반/불일치 위험**
- WeeklyGoalPanel/WeeklyGoalCard/WeeklyGoalModal에 `confirm()`/`alert()` 존재 → “모달 UX 통일(배경클릭 X + ESC 닫기)” 정책과 충돌.

3) **상태/사이드이펙트가 UI 클릭 빈도에 과도하게 종속**
- Weekly progress 변경은 Dexie write 후 Firebase에 ‘전체 goals’를 bulk sync 하는 패턴이 반복될 수 있어(특히 +/- 연타) 성능·비용 리스크.

4) **목표 의미론 분리로 인해 사용자/코드가 혼동**
- weekly는 수동 카운터, global은 task 기반.
- 둘을 “Goal”로 묶어 이야기하기 어렵고, 이벤트/파이프라인도 global에만 붙어서 확장 시 경계가 흔들리기 쉬움.

---

## Option A — Weekly Goal Hardening + Feature-first UI 분리 (Low risk, No new deps)
**의미론 분리는 유지**(weekly=수동 카운터). 기존 zustand/dexie/repository 패턴을 그대로 존중하면서 “구조/규칙 준수/검증”에 집중.

### 1) Domain model / types (zod 포함 관점)
- **정본 TS 타입은 유지**: `WeeklyGoal`, `WeeklyGoalHistory`는 `src/shared/types/domain.ts`에 계속 둔다.
- **입력 타입을 분리**: `WeeklyGoalCreateInput`, `WeeklyGoalUpdatePatch` 같은 *UI 입력용 타입*을 별도로 정의(예: feature-local `types.ts`).
- **zod은 ‘후속 도입 준비’로 설계만 반영**
  - 현재 deps에 zod가 없으므로 즉시 도입 대신, repository boundary에 단일 `normalizeWeeklyGoal()`을 “스키마 대체”로 명시.
  - 추후 Option B로 갈 때 `normalize`를 `weeklyGoalSchema.safeParse`로 대체 가능하도록 DTO 경계를 문서화.

### 2) State management
- Store는 계속 `src/shared/stores/weeklyGoalStore.ts`에 둔다(공용 상태).
- Store 책임을 “UI orchestration + optimistic state”로 명확히 하고, **repository는 IO + 영속화만** 담당하도록 경계 문서화.
- 패널에서 `loadGoals()` 호출 시, store에 `initialized` 가드(1회 로드) 같은 *수명주기 정책*을 두는 것을 권장(중복 로드/리셋 부작용 감소).

### 3) UI component 분리 (feature-first)
- `src/features/goals/` 하위에 `weekly/` 서브패키지로 정리 권장.
  - `weekly/components/*` (Card/Modal/History/ProgressBar)
  - `weekly/hooks/*` (controller/view-model hook)
  - `weekly/utils/*` (catchUp 계산, 숫자 파싱)
  - `weekly/constants/*` (quick buttons, icon/unit presets)
- `confirm/alert`는 공통 모달/토스트로 대체(정책 준수). 현재 `useModalEscapeClose`가 이미 있으므로 이를 기준으로 통일.

### 4) 이벤트/사이드이펙트 연동 지점
- Weekly는 task completion과 분리 유지.
- 다만 “사이드이펙트 관찰 가능성”을 위해 다음 이벤트 지점을 문서화(emit은 store에서만):
  - `weeklyGoal:progressChanged` (goalId, delta|newValue)
  - `weeklyGoal:weekReset` (oldWeekStart, newWeekStart, affectedCount)
- Subscriber는 필수는 아니며, 존재한다면 “sync flush / sync log” 정도의 보조 역할로 한정.

**Pros**
- 회귀 위험 낮음. 현 UX를 보존하면서 규칙 위반/구조 부채를 먼저 정리.
- 의미론 충돌(weekly vs global)을 억지로 해결하지 않아, UI-only 제약에 잘 맞음.

**Cons**
- weekly goal이 task와 계속 분리되어 ‘수동 진행도’가 실제 작업과 어긋날 수 있음.
- zod 기반의 엄격한 런타임 검증은 즉시 얻지 못함(후속).

**Fit when**
- “UI 일관성(모달/검증) + 유지보수성”이 우선이고, 데이터 마이그레이션/의미론 통합은 다음 단계로 미루고 싶을 때.

---

## Option B — Zod Boundary Validation + ViewModel Hook (Medium risk, adds dependency)
Option A 위에 **zod를 도입**해, Dexie/Firebase 경계에서 DTO를 강제 검증/정규화한다.

### 1) Domain model / types (zod 포함)
- `WeeklyGoal`은 여전히 TS interface로 유지하되,
- `WeeklyGoalDTO`(persistence shape)를 정의하고 `weeklyGoalSchema`로 parse한다.
- Repository에서 `loadWeeklyGoals()` 반환 전에 `safeParse`로 검증하고, 실패 시:
  - (정책) 최소한의 값으로 복구하거나
  - (정책) 해당 엔트리를 제외하고 sync 로그에 남긴다.

### 2) State management
- Store는 “검증된 WeeklyGoal만 상태에 올린다”를 보장.
- UI 입력은 zod로 검증(`WeeklyGoalCreateSchema`)하여 `alert` 대신 form error 상태로 처리.

### 3) UI 분리
- `useWeeklyGoalsController()` 같은 hook을 도입해, 컴포넌트는 render-only로 단순화.

### 4) 이벤트/사이드이펙트
- store emit 이벤트 payload는 schema로 고정하여 subscriber/telemetry가 안전하게 소비 가능.

**Pros**
- 데이터 정합성(클럭 스큐/이전 버전 데이터/부분 손상)에 강해짐.
- “정규화 함수 난립”을 스키마로 수렴.

**Cons**
- 신규 deps(zod) 추가 + 번들/런타임 비용.
- 기존 데이터가 스키마에 맞지 않을 때 정책 결정을 요구(버림/복구).

**Fit when**
- Firebase/Dexie 경계에서 데이터 손상/이상치가 관측되고, 장기적으로 sync 안정성이 중요할 때.

---

## Option C — Unified Goals Semantics + Pipeline Integration (High impact)
weekly/global을 장기적으로 하나의 “Goal 도메인”으로 통합하거나, 최소한 task completion 파이프라인이 weekly까지 업데이트하도록 확장.

### 핵심 아이디어
- `goalId` 하나로는 weekly/global을 구분 못하므로, `GoalRef = { kind, id }` 같은 식별자를 도입하거나 별도 필드를 둔다.
- TaskCompletion pipeline에 `WeeklyGoalProgressHandler`를 추가해, task 완료 시 weekly goal도 규칙 기반으로 업데이트한다.

**Pros**
- “목표=작업 기반”으로 의미론을 정리할 수 있어 사용자 혼란이 줄어들 수 있음.
- 이벤트/사이드이펙트가 단일 파이프라인으로 모여 관측/테스트 용이.

**Cons**
- 스키마 변경/마이그레이션이 사실상 필요(Front-only라도 Dexie schema/데이터 변환 작업이 큼).
- 제품 정책(weekly를 ‘시간’으로 볼지, ‘개수’로 볼지, task와 매핑 규칙) 결정이 선행돼야 함.

**Fit when**
- weekly 목표를 반드시 작업 기반으로 만들고 싶고, 데이터 마이그레이션/정책 결정을 감수할 준비가 됐을 때.

---

## Recommendation
**추천: Option A (Hardening + feature-first 분리)**

### Assumptions
- weekly goal은 당분간 “수동 카운터”로 유지한다(작업과 자동 연동하지 않음).
- zod는 즉시 도입하지 않고, repo boundary의 `normalize`를 단일 출처로 운영한다.

### Trade-offs / sacrifices
- ‘실제 작업 ↔ weekly progress’의 자동 정합은 포기한다(드리프트 가능).
- sync 성능 최적화(디바운스/배치/flush)는 설계만 남기고 즉시 구현하지 않을 수 있다.

### Follow-up (if/when)
- 데이터 손상/클럭 스큐 이슈가 실제로 발생하거나 Firebase 비용이 임계치라면 Option B로 전환(스키마 검증 수렴).
- 제품이 weekly 목표를 작업 기반으로 정의하려면 Option C를 별도 Epic으로 분리(정책/마이그레이션/회귀 계획 포함).

## Verdict
APPROVED_WITH_CHANGES
- Option A로 진행하되, **모달 UX 규칙 위반(confirm/alert)을 반드시 제거**하고, 기능-우선 구조로 컴포넌트를 재배치할 것.

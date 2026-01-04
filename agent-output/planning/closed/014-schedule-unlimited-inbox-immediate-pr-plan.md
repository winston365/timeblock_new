# Plan: Schedule 무제한(3개 제한 제거) + Inbox→TimeBlock 즉시 반영 (PR Plan)

## Plan Header
- Plan ID: plan-2025-12-23-schedule-unlimited-inbox-immediate
- Target Release: **1.0.165 (제안, 현재 package.json = 1.0.164 기준 patch +1)**
- Epic Alignment: “Schedule에서 작업 배치의 인위적 제약 제거 + Inbox→Schedule 배치가 즉시 보이도록 피드백 루프 단축”
- Status: QA Complete

## Changelog
- 2025-12-23: 2개 변경사항(무제한/즉시 반영) 단일 PR 기준으로 범위/커밋/리스크/테스트 영향 정리.
- 2025-12-23: QA 완료. `agent-output/qa/014-schedule-unlimited-inbox-immediate-qa.md`에 테스트/리스크/커버리지 분석 기록.

## References
- Architecture Decision: [agent-output/architecture/007-schedule-unlimited-optimistic-update-architecture-findings.md](../architecture/007-schedule-unlimited-optimistic-update-architecture-findings.md)
- Supporting Analysis: [agent-output/analysis/014-three-hour-bucket-ui-surfaces-analysis.md](../analysis/014-three-hour-bucket-ui-surfaces-analysis.md)

---

## Value Statement and Business Objective
As a 사용자, I want (1) 스케줄 타임블록에 작업을 원하는 만큼 넣을 수 있고, (2) 인박스에서 특정 시간대로 배치하면 새로고침 없이 즉시 스케줄에 나타나서, so that 계획/실행 흐름이 끊기지 않고(특히 ADHD 친화적으로) “했는데 안 보이는” 불안/혼란을 줄일 수 있다.

## Objective
1) **Schedule task limit(3개)** 관련 “가드/disabled/toast”를 제거하여 **무제한 배치**가 가능하도록 한다.
2) Inbox에서 timeBlock/hourSlot을 설정(버튼/드롭/편집)하면 **schedule UI가 즉시 반영**되도록, store/repo 호출 경로를 일관화하고 **optimistic update**를 적용한다.

## Scope / Constraints
- Frontend/Renderer(UI)만.
- Repository pattern 유지: store는 repository를 통해 영속화(직접 Dexie 호출 금지).
- localStorage 금지(테마 예외만).
- 기본값은 `src/shared/constants/defaults.ts`에서만 가져온다.
- Nested object 접근은 optional chaining 사용.
- 모달 UX 정책(배경 클릭 닫기 금지, ESC 닫기) 변경 없음.

## Out of Scope (명시)
- Dexie 스키마 변경/마이그레이션.
- Firebase/Supabase/Electron IPC 변경.
- “월간/주간 캘린더 셀에서 3개만 표시 + 더보기” 같은 **표시용 slice(0,3)** 정책 변경(예: `MonthlyScheduleView.tsx`) — 이번 요구가 ‘Schedule view(일일 스케줄)’에 한정이라는 가정.
- Inbox 탭의 ‘최근 3개’ 필터(의도된 UX로 보임) 변경.

## Assumptions
- “Schedule view task limit 3”은 **일일 스케줄(timeblock bucket) 배치**의 강제 제한을 의미하며, entrypoint(드롭/인라인 추가/모달 저장/미션 추가 등)에 공통으로 적용되는 제한을 제거하는 것이 목표다.
- “즉시 반영”은 “성공 시 즉시 UI 반영 + 실패 시 롤백/에러 표기”까지 포함한다(단순히 refresh를 빨리 하는 것이 아님).
- Release 타겟은 운영 정책상 patch +1이 허용된다고 가정한다(다른 PR이 이미 1.0.165를 사용하면 1.0.166으로 조정 필요).

## OPEN QUESTION (승인 필요)
- 무제한 정책을 **MissionModal(배틀 미션 추가)**에도 동일 적용할까요? (현재도 `MAX_TASKS_PER_BLOCK` 기반으로 제한을 강제)

---

# PR Approach Options (Trade-offs)

## Option 1 — 단일 PR (추천)
- Pros: 두 변경이 “같은 사용자 흐름(배치/즉시 확인)”을 완성된 경험으로 제공, store 경로 정리가 한 번에 끝남.
- Cons: 변경 파일이 다소 넓어 회귀 범위 증가.
- Appropriate when: 배포를 빠르게 하고, 커밋을 잘게 나눠 리뷰/롤백 용이하게 운영할 때.

## Option 2 — PR 2개로 분리(무제한 → 즉시 반영)
- Pros: 회귀 격리, 원인/효과가 더 명확.
- Cons: “제한은 사라졌는데 즉시 반영은 아직” 같은 중간 상태가 생길 수 있음.
- Appropriate when: 운영 리스크를 최우선으로 분리 배포할 때.

**Recommendation**
- 가정: 지금 목표는 UX 마찰 제거(무제한 + 즉시 반영)를 한 번에 제공하는 것.
- 추천: **Option 1(단일 PR)**. 희생: PR 범위가 넓어지므로 커밋 분리를 강제하고, 실패 시 롤백 포인트를 명확히 둔다.

---

# Implementation Plan (단일 PR 기준)

## Step 0 — Baseline & Guardrails
- Objective: 변경 전후 회귀 판단 기준을 확보.
- Tasks:
  - 현재 `npm test` 결과 기록.
  - 수동 재현 체크(2개):
    - Inbox에서 시간대 버튼으로 배치 → schedule에 즉시 나타나는지(현재는 refresh 필요로 추정).
    - 스케줄에서 4개 이상 추가/드롭 시 제한 토스트/disabled가 뜨는지(현재는 뜸).
- Acceptance Criteria:
  - 재현/기대 동작이 PR 설명에 한 줄로 정리되어 있음.

## Step 1 — “3개 제한” 단일 출처 정리 및 무력화(제한 제거)
- Objective: 코드베이스에 퍼진 capacity 제한을 제거하고, UI에서 더 이상 3개 제한을 강제하지 않음.
- Key idea:
  - `MAX_TASKS_PER_BLOCK`/`MAX_TASKS_PER_BUCKET`를 “제한 상수”로 쓰지 않도록 전환.
  - `isBucketAtCapacity()`는 더 이상 schedule 제한에 사용되지 않게 정리.
- Primary touchpoints (예상):
  - `src/features/schedule/utils/timeBlockBucket.ts`
  - `src/features/schedule/utils/threeHourBucket.ts` (중복 상수/함수 존재)
  - `src/features/schedule/components/TimeBlockBucket.tsx`
  - `src/features/schedule/components/ThreeHourBucket.tsx`
  - `src/features/schedule/TimelineView/TimelineView.tsx`
  - `src/features/schedule/components/FocusView.tsx`
  - (승인 시) `src/features/battle/components/MissionModal.tsx`
- Acceptance Criteria:
  - 인라인 추가/드롭/모달 저장 어떤 경로로든 한 블록에 4개 이상 배치 가능.
  - 더 이상 “최대 3개” 토스트/disabled가 발생하지 않음.
  - UI 카운터가 의미 있게 동작(예: `n개` 표시로 전환)하거나, 최소한 혼동을 유발하지 않음.

## Step 2 — Inbox→Block 즉시 반영: store 경로 단일화 + optimistic update
- Objective: “Inbox에서 timeBlock 지정”이 dailyDataStore(in-memory)와 inboxStore(in-memory)에 즉시 반영.
- Key idea:
  - 작업 위치 변경(timeBlock/hourSlot)은 **반드시 `useDailyDataStore.updateTask()`** 경로를 통과.
  - inboxStore가 repository를 직접 호출하여 dailyDataStore를 우회하는 구조를 제거.
- Primary touchpoints (예상):
  - `src/shared/stores/dailyDataStore.ts`
    - 현재: inbox↔block 이동은 optimistic 제외 + `loadData(currentDate, true)` 강제 리로드
    - 변경: inbox→block / block→inbox에도 optimistic update 적용, 성공 후에는 필요 시 background revalidate로 완화
  - `src/shared/stores/inboxStore.ts`
    - 현재: timeBlock 업데이트 시 `dailyDataRepository.updateTask` 직접 호출
    - 변경: `useDailyDataStore.getState().updateTask(...)`로 위임(순환 의존성 방지를 위해 동적 import 유지/활용)
  - `src/features/tasks/InboxTab.tsx`
    - timeblock 빠른 배치 버튼/드롭 등 다양한 entrypoint가 `useInboxStore.updateTask`를 호출 → 경로 정리 후 즉시 반영 확인
- Acceptance Criteria:
  - Inbox 탭에서 시간대 버튼을 클릭하면 해당 작업이 inbox 목록에서 사라지고, schedule에 즉시 나타남.
  - 실패 시(저장 실패/lock 오류 등) UI가 롤백되어 “중복/유령 task”가 남지 않음.
  - `loadData(..., true)` 강제 리로드는 “정합성 보강(선택)”으로만 남고, 즉시 반영의 핵심 메커니즘이 아님.

## Step 3 — 통합/회귀 방지: 동일 동작을 만드는 엔트리포인트 정리
- Objective: 동일한 사용자 의도(배치/이동)가 서로 다른 코드 경로로 분기되지 않도록 재발 방지.
- Tasks:
  - InboxTab의 배치/이동 관련 액션이 store 단일 API(=dailyDataStore.updateTask를 통해)로 수렴했는지 점검.
  - (선택) `src/shared/services/task/unifiedTaskService.ts`가 “store refresh” 수준만 제공하는데, 본 이슈는 “store in-memory 업데이트”가 필요하므로 역할 재정의/문서화.
- Acceptance Criteria:
  - Inbox→Schedule 이동이 “어느 UI에서 발생하든” 동일한 store 경로로 처리됨.

## Step 4 — Version / Release Artifacts
- Objective: Target Release 반영.
- Tasks:
  - `package.json` version을 Target Release로 bump.
  - CHANGELOG/릴리즈 노트가 운영 규칙에 맞게 존재한다면 해당 파일 업데이트(프로젝트 규칙 확인 후).
- Acceptance Criteria:
  - repo의 버전 아티팩트가 Target Release와 일치.

---

# Suggested Commit Breakdown (granular)
1) `test: capture baseline + adjust bucket utils test scaffolding`
2) `feat(schedule): remove per-block task capacity guards (TimeBlockBucket/ThreeHourBucket/TimelineView/FocusView)`
3) `refactor(schedule): dedupe bucket utils and remove MAX=3 semantics`
4) `fix(inbox): route timeBlock updates through dailyDataStore (avoid repo direct call)`
5) `fix(dailyDataStore): optimistic update for inbox↔block moves + rollback`
6) `test: update/add store-level tests for move-to-block immediate visibility`
7) `chore: bump version to Target Release + changelog`

(커밋 메시지는 Conventional Commits에 맞춰 조정)

---

# Risk Mitigation
- **중복 task 리스크**: inbox→daily 이동에서 동일 ID가 양쪽에 남을 수 있음 → optimistic 로직에서 “ID 기반 중복 방지/원자적 이동”을 우선.
- **롤백 리스크**: optimistic 후 repo 실패 시 두 store 상태가 어긋날 수 있음 → dailyDataStore 중심으로 롤백 상태를 단일화하고, inboxStore는 dailyDataStore 결과를 따라가도록 구성.
- **잠금(block lock) 리스크**: 잠금된 블록 이동 금지 정책 유지 필요 → 기존 lock 체크 로직을 우회하지 않도록 dailyDataStore.updateTask에 위임.
- **성능/시각 과부하 리스크(무제한)**: 한 블록에 많은 task가 생기면 렌더/스크롤 부담 → 최소 가드레일(블록 내부 스크롤, 필요 시 접기)을 “후속 옵션”으로 명시.
- **부분 롤백 가능성**: 무제한과 즉시 반영은 커밋 레벨로 분리하여, 문제 시 Stage 2만 revert 가능.

---

# Test Plan (Vitest) — 영향/대상만, 상세 케이스는 QA 범위

## Update existing tests
- `tests/three-hour-bucket-utils.test.ts`
  - `MAX_TASKS_PER_BLOCK === 3` 및 `isBucketAtCapacity()`가 3 기준으로 동작한다는 전제를 제거/대체.

## Add/extend tests (추천)
- Store/utils 중심 단위 테스트 추가(실제 Dexie/repo 없이 mock):
  - `tests/store-utils.test.ts`에 “inbox→block 이동 시 dailyData tasks 배열이 즉시 갱신되는” 헬퍼 수준 테스트를 추가하거나,
  - 신규 `tests/daily-inbox-move-optimistic.test.ts`로 store 행동을 mock 기반으로 고정.
- 기존 `tests/unified-task-service.test.ts`
  - 현재는 “store refresh 호출”만 검증 → 이번 변경에서 unifiedTaskService를 건드리지 않더라도, ‘store 경로 단일화’로 인해 호출 패턴이 달라지면 영향 확인.

## Validation commands
- `npm test`
- `npm run lint`

---

# PR Checklist
- [ ] Schedule에서 4개 이상 작업 배치가 가능(인라인/드롭/모달 저장 포함)
- [ ] “최대 3개” 토스트/disabled/카운터가 남아있지 않음(또는 UX적으로 혼동이 없음)
- [ ] Inbox에서 시간대 배치 시 schedule에 즉시 나타남(새로고침 없이)
- [ ] 실패 시 롤백/에러 처리로 중복/유령 task가 남지 않음
- [ ] Repository pattern 준수(직접 Dexie 접근 없음)
- [ ] localStorage 신규 사용 없음(테마 제외)
- [ ] optional chaining 준수(중첩 데이터 접근)
- [ ] `npm test`, `npm run lint` 통과
- [ ] Target Release 버전 아티팩트 정리 완료

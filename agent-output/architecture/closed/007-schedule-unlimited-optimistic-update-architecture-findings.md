# 007 — Schedule Unlimited + Inbox→Block Optimistic Update (Architecture Findings)

> **Date:** 2025-12-23  
> **Status:** DecisionRecord  
> **Verdict:** **APPROVED_WITH_CHANGES** (아래 변경 조건 충족 시)

## Handoff Context (Critic Findings 요약)
- Schedule 타임블록 당 작업 수 제한이 **MAX=3**으로 UI 가드/유틸 상수/여러 컴포넌트에 중복 전파됨.
- Inbox → TimeBlock 이동이 **즉시 UI 반영되지 않고 리프레시 필요**.
- 근본 원인:
  - `useInboxStore.updateTask()`가 **dailyDataStore가 아닌 repository를 직접 호출**하여, schedule UI가 구독하는 dailyDataStore 상태가 갱신되지 않음.
  - `useDailyDataStore.updateTask()`는 inbox↔block 이동 시 **optimistic update를 의도적으로 제외**하고 `loadData(currentDate, true)` 강제 리로드에 의존.

## Goals
1) Schedule view task limit 제거(무제한).  
2) Inbox → Block 이동 시 **즉시 화면에 반영**(리프레시 없이).

## Constraints / Policies
- **Frontend/UI only** (DB/Repo/Electron IPC/Supabase 변경 금지).
- localStorage 금지(테마 예외만). 기본값은 `src/shared/constants/defaults.ts` 단일 출처.
- Store→Subscriber(EventBus) 패턴 준수(단, store 간 상태 동기화는 “요청”이 아니라 “상태 일관성” 목적이라 직접 호출도 가능).

---

## Architectural Diagnosis
### 1) MAX=3 제한의 실제 강제 지점(주요)
- 상수/유틸(단일 출처 후보)
  - `src/features/schedule/utils/timeBlockBucket.ts`: `MAX_TASKS_PER_BLOCK = 3`, `isBucketAtCapacity()`
  - `src/features/schedule/utils/threeHourBucket.ts`: **중복** `MAX_TASKS_PER_BUCKET = 3`, `isBucketAtCapacity()`
- UI 가드/메시지/disabled
  - `src/features/schedule/TimelineView/TimelineView.tsx`
  - `src/features/schedule/components/TimeBlockBucket.tsx`
  - `src/features/schedule/components/ThreeHourBucket.tsx`
  - `src/features/schedule/components/FocusView.tsx`
  - (확장 영향) `src/features/battle/components/MissionModal.tsx`도 동일 상수/가드 사용

### 2) Inbox → Block 리프레시 문제의 구조적 원인
- Schedule 표면은 `useDailyDataStore((s) => s.dailyData?.tasks)`를 구독.  
- Inbox 표면은 `useInboxStore().inboxTasks`를 구독.
- **Inbox에서 timeBlock을 설정하는 경로**가 repository 직접 호출로 빠지면서 dailyDataStore의 in-memory state가 업데이트되지 않음 → schedule에 안 보임.

---

## Design Options (Trade-offs)
### Option A — “무제한 = Infinity”로 상수만 무력화 (최소 수정)
- **핵심**: `MAX_TASKS_PER_BLOCK`을 `Infinity`(또는 매우 큰 수)로 바꾸고 `isBucketAtCapacity()`가 항상 false가 되도록 함.
- Pros
  - 코드 변경량 최소(가드/분기/테스트 수정이 상대적으로 작음)
  - 롤백 쉬움(상수만 되돌리면 됨)
- Cons
  - UI에 `{tasks.length}/{MAX_TASKS_PER_BLOCK}` 같은 카운터가 **의미 없거나 이상해짐**
  - Toast 텍스트가 불필요하게 남음
- Appropriate when
  - 빠른 안정화가 최우선, UI 정리는 후순위

### Option B — “제한 로직/UX 자체를 삭제” (정합성 최고)
- **핵심**: 모든 schedule 관련 UI/서비스에서 capacity 가드를 제거하고, “초과” UX는 **시간(분) 초과(overtime) 경고만** 유지.
- Pros
  - UX/메시지/disabled가 깔끔해짐
  - “무제한” 의미가 코드에서 명확
- Cons
  - 수정 파일 수/회귀 범위 증가
- Appropriate when
  - 바로 다음 스프린트에서 schedule UX 정리를 같이 할 때

### Option C — “무제한 + 성능 가드레일(접기/가상화)”까지 포함 (장기 최적)
- Pros
  - 대량 작업에서도 렌더링/스크롤 성능 안정
  - ADHD 친화적으로 시각적 과부하를 줄이기 쉬움
- Cons
  - UI 작업량 증가(컴포넌트 구조/상태 추가)
- Appropriate when
  - 실제로 한 블록에 20+ 작업을 넣는 사용 패턴이 이미 존재

**Recommendation (가정 포함)**
- 가정: “지금은 회귀 최소 + 즉시 반영 버그 해결”이 우선이고, UI polish는 단계적으로 가능.
- 추천: **Option A로 먼저 제한 무력화 + (필수) UI 카운터/메시지 최소 정리**, 이후 필요 시 Option C를 후속으로.
- 희생: Option B/C의 UX 완성도는 2차로 미룸.

---

## Proposed Minimal-Risk Staged Design (Checkpoints 포함)

### Stage 0 — Baseline & Safety Net
- 체크포인트
  - `npm test` 통과 로그 확보
  - 수동 시나리오 2개 기록(현재 상태):
    - Inbox에서 시간대 지정 → schedule에 안 뜸(재현)
    - 드래그로 블록 간 이동 시 제한 토스트 노출(재현)
- 롤백
  - 변경은 모두 “상수/스토어/핸들러” 단위로 커밋 분리(되돌리기 용이)

### Stage 1 — Schedule Task Limit 제거(무제한)
- 설계 원칙
  - **Single source of truth**: capacity 관련 상수는 `src/shared/constants/defaults.ts`로 이동(또는 거기서 파생).
  - 중복 상수 제거: `threeHourBucket.ts`의 MAX 정의는 `timeBlockBucket.ts`를 사용하도록 수렴.
- 변경 내용(논리)
  - Capacity의 의미를 “갯수 제한”에서 제거.
  - UI에서 “최대 3개” 텍스트/disabled/카운터는 삭제하거나 “갯수”만 표시.
- 체크포인트
  - Schedule: 한 블록에 4개 이상 추가 가능(모달 추가/인라인 추가/드롭)
  - battle 미션 추가도 동일하게 제한 제거 여부 확인(의도에 따라 포함/제외 결정 필요)
- 롤백
  - 상수/가드만 되돌리면 기존 제한 복구

### Stage 2 — Inbox→Block 즉시 반영(Optimistic Update)
- 설계 원칙
  - **Single code path**: “작업 위치 변경(timeBlock/hourSlot)”은 반드시 `useDailyDataStore.updateTask()`를 통해 수행.
  - `loadData(currentDate, true)`는 **정합성 revalidate 용도로만** (성공 시 동기 호출 제거).
- 변경 내용(논리)
  1) `useDailyDataStore.updateTask()`에서 inbox↔block 이동도 optimistic update 적용
     - Inbox→Block: inbox task를 읽어 `dailyData.tasks`에 즉시 추가(동일 ID 중복 방지 포함)
     - Block→Inbox: `dailyData.tasks`에서 즉시 제거
  2) 저장 성공 후에는
     - 즉시 강제 리로드 대신, 필요하면 **백그라운드 revalidate**(UI 블로킹 X)
  3) Inbox store 동기화
     - Inbox→Block 시: inbox 목록에서 해당 task 제거(optimistic)
     - Block→Inbox 시: inbox 목록에 해당 task 추가(optimistic)

  **Store 간 동기화 방식(선택지)**
  - (권장) dailyDataStore 내부에서 dynamic import로 inboxStore를 호출해 상태 반영
    - Pros: 이벤트 설계 불필요, 결정적
    - Cons: store 간 결합이 늘어남(단, 동적 import로 순환 최소화)
  - (대안) eventBus로 “이동됨” 이벤트 발행 + inboxStore가 구독
    - Pros: 결합도 감소
    - Cons: 이벤트/구독 설계/테스트 비용, “UI 렌더 트리거” 용도로 오해될 위험

- 체크포인트
  - Inbox에서 block 지정 시 **즉시 schedule에 나타남**
  - 실패(예: repo 저장 실패) 시 dailyDataStore 롤백이 동작하고, UI가 일관적으로 복구

### Stage 3 — Inbox 표면 코드 경로 수렴(핵심 버그 재발 방지)
- 목표
  - InboxTab의 drop/편집/시간대 지정이 repository를 직접 호출하지 않도록 정리
- 변경 내용(논리)
  - `useInboxStore.updateTask()`의 “timeBlock 설정 시” 경로를 dailyDataStore.updateTask로 위임(또는 unifiedTaskService로 단일화)
  - InboxTab의 drop 핸들러도 동일하게 단일 경로 사용
- 체크포인트
  - Inbox→Schedule 이동이 어디서 발생하든(드롭/편집/단축입력) 즉시 반영

### Stage 4 — UX/Performance Guardrails(선택)
- 최소 가드레일(추천)
  - 블록 내 작업 리스트 영역에 **max-height + 내부 스크롤**
  - “10개 이상이면 자동 접기 + ‘더 보기’” (ADHD 친화: 시각 과부하 완화)
- 고급(필요 시)
  - 가상화(virtualization) 또는 “렌더 윈도잉”

---

## Files / Areas To Edit (UI-only)
### Unlimited Task (Limit 제거)
- `src/features/schedule/utils/timeBlockBucket.ts`
- `src/features/schedule/utils/threeHourBucket.ts` (중복 상수 정리)
- `src/features/schedule/components/TimeBlockBucket.tsx`
- `src/features/schedule/components/ThreeHourBucket.tsx`
- `src/features/schedule/TimelineView/TimelineView.tsx`
- `src/features/schedule/components/FocusView.tsx`
- `src/features/battle/components/MissionModal.tsx` (범위에 포함할지 결정 필요)
- `tests/three-hour-bucket-utils.test.ts` (MAX=3 전제 제거)

### Inbox→Block Optimistic Update (즉시 반영)
- `src/shared/stores/dailyDataStore.ts` (핵심)
- `src/shared/stores/inboxStore.ts` (위임 경로/optimistic sync)
- `src/features/tasks/InboxTab.tsx` (drop 경로 수렴)
- (선택) `src/shared/services/task/unifiedTaskService.ts` (단일 API로 통합 시)

---

## Rollback Strategy
- “Stage 단위로” 커밋/릴리즈 분리
  - Stage 1(무제한)과 Stage 2(optimistic move)는 **별도 배포 가능**
- 리스크 발생 시
  - 즉시 롤백 1순위: Stage 2만 되돌려 강제 리프레시 방식으로 복귀
  - 2순위: Stage 1까지 되돌려 MAX=3 복귀

---

## Mandatory Acceptance Checklist
- [ ] Inbox에서 작업을 block으로 보냈을 때 schedule에 즉시 표시됨
- [ ] Block→Inbox 이동도 즉시 반영되며 중복/유령 task 없음
- [ ] Drag/drop, inline add, modal add 모두 동일한 validation/저장 경로를 사용
- [ ] 대량 작업(예: 한 블록 15개)에서 UI가 사용 가능(스크롤/접기 가드레일)

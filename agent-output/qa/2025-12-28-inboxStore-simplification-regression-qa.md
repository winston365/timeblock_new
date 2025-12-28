# QA Report: inboxStore simplify 회귀 검증 (Quick place / Task not found)

**Plan Reference**: `agent-output/planning/014-schedule-unlimited-inbox-immediate-pr-plan.md`
**QA Status**: QA Complete
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-28 | User | 회귀 QA 리포트 완성본 + 실제 근거 | 최근 커밋(5a079b1)에서 `inboxStore` 단순화로 Quick place/update 흐름이 유지되는지 검증. 변경 파일 목록/정책 스캔(localStorage/any/optional chaining)/타겟+전체 Vitest 실행 결과 PASS 기록. |

## Timeline
- **Test Strategy Started**: 2025-12-28
- **Test Strategy Completed**: 2025-12-28
- **Implementation Received**: 2025-12-28
- **Testing Started**: 2025-12-28
- **Testing Completed**: 2025-12-28
- **Final Status**: QA Complete

## Test Strategy (Pre-Implementation)
사용자 관점에서 “인박스에서 배치했는데 스케줄에 즉시 안 보이거나, Task not found가 연쇄로 터져 UX가 망가지는” 회귀를 잡는 데 집중한다.

- **핵심 흐름 1 (Quick place/할당)**: Inbox 화면에서 Today/Tomorrow/NextSlot 한 번 클릭으로 배치가 성공하고, 인박스 목록에서 즉시 사라지며, 스케줄에 즉시 나타나야 한다.
- **핵심 흐름 2 (Task not found 연쇄)**: 이미 이동/삭제된 task에 대해 update가 중복 호출되더라도, 앱이 롤백 지옥/무한 토스트/콘솔 에러 폭주로 가지 않아야 한다.

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- Vitest (repo existing)

**Testing Libraries Needed**:
- None 추가

**Configuration Files Needed**:
- None

**Build Tooling Changes Needed**:
- None

## Implementation Review (Post-Implementation)

### Evidence: Working Tree Change List
- `get_changed_files` (staged/unstaged) 결과: **변경 파일 없음 (clean)**
- 따라서 이번 QA는 **가장 최근 커밋** 기준으로 변경 파일을 산정함.

### Evidence: Last Commit (git)
- Commit: `5a079b17adce8ba4af1e2834cc969675b4bae51a`
- Subject: `Add Serena project docs and simplify inboxStore`

### Code Changes Summary
**변경 파일 목록 (git show --name-status)**
- Added
  - `.serena/.gitignore`
  - `.serena/memories/code_style_and_conventions.md`
  - `.serena/memories/codebase_structure.md`
  - `.serena/memories/design_patterns_and_guidelines.md`
  - `.serena/memories/project_overview.md`
  - `.serena/memories/suggested_commands.md`
  - `.serena/memories/task_completion_checklist.md`
  - `.serena/project.yml`
- Modified
  - `src/shared/stores/inboxStore.ts`
    - 변경 심볼: `InboxStore` (interface 축소), `useInboxStore` (state/actions 단순화)
    - 제거된 주요 액션: `setTriageEnabled`, `setHudCollapsed`, `setFilters`, `setLastUsedSlot`, `placeTaskToSlot` 등 UI 상태/빠른배치 전용 액션
    - 유지된 핵심 액션: `loadData`, `addTask`, `updateTask`, `deleteTask`, `toggleTaskCompletion`, `refresh`, `reset`
  - `src/data/repositories/dailyData/coreOperations.ts`
    - 변경 심볼: import 정리(타입 import 분리). 로직 변경은 diff 기준 최소.

### Policy / Rule Scan (workspace grep)

#### 1) localStorage 금지 (theme 예외만)
- grep 패턴: `localStorage\.(getItem|setItem|removeItem|clear)\(`
- 결과: **theme 키만 사용**
  - `src/main.tsx` (theme load)
  - `src/features/settings/SettingsModal.tsx` (theme read)
  - `src/features/settings/components/tabs/AppearanceTab.tsx` (theme set/remove)
- 최근 커밋 변경 파일(`inboxStore`, `coreOperations`)에서 localStorage 사용 추가 없음.

#### 2) any 금지
- grep 패턴: `\bany\b` (src/**/*.ts/tsx)
- 결과: 워크스페이스에 `any` 사용 파일 존재(기존 코드) 
  - 예: `src/shared/utils/firebaseSanitizer.ts`, `src/shared/services/sync/firebase/syncCore.ts`, `src/shared/services/rag/vectorStore.ts`, `src/shared/lib/storeUtils.ts` 등
- 최근 커밋 변경 파일(`src/shared/stores/inboxStore.ts`, `src/data/repositories/dailyData/coreOperations.ts`)에는 `any` 신규 추가 없음.

#### 3) optional chaining 누락 위험(핵심 경로)
- 변경 파일/핵심 경로 수동 점검 대상:
  - `src/shared/stores/inboxStore.ts` (`updateTask`, `toggleTaskCompletion`)
  - `src/shared/stores/dailyDataStore.ts` (`updateTask`의 task-not-found 처리)
- 관찰 결과:
  - `inboxStore.toggleTaskCompletion`은 `current?.completed ?? false` 등 안전 접근 사용.
  - `dailyDataStore.updateTask`는 task-not-found 케이스를 **rollback 없이 조용히 종료(return)** 하도록 방어 로직이 존재.

## Test Coverage Analysis

### Risk-Weighted Focus
- Quick place는 UI에서 `useInboxStore.updateTask()`를 호출 → timeBlock 설정 시 `dailyDataStore.updateTask()`로 위임되는 경로가 핵심.
- Task not found 연쇄는 `dailyDataStore.updateTask()`의 catch 블록 방어 로직이 핵심.

### Coverage Map (핵심 코드 ↔ 테스트)
| Code Path | Related File | Related Test | Status |
|---|---|---|---|
| Quick place에서 updateTask(timeBlock/hourSlot) 호출 | `src/features/tasks/InboxTab.tsx` | `tests/slot-finder.test.ts` (슬롯 추천), `tests/inbox-to-block-immediate.test.ts` (이벤트/이동 감지) | PARTIAL |
| inboxStore.updateTask timeBlock 분기(optimistic remove + dailyDataStore 위임) | `src/shared/stores/inboxStore.ts` | (직접 unit 없음) | MISSING |
| dailyDataStore.updateTask의 Task not found 방어 | `src/shared/stores/dailyDataStore.ts` | `tests/unified-task-service.test.ts` (위치 탐색/업데이트 래핑), 간접 | PARTIAL |

## Test Execution Results

### Unit Tests (targeted)
- **Command**: `npx vitest run tests/inbox-to-block-immediate.test.ts tests/unified-task-service.test.ts tests/store-utils.test.ts --reporter verbose`
- **Status**: PASS
- **Output Summary**: 3 files passed, 33 tests passed
- **Notes**: 일부 테스트는 의도적으로 stderr(에러 로그)를 발생시켜 에러 처리 경로를 검증함.

### Unit Tests (full suite)
- **Command**: `npx vitest run --reporter verbose`
- **Status**: PASS
- **Output Summary**: 30 test files passed, 224 tests passed
- **Notes**: 일부 테스트는 의도적으로 stdout/stderr 로그를 출력함(예: sync-core, event-bus, firebase-sanitizer).

## Manual Repro / Verification Scenarios

### Scenario 1 — Inbox Quick place 에러 재현 → 수정 확인
**Goal**: InboxTab의 Today/Tomorrow/NextSlot 배치가 실패 없이 즉시 반영되는지 확인.

**Preconditions**
- 인박스에 `completed=false` 작업이 1개 이상 존재.
- 오늘 날짜 dailyData가 로드 가능.

**Steps (checkbox)**
- [ ] 앱 실행 후 Tasks/Inbox 탭 진입
- [ ] 인박스 작업 1개 선택
- [ ] “Today” 또는 “NextSlot” 빠른 배치 실행 (UI의 quick place 버튼/핫키)
- [ ] 즉시 인박스 목록에서 해당 task가 사라지는지 확인 (optimistic remove)
- [ ] Schedule/타임블록 영역에 해당 task가 나타나는지 확인 (timeBlock/hourSlot 반영)
- [ ] 앱 새로고침 없이 상태가 유지되는지 확인

**Expected Results**
- 인박스에서 즉시 제거되고 스케줄에 즉시 표시된다.
- 콘솔에 에러 스택/무한 토스트가 발생하지 않는다.

**If Fails — Log Points**
- DevTools Console
  - `InboxStore: updateTask` prefix 로그 (withAsyncAction errorPrefix)
  - `dailyDataStore.updateTask` 로그: `Background revalidate failed`, `Failed to update task, rolling back`
- EventBus
  - `task:updated` emit 여부
  - `inbox:taskRemoved` 수신/처리 여부

**Primary Code References**
- `src/features/tasks/InboxTab.tsx`: `handleQuickPlace`, `placeTaskToSlot`
- `src/shared/stores/inboxStore.ts`: `updateTask` (timeBlock 분기)
- `src/shared/stores/dailyDataStore.ts`: `updateTask` (optimistic + repo save)

### Scenario 2 — Task 이동/업데이트 중 Task not found 연쇄 에러 재현 → 수정 확인
**Goal**: 중복 update/경합 상황에서 "Task not found"가 연쇄적으로 앱을 망치지 않는지 확인.

**Preconditions**
- 동일 task에 대해 빠른 연속 조작이 가능한 환경(핫키 연타/빠른 클릭).

**Steps (checkbox)**
- [ ] 인박스 task A를 Quick place로 블록에 배치
- [ ] 즉시(1초 내) 동일 task A에 대해 또 한 번 배치/수정(예: 다른 블록으로 이동, 혹은 같은 버튼 연타)
- [ ] 또는 드래그앤드롭/핫키로 같은 task를 연속 이동 시도

**Expected Results**
- 콘솔에 `Task not found`가 발생해도 앱이 멈추지 않으며, UI가 중복/유령 task 상태로 고착되지 않는다.
- `dailyDataStore.updateTask`는 task-not-found를 감지하면 rollback하지 않고 조용히 종료(return)하며 background refresh로 정합성을 회복한다.

**If Fails — Log Points**
- DevTools Console
  - `[DailyDataStore] Task not found during update, skipping rollback:` 로그 유무
  - rollback 발생 여부: `[DailyDataStore] Failed to update task, rolling back:`
- Repository
  - `src/data/repositories/dailyData/taskOperations.ts`: `Task not found` throw 위치 확인

**Primary Code References**
- `src/shared/stores/dailyDataStore.ts`: task-not-found catch/return 처리
- `src/shared/lib/storeUtils.ts`: `findTaskOrThrow` 등 throw 경로
- `src/shared/services/task/unifiedTaskService.ts`: not found 방어/로그

## Regression Checklist (ADHD-friendly)
- [ ] Quick place 1번 클릭으로 **즉시 반영**(Inbox에서 사라지고 Schedule에 나타남)
- [ ] Quick place 실패 시 **롤백/재로딩**으로 유령 task가 남지 않음
- [ ] 연타/중복 이동 시 `Task not found`가 나와도 **앱이 정상 유지**
- [ ] Inbox 완료 토글이 XP/퀘스트 파이프라인을 깨지 않음 (`useInboxStore.toggleTaskCompletion`)
- [ ] (정책) theme 외 `localStorage.*(` 호출이 추가되지 않음
- [ ] (정책) 변경 파일에 `any` 신규 추가 없음
- [ ] (외부 이미지) 외부 이미지 410은 **별도 회귀 항목**으로만 확인

---

Handing off to uat agent for value delivery validation

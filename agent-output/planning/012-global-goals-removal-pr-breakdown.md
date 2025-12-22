# Plan: Weekly Goals Only — Global Goals 레거시 전체 제거 (PR Breakdown)

## Plan Header
- Plan ID: plan-2025-12-21-remove-global-goals
- Target Release:
  - **Release A (코드/동기화 제거, 스키마 유지): 1.0.164 (제안, 현재 package.json = 1.0.163 기준 patch +1)**
  - **Release B (Dexie 스키마 drop, post-soak): 1.0.165 (제안, Release A soak 이후 patch +1)**
- Epic Alignment: “weekly goals만 유지, global goals 레거시 코드 전체 제거”
- Status: Proposed

## Changelog
- 2025-12-21 (Planner): Analyst 체크리스트(012/013) 기반 PR 단위 작업 목록/순서 정리 및 검증/롤백 포함
- 2025-12-21 (Planner): Critic 피드백 반영( PR#4 Dexie drop 별도 릴리즈/soak 이후로 연기, Firebase 과거 데이터 읽기 호환 전략 명시, task.goalId 필드 삭제 defer, PR별 가드레일 강화 )

## References
- Analysis: [agent-output/analysis/012-global-goals-removal-analysis.md](../analysis/012-global-goals-removal-analysis.md)
- Analysis: [agent-output/analysis/013-global-goals-legacy-check-analysis.md](../analysis/013-global-goals-legacy-check-analysis.md)
- Architecture/ADR: [agent-output/architecture/system-architecture.md](../architecture/system-architecture.md)
- Architecture: [agent-output/architecture/005-long-term-goals-frontend-architecture-findings.md](../architecture/005-long-term-goals-frontend-architecture-findings.md)

---

## Value Statement and Business Objective
As a 사용자, I want 목표 시스템이 weekly goals만 남고, 글로벌(일일 리셋) 목표 레거시가 완전히 제거되기를, so that UI/데이터/동기화/파이프라인이 단순해지고 “보이지 않지만 계속 돌아가는” 백그라운드 비용·혼란·회귀 위험이 줄어든다.

## Objective
- Global goals(Dexie `globalGoals`, `globalGoalRepository`, `goalStore`, 이벤트/파이프라인/구독자, UI 연결) 경로를 **완전 제거**
- Weekly goals는 **현상 유지**(수동 카운터 유지; task 기반 자동 연동(Option C) 금지)
- 사용자 UX에서 “목표=weekly goals”만 남도록 global goal 노출(선택/색상/아이콘 등) 제거

## Scope Boundaries (중요)
- 포함: global goals 관련 코드/데이터/동기화/이벤트/파이프라인/미사용 UI 파일 삭제
- 제외(명시): weekly goals를 task에 자동 연동(Option C), 신규 목표 기능 추가, 신규 테스트 프레임워크/라이브러리 도입

## Engineering / Policy Constraints (must-follow)
- `localStorage` 금지(테마 예외만 허용)
- 기본값은 [src/shared/constants/defaults.ts](../../src/shared/constants/defaults.ts) 단일 출처
- 중첩 접근은 optional chaining 필수
- 모달 UX: 배경 클릭 닫기 금지, ESC로 닫기(가능하면 `useModalEscapeClose`)
- Dexie 스키마 변경 시 버전 업 + `upgrade()` 마이그레이션 포함

## Key Decision (전제)
- weekly↔task 의미론 통합은 별도 Epic(Option C)으로 분리되어 있으므로, **이번 작업에서는 task.goalId를 weekly goal로 매핑/마이그레이션하지 않는다.**
- **`task.goalId` 필드 삭제는 이번 Epic에서 DEFER**한다.
  - 전제: 현재 사용처 0(또는 사용자 가치/기능적으로 미사용만 보장) + 런타임/동기화/UX에서 더 이상 읽거나 쓰지 않음을 보장하는 것만으로 Epic 가치 달성 가능.
  - 이유: 모델 필드 삭제는 타입/정규화/마이그레이션 영향으로 forward-only 성격을 키우며, PR#4(스키마 drop)와 결합될 경우 롤백/다운그레이드 리스크가 커진다.

---

## PR Breakdown (권장 순서)

### Release Strategy (2-step + soak)
- **Release A**: PR#1 → PR#2 → PR#3 → PR#5를 포함. (중요) Dexie 스키마 변경 없음 → 롤백/리버트가 상대적으로 안전.
- **Soak 기간**: Release A 배포 후, 다음을 중심으로 “안정화 관측”을 수행한 뒤 Release B 진행.
  - 관측 포인트: SyncLog에서 `globalGoals` read/write가 사라졌는지, 초기 동기화/부팅 크래시 여부, task completion 보상 파이프라인(xp/quest/waifu 등) 정상 여부.
- **Release B**: PR#4만 포함(가능하면 단독). Dexie 스키마 drop은 사실상 forward-only 성격이 강하므로 별도 릴리즈로 운영 리스크를 분리.

### PR#1 — Global Goals 런타임 훅 제거 (파이프라인/이벤트/구독자)
**Outcome**
- task 완료/수정/삭제가 global goal 진행률을 재계산하지 않음
- `goal:progressChanged` 이벤트와 구독자가 제거되어 백그라운드 작업이 중단
- (중요) 데이터/동기화/테이블은 아직 남겨두어 롤백이 쉬운 상태에서 “기능 비활성화”를 먼저 달성

**변경 파일 후보(경로)**
- [src/shared/services/gameplay/taskCompletion/taskCompletionService.ts](../../src/shared/services/gameplay/taskCompletion/taskCompletionService.ts)
- [src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts](../../src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts)
- [src/shared/subscribers/goalSubscriber.ts](../../src/shared/subscribers/goalSubscriber.ts)
- [src/app/hooks/useEventBusInit.ts](../../src/app/hooks/useEventBusInit.ts)
- [src/shared/lib/eventBus/types.ts](../../src/shared/lib/eventBus/types.ts)
- [src/shared/stores/dailyDataStore.ts](../../src/shared/stores/dailyDataStore.ts)
- [src/shared/stores/inboxStore.ts](../../src/shared/stores/inboxStore.ts)
- Tests:
  - [tests/task-completion.test.ts](../../tests/task-completion.test.ts)
  - [tests/task-completion-handlers.test.ts](../../tests/task-completion-handlers.test.ts)
  - (필요 시) 이벤트 버스 관련 스모크/유틸 테스트

**상세 체크리스트**
- [ ] Task completion handler 체인에서 global goal 재계산 핸들러 제거(또는 noop로 치환 후 제거)
- [ ] `goal:progressChanged` emit/subscribe 연결 제거(행동 변화)
- [ ] (가급적 PR#5로 이동) `goal:progressChanged` 이벤트 타입/페이로드 정의 삭제는 “정리 단계”로 미루어 컴파일 연쇄 영향/회귀 탐지 난이도를 낮춘다
- [ ] GoalSubscriber 초기화 및 등록 제거 (`initAllSubscribers` 경로에서 참조 끊김 확인)
- [ ] dailyDataStore/inboxStore에서 `goal:progressChanged` emit 제거
- [ ] 관련 테스트에서 `recalculateGlobalGoalProgress` mocking 제거/수정
- [ ] optional chaining/기본값/defaults/localStorage/모달 UX 규칙 위반이 이번 PR에서 새로 생기지 않도록 확인

**가드레일 (테스트/수동 체크/관측 포인트)**
- 테스트(필수): `npm test` + `tests/task-completion.test.ts`, `tests/task-completion-handlers.test.ts`
- 수동 체크(필수): 작업 완료/수정/삭제 시 크래시 없이 동작, 보상 파이프라인(quest/xp/waifu 등) 체감상 정상
- 관측 포인트(권장): task completion 실행 후 주요 도메인 이벤트/로그가 여전히 발생하는지(예: SyncLog/개발 로그/성능 모니터)

**검증 방법**
- Vitest: `npm test`
- 수동(고수준): 앱에서 작업 완료/수정/삭제가 정상 동작(목표 관련 UI 변화는 다음 PR에서)

**롤백 전략**
- 코드 롤백: PR revert로 즉시 복구 가능(데이터/동기화/테이블이 남아있기 때문)
- 리스크: 이벤트 타입 삭제가 다른 곳에 영향을 줄 수 있으므로, merge 전 전역 검색으로 사용처 0 보장

---

### PR#2 — UI에서 Global Goals 연결 제거 (TaskModal/Timeline/카드)
**Outcome**
- 사용자가 더 이상 global goals를 선택/표시/색상 매핑할 수 없음
- “weekly goals만 유지” UX가 목표 화면뿐 아니라 일정/작업 흐름까지 일관되게 적용

**변경 파일 후보(경로)**
- [src/features/schedule/TaskModal.tsx](../../src/features/schedule/TaskModal.tsx)
- [src/features/schedule/TimelineView/TimelineView.tsx](../../src/features/schedule/TimelineView/TimelineView.tsx)
- [src/features/schedule/TimelineView/TimelineTaskBlock.tsx](../../src/features/schedule/TimelineView/TimelineTaskBlock.tsx)
- [src/features/schedule/TaskCard.tsx](../../src/features/schedule/TaskCard.tsx)
- (레거시 UI 삭제 포함 시)
  - [src/features/goals/GoalPanel.tsx](../../src/features/goals/GoalPanel.tsx)
  - [src/features/goals/constants/goalConstants.ts](../../src/features/goals/constants/goalConstants.ts)

**상세 체크리스트**
- [ ] TaskModal에서 global goals 로드/드롭다운/goalId 상태 관리 제거
- [ ] TimelineView에서 global goals 로드 및 goalColorMap 로직 제거
- [ ] TaskCard/TimelineTaskBlock 등에서 goal 관련 표시(예: 🎯) 제거
- [ ] UI에서 goalId를 더 이상 저장하지 않도록(새 task 생성/수정 시 goalId는 null 유지)
- [ ] 모달 UX 규칙 준수(배경 클릭 닫기 금지, ESC 닫기 유지/확인)

**가드레일 (테스트/수동 체크/관측 포인트)**
- 테스트(필수): `npm test`
- 수동 체크(필수): 기존 데이터에 `goalId`가 남아있는 계정/상태에서도 타임라인/카드/모달이 크래시 없이 렌더링 및 저장
- 관측 포인트(권장): 오류 로그(콘솔/SyncLog)에 goal 관련 undefined 접근/정규화 에러가 없는지

**검증 방법**
- Vitest: `npm test`
- 수동(고수준):
  - Task 생성/수정 모달이 정상 동작하고 저장됨
  - 타임라인 렌더링이 정상이며 goal 색상/표시가 사라짐

**롤백 전략**
- 코드 롤백: revert 가능(이 시점에도 repo/sync/table이 아직 남아있는 상태면 특히 안전)
- 리스크: 기존에 goalId가 있던 task의 표시만 바뀌는 것이므로 기능 손실을 의도된 변경으로 릴리즈 노트에 명시

---

### PR#3 — Global Goals 데이터 레이어/동기화 제거 (Repo + Firebase Strategy + Fetch Payload)
**Outcome**
- global goals CRUD/재계산/일일 리셋 로직이 코드에서 삭제
- Firebase sync에서 `globalGoals`를 더 이상 “업로드/갱신”하지 않음
- **과거 데이터 호환(읽기) 유지**: 원격/로컬에 `globalGoals` 키가 남아있더라도 앱이 안전하게 무시(선택적)하여 파싱/정규화/부팅이 깨지지 않음

**변경 파일 후보(경로)**
- [src/data/repositories/globalGoalRepository.ts](../../src/data/repositories/globalGoalRepository.ts)
- [src/data/repositories/index.ts](../../src/data/repositories/index.ts)
- [src/data/repositories/dailyData/coreOperations.ts](../../src/data/repositories/dailyData/coreOperations.ts)
- [src/data/repositories/gameState/index.ts](../../src/data/repositories/gameState/index.ts)
- [src/shared/services/sync/firebaseService.ts](../../src/shared/services/sync/firebaseService.ts)
- [src/shared/services/sync/firebase/strategies.ts](../../src/shared/services/sync/firebase/strategies.ts)

**상세 체크리스트**
- [ ] globalGoalRepository 파일 제거 및 배럴 export 제거
- [ ] `resetDailyGoalProgress` 호출 제거(일일 로딩/새날 초기화)
- [ ] Firebase 전략에서 `globalGoalStrategy` 및 deprecated `dailyGoalStrategy` 제거
- [ ] Firebase fetch/파서가 원격에 남아있는 `globalGoals` 키를 안전하게 무시하도록 유지(optional handling)
- [ ] 업로드 semantics 확인: “전체 스냅샷 set(덮어쓰기)”라면 `globalGoals` 누락이 원격 노드 삭제로 이어지지 않도록 가드(merge/update 또는 unknown-key 보존)
- [ ] firebaseService의 fetch 반환(도메인 모델)에서 `globalGoals`를 더 이상 사용하지 않도록 정리하되, 입력(payload) 호환은 유지
- [ ] 전역 검색으로 `loadGlobalGoals`/`recalculateGlobalGoalProgress`/`globalGoalStrategy` 참조 0 보장

**가드레일 (테스트/수동 체크/관측 포인트)**
- 테스트(필수): `npm test` + sync 관련 스모크(`tests/sync-core.test.ts`, `tests/smoke-sync-engine-basic.test.ts` 등 현재 레포의 sync 스모크 계열)
- 수동 체크(필수): 로그인/초기 동기화/재실행(앱 재부팅)에서 크래시 없음
- 관측 포인트(필수): SyncLog에서 `globalGoals` read/write가 0으로 수렴(또는 관련 로그가 더 이상 나타나지 않음)

**검증 방법**
- Vitest: `npm test`
- 수동(고수준): 로그인/동기화가 동작하고 SyncLog에서 globalGoals 관련 로그가 사라짐(있다면)

**롤백 전략**
- 코드 롤백: revert 가능(단, 다음 PR에서 Dexie 스키마 버전이 올라가기 전까지가 가장 안전)
- 운영 롤백 가정: 이미 배포된 버전에서 Firebase에 남아있는 `globalGoals` 데이터는 무시되며, 재도입이 필요하면 후속 버전에서 다시 fetch/strategy를 추가해야 함

---

### PR#5 — 레거시 잔재 정리(타입/이벤트/미사용 UI/문서) + 사용처 0 보장
**Outcome**
- global goals 관련 타입/컴포넌트/상수/이벤트 타입이 남지 않음(정리성 변경)
- 코드베이스에서 “goal(=global daily goal)” 개념이 사라지고 weekly goals만 남음
- (중요) **`task.goalId` 필드 삭제는 하지 않되**, 사용처 0 및 런타임/동기화 미사용 보장을 강화

**변경 파일 후보(경로)**
- [src/shared/types/domain.ts](../../src/shared/types/domain.ts)
- [src/shared/lib/eventBus/types.ts](../../src/shared/lib/eventBus/types.ts)
- (잔존 시) [src/features/goals/GoalPanel.tsx](../../src/features/goals/GoalPanel.tsx)
- (잔존 시) [src/features/goals/constants/goalConstants.ts](../../src/features/goals/constants/goalConstants.ts)
- (기타 grep로 발견되는 잔여 goal/globalGoals/goalId 문서/주석)

**상세 체크리스트**
- [ ] `goal:progressChanged` 이벤트 타입/페이로드 정의 제거(다른 도메인 미사용 확인 후)
- [ ] global goals 전용 타입/필드/상수/컴포넌트 제거 및 전역 검색으로 사용처 0 보장
- [ ] `task.goalId`는 “미사용 레거시 데이터”로 남기되, 생성/수정/동기화/표시 어디에서도 더 이상 쓰지 않음을 보장

**가드레일 (테스트/수동 체크/관측 포인트)**
- 테스트(필수): `npm test` + `npm run lint`(가능하면)
- 수동 체크(권장): 스케줄/인박스/주간목표(weekly) 핵심 플로우가 크래시 없이 정상
- 관측 포인트(권장): 전역 검색 결과(심볼/문자열) 0, SyncLog에 goal 관련 경로 활동 없음

**롤백 전략**
- 파일/타입 정리는 revert 가능(스키마 변경 전제 없음)

---

### PR#4 — Dexie 스키마에서 `globalGoals` 테이블 제거 + 초기화 경로 정리 (Release B / post-soak)
**Outcome**
- 로컬 DB에서 `globalGoals` 테이블이 제거되어 저장/마이그레이션/유지 비용이 사라짐
- 앱 초기화 단계에서 globalGoals를 Dexie에 쓰는 동작이 제거

**진입 조건 (Release B gate)**
- Release A 배포 후 soak 관측에서 부팅/동기화/핵심 플로우 회귀 신호가 없을 것
- SyncLog 기준으로 `globalGoals` read/write가 더 이상 발생하지 않을 것

**변경 파일 후보(경로)**
- [src/data/db/dexieClient.ts](../../src/data/db/dexieClient.ts)
- [src/data/db/infra/useAppInitialization.ts](../../src/data/db/infra/useAppInitialization.ts)
- [src/data/db/README.md](../../src/data/db/README.md)

**상세 체크리스트**
- [ ] Dexie schema 버전 업(예: v17 → v18) 및 upgrade에 `globalGoals` store 삭제 반영(필요 시 store=null)
- [ ] Dexie 타입/테이블 프로퍼티에서 `globalGoals` 제거
- [ ] 앱 초기화에서 Firebase 다운로드 결과를 Dexie에 쓰는 흐름 중 `globalGoals` write 제거
- [ ] DB 문서에 테이블/버전 히스토리 업데이트

**가드레일 (테스트/수동 체크/관측 포인트)**
- 테스트(필수): `npm test` + DB 관련 스모크(IndexedDB/Dexie open/migration 계열 테스트가 있다면 우선)
- 수동 체크(필수): “기존 사용자 데이터가 존재하는 환경”에서 앱 부팅/주요 화면(스케줄/인박스/weekly goals) 진입이 크래시 없이 동작
- 관측 포인트(권장): 마이그레이션이 수행되었음을 추적할 수 있는 마커/로그(예: systemState 마커 또는 SyncLog/로컬 로그)

**검증 방법**
- Vitest: `npm test`
- 수동(고수준):
  - 기존 사용자 데이터가 있는 환경에서 앱이 크래시 없이 뜨고, 주요 화면(스케줄/인박스/주간목표)이 정상

**롤백 전략 (중요: 스키마 변경은 사실상 forward-only)**
- 배포 후 롤백은 “이전 코드로 단순 revert”가 위험할 수 있음(Dexie 버전 불일치 가능)
- 안전한 롤백은 “새 patch 버전에서 store를 다시 추가”하는 형태(또는 동일 버전에서 복원 로직)로 수행
- 따라서 이 PR은 마지막에 가깝게 두고, merge 전 수동 검증 시간을 확보

---

## Dependencies / Owners
- Owner(Implementation): FE/TS Implementer
- Reviewer: Architecture/QA Reviewer
- Dependency: PR#1 → PR#2 (UI에서 goal 훅 제거가 이후 repo 삭제를 안전하게 함)
- Dependency: PR#2 → PR#3 (UI가 repo/sync를 더 이상 참조하지 않는 상태에서 삭제)
- Dependency: PR#3 → PR#5 (정리/사용처 0 보장)
- Dependency: (Release A 배포 + soak) → PR#4 (Dexie 테이블 삭제는 별도 릴리즈로)

## Validation (프로젝트 표준)
- 정적 검사: `npm run lint` (가능하면)
- 테스트: `npm test` (vitest run)
- 수동 검증: Electron dev(`npm run electron:dev`)에서 핵심 화면 크래시/동기화 문제 없는지 확인

---

## Version Management and Release Artifacts (필수 마일스톤)

### Release A (Target: 1.0.164)
- 목표: PR#1~#3, PR#5를 포함한 릴리즈를 “스키마 변경 없이” 배포 가능 상태로 만든다.
- 작업:
  - 버전 아티팩트 업데이트(예: root `package.json` 버전)
  - 배포/운영 커뮤니케이션에 포함할 변경 요약(내부 릴리즈 노트/PR 설명): “global goals 태깅/표시 제거, 동기화는 읽기 호환 유지(원격 데이터는 삭제하지 않음), weekly goals만 유지”
- 수용 기준:
  - 빌드 산출물/앱 About 등에 표시되는 버전이 1.0.164로 일치
  - 릴리즈 설명에 ‘goalId 필드 삭제는 defer’와 ‘원격 globalGoals는 방치(읽기 호환)’가 명확히 포함

### Release B (Target: 1.0.165)
- 목표: PR#4(Dexie `globalGoals` 테이블 drop)를 “단독 또는 최소 범위”로 배포한다.
- 작업:
  - 버전 아티팩트 업데이트(예: root `package.json` 버전)
  - 배포/운영 커뮤니케이션에 포함할 변경 요약: “Dexie 스키마 변경(사실상 forward-only), 다운그레이드 비권장”
- 수용 기준:
  - 빌드 산출물/앱 About 등에 표시되는 버전이 1.0.165로 일치
  - 운영 관점에서 ‘롤백/다운그레이드 리스크’가 릴리즈 설명에 명시됨

## Open Questions
- **OPEN QUESTION (BLOCKING)**: Release A/B 버전(제안: 1.0.164 / 1.0.165)이 로드맵/운영 정책과 맞나요? (현재 1.0.163)
- **OPEN QUESTION (SAME-DAY)**: “완전 제거”에 Firebase 원격 `globalGoals` 노드의 물리 삭제까지 포함하나요? (이번 플랜은 기본적으로 ‘읽기 호환 유지 + 더 이상 쓰지 않음(방치)’을 전제로 함)

---

## PR Title Suggestions
- PR#1: `refactor(goals): disable global-goal progress pipeline (handlers/subscribers)`
- PR#2: `refactor(ui): remove global-goal tagging from tasks (modal/timeline/cards)`
- PR#3: `refactor(sync): stop writing globalGoals; keep backward-compatible reads`
- PR#5: `chore(goals): remove remaining global-goals types/events/docs (goalId field deferred)`
- PR#4 (Release B): `chore(db): drop globalGoals Dexie table (post-soak)`

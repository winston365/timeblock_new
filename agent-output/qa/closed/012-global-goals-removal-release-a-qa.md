# QA Report: Release A Global Goals Removal

**Plan Reference**: `agent-output/planning/012-global-goals-removal-pr-breakdown.md`
**QA Status**: QA Complete
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-21 | Implementer | Release A(global goals 제거) QA 검증 | Vitest 전체 실행(PASS, skip 0) + weekly goals 수동 체크리스트/관측 포인트/회귀 위험 영역 정리 + 가드레일 테스트 1개 추가 |

## Timeline
- **Testing Started**: 2025-12-21
- **Testing Completed**: 2025-12-21
- **Final Status**: QA Complete

## Test Strategy (Pre-Implementation)
- 사용자 관점에서 “weekly goals만 남는다”가 깨지는 지점(Goals UI/주차 리셋/히스토리)과, 레거시 데이터(goalId/globalGoals)가 남아있을 때 크래시가 나는 지점(스케줄/타임라인/동기화/보상 파이프라인)을 우선 검증.
- 자동 테스트는 전체 vitest 스위트로 회귀 탐지 + Release A 핵심 불변조건(전략/구독자 부활 금지)을 작은 가드레일 테스트로 고정.
- 수동 검증은 weekly goals CRUD/히스토리/주차 전환을 체크리스트로 제공(실제 사용자 흐름).

### Testing Infrastructure Requirements
- 추가 인프라 필요 없음 (기존 `vitest`/alias `@/` 사용)

## Implementation Review (Post-Implementation)

### Code Changes Summary (회귀 위험 중심)
작업 트리 기준 변경/정리 대상이 넓음(전반적인 global goals 경로 제거).
- task completion: GoalProgressHandler 제거 및 실행 순서 변경
- eventBus/subscribers: goal subscriber 제거, 초기화 엔트리 정리
- schedule UI: TaskModal/Timeline/TaskCard에서 goal 연결 제거
- sync: firebase 전략/서비스에서 global goals 경로 제거(weeklyGoalStrategy만 유지)
- repositories/db: globalGoalRepository 및 dailyGoal 레거시 경로 정리(Release A: 스키마는 남을 수 있음)

## Test Coverage Analysis
### New/Modified Code
| File | Function/Class | Test File | Coverage Status |
|------|---------------|-----------|-----------------|
| `src/shared/services/sync/firebase/strategies.ts` | (export set) | `tests/global-goals-removal-release-a.test.ts` | COVERED (guard) |
| `src/shared/subscribers/index.ts` | (export set) | `tests/global-goals-removal-release-a.test.ts` | COVERED (guard) |
| task completion chain / handler order | TaskCompletionService | `tests/task-completion*.test.ts` | COVERED |

### Coverage Gaps (중요)
- UI(GoalsModal/WeeklyGoalPanel/TaskModal/TimelineView) 자체는 자동화 테스트가 거의 없어서, 아래 수동 체크리스트로 보완 필요.

## Test Execution Results

### Unit/Integration (Vitest)
- **Command**: `npx vitest run --reporter=json --outputFile=agent-output/qa/vitest-run.after-qa-guards.json`
- **Status**: PASS
- **Summary**: 58 suites / 124 tests passed, failed 0, **pending(skip) 0**
- **Evidence**: `agent-output/qa/vitest-run.after-qa-guards.json`

### QA Guardrail Tests Added
- Added: `tests/global-goals-removal-release-a.test.ts`
  - 목적: Release A에서 `globalGoalStrategy`/`dailyGoalStrategy` 및 `initGoalSubscriber`가 “실수로 재도입”되는 회귀를 조기 탐지

## Manual Checklist (Weekly Goals 핵심 플로우)
아래는 “weekly goals: 추가/수정/삭제/히스토리/주차 전환” 최소 수동 체크리스트입니다.

1) 진입/로드
- 상단 툴바에서 Goals 모달 열기 → weekly goals 목록이 렌더링되고 크래시/흰 화면 없음
- 모달 ESC로 닫힘(중첩 모달 포함 시 단계적으로 닫힘)

2) 추가(Add)
- ‘추가’로 새 목표 생성(제목/타깃/단위/아이콘/색상 입력) → 저장 후 카드 생성
- 앱 재시작 후에도 유지(Dexie 로컬) + SyncLog에 weeklyGoals 동기화 로그가 있다면 정상 1회 이상 관측

3) 수정(Edit)
- 기존 목표 편집(제목/타깃/단위/색상 변경) → 카드 반영
- 진행도 조작(± 버튼/직접 입력) → 0 미만/NaN 입력에서 UI가 깨지지 않음(최소: 크래시 없음)

4) 삭제(Delete)
- 목표 삭제 → 목록에서 제거되고 에러 로그/크래시 없음
- 삭제 후 즉시 재추가 가능

5) 히스토리(History)
- 목표 카드에서 히스토리 모달 열기 → 최근 주차 기록 표시(있는 경우)
- ESC/닫기 버튼으로 닫기 정상

6) 주차 전환(Week rollover)
- (권장) OS 날짜를 다음 주 월요일로 변경 → 앱 재실행 또는 Goals 재진입
- 기대: 진행도 리셋 + 이전 주가 history에 append + history 최대 보관 개수 정책(예: 최근 5주) 유지
- 동기화 환경이라면: weeklyGoals bulk sync가 1회 발생(과도 반복/무한 루프는 위험 신호)

## Task.goalId 잔존 시 UI 크래시 방지 확인 포인트
Release A 전제상 `task.goalId` 필드는 남아있을 수 있으므로(마이그레이션 DEFER), 아래를 “레거시 데이터 회귀 체크”로 권장합니다.
- 스케줄 리스트/타임라인 렌더링: goalId가 들어있는 task가 있어도 화면 렌더링 크래시 없음
- Task 편집 모달 열기/저장: goal 선택 UI가 없어도 저장/닫기 정상
- Quick Add/Inbox → Schedule 이동: 기존 goalId가 있어도 이동/완료 토글이 정상(보상 파이프라인 포함)
- 캘린더 연동(있다면): `task.goalId` 체크 분기에서 undefined 접근/문자열 처리 오류 없음

## SyncLog/로깅에서 globalGoals read/write = 0 관측 포인트
SyncLog UI는 [src/features/settings/SyncLogModal.tsx](../../src/features/settings/SyncLogModal.tsx)에서 메시지 기반으로 확인 가능합니다.
- (권장 절차)
  1) SyncLog 열기 → ‘로그 초기화’로 비우기
  2) 앱 재시작/동기화 트리거(로그인/초기화/작업 CRUD 등) 수행
  3) 필터를 Firebase + 전체(action=all)로 두고 메시지 스캔
- (기대 신호)
  - `globalGoals`, `globalGoal`, `dailyGoal` 관련 메시지/전략명이 **0건**
  - Dexie 로그에서도 `globalGoals` 테이블 write/clear/reset 관련 메시지가 **0건**
- (주의)
  - 원격 스냅샷에 과거 `globalGoals` 키가 남아있더라도, Release A 목표는 “명시적 read/write/strategy가 0”인지가 핵심입니다(= 파서에서 무시/optional 처리 가능).

## High Regression Risk Areas (우선 점검 리스트)
- task completion pipeline: handler 체인 순서 변경/부수효과 누락 위험
- eventBus 타입/구독자 초기화: goal subscriber 제거로 인한 초기화 경로 회귀
- schedule UI: `TaskModal`, `TimelineView`, `TaskCard`에서 goal 관련 렌더/상태 참조 잔존 여부
- sync 계층: [src/shared/services/sync/firebase/strategies.ts](../../src/shared/services/sync/firebase/strategies.ts), [src/shared/services/sync/firebaseService.ts](../../src/shared/services/sync/firebaseService.ts)
- repository/db 경계: globalGoalRepository 제거 이후 남는 import/배럴 export, Dexie init 경로

## QA Conclusion (Merge 가능 여부)
- **Merge: 가능** (자동 테스트 전부 PASS, skip 0, Release A 가드레일 테스트 추가)
- 단, 사용자 가치(UAT) 관점의 “weekly goals UX가 요구대로 동작”은 수동 체크리스트로 확인이 필요함(특히 주차 전환/히스토리).

Handing off to uat agent for value delivery validation

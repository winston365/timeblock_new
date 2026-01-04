# QA Report: P0 Repository Single-Gate (Dexie Direct Access Removal)

**Plan Reference**: `agent-output/architecture/system-architecture.md` (ADR-004) — P0 plan doc not found under `agent-output/planning/`
**QA Status**: QA Failed
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-17 | Implementer | P0(직접 Dexie 접근 제거, Repository 단일 관문) QA 검증 | 전역 검색/테스트 실행/스모크 호출 경로 점검. repo 외부 dexieClient import 및 `db.` 직접 접근 잔존 다수 확인. `npm test`는 PASS. |

## Timeline
- **Test Strategy Started**: 2025-12-17
- **Test Strategy Completed**: 2025-12-17
- **Implementation Received**: 2025-12-17
- **Testing Started**: 2025-12-17
- **Testing Completed**: 2025-12-17
- **Final Status**: QA Failed

## Test Strategy (Pre-Implementation)
본 P0의 사용자 영향은 “저장/동기화/캐시/설정 지속” 등 광범위합니다. 따라서 QA는 (1) 정적 스캔으로 경계 위반을 즉시 발견하고, (2) vitest 회귀를 통해 로직 동작을 확인하며, (3) 대표 스모크 플로우의 **호출 경로가 repo를 경유하는지** 코드 레벨로 검증합니다.

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- 기존 `vitest` 사용

**Testing Libraries Needed**:
- 추가 필수 없음

**Configuration Files Needed**:
- 추가 필수 없음

**Build Tooling Changes Needed**:
- (선택) 경계 위반을 막기 위한 `eslint` no-restricted-imports/no-restricted-properties 또는 vitest 정적 스캔 테스트 추가 고려

## Implementation Review (Post-Implementation)

### Code Changes Summary
- Repository 계층에 systemState/aiInsights/weather 등 wrapper가 존재하나, repo 외부에 Dexie 직접 접근(`@/data/db/dexieClient` import 및 `db.` 사용)이 여전히 남아있음.

## Test Coverage Analysis
### New/Modified Code
정적 스캔 기준으로 repo 외부에서 `@/data/db/dexieClient` 또는 `db.`를 사용하는 모듈이 존재하므로 “Repository 단일 관문” 수용 기준을 충족하지 못함.

## Test Execution Results
### Unit Tests
- **Command**: `npm test`
- **Status**: PASS
- **Summary**: Test Files 13 passed, Tests 94 passed
- **Notes**: 일부 테스트는 의도적으로 stderr 로그를 출력(예: error isolation)하나 실패는 없음

## Findings: Boundary Violations
아래는 **`src/data/repositories/**` 외부**에서 발견된 위반/잔존 사용처입니다.

### 1) `@/data/db/dexieClient` import 잔존
- `src/shared/services/sync/syncLogger.ts`
- `src/shared/services/sync/syncEngine.ts`
- `src/shared/services/sync/firebase/syncUtils.ts`
- `src/shared/services/rag/vectorPersistence.ts`
- `src/shared/services/rag/ragSyncHandler.ts`
- `src/shared/services/rag/directQueryService.ts`
- `src/shared/services/rag/autoTagService.ts`
- `src/shared/services/imageStorageService.ts`
- `src/shared/services/calendar/googleTasksService.ts`
- `src/shared/services/calendar/googleCalendarService.ts`
- `src/features/quickadd/QuickAddTask.tsx` (initializeDatabase import)
- `src/app/hooks/useAppInitialization.ts`

(테스트) `tests/sync-logger.test.ts`는 mock 목적의 import로 분류

### 2) `db.` 직접 접근 잔존 (대표)
- systemState 직접 접근
  - `src/shared/services/sync/syncLogger.ts`
  - `src/shared/services/sync/firebase/syncUtils.ts`
  - `src/shared/services/calendar/googleCalendarService.ts`
- inbox/task 직접 접근
  - `src/features/schedule/ScheduleView.tsx` (`db.globalInbox.get`)
  - `src/shared/services/sync/syncEngine.ts` (table hooks/clear/bulkPut 등)
  - `src/shared/services/rag/ragSyncHandler.ts` (Dexie hooks)
  - `src/app/hooks/useAppInitialization.ts` (bulkAdd/clear/get/put 등 다수)
- aiInsights 직접 접근
  - `src/features/stats/StatsModal.tsx` (`db.aiInsights.put`) — 읽기는 repo(`getAIInsight`)를 사용하지만 쓰기는 직접 접근

## Risk Assessment (Top 3)
1) `src/app/hooks/useAppInitialization.ts`: 초기화/동기화 시점에 여러 테이블을 직접 조작(clear/bulkAdd/put/get). repo 경계를 우회하면 마이그레이션/동기화 정책 변경 시 회귀 범위가 매우 큼.
2) `src/shared/services/sync/syncEngine.ts` 및 `src/shared/services/rag/ragSyncHandler.ts`: Dexie hook 기반으로 table-level 동작을 직접 결합. repo로 수렴하지 않으면 “단일 관문” 자체가 깨지고, hook 타이밍/트랜잭션 이슈가 UI까지 전파될 수 있음.
3) `src/shared/services/calendar/googleCalendarService.ts` / `src/shared/services/sync/firebase/syncUtils.ts` / `src/shared/services/sync/syncLogger.ts`: systemState를 직접 읽고 씀. 이미 `src/data/repositories/systemRepository.ts`가 키 관리(SYSTEM_KEYS 포함)를 제공하므로, 현 상태는 키/에러처리/직렬화 정책이 분산되어 설정 유실/불일치 위험이 큼.

## Suggested Additional Tests (Optional)
- (정적) vitest 테스트로 `src/**`를 스캔하여 `@/data/db/dexieClient` import가 `src/data/repositories/**` 외부에 존재하면 실패하도록 하는 “경계 가드” 테스트 추가
- (lint) `eslint`의 `no-restricted-imports`로 `@/data/db/dexieClient`를 repositories 외부에서 금지 (예외 allowlist: 테스트/특정 infra)

---

Handing off to uat agent for value delivery validation

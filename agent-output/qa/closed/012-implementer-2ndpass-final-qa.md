# QA Report: Implementer 2차 패스 이후 최종 QA (Dexie Boundary)

**Plan Reference**: `agent-output/architecture/system-architecture.md` (Repository Single-Gate / ADR-004) — 관련 플랜 문서가 `agent-output/planning/` 하위에서 확인되지 않아, 사용자 요청 기반으로 QA 수행
**QA Status**: QA Failed
**QA Specialist**: qa

> Flowbaby memory is unavailable; operating in no-memory mode.

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-17 | Implementer | Implementer 2차 패스 이후 최종 QA | 전역 검색(경로 포함)으로 Dexie 경계 위반 점검, ESLint/vitest 가드 실동작 확인, `npm test`/`npm run lint` 실행. dexieClient import 경계는 통과했으나, repo 외부 `db.` 직접 접근 4개 파일 잔존으로 QA Failed. |

## Timeline
- **Test Strategy Started**: 2025-12-17
- **Test Strategy Completed**: 2025-12-17
- **Implementation Received**: 2025-12-17
- **Testing Started**: 2025-12-17
- **Testing Completed**: 2025-12-17
- **Final Status**: QA Failed

## Test Strategy (Pre-Implementation)
사용자 관점에서 “저장/동기화/설정 지속성”이 깨지면 즉시 체감되므로, QA는 다음 3축으로 구성합니다.
1) **정적 경계 검사**: Dexie infra(`dexieClient`, `db.`) 접근이 허용 경로 밖에서 발생하는지 전역 검색으로 확인
2) **가드 실동작 확인**: ESLint `no-restricted-imports` + vitest 정적 스캔 테스트가 실제로 경계 위반을 막는지 확인
3) **회귀 방지**: `npm test`/`npm run lint`로 기본 회귀를 확인하고, 대규모 리팩터링 파일은 리스크로 별도 표기

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- 기존 `vitest`

**Testing Libraries Needed**:
- 추가 없음

**Configuration Files Needed**:
- `.eslintrc.cjs` (no-restricted-imports 가드)
- `vitest.config.ts` (테스트 include 확인)

## Implementation Review (Post-Implementation)
### Working Tree 상태
- 이번 QA는 **현재 워킹트리 변경분(미커밋/언트래킹 포함)** 기준으로 수행
- `git status --porcelain`에서 다수 파일 변경 및 `tests/db-access-boundary.test.ts`가 untracked로 확인됨

### Code Changes Summary (High-level)
- 대규모 리팩터링(삭제량 큰 파일):
  - `src/shared/services/sync/syncEngine.ts` (대규모 삭제)
  - `src/app/hooks/useAppInitialization.ts` (대규모 삭제)
  - `src/shared/services/rag/ragSyncHandler.ts` (대규모 삭제)
- 경계 가드 추가/강화:
  - `.eslintrc.cjs`에 `no-restricted-imports` 패턴 및 allowlist(override)
  - `tests/db-access-boundary.test.ts`에서 `src/**` 정적 스캔

## Required Verification Results
아래 4개 항목은 사용자 요청의 “필수 검증”을 그대로 수행한 결과입니다.

### 1) `@/data/db/dexieClient` import가 허용 경로 외부에 0개인지
- **Result**: PASS
- **Evidence (import 라인 기준)**: `src/` 전체에서 import 라인에 한해 집계 시 2개이며 모두 허용 경로에 존재
  - `src/data/repositories/dailyGoalRepository.ts:14`
  - `src/data/repositories/tempScheduleRepository.ts:15`

### 2) `db.` 직접 접근이 허용 경로 외부에 0개인지
- **Result**: FAIL
- **Evidence (raw `db.` 전역 검색, 경로 포함)**:
  - 총 12 matches / 4 files (허용 경로 외부)
  - 잔존 파일:
    - `src/features/schedule/ScheduleView.tsx:391` (`db.globalInbox.get`)
    - `src/features/stats/StatsModal.tsx:364` (`db.aiInsights.put`)
    - `src/shared/services/calendar/googleCalendarService.ts:357,376,393,402,416,433,482` (`db.table(...)`)
    - `src/shared/lib/errorHandler.ts:116,155,190` (예시 주석 내 `db.`)

> Note: 항목 2는 단순 문자열 기준 전역 검색이므로 주석 내 예시도 포함됩니다. 다만, `ScheduleView/StatsModal/googleCalendarService`는 실제 코드 경로로 보이며 Repository 단일 관문 원칙 위반 가능성이 큽니다.

### 3) 새 가드(ESLint no-restricted-imports + vitest 정적 스캔 테스트) 동작 확인
- **Result**: PASS (단, 스코프 갭 존재)
- **ESLint**:
  - `.eslintrc.cjs`에 `no-restricted-imports`로 `@/data/db/dexieClient` 및 `**/data/db/dexieClient`를 금지
  - `src/data/repositories/**`, `src/data/db/**`는 override로 예외 처리
- **Vitest 정적 스캔**:
  - `tests/db-access-boundary.test.ts`가 `src/**`를 스캔하여 허용 경로 외부 `dexieClient` import를 실패 처리
  - `npm test` 실행에서 해당 테스트가 PASS
- **갭(중요)**:
  - 현재 가드는 **`dexieClient import` 중심**이며, 항목 2의 `db.` 직접 접근을 직접적으로 차단하지 못할 수 있음(예: 전역/다른 모듈 경유로 `db` 접근 가능)

### 4) `npm test` + `npm run lint` 통과
- **Result**: PASS
- **Commands**:
  - `npm test` → PASS (Test Files 14 passed, Tests 95 passed)
  - `npm run lint` → PASS

## Test Coverage Analysis
### New/Modified Code vs Tests
- `tests/db-access-boundary.test.ts`는 **dexieClient import**에 대해서만 커버
- **`db.` 직접 접근(항목 2)**에 대한 정적 차단/테스트는 미흡 (현재 FAIL 원인)

## Findings: Violations (정확 경로)
- `src/features/schedule/ScheduleView.tsx:391`
- `src/features/stats/StatsModal.tsx:364`
- `src/shared/services/calendar/googleCalendarService.ts:357,376,393,402,416,433,482`
- `src/shared/lib/errorHandler.ts:116,155,190` (주석 예시)

## Risk Assessment (Top 3)
1) `src/shared/services/sync/syncEngine.ts`
   - 변경 규모가 매우 크고(sync/재시도/큐/전략 연동), 작은 로직 누락도 동기화 유실/중복 업로드로 이어질 수 있음.
2) `src/app/hooks/useAppInitialization.ts`
   - 앱 부팅 시점의 초기화 경로(로드/마이그레이션/캐시/동기화 트리거)가 얽혀 있어 회귀 시 “앱이 바로 망가져 보이는” 사용자 영향이 큼.
3) `src/shared/services/rag/ragSyncHandler.ts`
   - 문서/벡터 저장/동기화 경로의 단일화는 데이터 정합성에 민감. 리팩터링 후 경계가 조금만 흔들려도 누락/중복/성능 저하로 이어질 위험.

## Recommended Next Steps (Optional)
- (필수에 가까움) 항목 2의 잔존 `db.` 접근을 Repository로 수렴:
  - `ScheduleView.tsx`의 inbox 조회는 unified-task/repository 경유로 대체
  - `StatsModal.tsx`의 aiInsights 저장은 `aiInsightsRepository`로 대체
  - `googleCalendarService.ts`의 Dexie 매핑 테이블 접근은 `calendarRepository`로 수렴
- (가드 강화) vitest 정적 스캔에 `db.` 직접 접근(혹은 특정 table name: `globalInbox`, `aiInsights`, `systemState` 등)까지 포함하거나, ESLint에 `no-restricted-globals/properties`로 `db` 사용을 제한하는 규칙 추가 검토
- (문서/주석) `errorHandler.ts`의 예시 주석은 문자열 스캔에서 지속적으로 걸릴 수 있으므로, 가드 기준이 “코드만”이라면 주석 제외 로직을 명확히(또는 예시를 `repository` 기반으로 변경)

---

Handing off to uat agent for value delivery validation

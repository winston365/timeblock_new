# QA Report: Google Calendar 토큰 자동 갱신 안정화

**Plan Reference**: `agent-output/planning/011-google-calendar-token-refresh-stability-plan.md`
**QA Status**: QA Complete
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-21 | User | Manual repro/verification scenarios + regression checklist | Electron 수동 재현/검증 시나리오, 엣지케이스 매트릭스, 회귀 체크리스트 작성 + vitest/lint 증거 추가 |

## Timeline
- **Test Strategy Started**: 2025-12-21
- **Test Strategy Completed**: 2025-12-21
- **Implementation Received**: 2025-12-21 (변경 파일/테스트 명시됨)
- **Testing Started**: 2025-12-21
- **Testing Completed**: 2025-12-21
- **Final Status**: QA Complete

## Test Strategy (Pre-Implementation)
사용자 관점에서 “연동이 자주 끊긴다”가 실제로는 아래 4가지로 나타나므로, 각 흐름별로 재현/검증을 분리한다.
- **설정 로딩 호환성**: 레거시 필드명/형 변종으로 토큰 만료로 오판 → 재로그인 유도/연동 끊김
- **만료시간 누락 처리**: `tokenExpiresAt` 누락 시 선제 만료로 오판 → 401 기반 복구 경로가 작동하지 못함
- **동시 refresh 경쟁**: 여러 동기화 호출이 동시에 401을 만나 refresh IPC가 중복 호출 → 불안정/레이스
- **서비스 간 401 재시도 드리프트**: Calendar vs Tasks의 401 처리 규약 불일치 → 한쪽은 복구, 한쪽은 실패

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- vitest (repo 기존 사용)

**Testing Libraries Needed**:
- 없음(기존 mock/fake-indexeddb 사용)

**Configuration Files Needed**:
- 없음

**Build Tooling Changes Needed**:
- 없음

⚠️ TESTING INFRASTRUCTURE NEEDED: 없음

### Required Manual Verification (Electron)
아래 시나리오는 “원래 버그 재현 → 수정 검증”으로 구성했다.

#### Manual Scenario A — 레거시 설정 정규화 + write-back (원래 즉시 끊김/토큰 만료 오판)
**목적**: `expiresAt/email/accessTokenExpiresAt(변종)` 저장 사용자에서 앱 재시작 후 연동이 끊기지 않고, DB가 현행 shape로 수렴하는지 확인.

**재현(원래 버그) 데이터 준비**
1) Electron으로 실행: `npm run electron:dev`
2) 앱에서 Settings → Google Calendar 탭으로 이동
3) DevTools 열기: `Ctrl+Shift+I`
4) DevTools → Application → IndexedDB → (Dexie DB) → `systemState` 테이블에서 key가 `googleCalendarSettings`인 레코드를 찾는다.
5) value를 아래처럼 “레거시 필드만 남도록” 편집한다(예시).
   - `enabled: true`
   - `accessToken: "a"`, `refreshToken: "r"`
   - `accessTokenExpiresAt: "1730000000"` (문자열 + seconds epoch)
   - `email: "user@example.com"`
   - `clientId/clientSecret`는 유지
   - `tokenExpiresAt/userEmail`는 제거
6) 앱을 새로고침(또는 재시작)한다.

**검증(수정 기대 결과)**
- Settings → Google Calendar 탭에서 “연동됨” 상태가 유지되고, 이메일이 정상 표시된다.
- 같은 `systemState.googleCalendarSettings` 레코드를 다시 열어보면:
  - `tokenExpiresAt`가 **ms epoch(number)** 로 채워져 있다 (예: `1730000000 * 1000`).
  - `userEmail`가 채워져 있다.
  - 레거시 키(`expiresAt/accessTokenExpiry/accessTokenExpiresAt/email`)가 제거되어 있다(write-back).

#### Manual Scenario B — `tokenExpiresAt` 누락 + 401 트리거 refresh+retry
**목적**: 만료시간이 없는 레거시/부분 저장 상태에서 “즉시 재인증 강제” 대신, 실제 401을 만났을 때 자동 refresh+재시도가 되는지 확인.

**준비**
1) Electron에서 Google Calendar가 정상 연동된 상태여야 함(최소: `refreshToken`, `clientId`, `clientSecret` 존재).
2) DevTools에서 `systemState.googleCalendarSettings`를 편집:
   - `tokenExpiresAt`를 제거한다.
   - `accessToken`을 의도적으로 잘못된 값으로 바꾼다(예: `"invalid"`).

**실행(401 유도)**
- 스케줄된 작업을 1개 생성(또는 임시 스케줄을 1개 생성)해 Google Sync가 API 호출을 하게 만든다.
  - 스케줄된 작업: Task 생성/수정/삭제 이벤트가 Google Sync Subscriber를 트리거
  - 임시 스케줄: tempSchedule 생성/수정/삭제가 트리거

**검증(수정 기대 결과)**
- 한 번의 실패(401) 후 자동 갱신이 수행되고, 같은 작업이 최종적으로 동기화된다(구글 캘린더에 이벤트 생성/수정/삭제 반영).
- Settings 탭에서 불필요하게 “토큰 만료” 뱃지가 즉시 표시되지 않는다(만료시간 누락은 ‘알 수 없음’으로 취급).

#### Manual Scenario C — 단일 in-flight refresh (동시 동기화 폭발 방지)
**목적**: 여러 동기화가 동시에 401을 만나도 refresh IPC가 중복 폭발하지 않고 1회로 수렴하는지 확인.

**방법(현실적인 사용자 시나리오)**
1) Scenario B 상태(잘못된 access token)에서,
2) 빠르게 여러 변경을 만들어 “동시에 여러 API 호출”이 발생하도록 한다.
   - (예) 스케줄된 작업 3개를 연속 생성/수정하거나, 임시 스케줄과 작업을 연속 변경
3) DevTools Console에서 refresh 관련 로그(예: `[GoogleCalendar] Token refreshed successfully`)가 과도하게 반복되지 않는지 확인한다.

**검증 포인트**
- refresh 성공 로그가 1회(또는 매우 제한된 횟수)로 수렴
- 동기화 결과는 누락 없이 최종 반영

#### Manual Scenario D — Tasks API 401 재시도 일관성 (삭제 경로 포함)
**목적**: task 삭제 시 Calendar/Tasks 모두 “401 → refresh 1회 → 재시도 1회” 규약을 따르고, 매핑 삭제 레이스로 실패하지 않는지 확인.

**절차**
1) 스케줄된 작업을 1개 만들고(구글 캘린더에 이벤트가 생성된 상태),
2) 해당 작업을 앱에서 삭제한다.

**검증(수정 기대 결과)**
- 구글 캘린더 이벤트가 삭제된다.
- (레거시 cleanup) Tasks API 삭제 시도가 실패해도(404 등) 앱이 에러로 중단되지 않는다.
- 401이 발생하는 환경이라면 자동 refresh 후 재시도한다(사용자 재로그인 강제/무한 루프 없음).

### Edge-case Matrix (요구사항 매핑)
| 케이스 | 설정 상태(입력) | 환경 | 기대 동작(사용자 관점) | 기대 동작(시스템) |
|---|---|---|---|---|
| Legacy 필드명 | `expiresAt/email/accessTokenExpiresAt`만 존재 | Electron | 연동 상태 유지, 이메일 표시 정상 | 로드시 정규화 + write-back로 `tokenExpiresAt/userEmail` 수렴 |
| `tokenExpiresAt` 누락 | `enabled=true`, `accessToken` 존재, `tokenExpiresAt` 없음 | Electron | 즉시 “토큰 만료/재로그인” 강제 금지 | `isTokenValid()`는 true, 실제 401에서 refresh+retry |
| refreshToken 누락 | `accessToken` 만료/401, `refreshToken` 없음 | Electron/Non-Electron | 사용자에게 재로그인 요구가 명확히 표시 | refresh 시도 없이 예측 가능한 에러로 종료(무한 재시도 없음) |
| clientId/clientSecret 누락 | `refreshToken`은 있으나 client creds 없음 | Electron | “클라이언트 설정 누락” 안내 | refresh 불가로 종료, 401 retry 루프 없음 |
| Non-Electron 환경 | `window.electronAPI` 없음 | Web(Vite) | 설정 탭에서 “데스크톱 앱에서만” 경고, 자동 갱신 불가 안내 | refresh 경로 차단 + 명확한 에러 메시지 |

### Regression Checklist (요구사항)
아래는 배포 전 “짧게” 확인 가능한 체크리스트다.

**Settings UI 상태**
- Google Calendar 탭 로드 시 저장된 credentials가 입력란에 복원됨
- Electron이 아닐 때 경고가 표시되고, 연동 시도 시 실패가 명확함
- 레거시 데이터(Scenario A)에서 연동 상태/이메일 표시가 정상
- `tokenExpiresAt` 누락 상태에서 즉시 ‘토큰 만료’로 표시되지 않음

**Calendar CRUD (실사용 동작)**
- 스케줄된 작업 생성 → 구글 캘린더 이벤트 생성
- 스케줄된 작업 수정(시간/제목/메모) → 이벤트 업데이트
- 스케줄된 작업 삭제 → 이벤트 삭제
- 임시 스케줄 생성/수정/삭제 → 대응 이벤트 CRUD

**Tasks Delete (레거시 cleanup 포함)**
- 작업 삭제 시 Google Tasks cleanup 경로가 404에도 안전
- 401이 발생하는 환경에서 Calendar/Tasks 모두 refresh+retry 규약 준수

## Implementation Review (Post-Implementation)

### Code Changes Summary
- `src/data/repositories/calendarRepository.ts`
  - 레거시 설정 정규화(`expiresAt/email/...` → `tokenExpiresAt/userEmail`) + write-back
  - seconds/string epoch을 ms number로 강제(coerce)
- `src/shared/services/calendar/googleCalendarService.ts`
  - `tokenExpiresAt` 누락을 “사용 가능”으로 취급(`isTokenValid`)
  - 단일 in-flight refresh 가드(`refreshInFlight`)
  - 401 시 refresh 1회 + 재요청 1회 규약 명확화
  - refresh 불가 조건(Non-Electron/refreshToken/credentials 누락) 메시지 구체화
- `src/shared/services/calendar/googleTasksService.ts`
  - `callTasksApi`도 401 refresh+retry 규약을 Calendar와 동일하게 적용
  - 삭제 시 매핑을 먼저 읽어 레이스 방지(캘린더 삭제가 매핑을 지울 수 있음)
- `tests/google-calendar-token-refresh-stability.test.ts`
  - 정규화+write-back, 단일 refresh, Calendar 401 retry, Tasks 401 retry(삭제 경로) 커버

## Test Coverage Analysis
### New/Modified Code
| File | Function/Class | Test File | Test Case | Coverage Status |
|------|---------------|-----------|-----------|-----------------|
| src/data/repositories/calendarRepository.ts | normalizeGoogleCalendarSettings/getGoogleCalendarSettings | tests/google-calendar-token-refresh-stability.test.ts | normalizes legacy settings with write-back | COVERED |
| src/shared/services/calendar/googleCalendarService.ts | refreshAccessToken/getValidAccessToken | tests/google-calendar-token-refresh-stability.test.ts | single in-flight refresh, accessToken missing | COVERED |
| src/shared/services/calendar/googleCalendarService.ts | callCalendarApi(401 retry) | tests/google-calendar-token-refresh-stability.test.ts | retries once on 401 for Calendar API calls | COVERED |
| src/shared/services/calendar/googleTasksService.ts | callTasksApi(401 retry) + deleteGoogleTask | tests/google-calendar-token-refresh-stability.test.ts | retries once on 401 for Tasks API calls via deleteGoogleTask | COVERED |

### Coverage Gaps
- 실제 Electron IPC(googleOAuthRefresh)와 Google API 실통신은 단위 테스트에서 mock 처리됨 → 수동(Electron) 검증 시나리오로 보완 필요(Scenario B/C/D).

## Test Execution Results
### Unit Tests
- **Command**: `npm test -- tests/google-calendar-token-refresh-stability.test.ts`
- **Status**: PASS
- **Output**: 단일 파일 실행, 실패 없음

### Lint
- **Command**: `npm run lint`
- **Status**: PASS

## Manual Repro/Verification Quick List (현장용)
- Scenario A: 레거시 설정 → 재시작 → 연동 유지 + DB write-back 확인
- Scenario B: `tokenExpiresAt` 삭제 + accessToken 무효화 → 작업/임시스케줄 변경 → 401 후 자동 복구
- Scenario C: 위 상태에서 다건 동시 변경 → refresh 로그/동작이 1회로 수렴
- Scenario D: 작업 삭제 → 캘린더 이벤트 삭제 + Tasks cleanup 안전 + 401 retry 일관성

Handing off to uat agent for value delivery validation

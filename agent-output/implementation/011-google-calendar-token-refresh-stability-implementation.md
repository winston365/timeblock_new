# Implementation: Google Calendar 토큰 리프레시 안정화

## Plan Reference
- Plan: agent-output/planning/011-google-calendar-token-refresh-stability-plan.md
- Plan ID: plan-2025-12-21-google-calendar-token-refresh-stability

## Date
- 2025-12-21

## Changelog
| Date | Handoff/Request | Summary |
| --- | --- | --- |
| 2025-12-21 | User bug fix | 레거시 설정 정규화+write-back, tokenExpiresAt 누락 허용, 단일 in-flight refresh 유지/강화, 401 refresh+retry 규약 정렬, vitest 회귀 보강 |
| 2025-12-21 | Lint/테스트 정합성 | 테스트에서 Dexie 직접 접근 제거(Repository 경유), Tasks 인증 실패 메시지 규약을 Calendar와 통일, react-refresh 경고 무력화(최소 eslint-disable) |

## Implementation Summary
- 저장된 `googleCalendarSettings` 레코드의 레거시 필드/타입 드리프트(예: `expiresAt`, `accessTokenExpiresAt`, string/seconds epoch)를 읽을 때 정규화하고 동일 키로 write-back 하여 데이터가 단일 shape(`tokenExpiresAt` ms number, `userEmail`)로 수렴하도록 구현.
- `tokenExpiresAt`이 누락된 레거시/부분 저장 상태에서 즉시 “만료/재로그인”으로 떨어지지 않도록, access token이 있으면 우선 사용하고 401 발생 시에만 refresh+retry로 복구하도록 `googleCalendarService`를 조정.
- Calendar/Tasks 두 서비스의 401 처리 규약을 “refresh 1회 + 재요청 1회, 불가능 시 명확한 에러”로 일치.

## Milestones Completed
- [x] 1) 저장된 설정 정규화(legacy 필드명/shape 호환) + write-back
- [x] 2) 토큰 리프레시 가드(단일 in-flight refresh) 유지, tokenExpiresAt 누락 시 강제 재인증 방지
- [x] 3) 401 재시도 규약(Calendar/Tasks) 정렬 및 실패 메시지 표준화
- [x] 4) vitest 회귀 테스트 보강(정규화 변종 + tokenExpiresAt 누락 케이스)
- [x] 5) Validation: eslint + vitest 통과

## Files Modified
| Path | Changes | Notes |
| --- | --- | --- |
| src/data/repositories/calendarRepository.ts | 레거시 필드 매핑/타입 정규화 강화 + write-back 조건 보강 | seconds→ms heuristic, string→number parse, `accessTokenExpiry/accessTokenExpiresAt` 지원 |
| src/shared/services/calendar/googleCalendarService.ts | tokenExpiresAt 누락 시 유효로 간주, 401에서 refresh 실패 메시지 표준화 | 선제 refresh 제거(누락 시), doRequest 메시지 명확화 |
| src/shared/services/calendar/googleTasksService.ts | access token 획득 실패 시 에러 메시지 규약 정렬 | Calendar와 동일 정책(환경/토큰/크리덴셜 원인 분리) |
| tests/google-calendar-token-refresh-stability.test.ts | Dexie 직접 접근 제거 + 회귀 테스트 유지 | systemRepository/calendarRepository로 시드/검증, fetch mock을 Response 기반으로 정리 |
| tests/temp-schedule-date-parsing.test.ts | unused eslint-disable 제거 | `--report-unused-disable-directives` 통과 목적 |
| src/features/tempSchedule/components/MonthlyScheduleView.tsx | react-refresh 경고 무력화 | `react-refresh/only-export-components` (non-component export 유지)
| src/features/tempSchedule/components/WeeklyScheduleView.tsx | react-refresh 경고 무력화 | `react-refresh/only-export-components` (non-component export 유지)

## Files Created
| Path | Purpose |
| --- | --- |
| agent-output/implementation/011-google-calendar-token-refresh-stability-implementation.md | 구현 결과/검증 기록 |

## Code Quality Validation
- [x] TypeScript compile: (vitest run에서 TS 변환/수집 단계 통과)
- [x] Lint: `npm run lint` (0 warnings)
- [x] Tests: `npm test` (vitest)

## Value Statement Validation
- Original: “토큰 만료 후에도 자동으로 안정적으로 갱신되어 재로그인 없이 동기화 지속”
- Delivered:
  - 레거시 데이터에서도 만료 판단 필드명이 일치하도록 정규화+write-back
  - 만료 시간 누락으로 즉시 끊기는 케이스에서, 401 시 자동 refresh+retry로 복구
  - 동시 요청에서도 refresh 중복 폭발 방지(단일 in-flight)

## Test Coverage
- Unit/Integration (vitest 기반)
  - 레거시 설정 정규화(다양한 필드명/타입)
  - tokenExpiresAt 누락 상태에서 401→refresh→retry 복구

## Test Execution Results
- `npm test`
  - Result: PASS (24 files, 123 tests)
- `npm run lint`
  - Result: PASS

## Outstanding Items
- 버전 업데이트(1.0.163 제안)는 플랜 상 “승인 pending”이므로 이번 변경에 포함하지 않음.
- Electron 환경이 아닌 경우(`window.electronAPI` 부재) refresh는 불가능하므로, 해당 환경에서는 재로그인/환경 전환 안내 메시지로 귀결.

## Next Steps
- QA: Electron 패키징/실제 계정으로 토큰 만료(또는 강제 401) 후 자동 refresh+retry가 체감적으로 복구되는지 확인
- UAT: Settings 탭에서 “연동 유지” 관점 사용성 확인

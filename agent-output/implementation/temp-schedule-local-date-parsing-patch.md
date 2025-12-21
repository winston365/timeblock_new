# TempSchedule Local Date Parsing Patch

## Plan Reference
- None (direct patch request)

## Date
- 2025-12-21

## Changelog
| Date | Handoff/Request | Summary |
|---|---|---|
| 2025-12-21 | User request | Avoid UTC parsing for `YYYY-MM-DD` in tempSchedule week/month grids; use `getLocalDate`; add regression test |

## Implementation Summary
- `YYYY-MM-DD`를 `new Date(dateStr)`로 파싱할 때 UTC 기준으로 해석되어 날짜가 틀어질 수 있는 경로를 차단했다.
- 주/월 그리드 생성 시 날짜 문자열 생성은 `toISOString().split('T')[0]` 대신 `getLocalDate(date)`를 사용한다.
- 잘못된 `selectedDate` 입력은 빈 배열을 반환하도록 가드했다.
- `Date('YYYY-MM-DD')` 사용을 런타임에서 탐지하는 테스트를 추가했다.

## Milestones Completed
- [x] TASK_DEFAULTS 데드라인 기본값을 `getLocalDate()`로 변경
- [x] WeeklyScheduleView 주간 날짜 계산: 로컬 파싱 + `getLocalDate` 사용
- [x] MonthlyScheduleView 월간 날짜 계산: 로컬 파싱 + `getLocalDate` 사용
- [x] 테스트 1개 이상 추가 및 통과

## Files Modified
| Path | Changes |
|---|---|
| src/shared/constants/defaults.ts | TASK 기본 데드라인을 `getLocalDate()`로 변경 |
| src/features/tempSchedule/components/WeeklyScheduleView.tsx | `YYYY-MM-DD` 로컬 파싱 도입, `calculateWeekDates` export, `getLocalDate(d)`로 포맷 |
| src/features/tempSchedule/components/MonthlyScheduleView.tsx | `YYYY-MM-DD` 로컬 파싱 도입, `getLocalDate(d)`로 포맷, 문자열 파싱 안전화 |

## Files Created
| Path | Purpose |
|---|---|
| tests/temp-schedule-date-parsing.test.ts | `Date('YYYY-MM-DD')` 호출 금지(UTC 파싱 리그레션 방지) |

## Code Quality Validation
- [x] TypeScript compile (via vitest transform)
- [x] Tests: `npm test`
- [ ] Lint (not requested)

## Value Statement Validation
- Original: 자정 경계/UTC 파싱으로 인한 날짜 틀어짐 방지
- Delivered: `YYYY-MM-DD`는 로컬 Date로만 파싱하고, 출력은 `getLocalDate`로만 생성하도록 변경 + 테스트로 강제

## Test Coverage
- Unit: `calculateWeekDates`가 `Date('YYYY-MM-DD')`를 호출하지 않는지 검증

## Test Execution Results
- Command: `npm test`
- Result: 21 files, 113 tests passed

## Outstanding Items
- None

## Next Steps
- QA: 전체 UI 동작(주/월 전환, 날짜 클릭) 수동 확인
- UAT: 타임존이 다른 환경(음수 오프셋)에서 날짜 틀어짐 재현 여부 확인

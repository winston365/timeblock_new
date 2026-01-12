---
ID: 88
Origin: 88
UUID: c8d4f2a1
Status: UAT Approved
---

# Weekly Goals — "쉬는 날(rest days)" 기능 계획

## Plan Header
- Plan ID: 088-weekly-goal-rest-days-plan-2026-01-11
- Target Release: **1.0.194** (proposed; current [package.json](../../package.json) = 1.0.193 기준 patch +1)
- Epic Alignment: Weekly Goals 달성률 계산의 현실 반영(휴식일) + ADHD 친화(압박↓, 예측가능↑)
- Scope Constraint: 프론트/로컬 데이터 경로 중심. Electron IPC/Supabase 구현 없음.

## Changelog
| Date | Who | Change |
| --- | --- | --- |
| 2026-01-11 | Planner | Initial plan for WeeklyGoal restDays support |
| 2026-01-11 | UAT | UAT Complete - Implementation delivers ADHD-friendly rest day feature with pressure reduction |

---

## Value Statement and Business Objective
As a 주간 목표를 사용하는 사용자, I want 특정 요일을 “쉬는 날”로 지정했을 때 그 요일은 자동으로 완료로 처리되고 나머지 요일만 달성 대상으로 계산되길 원하고, so that 주간 목표를 현실적인 생활 리듬에 맞춰 압박감 없이(인지부하↓) 꾸준히 유지한다.

---

## Context / Constraints (Known)
- 요일 인덱스 규칙은 이미 [src/data/repositories/weeklyGoalRepository.ts](../../src/data/repositories/weeklyGoalRepository.ts) 내 [getDayOfWeekIndex](../../src/data/repositories/weeklyGoalRepository.ts)에서 **월요일=0, …, 일요일=6**으로 정의되어 있음.
- 저장은 Dexie(weeklyGoals) 기반이며 optional 필드 추가는 “schemaless” 특성상 대개 마이그레이션 불필요(단, 인덱스 추가는 별도).
- UI/스토어에서 Firebase API 직접 호출 금지(필요 시 repository/service layer에서만).

---

## Definitions
- `restDays`: 쉬는 날 요일 인덱스 배열(월=0…일=6). 중복/범위 밖 값은 저장/계산 전에 정규화.
- `activeDays`: $7 - |unique(restDays)|$ (단, 0~7로 clamp)
- “쉬는 날 자동 완료”의 의미: **‘오늘까지 해야 하는 누적 목표’와 ‘오늘 할당량’을 계산할 때 쉬는 날은 분모/일수에서 제외**.
  - 결과적으로 쉬는 날의 “오늘 할당량”은 0이 되며, UI는 “오늘은 쉬는 날”로 표시.

---

## OPEN QUESTION (승인 필요)
1) `activeDays = 0` (쉬는 날 7일)인 목표의 달성률을 **항상 100%로 표시**할까요, 아니면 **N/A**(표시 숨김/비활성)로 둘까요?
2) 쉬는 날에도 사용자가 진행도를 올릴 수 있게(선택적으로) **입력은 허용**하는 것이 맞을까요? (권장: 허용하되 ‘오늘 목표=0’만 표시)

---

# Task 1: 데이터 모델 확장

## Files
- [src/shared/types/domain/goal.types.ts](../../src/shared/types/domain/goal.types.ts)

## Change
- `WeeklyGoal`에 `restDays?: number[]` 추가(월요일=0…일요일=6).
- (권장) `WeeklyGoalDailyProgress.dayOfWeek`도 동일 인덱싱을 사용한다는 전제를 문서화(이미 number).

## ILLUSTRATIVE ONLY (expected snippet)
```ts
export interface WeeklyGoal {
  // ...existing fields
  restDays?: number[]; // 0=Mon ... 6=Sun
}
```

## Notes / Edge Cases
- 기존 데이터는 `restDays === undefined`가 정상 상태여야 함(하위 호환).
- 타입만 추가하면 런타임에서 “유효값 보장”이 되지 않으므로, 정규화 로직은 Task 2/3에서 처리.

---

# Task 2: 계산 로직 수정

## Files
- [src/data/repositories/weeklyGoalRepository.ts](../../src/data/repositories/weeklyGoalRepository.ts)

## Change
기존 “7일 고정” 계산을 “활성 일수(activeDays)” 기준으로 변경.
- `isRestDay(dayIndex, restDays)` 추가
- `getActiveDays(restDays)` 추가
- `getTodayTarget(target, dayIndex, restDays?)` 시그니처 확장(옵셔널 파라미터)
- `getRemainingDays(dayIndex, restDays?)` 시그니처 확장
- `getDailyTargetForToday(target, currentProgress, dayIndex, restDays?)` 시그니처 확장

### Behavioral intent
- 오늘이 쉬는 날이면:
  - `getDailyTargetForToday`는 0을 반환(오늘 할당 없음)
  - `getTodayTarget`은 “오늘이 쉬는 날이라면 오늘까지 누적 목표에서 오늘을 포함하지 않음”(즉, ‘직전 활성일’까지 기준)
- 쉬는 날은 “남은 일수(오늘 포함)” 계산에서 제외

## ILLUSTRATIVE ONLY (expected snippet)
```ts
export const isRestDay = (dayIndex: number, restDays?: readonly number[]) =>
  Array.isArray(restDays) && restDays.includes(dayIndex);

export const getActiveDays = (restDays?: readonly number[]) => {
  // returns 0..7
};

export function getTodayTarget(
  target: number,
  dayIndex: number = getDayOfWeekIndex(),
  restDays?: readonly number[]
): number {
  // compute by active days elapsed (excluding rest days)
}
```

## Notes / Edge Cases
- `restDays`는 중복/범위 밖 값이 들어올 수 있으므로, 계산 전에 `unique + clamp(0..6)` 정규화 필요.
- `activeDays = 0`이면 분모 0 문제 발생 → OPEN QUESTION에 따라 안전 처리.
- “오늘이 쉬는 날인데 남은량이 0이 아닌 경우”는 충분히 가능(사용자가 쉬는 날로 지정했지만 목표는 남음). 이때도 ‘오늘 할당=0’으로 압박을 줄이고, 다음 활성일에 재분배.

---

# Task 3: 리포지토리 업데이트

## Files
- [src/data/repositories/weeklyGoalRepository.ts](../../src/data/repositories/weeklyGoalRepository.ts)

## Change
- Task 2의 계산 함수들이 `restDays`를 받도록 변경하되, **기존 호출부는 변경 없이 동작**하도록 optional parameter로 유지.
- `normalizeWeeklyGoal`에서 `restDays`가 존재하면 안전 정규화(유효한 0..6 값만, 중복 제거, 정렬 권장).

## ILLUSTRATIVE ONLY (expected snippet)
```ts
function normalizeWeeklyGoal(goal: WeeklyGoal, fallbackOrder: number, currentWeekStart: string): WeeklyGoal {
  return {
    ...goal,
    restDays: normalizeRestDays(goal.restDays),
  };
}
```

## Notes / Edge Cases
- 저장소에 이미 “theme optional”을 안전 처리한 전례가 있으므로, `restDays`도 동일 패턴으로 optional-safe 유지.
- Firebase 동기화가 “전체 객체” 기준이라면 restDays가 자동 포함될 수 있음 → 구버전 클라이언트와의 호환성(필드 무시) 확인 필요.

---

# Task 4: 스토어 업데이트

## Files
- [src/shared/stores/weeklyGoalStore.ts](../../src/shared/stores/weeklyGoalStore.ts)

## Change
- 목표 생성/수정/표시에서 `restDays`를 상태로 유지하고 repository 호출로 전달.
- “오늘 할당/누적 목표” 계산에 `restDays`를 넘기도록 유틸/selector 시그니처 업데이트.

## ILLUSTRATIVE ONLY (expected snippet)
```ts
// selectors/computed
const todayTarget = getTodayTarget(goal.target, dayIndex, goal.restDays);
const dailyTarget = getDailyTargetForToday(goal.target, goal.currentProgress, dayIndex, goal.restDays);
```

## Notes / Edge Cases
- 기존 저장된 목표에 `restDays`가 없으면 빈 배열처럼 취급(단, defaults 하드코딩 대신 repository normalize 결과 사용).
- Zustand persist/localStorage 직접 사용은 금지(기존 패턴 유지).

---

# Task 5: UI — 쉬는 날 설정

## Files
- [src/features/goals/WeeklyGoalModal.tsx](../../src/features/goals/WeeklyGoalModal.tsx)

## Change
- 월~일 요일 선택 UI 추가(체크박스/토글).
- 선택 결과를 `restDays`(0..6) 배열로 저장.
- 쉬는 날 선택 시 “활성 일수(activeDays)”를 실시간 표시.

## ILLUSTRATIVE ONLY (expected snippet)
```tsx
// UI: Mon..Sun toggles
// state: restDays:number[]
// derived: activeDays = 7 - restDays.length
```

## Notes / Edge Cases
- ADHD 친화: 선택 폭발 방지(7개는 허용 가능). 토글은 한 줄/그리드로 단순 배치, 즉시 피드백(활성 일수)만 제공.
- 접근성: 키보드 포커스 이동 가능, 각 토글에 명확한 라벨.
- `restDays`는 저장 시 정렬/중복 제거.

---

# Task 6: UI — 카드 표시 개선

## Files
- [src/features/goals/WeeklyGoalCard.tsx](../../src/features/goals/WeeklyGoalCard.tsx)

## Change
- 쉬는 날 정보 표시(예: “휴식: 월/수/금” 칩).
- 오늘이 쉬는 날이면 “오늘은 쉬는 날” 상태 배지/강조 UI 표시.
- 오늘 할당량이 0임을 명확히(“오늘 목표 0”)하여 죄책감/혼란을 줄임.

## ILLUSTRATIVE ONLY (expected snippet)
```tsx
const isTodayRest = isRestDay(dayIndex, goal.restDays);
return (
  <>
    {isTodayRest && <Badge>오늘은 쉬는 날</Badge>}
  </>
);
```

## Notes / Edge Cases
- 쉬는 날이라도 사용자가 진행도를 올릴 수 있게 컨트롤을 막지 않을지(OPEN QUESTION 2) 정책 확정 필요.

---

# Task 7: 테스트 작성

## Files
- (신규/기존) [tests](../../tests) 내 weeklyGoalRepository 계산 로직 관련 테스트 파일

## Change
- 계산 로직 단위 테스트 추가/확장:
  - restDays가 없을 때 기존 7일 계산과 동일하게 유지(하위 호환성)
  - 일부 restDays가 있을 때 activeDays 기준으로 분모/남은일수/누적목표가 변하는지 검증
  - “오늘이 쉬는 날”일 때 today target / daily target이 압박을 만들지 않는 값(0 또는 직전 활성일 기준)인지 검증
  - 잘못된 입력(restDays에 -1, 7, 중복)이 안전하게 정규화되는지 검증

## ILLUSTRATIVE ONLY (expected snippet)
```ts
import { getDailyTargetForToday, getTodayTarget } from '@/data/repositories/weeklyGoalRepository';
```

## Notes / Edge Cases
- 구체 테스트케이스 목록은 QA 문서로 이관 가능(여기서는 범주만 정의).
- 테스트는 repository 순수 유틸(계산 함수) 중심으로 작성해 빠르고 안정적으로 유지.

---

## Validation (High-level)
- Typecheck/lint: `npm run lint`
- Test: `npm test` (또는 영향 범위 테스트 선택 실행)
- Manual spot-check: 쉬는 날 0/1/3/7개 선택 시 “활성 일수”와 카드 표시가 직관적으로 동작

## Risks / Rollback
- 달성률 계산 규칙 변경은 UX 체감이 크므로, UI에서 “쉬는 날 제외 계산”을 명확히 표기해 오해를 줄임.
- sync 데이터 계약 변경(필드 추가)로 구버전 클라이언트 호환 문제가 발견되면, `restDays`를 repo normalize 단계에서만 사용하고 원격 반영은 차단하는 임시 전략도 고려(별도 계획 필요).

## Version Management Milestone
- Target Release 확정 후, 배치에 포함되는 실제 변경이 merge될 때 [package.json](../../package.json) 버전과 릴리즈 노트/CHANGELOG(존재 시)를 정합화한다.

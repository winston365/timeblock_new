---
ID: 88
Origin: 88
UUID: c8d4f2a1
Status: OPEN
---

# Critique: Weekly Goal Rest Days Plan

| Artifact Path | [agent-output/planning/088-weekly-goal-rest-days-plan-2026-01-11.md](../planning/088-weekly-goal-rest-days-plan-2026-01-11.md) |
|---------------|-------------------------------------------------------------------------------------------------------------------------------------|
| Date | 2026-01-11 |
| Status | Initial Review |

## Changelog

| Date | Who | Request | Summary |
|------|-----|---------|---------|
| 2026-01-11 | Critic | Initial critique | 계획 전반 검토 및 피드백 |

---

## Value Statement Assessment

✅ **적절** — Value Statement가 명확하게 정의됨

> "As a 주간 목표를 사용하는 사용자, I want 특정 요일을 '쉬는 날'로 지정했을 때 그 요일은 자동으로 완료로 처리되고 나머지 요일만 달성 대상으로 계산되길 원하고, so that 주간 목표를 현실적인 생활 리듬에 맞춰 압박감 없이(인지부하↓) 꾸준히 유지한다."

- **User Story 형식**: 준수 (As a / I want / So that)
- **ADHD 친화성**: 명시적으로 "인지부하↓"를 목표로 삼음
- **비즈니스 가치**: 현실적인 생활 리듬 반영 → 지속 가능한 목표 관리

---

## Overview

"쉬는 날(rest days)" 기능은 주간 목표의 유연성을 높이는 합리적인 확장입니다. 기존 7일 고정 계산 방식을 `activeDays` 기반으로 전환하여 사용자가 특정 요일을 제외할 수 있게 합니다.

**장점**:
- 하위 호환성 고려 (optional `restDays` 필드)
- Repository Pattern 준수
- Firebase 동기화 자연 통합 (기존 `weeklyGoalStrategy` 활용)

**주의점**:
- OPEN QUESTION 2개 미해결
- Edge case 처리 일부 미정

---

## Architectural Alignment

### ✅ **적절**: Repository Pattern 준수

계획이 `weeklyGoalRepository.ts`에 계산 로직을 집중시키고, Store/UI는 이를 활용하는 구조입니다. 기존 아키텍처 패턴과 일치합니다.

### ✅ **적절**: Firebase 동기화 자연 통합

`weeklyGoalStrategy`가 이미 `WeeklyGoal[]` 전체를 Last-Write-Wins로 동기화하므로, `restDays` 필드 추가 시 별도 전략 변경 없이 동기화됩니다.

```typescript
// 기존 strategies.ts (변경 불필요)
export const weeklyGoalStrategy: SyncStrategy<WeeklyGoal[]> = {
  collection: 'weeklyGoals',
  // ...
};
```

### ✅ **적절**: 타입 확장 방식

`WeeklyGoal` 인터페이스에 optional 필드 추가는 schemaless Dexie 특성상 마이그레이션 불필요하며, 하위 호환성이 보장됩니다.

---

## Scope Assessment

### ⚠️ **주의 필요**: OPEN QUESTION 미해결

계획에 2개의 OPEN QUESTION이 있으나 **해결 상태가 명시되지 않음**:

1. **`activeDays = 0` 처리**: 100% 표시 vs N/A 표시
2. **쉬는 날 진행도 입력 허용**: 허용 vs 차단

**Impact**: UI 구현(Task 5, 6)이 이 결정에 의존합니다.

**Recommendation**: 
- OPEN QUESTION 1: **100% 표시 권장** (사용자 심리적 보상, "오늘은 완벽한 휴식일")
- OPEN QUESTION 2: **입력 허용 권장** (ADHD 친화 — 제한 없이 자율성 부여, 단 "오늘 목표=0" 명시)

### ✅ **적절**: 작업 분할

7개 Task로 명확히 분할되어 있으며, 각 Task가 단일 책임을 가집니다.

---

## Technical Debt Risks

### ⚠️ **주의 필요**: 구버전 클라이언트 호환성

계획의 "Risks / Rollback" 섹션에서 언급되었지만, 구체적인 대응 방안이 부족합니다.

**시나리오**: 구버전 앱이 `restDays` 필드를 알지 못함 → Firebase에서 다운로드 시 무시 → 재업로드 시 `restDays` 누락?

**Recommendation**:
- `normalizeWeeklyGoal`에서 `restDays`가 `undefined`일 때 **빈 배열로 명시적 초기화하지 않고 그대로 유지** → 구버전과 신버전 간 필드 손실 방지
- 또는 `serialize/deserialize` 훅에서 안전 처리

### ✅ **적절**: 분모 0 문제 인지

`activeDays = 0` 시 분모 0 문제를 계획에서 인지하고 있으며, OPEN QUESTION으로 정책 결정을 요청했습니다.

---

## Findings

### Critical (재검토 필요)

*없음*

### Medium (주의 필요)

| # | Issue Title | Status | Description | Impact | Recommendation |
|---|-------------|--------|-------------|--------|----------------|
| M1 | OPEN QUESTION 미해결 | OPEN | `activeDays=0` 처리 방식과 쉬는 날 입력 허용 여부 결정 필요 | Task 5, 6 구현 차단 가능 | 아래 "권장 결정" 섹션 참조 |
| M2 | 구버전 호환성 전략 미흡 | OPEN | `restDays` 필드 추가 시 구버전 클라이언트와의 동기화 충돌 가능성 | 데이터 손실 위험 | `normalizeWeeklyGoal`에서 `undefined` 보존 또는 마이그레이션 전략 추가 |
| M3 | `restDays` 정규화 위치 분산 | OPEN | Task 2, 3, 5에서 각각 정규화 언급 | 로직 중복 가능성 | 단일 정규화 함수 `normalizeRestDays()`를 repository에 정의하고 재사용 |

### Low (개선 권장)

| # | Issue Title | Status | Description | Impact | Recommendation |
|---|-------------|--------|-------------|--------|----------------|
| L1 | 테스트 케이스 구체화 부족 | OPEN | Task 7에서 "범주만 정의"라고 명시 | QA 누락 가능성 | 최소한 edge case 목록 명시 (예: `restDays=[0,0,7,-1]`, `restDays=undefined`) |
| L2 | UI 접근성 검증 미언급 | OPEN | Task 5에서 "키보드 포커스" 언급하나 구체적 검증 방법 없음 | 접근성 이슈 | 스크린 리더 테스트 또는 `aria-label` 명시 |
| L3 | 성능 영향 미분석 | OPEN | `for` 루프 기반 활성 일수 계산이 카드 렌더링마다 실행 | 미미하나 잠재적 | 메모이제이션 고려 (단, 현재 복잡도 O(7)이므로 낮은 우선순위) |

---

## Questions

1. **OPEN QUESTION 결정 필요**: `activeDays = 0`일 때 100% 표시 vs N/A? (권장: 100%)
2. **OPEN QUESTION 결정 필요**: 쉬는 날에도 진행도 입력 허용? (권장: 허용)
3. **마이그레이션 계획**: 기존 사용자 데이터에 `restDays` 추가 시 특별한 처리 필요한가? (현재: 불필요로 추정)
4. **Zod 스키마**: `WeeklyGoal` 타입에 대한 Zod 스키마가 있는가? 있다면 `restDays` 추가 필요

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OPEN QUESTION 미결로 구현 지연 | High | Medium | Planner가 결정 후 계획 업데이트 |
| 구버전 클라이언트 데이터 손실 | Low | High | `undefined` 보존 정책 명시 |
| UI 복잡도 증가로 ADHD 비친화 | Low | Medium | "쉬는 날" 토글을 숨김 가능한 고급 설정으로 분리 고려 |

---

## Recommendations

### 1. OPEN QUESTION 해결 (권장 결정)

**OPEN QUESTION 1**: `activeDays = 0` → **100% 달성으로 표시**
- 이유: "7일 모두 쉬기로 했다 = 목표 달성 조건 만족"으로 해석
- UI: "🎉 이번 주는 완전 휴식!" 등 긍정적 메시지

**OPEN QUESTION 2**: 쉬는 날에도 진행도 입력 **허용**
- 이유: ADHD 사용자에게 제한은 부담 → 자율성 부여
- UI: 입력 허용하되 "오늘 목표: 0" 명시로 압박 제거

### 2. 단일 정규화 함수 정의

```typescript
// weeklyGoalRepository.ts
export function normalizeRestDays(restDays?: number[]): number[] | undefined {
  if (!restDays) return undefined; // 구버전 호환
  return [...new Set(restDays.filter(d => d >= 0 && d <= 6))].sort((a, b) => a - b);
}
```

### 3. 테스트 케이스 명시화

Task 7에 아래 edge case 추가 권장:
- `restDays = undefined` → 기존 7일 계산과 동일
- `restDays = []` → 기존 7일 계산과 동일
- `restDays = [0,1,2,3,4,5,6]` → `activeDays = 0` → 100% 달성
- `restDays = [0,0,7,-1,3]` → 정규화 후 `[0,3]` → `activeDays = 5`
- 오늘이 쉬는 날 → `getDailyTargetForToday()` = 0
- 오늘이 활성일 → 정상 계산

---

## Version Compliance

✅ **적절**: Target Release `1.0.194`로 명시, 현재 `1.0.193` 기준 patch 증가 계획 확인됨

---

## Hotfix Risk Assessment (How will this plan result in a hotfix after deployment?)

### 잠재적 Hotfix 시나리오

1. **분모 0 에러**: `activeDays = 0`일 때 `target / activeDays` 계산에서 `Infinity` 또는 `NaN` 발생 → UI 깨짐
   - **대응**: OPEN QUESTION 1 결정 및 guard clause 필수
   
2. **구버전 ↔ 신버전 동기화 충돌**: 구버전이 `restDays`를 알지 못하고 덮어씀 → 설정 손실
   - **대응**: 필드 보존 정책 명확화
   
3. **음수/범위 외 입력**: 사용자가 직접 수정하지 않더라도 데이터 손상 시 `restDays = [-1]` 등 가능
   - **대응**: 정규화 함수로 방어

### 권장 사항
- Task 2에 **guard clause 명시** (`if (activeDays === 0) return target;` 등)
- Task 7에 **경계값 테스트 필수**

---

## Unresolved Open Questions

⚠️ **이 계획에는 2개의 미해결 OPEN QUESTION이 있습니다:**

1. `activeDays = 0` (쉬는 날 7일)인 목표의 달성률을 **항상 100%로 표시**할까요, 아니면 **N/A**(표시 숨김/비활성)로 둘까요?

2. 쉬는 날에도 사용자가 진행도를 올릴 수 있게(선택적으로) **입력은 허용**하는 것이 맞을까요?

**❓ 사용자 확인 요청**: 이 계획을 미해결 OPEN QUESTION과 함께 구현 승인하시겠습니까, 아니면 Planner가 먼저 해결해야 할까요?

---

## Summary Verdict

| Category | Rating | Notes |
|----------|--------|-------|
| Value Statement | ✅ 적절 | User Story 형식 준수, ADHD 친화 목표 명시 |
| 아키텍처 일관성 | ✅ 적절 | Repository Pattern, Firebase Strategy 준수 |
| 하위 호환성 | ⚠️ 주의 | `undefined` 보존 정책 명확화 필요 |
| 성능 | ✅ 적절 | O(7) 계산으로 영향 미미 |
| UX (ADHD 친화) | ✅ 적절 | 압박감 감소, 유연성 증가 목표 |
| 엣지 케이스 | ⚠️ 주의 | OPEN QUESTION 해결 및 테스트 명시 필요 |
| 보안/입력 검증 | ⚠️ 주의 | 정규화 함수 단일화 권장 |
| Firebase 동기화 | ✅ 적절 | 기존 전략 그대로 사용 가능 |

**Overall**: ⚠️ **OPEN QUESTION 해결 후 승인 권장**

---

## Revision History

*Initial review — 2026-01-11*

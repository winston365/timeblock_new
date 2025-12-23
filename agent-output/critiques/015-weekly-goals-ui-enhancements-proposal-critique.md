# Critique — 015-weekly-goals-ui-enhancements-proposal

Artifact path: [agent-output/planning/015-weekly-goals-ui-enhancements-proposal.md](../planning/015-weekly-goals-ui-enhancements-proposal.md)
Analysis source: [agent-output/analysis/012-long-term-goals-ui-addons-analysis.md](../analysis/012-long-term-goals-ui-addons-analysis.md)
Architecture ref: [agent-output/architecture/005-long-term-goals-frontend-architecture-findings.md](../architecture/005-long-term-goals-frontend-architecture-findings.md)
Date: 2025-12-23
Status: **Revision 1 — ADDRESSED** (See final plan: agent-output/planning/016-long-term-goals-ux-final-now-next-later.md)

---

## Changelog
| Date | Handoff/Request | Summary |
|---|---|---|
| 2025-12-23 | Planner handoff | Initial critique: 구조, ADHD 원칙, 정책 정합 검토 |
| 2025-12-23 | User review request | **Revision 1**: Scope creep, ADHD-friendliness(cognitive load/interruptions/habit loops), modal/ESC 준수, state integrity(localStorage 금지), implementation pitfalls, 성공 측정 기준 심화 검토 |

---

## Value Statement Assessment

✅ **PASS** — Value Statement가 명확하고 사용자 관점에서 "무엇을, 왜, 결과" 구조를 갖추고 있습니다.

> "오늘 무엇을 하면 되는지 즉시 이해하고, 뒤처졌을 때 죄책감 대신 구체적인 회복 플랜을 안내받으며, 실수 없이 진행을 기록해서, 목표가 부담이 아니라 실행을 돕는 가벼운 안내판이 된다."

**강점:**
- ADHD 사용자의 핵심 고통점(해석 부담, 뒤처짐 죄책감, 실수 불안)을 직접 타겟팅
- "안내판"이라는 메타포로 목적이 명확

**개선 권장:**
- "5초 안에"라는 UX Goal이 있으나 측정 불가 → AC에 "카드 로딩 후 Today target이 1초 내 visible" 같은 정량 기준 추가 권장

---

## 1. Scope Creep Risk vs Frontend-only Constraint

### Critical Findings

| Item | Risk Level | Issue |
|------|------------|-------|
| **#3 Delete Undo** | 🔴 HIGH | `weeklyGoalRepository.deleteWeeklyGoal`은 **history 포함 완전 삭제**. 복원은 새로운 repo 메서드 필요 → **backend 경계 침범 가능성** |
| **#5 템플릿 가이드** | 🟡 MEDIUM | "마지막 사용 템플릿을 systemRepository에 저장" 선택사항이 제안됨 — 범위 증가 |
| **#6 pinnedGoalIds** | 🟡 MEDIUM | systemRepository 저장을 언급하나 도메인 확장으로 보일 수 있음 |
| **#8 마일스톤** | 🔴 HIGH | "WeeklyGoal 타입 확장" 명시 → 스키마 변경 = **Non-goal 위반** |

### Recommendations

1. **#3 Delete Undo → NOW에서 제외 (NEXT로 이동)**
   - **Progress Undo만 NOW에 유지** (store-level snapshot으로 가능)
   - Delete Undo는 "soft delete" 정책 결정 + repo 확장이 필요하므로 별도 계획

2. **#8 마일스톤 → 명시적으로 "디자인 탐색만" 스코프로 한정**
   - 현재 Non-goal에 "DB 스키마 마이그레이션" 언급이 있으나, #8 spec이 타입 확장을 언급하여 혼란
   - **권장**: LATER 항목에 "UI mockup/prototype only, 타입 확장 없음" 명시

3. **NOW 스코프 재정의 제안**
   ```
   NOW (확정):
   - #1 Catch-up Alert 2.0 (스누즈/배너)
   - #2 WeeklyGoalCard 이해도 강화 (배지/툴팁)
   - #4 Quick Log Session (popover)
   
   NOW → NEXT로 이동:
   - #3 Undo (progress only를 NOW에 유지하되, delete undo는 NEXT)
   ```

---

## 2. ADHD-Friendliness 심층 평가

### 2.1 Cognitive Load (인지부하)

| Principle | Plan Alignment | Gap/Risk |
|-----------|----------------|----------|
| 즉시성 (5초 이해) | ✅ 배지/Today target 명시 | Today target 계산 로직이 카드마다 있어 렌더 지연 가능 |
| 점진적 공개 | ✅ 툴팁으로 상세 숨김 | 툴팁 트리거가 hover+focus인데, **터치 환경 고려 부재** |
| 색상+텍스트 병행 | ✅ severity 배지 추가 | - |

**Gap #1: 정보 밀도 증가 위험**
- 현재 카드: progress bar + 버튼 2개
- 제안 후 카드: progress bar + 버튼 2개 + 배지 + Today target 숫자 + `i` 아이콘 + Log Session 버튼
- **ADHD 역효과**: 정보 과잉 → 결정 피로

**Recommendation:**
- "Log Session" 버튼을 **카드 hover/focus 시에만 노출** (progressive disclosure 강화)
- 또는 카드 클릭 → popover에서 +/-/log를 통합 (현재 +/- 버튼과 log popover가 분리되어 있음)

### 2.2 Interruptions (중단)

| Source | Current | Proposed | Risk |
|--------|---------|----------|------|
| Catch-up Alert | 1일 1회 자동 모달 | + 스누즈 + 배너 | 스누즈 만료 시 **예고 없는 모달 재등장** → 작업 중단 |
| 축하 피드백 (#9) | 없음 | 달성 시 1회 배지/애니메이션 | 구현에 따라 **시각 자극 과잉** 가능 |

**Gap #2: 스누즈 만료 타이밍이 불명확**
- "2시간 후 자동 재노출"이 사용자가 집중 중일 때 발생하면 오히려 해로움
- ADHD 사용자는 **예측 가능한 중단**을 선호

**Recommendation:**
- 스누즈 만료 후 **즉시 모달이 아닌 배너만 활성화** (사용자가 직접 열기)
- 또는 "다음 앱 시작 시에만" 재노출하는 옵션 추가
- AC에 "스누즈 중에는 자동 모달 절대 안 뜸" 명시 필요

### 2.3 Habit Loops (습관 루프)

| Element | Coverage | Gap |
|---------|----------|-----|
| Cue (신호) | ✅ 배너/Alert | 충분 |
| Routine (행동) | ✅ Log Session으로 간소화 | 충분 |
| Reward (보상) | ⚠️ #9 축하 피드백은 LATER | **NOW에 보상 요소 없음** |

**Gap #3: NOW 항목에 보상 피드백 부재**
- Log Session으로 기록은 쉬워지나, 기록 후 **즉각적 피드백이 없음**
- ADHD는 즉각 보상에 민감 → 습관 형성에 중요

**Recommendation:**
- **#9 미세 축하를 NOW로 이동** (MVP 수준: "오늘 목표량 달성!" 텍스트 + 체크마크 아이콘, 애니메이션 없이)
- 또는 Log Session 완료 시 "기록됨 ✓" snackbar를 **진행도 변화와 함께** 표시

---

## 3. Modal/Escape Behavior Compliance

### 현재 정책 (Architecture #005 + 프로젝트 규칙)
- 배경 클릭 닫기 **금지**
- ESC는 **항상** top modal을 닫음
- `useModalEscapeClose` + `modalStackRegistry` 사용

### Plan 정합성 점검

| Component | Plan Statement | Compliance |
|-----------|----------------|------------|
| CatchUpAlertModal | "ESC로 닫기, 배경 클릭 닫기 금지" 명시 | ✅ |
| Log Session Popover | "ESC=닫기" 명시 | ⚠️ **popover는 modal stack에 등록해야 함** |
| Tooltip | "ESC로 닫기 동작을 방해하지 않는다" | ✅ 의도는 맞으나 구현 가이드 부재 |

**Critical Finding: Popover와 Modal Stack 충돌**

```
시나리오:
1. GoalsModal 열림 → stack: [GoalsModal]
2. WeeklyGoalCard의 Log Session popover 열림 → stack 미등록?
3. 사용자 ESC → GoalsModal이 닫힘 (popover는 그대로)
```

**Recommendation:**
- Item #4 spec에 **명시적 구현 가이드 추가**:
  > "Log Session popover는 `modalStackRegistry.push/pop`을 사용하여 ESC 우선순위 충돌 방지. popover 열림 시 stack에 등록, 닫힘 시 제거."
- AC 추가: "ESC 1회 = popover만 닫힘, ESC 2회 = GoalsModal 닫힘"

---

## 4. State Integrity (localStorage 금지, Dexie systemState 선호)

### Plan 분석

| Item | State 제안 | Compliance |
|------|-----------|------------|
| #1 Catch-up snooze | `SYSTEM_KEYS.CATCH_UP_ALERT_SNOOZE_UNTIL` (systemRepository) | ✅ |
| #3 Undo | `lastMutation` in Zustand store (메모리 only) | ✅ |
| #4 Log Session | 컴포넌트 로컬 state | ✅ |
| #5 템플릿 선호도 | systemRepository (optional) | ✅ |
| #6 pinnedGoalIds | systemRepository (optional) | ✅ |
| #9 축하 중복 방지 | `SYSTEM_KEYS.WEEKLY_GOAL_TODAY_CELEBRATED_...` 또는 in-memory | ✅ |

**✅ PASS** — localStorage 금지 정책 준수

### 추가 권장사항

1. **SYSTEM_KEYS 확장 시 네이밍 컨벤션 통일**
   - 현재: `CATCH_UP_ALERT_SHOWN_DATE`, `TIMELINE_SHOW_PAST`
   - 제안: `CATCH_UP_ALERT_SNOOZE_UNTIL` → 일관성 유지 ✅
   - **권장**: 새 키 추가 시 `weekly_goal:*` prefix 고려 (namespace 충돌 방지)

2. **Undo state의 영속화 여부 결정 필요**
   - 현재 제안: 메모리 only → 앱 재시작 시 undo 불가
   - 이는 적절한 trade-off지만 **명시적으로 AC에 반영** 권장:
     > "Undo는 앱 재시작/날짜 변경 시 초기화된다"

---

## 5. Implementation Pitfalls & Edge Cases

### 5.1 Critical Pitfalls

| Item | Pitfall | Mitigation |
|------|---------|------------|
| #1 Snooze | `SNOOZE_UNTIL` 시간 비교 시 **timezone/DST 문제** | ISO string 저장 + `Date.now()` 비교로 단순화, timezone 변환 금지 |
| #1 Snooze | 앱이 2시간 이상 열려있으면 snooze 만료 감지 못함 | `setInterval` 또는 다음 앱 시작으로 한정 (후자 권장) |
| #2 Tooltip | 모달 내부 tooltip이 모달 경계 바깥으로 렌더링됨 | `portaled` tooltip + `z-index` 관리 필요 |
| #3 Progress Undo | 연속 +/+ 후 undo → 어디까지 복구? | "마지막 1회만" 명시 ✅, but **연타 디바운스 필요** |
| #4 Log Session | 음수 입력 + 진행도 < 0 | AC에 "음수/NaN 방지" 있음 ✅, **추가**: 결과 < 0 시 0으로 clamp |
| #4 Log Session | Enter 연타 → 중복 저장 | 저장 중 버튼 disabled ✅, **추가**: optimistic lock 고려 |

### 5.2 Edge Cases (미언급)

1. **목표가 0개인 상태**
   - Catch-up Alert: "behind goals가 1개 이상이면" → 0개 시 배너도 안 보임 ✅
   - Panel 상단 요약 (#6): 목표 0개 시 빈 상태 UI 정의 필요

2. **주간 리셋 경계 (월요일)**
   - Log Session이 일요일 23:59에 열리고, 저장이 월요일 00:01에 되면?
   - **권장**: 저장 시점의 `weekStartDate`와 현재 goal의 `weekStartDate` 비교 → 불일치 시 경고/재로드

3. **Goal 동시 수정 (Firebase sync)**
   - Undo 중 sync로 서버 값이 덮어쓰면?
   - **권장**: Undo는 "로컬 optimistic 복구"로 한정, sync conflict 시 서버 값 우선 명시

4. **접근성: 스크린 리더**
   - 배지의 aria-label 정의 필요
   - Tooltip의 `role="tooltip"` + `aria-describedby` 연결 필요

---

## 6. Success Measurement (성공 측정)

### ⚠️ GAP: 측정 기준 부재

현재 제안서에는 **정량적 성공 지표가 없습니다**. "배포 후 어떻게 성공을 알 수 있는가?"에 답이 없으면 hotfix 상황 판단이 어렵습니다.

### Recommended Metrics

| Category | Metric | Target | How to Measure |
|----------|--------|--------|----------------|
| **Adoption** | Log Session 사용률 | 목표 보유 사용자의 30%+ | EventBus emit count |
| **Engagement** | Snooze vs 즉시 보기 비율 | Snooze < 50% | systemRepository 키 분석 |
| **Error** | Progress undo 사용률 | < 10% (실수 감소 의미) | store action count |
| **Retention** | 주간 목표 완료율 변화 | baseline 대비 +5% | history 분석 |

### Recommended Telemetry Points (EventBus emit)

```typescript
// Item #1
'weeklyGoal:catchUpAlert:shown'
'weeklyGoal:catchUpAlert:snoozed' | 'weeklyGoal:catchUpAlert:dismissed'

// Item #3
'weeklyGoal:progress:undone'

// Item #4
'weeklyGoal:logSession:opened'
'weeklyGoal:logSession:submitted' // { delta: number }
```

---

## 7. Unresolved Open Questions

제안서의 OPEN QUESTION 4개가 **모두 미해결 상태**입니다:

| # | Question | Criticality | Recommendation |
|---|----------|-------------|----------------|
| 1 | Target Release (1.0.165 vs 1.0.166) | 🟡 Low | 운영팀 확인 후 결정 |
| 2 | Delete Undo NOW 포함 여부 | 🔴 High | **NOW에서 제외 권장** (위 분석 참조) |
| 3 | Top 1~3 선정 기준 (severity vs pin) | 🟡 Medium | 기본=severity, pin은 NEXT에서 추가 |
| 4 | Snooze 기본값 (1h/2h/3h) | 🟢 Low | 2h 유지, 설정 옵션은 LATER |

### ⚠️ APPROVAL BLOCKER

> **이 제안서에는 4개의 미해결 OPEN QUESTION이 있습니다.**
> 
> 오빠, #2 (Delete Undo 범위)는 scope creep과 직결되어 있어서 **구현 전 반드시 결정이 필요해요**.
> 나머지 3개는 구현 중 결정해도 괜찮지만, #2는 NOW 항목 정의 자체가 바뀌니까요.
>
> **질문: Delete Undo를 NOW에서 제외하고 Progress Undo만 진행할까요, 아니면 Delete Undo까지 포함하되 repo 확장을 별도 sub-task로 분리할까요?**

---

## 8. Findings Summary

### Critical (구현 전 해결 필수)

| ID | Title | Status | Issue | Impact | Recommendation |
|----|-------|--------|-------|--------|----------------|
| C-1 | Delete Undo scope creep | OPEN | repo 확장 필요 → frontend-only 위반 가능 | 일정/아키텍처 | NOW에서 제외, NEXT로 이동 |
| C-2 | Popover-Modal ESC 충돌 | OPEN | stack 미등록 시 ESC 동작 불일치 | UX 정책 위반 | Item #4에 구현 가이드 추가 |
| C-3 | 미해결 OPEN QUESTION #2 | OPEN | Delete Undo 결정 미완 | 스코프 불확실 | Planner가 결정 반영 필요 |

### Medium (구현 중 주의)

| ID | Title | Status | Issue | Impact | Recommendation |
|----|-------|--------|-------|--------|----------------|
| M-1 | NOW에 보상 피드백 부재 | OPEN | 습관 루프 불완전 | ADHD 체감 | #9 MVP를 NOW로 이동 또는 snackbar 강화 |
| M-2 | 정보 밀도 증가 | OPEN | 카드에 요소 추가 → 결정 피로 | ADHD 역효과 | Log Session 버튼 progressive disclosure |
| M-3 | Snooze 만료 중단 | OPEN | 예측 불가능한 모달 재등장 | 작업 중단 | 배너만 활성화, 자동 모달 금지 |
| M-4 | 성공 측정 기준 부재 | OPEN | 배포 후 판단 불가 | 운영 | 제안된 metrics/telemetry 추가 |

### Low (품질 향상)

| ID | Title | Status | Issue | Impact | Recommendation |
|----|-------|--------|-------|--------|----------------|
| L-1 | 마일스톤 스코프 혼란 | OPEN | #8이 타입 확장 언급 | Non-goal 위반 | "UI mockup only" 명시 |
| L-2 | 접근성 상세 부재 | OPEN | aria-label/role 미정의 | a11y | 구현 단계에서 보완 |

---

## 9. Recommendations Summary

### 제거/이동 권장 항목

| Item | Action | Reason |
|------|--------|--------|
| #3 Delete Undo | NEXT로 이동 | repo 확장 필요, scope creep |
| #8 마일스톤 | LATER 유지 + "UI only" 명시 | 타입 확장 = Non-goal 위반 |

### 병합 권장 항목

| Items | Action | Reason |
|-------|--------|--------|
| #2 + #4 | 고려 | 둘 다 WeeklyGoalCard 수정, 통합 시 회귀 테스트 1회 |
| #9 MVP + #3 Undo | NOW 통합 | Undo snackbar에 축하 메시지 통합 가능 |

### NOW 스코프 최종 권장안

```
NOW (4 items, 저위험):
1. Catch-up Alert 2.0 (스누즈/배너) — 단, 스누즈 만료 시 자동 모달 금지
2. WeeklyGoalCard 이해도 강화 (배지/툴팁)
3. Progress Undo (delete 제외) + 미세 축하 MVP (snackbar)
4. Quick Log Session (popover + ESC stack 등록)
```

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ESC 동작 불일치로 UX 정책 위반 | High | Medium | popover stack 등록 필수화 |
| Delete Undo로 인한 일정 지연 | High | High | NOW에서 제외 |
| 정보 과잉으로 ADHD 역효과 | Medium | Medium | progressive disclosure 강화 |
| Snooze 관련 timezone 버그 | Medium | Low | ISO string + Date.now() 비교 |
| 성공 측정 불가로 hotfix 판단 어려움 | High | Medium | metrics/telemetry 추가 |

---

## Revision History

| Date | Artifact Change | Findings Addressed | New Findings | Status Change |
|------|-----------------|-------------------|--------------|---------------|
| 2025-12-23 | Initial | - | 3 Critical, 4 Medium, 2 Low | Initial → Revision 1 |

---

**Next Actions:**
1. Planner: OPEN QUESTION #2 결정 (Delete Undo NOW 제외 여부)
2. Planner: C-2 해결 — Item #4에 popover ESC 구현 가이드 추가
3. Planner: M-1 반영 — #9 MVP를 NOW로 이동하거나 snackbar에 통합
4. Planner: M-4 반영 — Success Measurement 섹션 추가
5. Critic: 수정된 제안서 재검토 후 Status → ADDRESSED/RESOLVED 업데이트

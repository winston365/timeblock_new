# Critique: Inbox UI Cleanup and Triage Crash Fix

- **Artifact Path**: `agent-output/analysis/045-inbox-triage-ui-cleanup-analysis.md`
- **Related Analysis**: `agent-output/analysis/031-inbox-improvements-requirements-fit-analysis.md`
- **Related Plan**: `agent-output/planning/032-inbox-six-requirements-ui-only-implementation-plan.md`
- **Date**: 2025-12-28
- **Status**: Initial Review
- **Reviewer**: Critic Agent

## Changelog

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2025-12-28 | User → Critic | Inbox UI 정리(chip 제거, row 병합) + triage 크래시 수정 검토 | 초기 검토 완료. 리스크 분석 + 누락 정보 요청 + 테스트 제안 |

---

## Value Statement Assessment

✅ **Value Statement 존재 및 품질**: 분석 문서에 명확히 기술됨

> "Streamline the Inbox UI so ADHD users can triage faster without visual clutter and avoid crashes that interrupt the flow."

- ✅ ADHD 친화 UX 원칙 정렬 (시각적 산만함 감소, 흐름 중단 방지)
- ✅ 직접적 가치 전달 (UI 간소화 + 안정성)
- ⚠️ 측정 가능성: "faster" 정량화 부재 (minor)

---

## Overview

분석 문서 045는 세 가지 UI 변경 요청을 다루고 있습니다:

1. **TIME_BLOCKS 칩 제거** ([InboxTab.tsx#L770-L788](src/features/tasks/InboxTab.tsx#L770-L788)): 5-8, 8-11, ... 20-23 버튼 행 삭제
2. **Today/Tomorrow/Next + 고정/보류 병합**: 현재 2행 → 1행으로 통합
3. **Triage 크래시 수정**: `TypeError: x is not a function` onClick 에러

---

## (1) TIME_BLOCKS 칩 제거 리스크 및 엣지 케이스

### 🟢 리스크 수준: **Low-Medium**

#### 장점
- ✅ 시각적 산만함 감소 (ADHD 친화)
- ✅ 수직 공간 절약 (task당 ~30px 감소)
- ✅ Today/Tomorrow/Next가 동일 기능 제공

#### 리스크 및 엣지 케이스

| 리스크 | 심각도 | 설명 | 완화책 |
|--------|--------|------|--------|
| **기능 손실: 특정 블록 선택 불가** | 🟡 Medium | 사용자가 "14-17 블록에 정확히 배치"를 원할 때 UI 경로 없음 | TaskModal 편집에서 시간 블록 선택 UI 유지 확인 필요 |
| **접근성 회귀** | 🟢 Low | 칩 버튼은 키보드 접근 가능했음; Today/Tomorrow/Next도 동일하게 접근 가능해야 함 | `tabIndex` 및 `aria-label` 확인 |
| **파워 유저 워크플로우 붕괴** | 🟡 Medium | 직접 블록 지정이 빠른 사용자에게 추가 클릭 필요 | Triage 모드 핫키(t/o/n)로 대체; 필요시 설정에서 "고급 블록 버튼" 토글 |

#### 레이아웃 고려사항

```
현재 상태 (task당 3행):
┌──────────────────────────────────────────┐
│ TaskCard                                 │
├──────────────────────────────────────────┤
│ ⚡ [Today] [Tomorrow] [Next]             │  ← renderQuickPlaceButtons
├──────────────────────────────────────────┤
│ 🏷️ [고정] [보류]                          │  ← renderTriageButtons
├──────────────────────────────────────────┤
│ ⏰ [5-8] [8-11] [11-14] [14-17] [17-20] [20-23] │  ← TIME_BLOCKS (삭제 대상)
└──────────────────────────────────────────┘

목표 상태 (task당 1행):
┌──────────────────────────────────────────┐
│ TaskCard                                 │
├──────────────────────────────────────────┤
│ ⚡ [Today] [Tomorrow] [Next] | 📌[고정] ⏸️[보류] │
└──────────────────────────────────────────┘
```

**권고**: TIME_BLOCKS 칩 제거는 **승인**, 단 다음 조건 충족 시:
1. TaskModal에서 시간 블록 직접 선택 UI 유지 확인
2. 삭제 전 사용 빈도 로깅 고려 (선택적)

---

## (2) Today/Tomorrow/Next + 고정/보류 행 병합 리스크

### 🟢 리스크 수준: **Low**

#### 레이아웃 분석

**현재 구현**:
- `renderQuickPlaceButtons` ([InboxTab.tsx#L584-L604](src/features/tasks/InboxTab.tsx#L584-L604)): Today/Tomorrow/Next
- `renderTriageButtons` ([InboxTab.tsx#L614-L664](src/features/tasks/InboxTab.tsx#L614-L664)): 고정/보류

**병합 시 고려사항**:

| 항목 | 현재 | 병합 후 | 리스크 |
|------|------|---------|--------|
| 버튼 개수 | 3 + 2 = 5개 | 5개 (같은 행) | 🟢 수용 가능 |
| 총 너비 | ~200px | ~250px | 🟡 좁은 패널에서 줄바꿈 가능 |
| 시각적 그룹화 | 명확한 분리 | 구분자 필요 | 🟡 구분자 또는 간격 필요 |
| 터치 타겟 | 개별 충분 | 밀집될 수 있음 | 🟡 최소 44px 터치 타겟 확인 |

#### 접근성 고려사항

```tsx
// 권고: 논리적 그룹화를 위한 role="group" 사용
<div className="flex items-center gap-1 px-1">
  <div role="group" aria-label="빠른 배치">
    <span className="text-[10px] mr-1">⚡</span>
    <button>Today</button>
    <button>Tomorrow</button>
    <button>Next</button>
  </div>
  <span className="w-px h-4 bg-[var(--color-border)]" /> {/* 구분자 */}
  <div role="group" aria-label="상태 관리">
    <button>고정</button>
    <button>보류</button>
  </div>
</div>
```

**권고**: 행 병합 **승인**, 단 다음 조건:
1. 시각적 구분자 (`|` 또는 spacing) 추가
2. 반응형 고려: 좁은 화면에서 줄바꿈 허용 또는 축약 (`T` / `O` / `N` 아이콘)
3. `role="group"` + `aria-label`로 접근성 유지

---

## (3) Triage 크래시 수정 분석: TypeError x is not a function

### 🔴 심각도: **Critical** (사용자 흐름 중단)

#### 분석 문서의 Root Cause 가설 검증

분석 문서 045 인용:
> "The onClick crash likely originates from the triage toggle path in InboxTab because it is the only triage-labeled onClick... if the hook ever receives a non-function setter (e.g., undefined) the onClick path would throw exactly the reported TypeError."

#### 코드 리뷰 결과

**취약점 1: useInboxHotkeys 내부 vs 외부 상태 불일치**

```typescript
// useInboxHotkeys.ts:L105-L111
const [triageFocusedTaskId, setTriageFocusedTaskIdLocal] = useState<string | null>(null);
const setTriageFocusedTaskId = setTriageFocusedTaskIdProp ?? setTriageFocusedTaskIdLocal;
```

- 외부에서 `setTriageFocusedTaskId`를 주입하면, **읽기**는 여전히 내부 `triageFocusedTaskId` 사용
- 결과: 포커스 상태 불일치 → null 상태로 triage 액션 실행

**취약점 2: placeTaskToSlot 콜백 미검증**

```typescript
// useInboxHotkeys.ts:L109-L115
const placeTaskToSlot = useMemo(() => {
  if (placeTaskToSlotProp) return placeTaskToSlotProp;
  return async (taskId: string, _date: string, blockId: TimeBlockId, hourSlot: number) => {
    await updateTask(taskId, { timeBlock: blockId, hourSlot });
  };
}, [placeTaskToSlotProp, updateTask]);
```

- `placeTaskToSlotProp`이 `undefined`가 아닌 **non-function truthy value**일 경우 크래시 가능
- 예: 실수로 `placeTaskToSlot={someObject}` 전달 시

**취약점 3: InboxTab의 triage 토글 onClick**

```tsx
// InboxTab.tsx:L566
<button onClick={() => setTriageEnabled(!triageEnabled)} ...>
```

- 이 코드 자체는 안전함
- 하지만 **이벤트 핸들러 내에서 호출되는 함수가 undefined일 때** 문제 발생 가능

#### 가능한 실패 모드 (Failure Modes)

| 실패 모드 | 원인 | 재현 조건 | 확률 |
|-----------|------|-----------|------|
| **FM-1: setTriageFocusedTaskId undefined** | 외부 setter 미제공 + 로컬 상태 null | Triage 활성화 직후 키보드 액션 | Medium |
| **FM-2: placeTaskToSlot non-function** | Props 전달 오류 | 개발 중 실수 | Low |
| **FM-3: updateTask undefined** | inboxStore 훅 반환 오류 | Store 초기화 실패 시 | Low |
| **FM-4: handleQuickPlace 비동기 에러** | slotFinder 예외 미처리 | 잘못된 날짜/블록 데이터 | Medium |

#### 권고: 강건한 수정 설계

**1. 타입 안전성 강화**

```typescript
// useInboxHotkeys.ts 수정 제안
export interface UseInboxHotkeysOptions {
  readonly triageEnabled: boolean;
  readonly setTriageFocusedTaskId?: ((taskId: string | null) => void) | undefined;
  // ↑ 명시적 undefined 허용 + 함수 시그니처 명확화
  readonly placeTaskToSlot?: ((taskId: string, date: string, blockId: TimeBlockId, hourSlot: number) => Promise<void>) | undefined;
  // ...
}
```

**2. 런타임 가드 추가**

```typescript
// 호출 전 함수 유효성 검사
const safeSetTriageFocusedTaskId = useCallback((taskId: string | null) => {
  if (typeof setTriageFocusedTaskId !== 'function') {
    console.warn('[useInboxHotkeys] setTriageFocusedTaskId is not a function');
    return;
  }
  setTriageFocusedTaskId(taskId);
}, [setTriageFocusedTaskId]);
```

**3. 단일 상태 소스 원칙**

```typescript
// 선택지 A: 완전 로컬 상태 (InboxTab이 읽기만)
// useInboxHotkeys 내부에서 모든 triage 상태 관리
// InboxTab은 focusedTaskId를 반환값으로만 받음

// 선택지 B: 완전 외부 상태 (InboxTab이 소유)
// InboxTab에서 triageFocusedTaskId 상태 정의
// useInboxHotkeys는 value + setter 모두 props로 받음

// 권고: 선택지 A (로컬 상태가 더 안전)
```

**4. try-catch 래핑**

```typescript
const handleQuickPlace = useCallback(async (mode: SlotFindMode) => {
  if (!triageFocusedTaskId || isProcessingRef.current) return;
  
  isProcessingRef.current = true;
  try {
    // ... 기존 로직
  } catch (error) {
    console.error('[useInboxHotkeys] Quick place failed:', error);
    notify.error('배치에 실패했습니다');
  } finally {
    isProcessingRef.current = false;
  }
}, [/* deps */]);
```

---

## (4) 누락 정보 요청

### 🔴 크래시 재현에 필요한 정보

| 항목 | 현재 상태 | 요청 |
|------|-----------|------|
| **Production 스택 트레이스** | 미제공 | Electron 콘솔/DevTools 에러 전문 필요 |
| **재현 시나리오** | 추정만 | 정확한 재현 단계 (1. Triage ON 2. ??? 3. 크래시) |
| **Source map 매핑** | 미확인 | 크래시 라인이 실제 어느 함수인지 |

### 🟡 수정 범위 확정에 필요한 파일/심볼

| 파일 | 수정 필요 여부 | 확인 필요 사항 |
|------|----------------|----------------|
| [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx) | ✅ 확정 | `renderQuickPlaceButtons`, `renderTriageButtons` 병합 위치 |
| [src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts) | ✅ 확정 | 상태 불일치 수정 |
| [src/shared/stores/inboxStore.ts](src/shared/stores/inboxStore.ts) | ⚠️ 확인 필요 | triage 상태가 여기 있어야 하는지 |
| [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts) | ⚠️ 확인 필요 | triage 관련 기본값 추가 여부 |

### 🟡 UX 결정 필요

| 결정 사항 | 옵션 | 권고 |
|-----------|------|------|
| 병합된 버튼 행 순서 | A) Today/Tomorrow/Next \| 고정/보류 <br> B) 고정/보류 \| Today/Tomorrow/Next | A (배치가 주 동작) |
| 좁은 화면 대응 | A) 축약 아이콘 <br> B) 줄바꿈 허용 <br> C) 스크롤 | B (자연스러움) |

---

## (5) 최소 테스트 추가 제안

### Unit Tests (slotFinder + 가드)

```typescript
// tests/inbox-triage-guards.test.ts

describe('useInboxHotkeys guards', () => {
  it('should not throw when setTriageFocusedTaskId is undefined', () => {
    // Props 미제공 시 로컬 fallback 사용 확인
  });
  
  it('should not throw when placeTaskToSlot is undefined', () => {
    // updateTask fallback 사용 확인
  });
  
  it('should handle non-function placeTaskToSlot gracefully', () => {
    // 타입 에러 방지 가드 확인
  });
});
```

### Integration Tests (UI 병합 회귀)

```typescript
// tests/inbox-ui-layout.test.ts

describe('InboxTab quick actions layout', () => {
  it('should render merged action row without TIME_BLOCKS chips', () => {
    // TIME_BLOCKS 버튼 미존재 확인
    // Today/Tomorrow/Next + 고정/보류가 같은 행에 있는지 확인
  });
  
  it('should maintain keyboard accessibility for all buttons', () => {
    // Tab 키로 모든 버튼 접근 가능 확인
  });
});
```

### Smoke Tests (크래시 회귀 방지)

```typescript
// tests/triage-crash-smoke.test.ts

describe('Triage mode crash prevention', () => {
  it('should toggle triage mode without throwing', () => {
    // Triage ON/OFF 토글 시 에러 없음 확인
  });
  
  it('should handle quick place during triage without crash', () => {
    // Triage ON → T 키 → 에러 없음 확인
  });
});
```

---

## Risk Assessment

| 리스크 | 심각도 | 발생 가능성 | 완화 상태 |
|--------|--------|-------------|----------|
| Triage 크래시 재발 | 🔴 High | Medium | 가드 추가 권고됨, 테스트 제안됨 |
| TIME_BLOCKS 제거로 기능 손실 | 🟡 Medium | Low | TaskModal 경로 유지 확인 필요 |
| 행 병합으로 터치 타겟 축소 | 🟡 Medium | Low | 44px 최소 크기 권고 |
| 접근성 회귀 | 🟢 Low | Low | role="group" 권고 |

---

## Unresolved Open Questions

분석 문서 045에서 다음 항목이 미해결 상태입니다:

| # | Open Question | Status | 권고 |
|---|---------------|--------|------|
| 1 | Production 스택 트레이스 필요 | ❌ UNRESOLVED | **Planner에게 반환**: 크래시 로그 수집 후 재분석 |
| 2 | 병합된 행 버튼 순서 UX 결정 | ❌ UNRESOLVED | User 승인 필요 |

---

## Recommendations

### 즉시 실행 (구현 전 필수)

1. **크래시 스택 트레이스 수집**: Production/Dev 환경에서 재현 후 정확한 에러 위치 확인
2. **useInboxHotkeys 상태 불일치 수정**: 단일 상태 소스 원칙 적용 (로컬 상태 우선 권고)
3. **함수 유효성 가드 추가**: `typeof x === 'function'` 체크

### 구현 시 주의

1. **TIME_BLOCKS 제거는 TaskModal 시간 선택 UI 유지 확인 후 진행**
2. **병합된 행에 시각적 구분자 추가** (`|` 또는 gap-4)
3. **테스트 추가**: 최소 3개 테스트 케이스 (가드, 레이아웃, 크래시 스모크)

### 지연 가능

- 좁은 화면 대응 (현재 Inbox 패널 고정 너비 가정 시)
- 사용 빈도 로깅 (분석용)

---

## Questions for User

1. **크래시 재현 가능한가요?** 정확한 재현 단계와 콘솔 에러 전문이 있으면 수정 정확도가 높아집니다.
2. **병합된 버튼 순서**: `[Today] [Tomorrow] [Next] | [고정] [보류]` 순서로 괜찮은가요?
3. **TIME_BLOCKS 제거 승인**: 특정 시간대 직접 배치 기능 손실을 감수할 수 있나요?

---

## Revision History

*최초 검토 - 2025-12-28*

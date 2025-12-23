# Critique: 인박스 개선 15개 제안서 구현 준비 검토

- **Artifact Path**: `agent-output/planning/030-inbox-improvements-15-proposals-final.md`
- **Analysis Reference**: `agent-output/analysis/031-inbox-improvements-requirements-fit-analysis.md`
- **Date**: 2025-12-23
- **Status**: Initial Review
- **Reviewer**: Critic Agent

## Changelog

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2025-12-23 | User → Critic | 6개 요구사항 구현 설계/UX/리스크 비판적 검토 | 초기 검토 완료. 5개 우려사항 + MVP 경계 + 체크리스트 제공 |

---

## Value Statement Assessment

✅ **Value Statement 존재 및 품질**: 명확함

> "As a 사용자(특히 ADHD 사용자), I want 인박스에서 해야 할 일을 '빠르게 캡처하고, 한 번에 배치하고, 결과를 즉시 확인하며, 실수하면 되돌릴 수' 있어서, so that 계획/실행 흐름이 끊기지 않고 정리 부담(인지 부하)을 최소화할 수 있다."

- ✅ User Story 형식 준수 (As a / I want / So that)
- ✅ ADHD 친화 UX 원칙과 정렬
- ✅ 측정 가능한 가치 제안 (빠른 캡처, 즉시 확인, 실수 복구)

---

## Overview

Plan은 15개 제안(기능 10 + UX 5)을 담고 있으며, Top 5 우선순위(P0)를 명시합니다. Analyst 분석 문서(031)는 코드베이스에서 inbox 관련 코드 위치, dual-storage 패턴, toast 이원화, hotkey 체계를 잘 식별했습니다.

**이 critique는 사용자 요청에 따라 다음 6개 구현 결정에 초점을 맞춥니다:**
1. 저장이 필요한 상태(목표/핀/보류)를 task schema vs systemState 매핑
2. Today/Tomorrow/NextSlot 배치의 dual-storage + eventBus 취약점
3. Toast 채널 이원화 해결 (단일 래퍼 vs 기존 컴포넌트)
4. 키보드 전용 플로우의 focus/ESC/단축키 충돌
5. MVP 경계 제안

---

## (A) 5개 핵심 우려사항 + 완화책

### 🔴 우려 1: Task Schema 확장 vs SystemState 저장 — 마이그레이션/Sync 비용

**문제 상세:**
- Plan의 결정 A는 "태그/메타(기존 필드 확장)로 시작"을 권장하지만, **구체적인 저장 위치가 모호**합니다.
- `Task` interface는 이미 `goalId?`, `emoji?`, `fromAutoTemplate?` 등 선택 필드를 갖고 있어, 새 필드 추가 시 **Firebase Sync payload 증가 + 구버전 클라이언트 호환성** 문제가 발생합니다.
- "정리 상태(triaged/parked)" 같은 **UI 전용 상태**를 Task에 넣으면 dual-storage(inbox/daily) 양쪽에서 관리해야 합니다.

**완화책:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 저장 위치 결정 매트릭스                                          │
├─────────────────┬──────────────────┬──────────────────────────────┤
│ 상태 유형       │ Task Schema에     │ SystemState/로컬에           │
├─────────────────┼──────────────────┼──────────────────────────────┤
│ 영구 + 동기화   │ ✅ goalId, pin   │ ❌                           │
│ 세션 한정       │ ❌               │ ✅ triageFilter, lastUsedSlot│
│ 기기별 UI 상태  │ ❌               │ ✅ collapsedSections         │
│ Snooze(되돌아옴)│ ⚠️ snoozeUntil?  │ ✅ snoozeQueue (로컬 큐)     │
└─────────────────┴──────────────────┴──────────────────────────────┘
```

**권고:**
- **"핀(고정)"**: Task schema에 `isPinned?: boolean` 추가 → 동기화 대상(다른 기기에서도 유지)
- **"보류(snooze)"**: Task에 `snoozedUntil?: string` (ISO 날짜) 추가 — **단, 보류 해제 로직은 앱 시작/날짜 변경 시 inbox 쿼리에서 처리** (별도 테이블 X)
- **"정리 상태(triaged/new)"**: SystemState에 `inbox:triagedTaskIds: string[]` 형태로 저장 — 로컬 전용, 동기화 제외
- **"목표 연결"**: 기존 `goalId` 필드 활용 (schema 변경 불필요)

---

### 🔴 우려 2: Today/Tomorrow/NextSlot 배치 — Dual-Storage 경계에서 유령 Task 위험

**문제 상세:**
- Analyst 분석에서 확인: `inboxStore.updateTask`가 `timeBlock`을 설정하면 **optimistic하게 inbox에서 즉시 제거** 후 `dailyDataStore.updateTask` 호출
- 만약 `dailyDataStore.updateTask`가 실패하면 **inbox에서 사라졌지만 schedule에 없는 "유령 task"** 발생
- `unifiedTaskService.findTaskLocation`은 7일치만 검색하므로, 오래된 날짜로 잘못 배치되면 영구 유실 가능

**현재 코드 취약점** ([inboxStore.ts#L81-L95](src/shared/stores/inboxStore.ts#L81-L95)):
```typescript
// Optimistic: 즉시 inbox에서 제거
set({ inboxTasks: inboxTasks.filter(t => t.id !== taskId) });
try {
    await useDailyDataStore.getState().updateTask(taskId, updates);
} catch (error) {
    // 실패 시 롤백: inbox 목록 다시 로드
    await get().loadData();  // ⚠️ 네트워크/DB 에러 시 이것도 실패 가능
    throw error;
}
```

**완화책:**
1. **트랜잭션 개념 도입**: 이동 전 "이동 중" 상태를 잠시 표시 → 성공 시 제거, 실패 시 원복 + 에러 toast
2. **EventBus 이벤트 표준화**: `task:moveToSchedule` 이벤트를 만들어, inbox subscriber와 dailyData subscriber가 같은 신호를 받도록 함
3. **Rollback 강화**: `loadData()` 실패 시 메모리 캐시에서 복원하는 2차 방어선 추가

**권고:**
```typescript
// 제안: 안전한 이동 패턴
const moveTaskToSchedule = async (taskId: string, targetBlock: TimeBlockId, targetHourSlot: number) => {
    const originalTask = inboxTasks.find(t => t.id === taskId);
    if (!originalTask) throw new Error('Task not found');
    
    // 1. UI에 "이동 중" 표시 (선택적)
    set({ movingTaskId: taskId });
    
    try {
        // 2. Repository 레벨에서 atomic하게 처리
        await unifiedTaskService.moveInboxToDaily(taskId, targetBlock, targetHourSlot);
        
        // 3. 성공 시 inbox 상태 갱신
        set(state => ({ 
            inboxTasks: state.inboxTasks.filter(t => t.id !== taskId),
            movingTaskId: null 
        }));
        
        // 4. EventBus로 피드백 요청
        eventBus.emit('task:movedToSchedule', { taskId, targetBlock, targetHourSlot });
    } catch (error) {
        // 5. 실패 시 원복
        set({ movingTaskId: null });
        // inbox는 이미 메모리에 있으므로 DB 리로드 없이 유지됨
        throw error;
    }
};
```

---

### 🟡 우려 3: Toast 채널 이원화 — 피드백 불일치 위험

**문제 상세:**
- Analyst 분석 확인: **두 개의 toast 시스템이 공존**
  1. `react-hot-toast` (AppToaster): InboxTab, gameStateEventHandler, idleFocusModeService 등에서 직접 사용
  2. `toastStore` (Zustand + Toast.tsx): 존재하지만 inbox에서 미사용
- Plan의 F#4(Placement Feedback), UX#1(Undo Snackbar)은 **통일된 toast 채널**을 전제로 함
- 현재 상태로 구현하면 **XP toast는 react-hot-toast, Undo snackbar는 toastStore**로 나뉘어 사용자 혼란 야기

**완화책:**

| 옵션 | 장점 | 단점 | 권고 |
|------|------|------|------|
| A) react-hot-toast로 통일 | 이미 대부분 사용 중, 커스텀 UI 지원(XPToast) | toastStore 리팩터링 필요 | ✅ 권장 |
| B) toastStore로 통일 | Zustand 통합, 세밀한 제어 가능 | 기존 코드 대량 수정, react-hot-toast 제거 | ❌ |
| C) 래퍼 함수로 추상화 | 점진적 마이그레이션 가능 | 추상화 레이어 복잡도 | △ 차선책 |

**권고:**
- **옵션 A 채택**: `shared/lib/notify.ts` 래퍼 함수 생성
```typescript
// notify.ts - toast 단일 진입점
import { toast } from 'react-hot-toast';
import { XPToast } from '@/shared/components/XPToast';

export const notify = {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast(message),
    xp: (xp: number, message: string) => toast.custom((t) => XPToast({ xp, message, t })),
    undo: (message: string, onUndo: () => void) => toast(/* custom undo component */),
};
```
- InboxTab 등에서 `import { notify } from '@/shared/lib/notify'` 사용
- toastStore는 deprecate 후 점진 제거

---

### 🟡 우려 4: 키보드 전용 플로우 — Focus/ESC/단축키 충돌 위험

**문제 상세:**
- 현재 `useModalEscapeClose` + `modalStackRegistry`가 ESC 처리를 담당 ([useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts))
- Triage 모드(F#3)는 **모달 아닌 인라인 UI**에서 키보드 내비게이션 필요
- `react-hotkeys-hook`이 프로젝트에 설치되어 있으나, **inbox에서 미사용** (Analyst 확인)
- 충돌 시나리오:
  1. Triage 모드에서 ↑↓ 네비게이션 중 TaskModal 열림 → ESC가 어디로?
  2. 전역 단축키(Ctrl+B 패널 토글)와 Triage 단축키(T = Today) 충돌
  3. IME 조합 중 Enter 입력 → 의도치 않은 배치 확정

**완화책:**
```
┌──────────────────────────────────────────────────────────────┐
│ 키보드 우선순위 스택 (위가 최고 우선)                        │
├──────────────────────────────────────────────────────────────┤
│ 1. Modal (TaskModal, SettingsModal 등)                      │
│    → ESC: 닫기, Enter: 확정, ↑↓: 내부 네비게이션            │
├──────────────────────────────────────────────────────────────┤
│ 2. Triage Mode (InboxTab 내 활성화 시)                       │
│    → ESC: Triage 종료, T/O/N: Today/Tomorrow/Next, ↑↓: 항목│
├──────────────────────────────────────────────────────────────┤
│ 3. Global Shortcuts (패널 토글, 앱 수준)                     │
│    → Ctrl+B, Ctrl+Shift+B, F1 등                            │
└──────────────────────────────────────────────────────────────┘
```

**권고:**
1. `modalStackRegistry` 확장: Triage 모드도 "컨텍스트"로 등록 → isTop 확인 후 키 처리
2. IME 가드: 모든 키 핸들러에 `e.isComposing || e.key === 'Process'` 체크 (이미 useModalEscapeClose에 존재, 복제 필요)
3. 단축키 네임스페이스 분리:
   - 전역: Ctrl/Cmd + 키
   - Triage 로컬: 단일 키 (T, O, N, P, D)
   - 충돌 시 Triage가 활성화된 동안 전역 비활성화 (또는 modifier 필수)

---

### 🟢 우려 5: "빈 슬롯(NextSlot)" 정책 — 엣지 케이스 미정의

**문제 상세:**
- Plan의 결정 B는 "가장 가까운 미래의 빈 TimeBlock 시작"을 권장하지만:
  - "빈"의 정의가 모호: Task가 0개? 아직 시작 안 한 hourSlot?
  - 23시 이후(night 블록 종료 후)의 동작 미정의
  - "잠금(locked)" 블록 스킵 로직 → TimeBlockState.isLocked 확인 필요

**Analyst 분석 확인**: `timeBlockVisibility.ts`에 `getCurrentBlock(hour)` 존재, 하지만 **"next empty slot" 헬퍼는 없음**

**완화책:**

```typescript
// slotFinder.ts - 제안 구현 골격
interface SlotSuggestion {
    date: string;           // YYYY-MM-DD
    blockId: TimeBlockId;
    hourSlot: number;
    label: string;          // "오늘 11시-14시 블록" 같은 사용자 친화 문구
}

function findNextAvailableSlot(
    currentHour: number,
    todayTasks: Task[],
    todayBlockStates: TimeBlockStates,
    tomorrowTasks?: Task[]
): SlotSuggestion {
    const now = new Date();
    const todayDate = getLocalDate();
    
    // 1. 오늘 남은 블록 중 잠금 안 된 첫 블록
    for (const block of TIME_BLOCKS) {
        if (block.end <= currentHour) continue;  // 이미 지남
        if (todayBlockStates[block.id]?.isLocked) continue;  // 잠금
        
        return {
            date: todayDate,
            blockId: block.id as TimeBlockId,
            hourSlot: Math.max(block.start, currentHour),  // 현재 시간 또는 블록 시작
            label: `오늘 ${block.label}`,
        };
    }
    
    // 2. 오늘 없으면 내일 첫 블록
    const tomorrowDate = /* 내일 날짜 */;
    return {
        date: tomorrowDate,
        blockId: TIME_BLOCKS[0].id as TimeBlockId,
        hourSlot: TIME_BLOCKS[0].start,
        label: `내일 ${TIME_BLOCKS[0].label}`,
    };
}
```

**권고:**
- 23시 이후 특별 처리: "오늘 더 이상 블록 없음" → 자동으로 내일로
- "빈"의 정의 명확화: **Task 개수와 무관**, 시간 기준으로 "아직 지나지 않은 블록"
- 잠금 블록 스킵은 **옵션으로 제공** (settings에서 토글 가능)

---

## (B) "반드시 지금" 3개 vs "나중에" 3개

### ✅ 반드시 지금 (MVP 필수)

| # | 항목 | 이유 |
|---|------|------|
| 1 | **UX#1 Undo 기반 안전장치** | 실수 복구 없이 원탭 배치는 위험 → 데이터 유실 민원 예상 |
| 2 | **F#2 Today/Tomorrow/NextSlot 원탭 배치** | Value Statement 핵심("한 번에 배치") + 기존 TIME_BLOCKS 버튼 대체 |
| 3 | **Toast 채널 통일 (notify 래퍼)** | F#4, UX#1 모두 toast 의존 → 선행 인프라 |

### ⏳ 나중에 (v1.0.172+ 이후)

| # | 항목 | 이유 |
|---|------|------|
| 1 | **F#3 Triage 모드** | 키보드 인프라(우선순위 스택) 정비 후 안전 구현 가능 |
| 2 | **F#1 Capture + Preview** | 기존 인라인 입력이 작동 중, 프리뷰는 부가 가치 |
| 3 | **F#10 Snooze(보류)** | Task schema 변경 필요 → 마이그레이션 계획 후 |

---

## (C) 구현 전 확인 필수 파일/함수 체크리스트

### 🗂️ Dual-Storage 흐름 검증

| 파일 | 확인 포인트 |
|------|------------|
| [src/shared/stores/inboxStore.ts](src/shared/stores/inboxStore.ts) | `updateTask` optimistic 제거 + 롤백 로직 |
| [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts) | inbox→daily 이동 시 이벤트 발행 |
| [src/shared/services/task/unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts) | `findTaskLocation` 7일 제한 확인 |
| [src/data/repositories/inboxRepository.ts](src/data/repositories/inboxRepository.ts) | `addInboxTask`, `deleteInboxTask` 트랜잭션 |

### 🔔 Toast/피드백 통일

| 파일 | 확인 포인트 |
|------|------------|
| [src/app/components/AppToaster.tsx](src/app/components/AppToaster.tsx) | 기존 설정 확인 (position, style) |
| [src/shared/stores/toastStore.ts](src/shared/stores/toastStore.ts) | 사용처 파악 후 deprecation 계획 |
| [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx) | 현재 `toast` import 위치 |

### ⌨️ 키보드/ESC 충돌 방지

| 파일 | 확인 포인트 |
|------|------------|
| [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts) | IME 가드 로직 복제 필요 |
| [src/shared/hooks/modalStackRegistry.ts](src/shared/hooks/modalStackRegistry.ts) | Triage 컨텍스트 추가 가능 여부 |
| [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx) | 내부 keydown 핸들러 존재 여부 |

### 📍 Slot Finder 신규 개발

| 파일 | 확인 포인트 |
|------|------------|
| [src/features/schedule/utils/timeBlockVisibility.ts](src/features/schedule/utils/timeBlockVisibility.ts) | `getCurrentBlock`, `getVisibleBlocks` 재사용 |
| [src/shared/utils/timeBlockUtils.ts](src/shared/utils/timeBlockUtils.ts) | `getBlockIdFromHour` 중복 확인 |
| [src/shared/types/domain.ts](src/shared/types/domain.ts) | `TIME_BLOCKS`, `TimeBlockState` 구조 |

### 💾 SystemState 저장 위치

| 파일 | 확인 포인트 |
|------|------------|
| [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts) | `SYSTEM_KEYS` 확장 필요 여부 |
| [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts) | `SYSTEM_STATE_DEFAULTS` 신규 키 추가 |

---

## Risk Assessment

| 리스크 | 심각도 | 발생 가능성 | 완화 상태 |
|--------|--------|-------------|----------|
| 유령 Task (dual-storage 이동 실패) | 🔴 High | Medium | 권고안 제시됨 |
| Toast 혼재로 UX 불일치 | 🟡 Medium | High | notify 래퍼 제안 |
| ESC/단축키 충돌 | 🟡 Medium | Medium | 우선순위 스택 제안 |
| Task schema 확장 마이그레이션 | 🟡 Medium | Low (태그 먼저) | 결정 매트릭스 제공 |
| NextSlot 엣지 케이스 | 🟢 Low | Low | slotFinder 골격 제안 |

---

## Recommendations Summary

1. **즉시 실행**: Toast 래퍼(`notify.ts`) 먼저 구현하여 피드백 인프라 통일
2. **Undo 선행**: 원탭 배치 전에 반드시 Undo 메커니즘 구현 (메모리 기반 1회)
3. **이동 로직 강화**: `inboxStore.updateTask` 롤백 로직 보강 + eventBus 표준 이벤트
4. **Triage 분리**: MVP에서 제외, 키보드 인프라 정비 후 별도 PR
5. **슬롯 정책 문서화**: `slotFinder.ts` 구현 시 엣지 케이스(23시 이후, 잠금 블록) 주석으로 명시

---

## Findings

### Critical

| Issue | Status | Description | Impact | Recommendation |
|-------|--------|-------------|--------|----------------|
| C-1: Dual-Storage 이동 롤백 불완전 | 🟡 OPEN | `inboxStore.updateTask`에서 dailyData 실패 시 `loadData()` 호출만 함 | 네트워크 장애 시 유령 Task | 메모리 캐시 복원 + eventBus 동기화 |
| C-2: Toast 이원화 | 🟡 OPEN | react-hot-toast와 toastStore 공존 | UX#1, F#4 구현 시 혼란 | notify 래퍼로 단일화 |

### Medium

| Issue | Status | Description | Impact | Recommendation |
|-------|--------|-------------|--------|----------------|
| M-1: NextSlot 헬퍼 부재 | 🟡 OPEN | F#2 구현에 필요한 `findNextAvailableSlot` 없음 | Today/Tomorrow/Next 버튼 구현 지연 | slotFinder.ts 신규 개발 |
| M-2: Triage 키보드 컨텍스트 미정의 | 🟡 OPEN | modalStackRegistry가 모달만 지원 | Triage 모드 단축키 충돌 | 컨텍스트 확장 또는 별도 레지스트리 |
| M-3: Task schema 확장 정책 미확정 | 🟡 OPEN | pin/snooze 필드 추가 시 Firebase 동기화 영향 | 마이그레이션 비용 | 태그/메타 우선, 필드는 검증 후 |

### Low

| Issue | Status | Description | Impact | Recommendation |
|-------|--------|-------------|--------|----------------|
| L-1: IME 가드 중복 | 🟢 INFO | useModalEscapeClose에만 IME 체크 존재 | Triage keydown에서 누락 가능 | 공통 유틸로 추출 |

---

## Questions for Planner

1. **Undo 범위**: Undo가 "마지막 1회" 한정인지, "세션 내 N회"까지 확장 가능한지?
2. **잠금 블록 정책**: NextSlot 계산 시 잠금 블록을 건너뛸지, 사용자에게 경고만 할지?
3. **Snooze 동기화**: 보류된 Task가 다른 기기에서도 보류 상태를 유지해야 하는지?

---

## Revision History

*최초 검토 - 추후 Plan 수정 시 업데이트 예정*

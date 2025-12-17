# Implementation: Focus-only TimeBlock Visibility + Warmup Auto-Generate Toggle

## Plan Reference
`agent-output/architecture/001-focus-only-blocks-warmup-toggle-architecture-findings.md`

## Date
2025-12-17

## Changelog
| Date | Handoff | Request | Summary |
|---|---|---|---|
| 2025-12-17 | User → Implementer | 점진 적용 형태로 실제 코드 변경 | Phase 2 + Phase 3 구현 완료 |

## Implementation Summary

### Value Statement
이 구현은 다음 두 가지 핵심 가치를 전달합니다:

1. **현재 집중 블록만 표시**: ScheduleView 리스트 뷰에서 과거/미래 타임블록을 숨기고 현재 진행 중인 3시간 블록만 표시하여 사용자가 "지금"에 집중할 수 있게 합니다.

2. **워밍업 자동생성 제어권**: 사용자가 워밍업 작업 자동 삽입 기능을 on/off 토글로 제어할 수 있어, 원하지 않는 자동 작업 추가를 방지할 수 있습니다.

### How It Delivers Value
- **timeBlockVisibility 유틸**: 재사용 가능한 순수 함수로 타임블록 가시성 정책을 분리하여 향후 TimelineView 확장이 용이
- **Dexie systemState 저장**: localStorage 금지 정책 준수, 기기 단위 설정 영속화
- **기존 동작 보존**: "모든 블록 보기" 버튼으로 언제든 전체 블록 확인 가능

## Milestones Completed
- [x] Phase 1: 표시 정책 분리 + systemState 키 정의
- [x] Phase 2: ScheduleView에서 현재 블록만 렌더링
- [x] Phase 3: WarmupPresetModal 토글 UI + 자동삽입 가드 연결
- [x] 테스트 커버리지 추가

## Files Modified

| Path | Changes | Lines Changed |
|------|---------|---------------|
| `src/data/repositories/systemRepository.ts` | SYSTEM_KEYS에 WARMUP_AUTO_GENERATE_ENABLED 추가 | +2 |
| `src/shared/constants/defaults.ts` | SYSTEM_STATE_DEFAULTS 상수 추가 | +17 |
| `src/features/schedule/ScheduleView.tsx` | 가시성 유틸 import, 상태/로직 변경, 빈 상태 UI | +50 |
| `src/features/schedule/components/WarmupPresetModal.tsx` | 토글 UI/로직 추가, onAutoGenerateToggle prop | +55 |

## Files Created

| Path | Purpose |
|------|---------|
| `src/features/schedule/utils/timeBlockVisibility.ts` | 타임블록 가시성 정책 순수 함수 유틸 |
| `tests/timeblock-visibility.test.ts` | timeBlockVisibility 유틸 유닛 테스트 (20 cases) |

## Code Quality Validation
- [x] TypeScript 컴파일 성공 (오류 없음)
- [x] ESLint 검사 통과 (변경 파일 기준)
- [x] 기존 테스트 통과 (71개)
- [x] 신규 테스트 통과 (20개)
- [x] 기존 코드와 호환성 유지

## Value Statement Validation

### Original Value Statement
1. 현재 진행 중인 3h 타임블록만 보이게
2. 워밍업 자동생성 on/off 토글 추가

### Implementation Delivers
1. ✅ `getVisibleBlocks(currentHour, 'current-only')` 로 현재 블록만 필터링
2. ✅ WarmupPresetModal에 토글 스위치 추가, Dexie systemState 저장
3. ✅ 현재 블록이 없는 시간대(05:00 이전, 23:00 이후) 빈 상태 텍스트 표시
4. ✅ 숨겨진 블록이 있을 때 "모든 블록 보기" 버튼 제공

## Test Coverage

### Unit Tests
- `timeBlockVisibility.test.ts`: 20 test cases
  - `getCurrentBlock`: 4 cases (시간대별 블록 반환, 범위 외 null)
  - `isBlockPast/Future/Current`: 9 cases (상태 판별)
  - `shouldShowBlock`: 3 cases (모드별 정책)
  - `getVisibleBlocks`: 4 cases (필터링 결과)

### Integration (Manual Verification Required)
- [ ] 현재 시간 기준 1개 블록만 표시
- [ ] "모든 블록 보기" 클릭 시 전체 표시
- [ ] 05:00 이전/23:00 이후 빈 상태 메시지
- [ ] 워밍업 토글 on/off 동작
- [ ] 토글 off 시 50분 자동삽입 미발생

## Test Execution Results

```
Command: npx vitest run --reporter verbose

Results:
Test Files  12 passed (12)
Tests       91 passed (91)
Duration    ~1.4s
```

Issues: None
Coverage: timeBlockVisibility.ts 100% (statements/branches)

## Outstanding Items

### Incomplete
- 없음

### Issues
- 없음

### Deferred (Plan-approved)
- TimelineView 확장 (이번 범위 제외, 유틸로 분리되어 추후 적용 용이)
- Firebase sync 기반 계정 단위 설정 동기화 (Option 3, 후속 과제)

### Test Failures
- 없음

### Missing Coverage
- WarmupPresetModal 토글 UI 통합 테스트 (수동 검증 권장)

## Next Steps
1. **QA 검증**: 수동 테스트 수행 (현재 시간대 변경하며 UI 확인)
2. **UAT 검증**: 실제 사용 시나리오 테스트
3. 필요 시 TimelineView 확장 검토

---

## Technical Notes

### systemState 키 네이밍
- 형식: `{domain}:{key}` (예: `schedule:warmupAutoGenerateEnabled`)
- 충돌 방지를 위해 도메인 프리픽스 사용

### 모달 UX 패턴
- 배경 클릭으로 닫히지 않음 (기존 정책 유지)
- ESC 키로 닫힘 (`useModalEscapeClose` 훅 사용)
- 명시적 닫기 버튼 제공

### 기본값 중앙화
- `SYSTEM_STATE_DEFAULTS.warmupAutoGenerateEnabled = true`
- 하드코딩 기본값 금지 정책 준수

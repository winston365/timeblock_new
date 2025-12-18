# 008-firebase-rtdb-download-leak-pr-breakdown — Implementation

## Plan Reference
- Planning: agent-output/planning/008-firebase-rtdb-download-leak-pr-breakdown.md
- Related analysis: agent-output/analysis/011-firebase-rtdb-download-spike-analysis.md
- Related architecture: agent-output/architecture/004-firebase-rtdb-mitigation-phased-architecture-findings.md

## Date
- 2025-12-18

## Changelog
| Date | Handoff/Request | Summary |
|------|------------------|---------|
| 2025-12-18 | Implementer | RTDB 리스너 중복/누수 완화(리스너 레지스트리+stopListening+멀티윈도우 리더락), pre-get single-flight, 대형 컬렉션 업로드 debounce, DEV 계측 훅 추가 |

## Implementation Summary
- 목표(가치): RTDB 저장량 대비 과도한 다운로드가 발생하는 주요 트리거(루트 onValue 리스너 중복, 재초기화 시 리스너 누수, 연속 쓰기→pre-get 반복 다운로드)를 클라이언트만으로 완화하고, 원인 계측을 위한 훅을 제공.
- 방식:
  - RTDB onValue 리스너를 경로별로 단일화/레퍼런스 카운트로 관리하는 레지스트리 도입.
  - SyncEngine에 start/stop 생명주기 및 멀티윈도우 리더락(1개 창만 리스닝)을 추가.
  - 큰 컬렉션(templates/globalInbox/shopItems/completedInbox) 업로드를 debounce하여 write/pre-get/onValue 에코 폭주 완화.
  - syncCore의 pre-get을 single-flight + 짧은 TTL 캐시로 묶어 연속 동기화에서 다운로드 증폭 완화.
  - DEV에서만 bytes 추정(직렬화 크기) 계측을 활성화하고, 경로별 attach/detach/event/bytes를 집계.

## Milestones Completed
- [x] Listener hygiene: 중복 등록 방지 + 명시적 stop 제공
- [x] Multi-window guard: 리더 1개만 리스닝
- [x] Debounce: 대형 컬렉션 쓰기 빈도 완화
- [x] Single-flight: syncToFirebase pre-get 중복 다운로드 완화
- [x] Instrumentation hooks: DEV 계측/카운터/bytes 추정
- [x] Tests: vitest 통과

## Files Modified
| Path | Changes | Notes |
|------|---------|------|
| src/shared/services/sync/firebase/firebaseClient.ts | 재초기화/disconnect 시 RTDB 리스너 전부 stop | 리스너 누수 방지 |
| src/shared/services/sync/firebase/syncCore.ts | onValue unsubscribe 반환 사용, pre-get single-flight+TTL, 계측 훅 | off(ref) 제거 |
| src/data/db/infra/syncEngine.ts | startListening async + stopListening + 리더락 + registry attach + debounce | 루트 onValue 중복/누수 완화 |
| src/data/db/infra/useAppInitialization.ts | startListening await + beforeunload stop | 종료 시 정리 |
| src/shared/services/sync/firebaseService.ts | 레거시 enableFirebaseSync unsubscribe 사용 | 광역 off 방지 |
| tests/sync-core.test.ts | onValue unsubscribe 기반으로 테스트 갱신 | 회귀 방지 |

## Files Created
| Path | Purpose |
|------|---------|
| src/shared/services/sync/firebase/rtdbListenerRegistry.ts | 경로별 onValue 단일화/참조 카운트/stopAll 제공 |
| src/shared/services/sync/firebase/rtdbMetrics.ts | 경로별 attach/detach/event/bytes(추정) 계측 |
| src/shared/services/sync/firebase/firebaseSyncLeaderLock.ts | navigator.locks 기반 멀티윈도우 리더 선출 |
| tests/rtdb-listener-registry.test.ts | 레지스트리 중복 방지/해제 검증 |

## Code Quality Validation
- [x] TypeScript 컴파일: vitest 실행 성공
- [x] Lint: (이번 변경에서는 별도 실행하지 않음)
- [x] Unit tests: `npm test` 통과
- [x] Optional chaining / null guards: 리스너 처리부 보강

## Value Statement Validation
- Original: RTDB 과다 다운로드를 즉시 줄이고 재발을 방지할 수 있게, 읽기/리스너를 통제하고 원인을 계측.
- Delivered:
  - 중복 리스너(특히 멀티 창/재초기화)로 인한 다운로드 배수 증가를 구조적으로 차단.
  - 연속 쓰기에서 pre-get 중복 다운로드를 single-flight로 완화.
  - 대형 컬렉션 연속 업로드를 debounce하여 쓰기/읽기 에코 빈도 감소.
  - DEV에서 경로별 이벤트/bytes 추정치 계측 가능.

## Test Coverage
- Unit
  - tests/rtdb-listener-registry.test.ts
  - tests/sync-core.test.ts (갱신)

## Test Execution Results
- Command: `npm test`
- Result: PASS (15 files, 97 tests)

## Outstanding Items
- 계측 플래그를 systemState로 제어하는 UI/설정 토글은 아직 없음(현재 DEV에서만 bytes 추정 활성).
- Phase 2 수준의 “루트 리스너 범위 축소(query/증분 수신)”는 데이터 모델 변경 위험이 있어 이번 변경에서 제외.

## Next Steps
- QA: 1창/2창(QuickAdd 포함)에서 SyncLog의 리스너 attach/detach, onValue 이벤트 빈도 확인.
- UAT: 실제 사용자 시나리오(작업 완료/인박스 수정/템플릿 편집) 반복 후 RTDB Console 다운로드 추세 비교.

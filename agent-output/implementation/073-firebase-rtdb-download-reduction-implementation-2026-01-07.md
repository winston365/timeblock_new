---
ID: 73
Origin: 73
UUID: c2ab37f1
Status: Active
---

# Plan Reference
- Plan: agent-output/planning/073-firebase-rtdb-download-reduction-plan-2026-01-07.md

# Date
- 2026-01-07

# Changelog
| Date | Handoff/Request | Summary |
| --- | --- | --- |
| 2026-01-07 | User: proceed; skip version/release | RTDB date-keyed listeners narrowed (range query), DEV instrumentation strengthened, tests added |
| 2026-01-07 | Follow-up: BW-02 + BW-06 | Date-keyed listeners switched to child-delta key-range listeners; syncToFirebase removes pre-write reads and uses observed-remote cache; tests updated |
| 2026-01-07 | User: “fix bandwidth NOW” (skip version/release) | (BW-07) Legacy root listeners disabled via hard error; (BW-01) Startup bulk download removed — rely on RTDB listener initial snapshots; tests + full vitest pass |
| 2026-01-07 | User: BW-04 non-date collections | templates/shopItems/globalInbox listeners switched from full `onValue` to child events on `.../data` (adds `attachRtdbOnChild`); tests updated; full vitest pass |

# Implementation Summary
- (BW-07) 레거시 `enableFirebaseSync()`(root `onValue` 리스너)를 **명시적 에러로 차단**해, SyncEngine 외부에서 실수로 루트 리스너가 켜지는 것을 원천 차단했습니다.
- (BW-01) 앱 시작 시 `fetchDataFromFirebase()`로 대량 `get()`을 수행하던 경로를 제거하고, **SyncEngine 리스너의 초기 스냅샷**으로 로컬 DB가 채워지도록 변경했습니다(스타트업 “double-download” 제거).
- (BW-02) date-keyed 컬렉션의 child-delta 구독은 이미 적용되어 있었고, 관련 테스트 포함 전체 vitest로 회귀가 없음을 확인했습니다.
- (BW-04) `templates/shopItems/globalInbox`는 `onValue`로 배열 전체를 매번 재다운로드하던 구조였는데, 이제 `.../data`에 대해 `onChildAdded/Changed/Removed`로 **아이템 단위 delta 적용**(Dexie upsert/delete)하도록 바꿔 “작은 변경 1회 → 전체 배열 재다운로드”를 차단했습니다.

# Milestones Completed
- [x] DEV 계측(읽기 바이트 추정) 강화
- [x] (BW-02) SyncEngine date-keyed RTDB 리스너를 child-delta로 전환
- [x] (BW-06) syncToFirebase pre-write read 제거
- [x] (BW-07) 레거시 root 리스너 진입점(enableFirebaseSync) 비활성화
- [x] (BW-01) 스타트업 bulk `get()` 제거(리스너 초기 스냅샷으로 대체)
- [x] (BW-04) templates/shopItems/globalInbox의 full-subtree(onValue) 다운로드를 child events로 대체
- [x] 신규/변경 동작에 대한 vitest 테스트 추가
- [ ] (스킵) 앱 버전/릴리즈 아티팩트 변경 (사용자 명시적 요청)

# Files Modified
| Path | Changes | Notes |
| --- | --- | --- |
| src/shared/services/sync/firebase/rtdbListenerRegistry.ts | key-range child listeners(added/changed/removed) 지원 + observed cache 업데이트 | BW-02: range onValue 재다운로드 제거 |
| src/data/db/infra/syncEngine/listener.ts | dailyData/completedInbox/tokenUsage를 child-delta key-range 구독으로 변경; templates/shopItems/globalInbox를 child events 기반으로 전환 | BW-02 + BW-04 |
| src/shared/services/sync/firebase/syncCore.ts | syncToFirebase에서 pre-write read 제거, observed cache 사용 | BW-06: write path read 증폭 제거 |
| src/shared/constants/defaults.ts | FIREBASE_SYNC_DEFAULTS 추가 | 하드코딩 회피(중앙 관리) |
| src/shared/services/sync/firebaseService.ts | `enableFirebaseSync()`를 deprecate+throw로 변경 | BW-07: 레거시 루트 리스너 차단 |
| src/data/db/infra/useAppInitialization.ts | 스타트업 bulk fetch/merge 제거, 리스너 시작으로 단순화 | BW-01: double-download 제거 |
| tests/rtdb-listener-registry.test.ts | key-range query 테스트 추가 + non-range child listeners 테스트 추가 | TDD: 새 API 계약 |
| tests/sync-core.test.ts | BW-06(무프리리드) 반영 + instrumentation 기대값 조정 | syncToFirebase는 get을 호출하지 않음 |
| tests/sync-engine-rtdb-range-listeners.test.ts | non-date 컬렉션이 child listeners를 쓰는지 계약 추가 | BW-04 회귀 방지 |

# Files Created
| Path | Purpose |
| --- | --- |
| src/data/db/infra/startupFirebaseSync.ts | 스타트업 Firebase 초기 read 정책을 테스트 가능하게 분리 | BW-01 Option A: bulk fetch 스킵 |
| tests/firebase-service-legacy-root-listeners-disabled.test.ts | enableFirebaseSync가 실행 불가(에러)임을 보장 | BW-07 회귀 방지 |
| tests/startup-firebase-initial-read-no-bulk-fetch.test.ts | 스타트업에서 bulk fetch를 하지 않음을 보장 | BW-01 회귀 방지 |
| tests/sync-engine-rtdb-range-listeners.test.ts | SyncEngine이 date-keyed 컬렉션에 range listener를 사용하는지 보장 |
| src/shared/services/sync/firebase/rtdbObservedCache.ts | 리스너 기반 observed-remote 캐시 | BW-06: pre-write read 제거를 위한 기반 |

# Code Quality Validation
- [ ] TypeScript compile (not run)
- [ ] Lint (not run)
- [x] Unit tests (vitest)

# Value Statement Validation
- Original: Firebase RTDB 다운로드가 데이터 크기에 비례해 폭증하지 않게 만들고, 운영 비용/쿼터 리스크 없이 안정적으로 동기화.
- Implementation delivers:
  - date-keyed map에서 root onValue 대신 범위 쿼리로 구독하여 “작은 변경 → 전체 subtree 재다운로드” 패턴을 완화
  - 스타트업에서 bulk `get()`을 제거해 “같은 데이터 2번 다운로드”를 제거
  - 레거시 루트 리스너 진입점을 차단해, 실수로 폭주 경로가 켜지는 리스크를 제거
  - DEV에서 이벤트당 bytes/읽기 패턴 계측이 더 정확해져 개선 폭 확인이 쉬움

# Test Coverage
- Unit: rtdbListenerRegistry key-range attach, syncCore instrumentation
- Integration/Smoke: (실행 결과 섹션에 기록)

# Test Execution Results
- `npx vitest run tests/sync-core.test.ts --reporter verbose` → PASS
- `npx vitest run tests/rtdb-listener-registry.test.ts tests/sync-engine-rtdb-range-listeners.test.ts --reporter verbose` → PASS
- `npx vitest run tests/smoke-sync-engine-basic.test.ts --reporter verbose` → PASS
- `npx vitest run tests/firebase-service-legacy-root-listeners-disabled.test.ts --reporter verbose` → PASS
- `npx vitest run tests/startup-firebase-initial-read-no-bulk-fetch.test.ts --reporter verbose` → PASS
- `npm test` → PASS (43 files, 515 tests)

# Outstanding Items
- OPEN QUESTION(Q1: Target Release) 관련: 사용자 명시적 결정으로 버전/릴리즈 단계는 수행하지 않음.
- (리스크) BW-01로 인해 “원격에만 존재하는 데이터”는 리스너 초기 스냅샷 도착 이후 UI에 반영됩니다(초기 로딩 중 잠깐의 지연 가능). 또한 “로컬만 존재 + 원격 비어있음”의 경우, 별도 부팅 업로드 정책이 없으면 즉시 업로드되지 않을 수 있습니다.
- DEV에서 실제 RTDB bandwidth는 SDK 한계로 추정치(JSON 직렬화 크기)이며, 네트워크 레벨 바이트는 수동 확인이 필요.

# Next Steps
- QA 실행 및 리포트 확인(qa/ 문서는 수정 금지)
- 필요 시 UAT

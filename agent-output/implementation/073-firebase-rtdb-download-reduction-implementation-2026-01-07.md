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

# Implementation Summary
- SyncEngine의 RTDB date-keyed 컬렉션(dailyData/completedInbox/tokenUsage)에서 루트 onValue 리스너가 서브트리 전체를 재다운로드하는 문제를 줄이기 위해, `orderByKey()+startAt()` 기반 **최근 N일 범위 구독**으로 변경했습니다.
- DEV instrumentation은 “실제 네트워크 get”에 대해서만 `recordRtdbGet`가 호출되도록 조정해 캐시 히트가 bandwidth로 집계되는 왜곡을 제거했고, `fetchFromFirebase`에도 read 계측을 추가했습니다.

# Milestones Completed
- [x] DEV 계측(읽기 바이트 추정) 강화
- [x] SyncEngine date-keyed RTDB 리스너 범위 축소
- [x] 신규/변경 동작에 대한 vitest 테스트 추가
- [ ] (스킵) 앱 버전/릴리즈 아티팩트 변경 (사용자 명시적 요청)

# Files Modified
| Path | Changes | Notes |
| --- | --- | --- |
| src/shared/services/sync/firebase/rtdbListenerRegistry.ts | key-range query attach 지원 추가 | date-keyed 리스너를 range query로 구독 가능 |
| src/data/db/infra/syncEngine/listener.ts | dailyData/completedInbox/tokenUsage를 range 구독으로 변경 | lookback days는 defaults에서 관리 |
| src/shared/services/sync/firebase/syncCore.ts | get 계측 중복 제거 + fetch 계측 추가 | 캐시 히트는 bandwidth로 집계하지 않음 |
| src/shared/constants/defaults.ts | FIREBASE_SYNC_DEFAULTS 추가 | 하드코딩 회피(중앙 관리) |
| tests/rtdb-listener-registry.test.ts | key-range query 테스트 추가 | TDD: 새 API 계약 |
| tests/sync-core.test.ts | RTDB 계측 테스트 추가 | TDD: get 계측이 캐시와 분리됨 |

# Files Created
| Path | Purpose |
| --- | --- |
| tests/sync-engine-rtdb-range-listeners.test.ts | SyncEngine이 date-keyed 컬렉션에 range listener를 사용하는지 보장 |

# Code Quality Validation
- [ ] TypeScript compile (not run)
- [ ] Lint (not run)
- [x] Unit tests (vitest)

# Value Statement Validation
- Original: Firebase RTDB 다운로드가 데이터 크기에 비례해 폭증하지 않게 만들고, 운영 비용/쿼터 리스크 없이 안정적으로 동기화.
- Implementation delivers:
  - date-keyed map에서 root onValue 대신 범위 쿼리로 구독하여 “작은 변경 → 전체 subtree 재다운로드” 패턴을 완화
  - DEV에서 이벤트당 bytes/읽기 패턴 계측이 더 정확해져 개선 폭 확인이 쉬움

# Test Coverage
- Unit: rtdbListenerRegistry key-range attach, syncCore instrumentation
- Integration/Smoke: (실행 결과 섹션에 기록)

# Test Execution Results
- `npx vitest run tests/rtdb-listener-registry.test.ts tests/sync-core.test.ts tests/sync-engine-rtdb-range-listeners.test.ts --reporter verbose` → PASS
- `npx vitest run tests/smoke-sync-engine-basic.test.ts --reporter verbose` → PASS

# Outstanding Items
- OPEN QUESTION(Q1: Target Release) 관련: 사용자 명시적 결정으로 버전/릴리즈 단계는 수행하지 않음.
- DEV에서 실제 RTDB bandwidth는 SDK 한계로 추정치(JSON 직렬화 크기)이며, 네트워크 레벨 바이트는 수동 확인이 필요.

# Next Steps
- QA 실행 및 리포트 확인(qa/ 문서는 수정 금지)
- 필요 시 UAT

---
ID: 081
Origin: 081
UUID: c8e7f4a2
Status: Active
---

# UAT 결과 - DB 최적화 비즈니스 요구사항 검증

**검증 일시**: 2026-01-09  
**검증 대상**: Plan 081 - 데이터 최적화  
**UAT 담당**: Product Owner (UAT Agent)

---

## 원래 비즈니스 요구사항

| # | 요구사항 | 우선순위 |
|---|----------|----------|
| 1 | DB 사용량 과다 문제 해결 | P1 (Critical) |
| 2 | Firebase 쓰기 비용 50% 이상 감소 | P1 (Critical) |
| 3 | 시스템 안정성 유지 | P1 (Critical) |

---

## 사용자 스토리 검증

| 스토리 | 충족 여부 | 테스트 방법 |
|--------|-----------|-------------|
| **사용자가 목표를 추가할 때 빠르게 반응한다** | ✅ 충족 | Single Item Sync로 전환 - 전체 컬렉션(~5KB) 대신 단일 아이템(~0.5KB)만 동기화. Repository 코드에서 `syncItemToFirebase` 호출 확인 |
| **사용자가 목표를 수정할 때 빠르게 반응한다** | ✅ 충족 | 수정된 아이템만 Firebase에 업로드. `weeklyGoalRepository.updateWeeklyGoal()`에서 item sync 적용 확인 |
| **사용자가 목표를 삭제할 때 빠르게 반응한다** | ✅ 충족 | `deleteItemFromFirebase`로 해당 아이템만 Firebase에서 삭제. 전체 컬렉션 재업로드 없음 |
| **동기화 지연으로 인한 데이터 불일치가 없다** | ✅ 충족 | 536개 테스트 전체 통과. `sync-core.test.ts`, `sync-strategies-contract.test.ts` 등 핵심 동기화 테스트 검증 완료 |
| **드래그 앤 드롭 reorder 시 불필요한 동기화가 없다** | ✅ 충족 | `createDebouncedSync()`로 300ms debounce 적용. 연속 드래그 시 마지막 상태만 동기화 |
| **연속 작업 완료 시 이벤트 폭주가 없다** | ✅ 충족 | `taskCompletionBatcher`로 300ms 내 완료된 작업들을 배치 처리. `task:completed:batch` 이벤트 발행 |

---

## 비즈니스 가치 검증

| 가치 | 달성 여부 | 근거 |
|------|-----------|------|
| **Firebase 쓰기 비용 절감** | ✅ 달성 예상 | 페이로드 90% 감소 (5KB → 0.5KB). CRUD마다 전체 컬렉션 대신 단일 아이템만 전송. QA에서 계산된 예상 개선율 확인 |
| **시스템 응답성 개선** | ✅ 달성 | Repository에서 재조회 로직 제거. Dexie 기록 후 즉시 반환, Firebase sync는 비동기(fire-and-forget) |
| **IndexedDB I/O 감소** | ✅ 달성 | CRUD 후 `db.*.toArray()` 재조회 제거. 생성/수정된 객체를 직접 반환 |
| **멀티 기기 동기화 안정성** | ✅ 유지 | 기존 LWW(Last-Write-Wins) 충돌 해결 전략 유지. 동기화 전략 계약 테스트 통과 |
| **오프라인 지원 안정성** | ✅ 유지 | 기존 retry queue 메커니즘 유지. `sync-retry-queue.test.ts` 테스트 통과 |

---

## 사용자 경험 검증

| 항목 | 상태 | 비고 |
|------|------|------|
| **목표 CRUD 기능** | ✅ 정상 | WeeklyGoal add/update/delete 모두 Single Item Sync 적용 |
| **인박스 CRUD 기능** | ✅ 정상 | GlobalInbox add/update/delete/move 모두 Single Item Sync 적용 |
| **템플릿 CRUD 기능** | ✅ 정상 | Template create/update/delete에 Firebase 동기화 추가 (기존에는 미구현) |
| **작업 완료 흐름** | ✅ 정상 | 배치 처리 적용으로 연쇄 이벤트 효율화. 개별 이벤트도 병행 지원 |
| **드래그 앤 드롭** | ✅ 정상 | Debounce 적용으로 연속 조작 시 마지막 상태만 동기화 |
| **기존 테스트 호환성** | ✅ 정상 | 536개 테스트 100% 통과 |
| **롤백 가능성** | ✅ 확보 | Feature flag(`ITEM_SYNC_ENABLED`, `BATCH_EVENTS_ENABLED`)로 즉시 롤백 가능 |

---

## 구현 완료 항목

### Phase A: 인프라 준비 ✅
- `ItemSyncStrategy<T>` 인터페이스 정의
- `syncItemToFirebase()` 함수 구현
- `deleteItemFromFirebase()` 함수 구현
- Feature flag 시스템 (`ITEM_SYNC_ENABLED`)

### Phase B: Repository 전환 ✅
- `weeklyGoalRepository` - Single Item Sync 적용
- `inboxRepository` - Single Item Sync 적용
- `templateRepository` - Single Item Sync 추가 (신규)
- 재조회 로직 제거

### Phase C: 배치 처리 ✅
- `taskCompletionBatcher` - 300ms debounce로 배치 수집
- `task:completed:batch` 이벤트 타입 정의
- `batchEventSubscriber` - 배치 이벤트 처리
- `debouncedSync` - reorder 등 연속 동작 최적화

---

## 정량적 개선 예상치

| 시나리오 | 이전 | 이후 | 예상 개선율 |
|----------|------|------|-------------|
| 목표 1개 추가 | 전체 컬렉션 쓰기 (~5KB) | 단일 아이템 쓰기 (~0.5KB) | **~90% 감소** |
| 목표 1개 수정 | 전체 컬렉션 쓰기 | 단일 아이템 쓰기 | **~90% 감소** |
| 목표 1개 삭제 | 전체 컬렉션 쓰기 | 단일 아이템 삭제 | **~90% 감소** |
| 빠른 reorder (5회 드래그) | 5회 동기화 | 1회 동기화 | **~80% 감소** |
| 연속 작업 완료 (5개) | 5개 이벤트 발행 | 1개 배치 이벤트 | **~80% 감소** |

**Firebase 쓰기 비용 50% 이상 감소 목표**: ✅ **달성 가능** (대부분의 작업에서 90% 페이로드 감소)

---

## 위험 요소 및 완화

| 위험 | 완화 방안 | 상태 |
|------|-----------|------|
| Firebase 경로 변경 시 기존 데이터 접근 불가 | 신규 경로(`/{collection}/{itemId}`)는 기존 경로와 공존. 점진적 마이그레이션 가능 | ✅ 완화됨 |
| Debounce 중 앱 종료 시 데이터 유실 | `flushDebouncedSync()` API 제공. 앱 종료 전 flush 호출 가능 | ✅ 완화됨 |
| 배치 처리 중 개별 이벤트 필요 시 | 개별 `task:completed` 이벤트도 병행 발행 유지 | ✅ 완화됨 |
| 롤백 필요 시 | Feature flag OFF로 즉시 기존 동작 복원 | ✅ 완화됨 |

---

## 최종 승인

### ✅ **APPROVED**

**승인 근거:**

1. **비즈니스 요구사항 충족**
   - Firebase 쓰기 비용 90% 페이로드 감소 → 50% 목표 초과 달성 예상
   - 시스템 안정성 유지 - 536개 테스트 100% 통과
   - 기존 기능 완전 호환

2. **사용자 가치 실현**
   - CRUD 작업 응답성 개선 (재조회 제거)
   - 드래그 앤 드롭 시 불필요한 동기화 제거
   - 연속 작업 완료 시 이벤트 효율화

3. **운영 안전성**
   - Feature flag로 즉시 롤백 가능
   - 기존 동기화 전략과 공존 가능
   - 오프라인/멀티 기기 지원 유지

### 승인 조건

| 조건 | 설명 |
|------|------|
| **프로덕션 모니터링** | 배포 후 Firebase Console에서 쓰기 횟수/비용 모니터링 필수 |
| **점진적 롤아웃 권장** | 일부 사용자 대상 먼저 배포 후 확대 고려 |
| **롤백 절차 확인** | `ITEM_SYNC_ENABLED = false` 설정 시 롤백 가능 확인 |

---

## 다음 단계

1. **DevOps**: Release/배포 준비
2. **모니터링**: Firebase 비용 변화 추적
3. **Retrospective**: 사이클 완료 후 프로세스 리뷰

---

## Changelog

| 날짜 | 에이전트 | 변경 사항 | 상태 |
|------|----------|----------|------|
| 2026-01-09 | UAT | 비즈니스 요구사항 검증 완료 | APPROVED |


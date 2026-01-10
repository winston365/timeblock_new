---
ID: 86
Origin: 86
UUID: 6f2c9a1d
Status: Active
---

# 데이터 최적화 실행 로드맵

## Value Statement and Business Objective
As a local-first 사용자(오빠 포함), I want 인박스/완료 인박스 동기화가 “변경량에 비례”해서 동작하고(불필요한 전체 스캔/전체 재작성 제거), so that 토글/동기화가 더 빠르고 안정적이며 Firebase 비용과 데이터 정합성 리스크가 줄어든다.

## 1. 실행 개요
- 전체 타임라인: 3주 (+1주 선택적)
- 총 PR 수: 6개 (핵심 4개 + 선택 1개 + 릴리즈/정리 1개)
- 서비스 영향: 
  - Phase 1: 낮음 (중복 호출 제거)
  - Phase 2: 중간 (Remote→Local 적용 로직 변경, 플래그로 단계적 롤아웃)
  - Phase 3(선택): 낮음~중간 (CompletedInbox write-path 최적화)

### 코드 기반으로 확인된 현재 병목(증거)
- Inbox 토글이 “이중 동기화”를 유발
  - [src/data/repositories/inboxRepository.ts](src/data/repositories/inboxRepository.ts)에서 `toggleInboxTaskCompletion()`이 `withFirebaseSync(syncBothInboxTablesToFirebase, ...)`를 호출
  - 같은 토글은 SyncEngine hook도 트리거: [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts) CompletedInbox 훅이 `db.completedInbox.toArray()` 후 날짜별 sync 수행
- CompletedInbox RTDB 리스너가 “변경 1회 → 로컬 전체 재작성(clear→bulkPut)” 수행
  - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)에서 `completedInboxByDate`를 합쳐 `db.completedInbox.clear()` 후 `bulkPut()`

### Feature Flag 원칙
- 각 단계는 “구현 + 플래그(기본 OFF) + 로그/계측 + 롤백 경로”를 함께 제공
- 기본은 빌드타임 플래그([src/shared/constants/featureFlags.ts](src/shared/constants/featureFlags.ts))로 시작
- 고위험 변경(DI-2)은 필요 시 runtime kill-switch(systemState) 옵션을 별도 PR로 추가 가능

### Target Release
- 현재 앱 버전: 1.0.191 ([package.json](package.json))
- 권장 릴리즈 라인: 1.0.192~1.0.194 (PR 단위로 패치 릴리즈 분할)
- OPEN QUESTION: 이 작업들을 “한 번에 묶어 릴리즈”할지, “PR별로 패치 릴리즈”할지 확정 필요

---

## 2. Phase 1: Quick Win (Week 1)

### PR-1: 인박스 토글 이중 동기화 제거 (DI-3)
- **목적**: `toggleInboxTaskCompletion()`에서 manual full sync 호출을 제거/비활성화하여 중복 스캔·중복 동기화를 즉시 제거
- **변경 범위**:
  - [src/data/repositories/inboxRepository.ts](src/data/repositories/inboxRepository.ts)
  - (선택) [src/shared/constants/featureFlags.ts](src/shared/constants/featureFlags.ts) — 안전 플래그 추가 시
- **의존성**: 없음
- **예상 작업 시간**: 2–4시간
- **테스트 계획**:
  - [ ] 단위 테스트: 기존 테스트 보강(토글 후 로컬 상태 이동 보장)
  - [ ] 통합 테스트: `npm test` (특히 inbox/sync 관련 스모크)
  - [ ] 수동 검증: 토글 연속 20회 시 UI 지연/깜빡임/동기화 오류 없음
- **검증 기준 (AC)**:
  - 토글 1회당 “manual full sync로 인한 toArray 2회”가 더 이상 발생하지 않음(로그/계측으로 확인)
  - SyncEngine 경로만으로도 GlobalInbox/CompletedInbox 원격 반영이 유지됨
- **롤백 계획**:
  - PR revert 또는 플래그(도입 시)로 기존 동작 재활성화
- **Feature Flag**:
  - 기본: 필요 없음(변경 자체가 안전한 제거)
  - 선택: `FEATURE_FLAGS.INBOX_TOGGLE_FULL_SYNC_FALLBACK` 같은 형태로 “예외 시 원복 경로” 제공

---

## 3. Phase 2: Core Optimization (Week 2–3)

### PR-2: CompletedInbox RTDB→Dexie 증분 적용 스캐폴딩 + 플래그(기본 OFF) (DI-2 준비)
- **목적**: 로직 전환 전, 증분 적용 모드를 안전하게 주입할 구조(플래그/로깅/경계)를 마련
- **변경 범위**:
  - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)
  - (선택) [src/shared/constants/featureFlags.ts](src/shared/constants/featureFlags.ts)
  - (선택) [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts) + [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts) — runtime kill-switch가 필요할 때만
- **의존성**: PR-1 이후 권장(동일 영역 충돌 최소화)
- **예상 작업 시간**: 0.5–1일
- **테스트 계획**:
  - [ ] 단위 테스트: RTDB 이벤트 처리 함수(가능한 범위에서) 분리 시
  - [ ] 통합 테스트: `npm test` + sync 관련 테스트 파일들 중심
  - [ ] 수동 검증: 플래그 OFF에서 동작 100% 동일
- **검증 기준 (AC)**:
  - 플래그 OFF일 때 기존 `clear→bulkPut` 경로 그대로 유지
  - 플래그 ON일 때 “증분 경로”로 분기되며, 성공/실패 로그가 남음
- **롤백 계획**:
  - 플래그 OFF(또는 PR revert)
- **Feature Flag**:
  - `FEATURE_FLAGS.COMPLETED_INBOX_INCREMENTAL_RTD_APPLY_ENABLED` (권장, 기본 OFF)

### PR-3: CompletedInbox RTDB→Dexie 증분 동기화 전환 (DI-2)
- **목적**: 원격 dateKey 변경을 “해당 dateKey의 diff”로 로컬에 반영하여, 전체 `clear→bulkPut`를 제거
- **변경 범위**:
  - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)
  - (필요 시) [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts) — 스키마/인덱스 변경이 정말 필요할 때만
- **의존성**: PR-2 이후
- **예상 작업 시간**: 2–4일
- **테스트 계획**:
  - [ ] 단위 테스트: diff 로직이 분리될 경우
  - [ ] 통합 테스트: `npm test` + SyncEngine smoke
  - [ ] 수동 검증: 두 디바이스에서 같은 날짜에 완료 토글 시 로컬 깜빡임/데이터 유실 없음
- **검증 기준 (AC)**:
  - 원격에서 특정 dateKey만 변경되어도 로컬 `completedInbox`가 “다른 날짜 데이터까지 삭제”되지 않음
  - `db.completedInbox.clear()`가 CompletedInbox 리스너 경로에서 더 이상 호출되지 않음(플래그 ON에서)
  - clear/bulkPut 사이 “순간적 empty” 상태로 인한 UI/쿼리 불안정이 사라짐
- **롤백 계획**:
  - 플래그 OFF로 즉시 기존 경로 복귀(또는 PR revert)
- **Feature Flag**:
  - PR-2에서 도입한 동일 플래그 사용

### PR-4: 증분 모드 기본값 전환 + 레거시 경로 축소(안정화 이후)
- **목적**: 증분 모드가 충분히 안정적일 때 기본 ON으로 전환하고, 레거시 코드를 축소해 유지보수 비용을 줄임
- **변경 범위**:
  - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)
  - [src/shared/constants/featureFlags.ts](src/shared/constants/featureFlags.ts)
- **의존성**: PR-3 안정화 확인 이후
- **예상 작업 시간**: 0.5–1일
- **테스트 계획**:
  - [ ] 통합 테스트: `npm test`
  - [ ] 수동 검증: 설치/재시작/리더락(멀티윈도우) 시나리오에서 리스너가 정상
- **검증 기준 (AC)**:
  - 기본 설정에서 증분 모드가 활성화되고, 사용자 영향(깜빡임/유실)이 없다
- **롤백 계획**:
  - 플래그 기본값을 다시 OFF로 되돌린 패치 릴리즈
- **Feature Flag**:
  - 동일(기본값만 변경)

---

## 4. Phase 3: Polish (Week 4, 선택적)

### PR-5: CompletedInbox write-path 스마트 캐싱(Dirty Date Tracking) (DI-1)
- **목적**: CompletedInbox 변경 시 매번 전체 `toArray()` 스캔/그룹화를 하지 않고 “변경된 dateKey만” debounce 후 sync
- **변경 범위**:
  - [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts)
  - (선택) [src/shared/constants/featureFlags.ts](src/shared/constants/featureFlags.ts)
  - (선택) [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts) — 인덱스가 필요하다고 결론 나면
- **의존성**: PR-3/4 이후 권장(동기화 경로를 먼저 안정화)
- **예상 작업 시간**: 2–3일
- **테스트 계획**:
  - [ ] 단위 테스트: dirty set / dateKey 계산 로직 분리 시
  - [ ] 통합 테스트: `npm test`
  - [ ] 수동 검증: 완료 작업 500건 환경에서 토글 시 CPU/지연 체감 감소
- **검증 기준 (AC)**:
  - CompletedInbox 변경 1회가 “전체 스캔”이 아니라 “해당 dateKey만” 동기화하도록 동작
  - debounce(현재 750ms) 의미가 유지됨
- **롤백 계획**:
  - 플래그 OFF로 기존 전체 스캔 방식 복귀
- **Feature Flag**:
  - `FEATURE_FLAGS.COMPLETED_INBOX_DIRTY_DATE_SYNC_ENABLED` (권장, 기본 OFF)

---

## 5. Version & Release (마무리 PR)

### PR-6: 버전/릴리즈 아티팩트 업데이트
- **목적**: 위 PR 스택이 실제 릴리즈에 반영되도록 버전/CHANGELOG 정리
- **변경 범위**:
  - [package.json](package.json)
  - (필요 시) README/릴리즈 노트 문서
- **의존성**: 릴리즈에 포함될 PR들이 머지된 뒤
- **예상 작업 시간**: 0.5시간
- **테스트 계획**:
  - [ ] `npm test`
- **검증 기준 (AC)**:
  - 릴리즈 버전이 계획한 target line과 일치
  - 릴리즈 노트에 “인박스 토글 동기화 최적화 / CompletedInbox 증분 적용”이 사용자 영향 관점으로 요약됨
- **롤백 계획**:
  - 릴리즈 revert(필요 시)

---

## 6. 의존성 다이어그램

PR-1 ────────────────┐
                     ├──> PR-2 ──> PR-3 ──> PR-4
                     │
                     └────────────> PR-5 (선택)

(모든 완료 후) PR-6 (버전/릴리즈)

---

## 7. 리스크 레지스터

| 리스크 | 영향 | 확률 | 완화 방안 |
|---|---:|---:|---|
| DI-2 증분 적용이 일부 케이스에서 누락/중복을 만들 수 있음 | 높음(정합성) | 중간 | 플래그 기본 OFF → 점진적 ON, SyncEngine operationQueue 유지, 로그로 차이 감지 |
| 현재 CompletedInbox 리스너의 `clear→bulkPut`가 “lookback 밖 데이터”를 지우는 부작용일 수 있음 | 높음(잠재 데이터 유실) | 미상 | PR-3에서 “다른 날짜/범위 데이터 보존”을 AC로 고정하고 수동 검증 |
| PR-1에서 manual full sync 제거 후 일부 환경에서 원격 반영 지연 | 중간 | 낮음 | SyncEngine 훅 경로 확인, 실패 시 fallback 플래그 또는 빠른 revert |
| 동시 진행 중인 다른 Sync/Bandwidth 작업과 파일 충돌 | 중간 | 중간 | [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) 변경은 PR 단위로 작게, 머지 순서 고정 |

---

## 8. 성공 지표 (KPI)
- Firebase 쓰기 횟수(또는 syncToFirebase 호출 수) 감소: Inbox 토글 기준 체감 30–60% 감소(중복 경로 제거)
- 인박스 토글 응답 체감: “연속 토글 시” 백그라운드 부하 감소(로그로 Dexie toArray 호출 수 3→1 수준 목표)
- Dexie clear→bulkPut 제거: CompletedInbox Remote→Local 경로에서 `clear()` 호출 0회(증분 모드 ON 기준)

---

## 9. 커뮤니케이션 계획
- 릴리즈 노트 포함 사항
  - “인박스 완료 토글 동기화 최적화: 중복 동기화 제거”
  - “완료 인박스 원격 변경 반영 안정화: 전체 재작성 제거(깜빡임/유실 리스크 감소)”
- 사용자 영향 고지
  - 기능 변화는 없고, 성능/안정성 개선 목적(데이터 유실/충돌 이슈 발생 시 빠른 롤백 가능)을 명시

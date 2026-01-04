# Firebase RTDB 다운로드 누수(4.95GB) — PR 단위 작업 분해

## Plan Header
- Plan ID: plan-2025-12-18-firebase-rtdb-download-leak-pr-breakdown
- Target Release: 1.0.158 (제안, 현재 1.0.157 기준 patch)
- Epic Alignment: ADR-006 “폭주 방지(Containment) 우선” 기반 Phase 0→1→2→3 단계적 완화
- Status: Draft

## Value Statement and Business Objective
As a 사용자, I want to Firebase RTDB에서 저장량 대비 과도한 다운로드가 발생하지 않도록 동기화 읽기/리스너를 통제하고 원인을 계측해서, so that 비용 폭증과 성능/데이터 소모를 즉시 줄이고 재발을 방지할 수 있다.

## Scope / Constraints
- 대상: RTDB 동기화 계층(초기 fetch, onValue 리스너, syncToFirebase pre-get/쓰기 패턴) 및 최소한의 설정 UI
- 백엔드/DB 구조 변경 없이 시작(ADR-006 Phase 0/1 우선)
- localStorage 금지(테마 예외만), 플래그 저장은 `Dexie.systemState` + Repository 경유
- UI에서 Firebase SDK 직접 호출 금지(현 경계 유지)
- PR은 “작게/되돌리기 쉽게”: 각 PR 단독 배포 가능 + revert/플래그 OFF로 즉시 원복

## Known Hotspots (근거)
- 초기 전체 읽기: `fetchDataFromFirebase()`가 다수 루트 `get()`
- 루트 리스너: `syncEngine.startListening()`이 여러 컬렉션 루트에 `onValue()`
- 쓰기 시 추가 읽기: `syncToFirebase()`가 사전 `get()` 후 `set()`
- 전체 컬렉션 업로드: Dexie hook에서 `toArray()` 후 통째 업로드(templates/globalInbox/shopItems/completedInbox)

---

# PR 브레이크다운 (6 PR, 독립 배포 가능)

## PR#1 — Observability: RTDB 다운로드/리스너/프리겟 계측(기본 OFF)
- 목표: “어디서(경로/오퍼레이션) 얼마나(추정 bytes) 얼마나 자주(횟수/분) 다운로드가 나는지”를 앱 내부에서 수치로 확보
- 스코프
  - `onValue` 콜백 빈도/스냅샷 크기 추정(경로별)
  - `fetchDataFromFirebase` 경로별 `get()` 수행 및 수신 크기 추정
  - `syncToFirebase` pre-get/업로드 payload 크기 추정 + 호출 빈도
  - 리스너 등록 카운트/렌더러 인스턴스 식별자(중복 탐지)
  - 로그 폭주 방지(샘플링/상한) + 기본값 OFF
- 주요 파일(후보)
  - src/data/db/infra/syncEngine.ts
  - src/shared/services/sync/firebaseService.ts
  - src/shared/services/sync/firebase/syncCore.ts
  - src/shared/services/sync/syncLogger.ts
  - src/data/repositories/systemRepository.ts (플래그/샘플링 저장)
  - src/features/settings/SyncLogModal.tsx (표시 최소 확장, 필요 시)
- Acceptance Criteria
  - 계측 OFF(기본)일 때: 기존 동작/성능/로그 양이 유의미하게 증가하지 않음
  - 계측 ON일 때: 경로별 `onValue`/`get`/`pre-get` 이벤트가 식별 가능하고, 각 이벤트에 bytes 추정치가 기록됨
  - 계측 자체가 원격 읽기/쓰기를 추가로 발생시키지 않음(로컬 로그만)
- Risk / Rollback
  - 리스크: 로그 폭주로 Dexie/렌더 성능 저하
  - 롤백: 계측 플래그 OFF 또는 PR revert(동작 변경 없음)

## PR#2 — Containment Controls: 킬스위치 + 경로별 게이트 + Safe Mode(설정 UI 포함)
- 목표: 폭주가 재현/의심될 때 즉시 “초기 fetch / 리스너 / 쓰기”를 선택적으로 차단해 다운로드를 멈출 수 있게 함(기본값은 현행 유지)
- 스코프
  - 글로벌 `firebaseSync.enabled`(완전 중지)
  - `initialFetch.enabled`, `listen.{path}`(경로별), (옵션) `write.enabled` 토글
  - `safeMode` 프리셋: 대형 경로(예: completedInbox/globalInbox/templates/dailyData) 우선 OFF 프로파일
  - 설정 UI: Firebase 설정 탭에 “고급(Advanced)” 섹션으로 최소 토글 제공(사용자 혼란 최소)
- 주요 파일(후보)
  - src/data/db/infra/useAppInitialization.ts
  - src/shared/services/sync/firebaseService.ts
  - src/data/db/infra/syncEngine.ts
  - src/data/repositories/systemRepository.ts
  - src/features/settings/SettingsModal.tsx
  - src/features/settings/components/tabs/FirebaseTab.tsx
- Acceptance Criteria
  - 킬스위치 OFF 시: RTDB 초기 fetch/리스너 시작/쓰기가 수행되지 않으며, 앱은 로컬(Dexie) 기반으로 정상 사용 가능
  - 경로별 listen OFF 시: 해당 경로 리스너가 등록되지 않음(계측 PR#1의 등록 카운트로 확인 가능)
  - Safe Mode ON 시: 사전에 정의된 “대형 경로”가 일괄적으로 차단됨
- Risk / Rollback
  - 리스크: 동기화 중단으로 멀티디바이스 최신화 지연/누락
  - 롤백: 토글을 현행(ON)으로 복구 또는 PR revert

## PR#3 — Listener Hygiene: startListening 중복 방지 + stopListening 도입 + 멀티윈도우 중복 완화
- 목표: 동일 세션/재초기화/다중 창에서 리스너가 중복 등록되어 다운로드가 배수로 늘어나는 문제를 구조적으로 차단
- 스코프
  - `startListening()`의 idempotent 보장(중복 호출 시 기존 리스너 재사용 또는 no-op)
  - `stopListening()` 제공 및 호출 지점 연결(로그아웃/설정 저장 후 재초기화/창 종료 등)
  - (선택) 멀티 윈도우 리더 선출(soft lock): 한 렌더러만 listen 활성, 나머지는 listen OFF(Phase 0 플래그와 결합)
- 주요 파일(후보)
  - src/data/db/infra/syncEngine.ts
  - src/shared/services/sync/firebase/firebaseClient.ts (재초기화와 생명주기 정렬)
  - src/data/db/infra/useAppInitialization.ts
  - src/features/settings/SettingsModal.tsx (재초기화 흐름)
- Acceptance Criteria
  - 동일 런타임에서 `startListening()`이 여러 번 호출되어도 리스너 수가 증가하지 않음
  - `stopListening()` 호출 후에는 더 이상 `onValue` 콜백이 발생하지 않음
  - 2창 시나리오에서 “리스너 중복”이 탐지/완화됨(리더 1개만 활성)
- Risk / Rollback
  - 리스크: stopListening 타이밍 오류로 실시간 동기화가 끊김
  - 롤백: 리더 선출 기능 OFF(플래그) + PR revert(이전 단순 리스닝으로 복귀)

## PR#4 — Phase 2(부분): 대형 경로 리스너/초기 fetch 범위 축소(기능은 유지, 기본 OFF/실험 플래그)
- 목표: 원인 TOP 후보(대형 컬렉션 루트 onValue/초기 전체 get)에서 “서브트리 전체 스냅샷 반복 다운로드”를 줄이는 구체적 행동 변경을 도입
- 스코프(계측 PR#1 결과를 반영해 최소 범위로)
  - 리스너 범위 축소: 루트 `onValue` → 더 작은 키 단위 또는 제한된 범위(예: 최근 N일)로 구독 전환
  - 초기 fetch 범위 축소: 반드시 필요한 경로만 eager-load, 나머지는 on-demand(화면 진입/사용 시)
  - 변경은 플래그로 게이트(기본 OFF)하여 안전하게 점진 적용
- 주요 파일(후보)
  - src/data/db/infra/syncEngine.ts
  - src/shared/services/sync/firebaseService.ts
  - src/shared/services/sync/firebase/syncUtils.ts (있다면 헬퍼)
  - src/features/schedule/ScheduleView.tsx (warmupPresetStrategy 등 추가 fetch 지점 정렬 필요 시)
- Acceptance Criteria
  - 플래그 ON 시: 대상 대형 경로에서 루트 스냅샷 반복 수신이 감소(계측 지표로 확인)
  - 플래그 OFF 시: 현행 동작 유지
  - 기능 회귀 최소: 로컬 데이터는 유지되며, 필요한 경우 on-demand로 원격 데이터를 가져올 수 있음
- Risk / Rollback
  - 리스크: 특정 화면에서 기대하던 “실시간” 업데이트 범위가 줄어듦
  - 롤백: 해당 플래그 OFF 또는 PR revert

## PR#5 — Phase 3(가드레일): 다운로드 예산(budget) 기반 자동 Safe Mode + 쓰기/로그 rate-limit
- 목표: 원인이 완전히 제거되지 않더라도 “폭주가 시작되면 자동으로 멈추는” 운영 안전장치를 제공
- 스코프
  - 세션/시간당 다운로드 추정치 budget 초과 시: 자동 Safe Mode 전환(리스너/초기 fetch 차단)
  - 로컬 변경→원격 쓰기 디바운스/배치(가능 범위 내, 큰 변경은 제외)
  - 계측/SyncLog도 동일하게 상한 적용(로그 폭주 방지)
- 주요 파일(후보)
  - src/shared/services/sync/syncLogger.ts
  - src/data/db/infra/syncEngine.ts
  - src/shared/services/sync/firebase/syncCore.ts
  - src/data/repositories/systemRepository.ts
- Acceptance Criteria
  - budget 초과 시 동기화가 자동으로 완화 모드로 전환되고, 이후 다운로드 관련 이벤트가 급격히 감소
  - 사용자는 로컬 앱 기능을 계속 사용할 수 있음(Local-first 보장)
- Risk / Rollback
  - 리스크: 과도하게 보수적인 budget으로 정상 사용자도 sync가 자주 꺼짐
  - 롤백: budget 기능 OFF(플래그) + 임계치 상향 또는 PR revert

## PR#6 — Version / Release Artifacts
- 목표: 릴리즈 버전/변경 요약을 반영해 배포 추적 가능하게 함
- 스코프
  - `package.json` 버전 1.0.158 반영(또는 팀 규칙에 따른 증가)
  - 사용자 영향이 큰 경우 README 또는 릴리즈 노트에 “Safe Mode/킬스위치/동기화 제한” 안내 추가
- 주요 파일(후보)
  - package.json
  - README.md (필요 시)
- Acceptance Criteria
  - 버전이 목표로 업데이트되고, 변경 요약이 릴리즈 아티팩트에 남음
- Risk / Rollback
  - 리스크: 버전만 올라가고 기능 배포가 누락
  - 롤백: 버전 커밋 revert(기능 PR과 분리되어야 함)

---

## 권장 순서 / 의존성
- 1) PR#1 (계측) → 2) PR#2 (킬스위치/게이트) → 3) PR#3 (리스너 생명주기) → 4) PR#4 (대형 경로 축소, 플래그 실험) → 5) PR#5 (자동 가드레일) → 6) PR#6 (버전)

## Testing / Validation (High-level)
- 정적: `npm run lint`
- 실행: `npm run electron:dev`로 1창/2창(QuickAdd 포함)에서 리스너 중복 및 다운로드 이벤트 폭주 여부 확인
- 자동: `npm test` (기존 vitest 스위트 회귀 확인)

## Notes / Open Questions
- **OPEN QUESTION**: Safe Mode 기본값을 “OFF(현행 유지)”로 둘지, 사고 대응 릴리즈에서는 “ON(보수적 기본)”으로 둘지 결정 필요(비용/UX 트레이드오프).
- **REQUIRES ANALYSIS (OPTIONAL)**: 계측 PR#1 결과 기반으로 ‘대형 TOP 3 경로’를 확정 후, PR#4의 범위를 최소화(불필요 리팩터 방지).

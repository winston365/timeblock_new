# 004-firebase-rtdb-mitigation-phased-architecture-findings

## Changelog
- 2025-12-18: RTDB 다운로드 스파이크(과다 리스너/풀 스냅샷/사전 get) 의심에 대한 **단계적·최소위험 완화 설계** 문서화.

## Problem Statement (요약)
Firebase RTDB 사용량에서 **저장량(수 MB) 대비 다운로드(수 GB)** 가 관측되었고, 레포 구조상 다음 패턴이 결합되면 “변경 1회 → 큰 서브트리 반복 다운로드”가 쉽게 발생한다.
- 앱 시작 시 `fetchDataFromFirebase()`가 여러 루트 경로를 `get()`로 병렬 전체 읽기
- `syncEngine.startListening()`이 여러 **컬렉션 루트**에 `onValue()` 리스너 등록
- 로컬 변경(Dexie hook)이 **전체 컬렉션 업로드** + `syncToFirebase()`의 사전 `get()`를 유발
- Electron 특성상 다중 렌더러(QuickAdd 등)에서 동일 리스너가 중복 등록될 위험

근거 분석 문서: [agent-output/analysis/011-firebase-rtdb-download-spike-analysis.md](../analysis/011-firebase-rtdb-download-spike-analysis.md)

## Repo Architectural Constraints (설계 제약)
- **Electron + React Renderer**: 동일 계정/동일 코드가 다중 창/프로세스에서 동시 실행될 수 있음 → 리스너 중복/다운로드 배수 위험.
- **Local-first**: Dexie가 진실 소스(오프라인 우선). Firebase는 “동기화/백업” 성격이므로, 동기화 중단은 UX 영향이 있지만 앱 기능 자체는 유지 가능해야 함.
- **Sync Layer 위치**: `src/shared/services/sync/firebase/*` (전략 기반) + `src/data/db/infra/syncEngine.ts` (Dexie hooks + 리스너 오케스트레이션) + `src/shared/services/sync/firebaseService.ts` (초기 fetch 등).
- **EventBus 규칙**: emit은 store/orchestrator만(원칙). 동기화 이벤트/로그도 store/subscriber에서 관측하도록 정렬 필요.
- **Dexie systemState**: 로컬 토글/플래그 저장은 `db.systemState`가 표준(테마 예외). → 기능 플래그는 systemState로 수용(Repository 경유).

## Design Goal
1) **Phase 0에서 즉시 폭주를 멈춤(Containment)**: 백엔드 변경 없이도 “대량 다운로드 트리거”를 차단.
2) **관측 가능(Phase 1)**: 어디서/얼마나/얼마나 자주 다운로드가 일어나는지 수치화.
3) **정합성(Phase 2)**: 루트 리스너/사전 get/전체 업로드 패턴을 구조적으로 완화.
4) **가드레일(Phase 3)**: 재발 방지(안전장치, 회귀 탐지, 운영 모드).

---

## Phase 0 — Immediate Containment (백엔드 변경 없이, 즉시 폭주 차단)
**목표**: “다운로드가 폭증할 수 있는 경로”를 **즉시 끊고**, 앱 기능을 최대한 유지.

### Containment Strategy (최소위험 순)
1) **Global Kill Switch (동기화 완전 중지)**
   - 렌더러에서 Firebase Sync를 완전히 끄는 단일 플래그.
   - 기본값은 현재 동작 유지(=ON) 대신, 사고 대응 모드에선 배포 즉시 OFF로 가능해야 함.
   - 저장소: `Dexie.systemState` (Repository 경유) — 로컬에서 즉시 토글 가능.

2) **Listener Hygiene 우선 차단(읽기 폭주 원인 1순위)**
   - `syncEngine.startListening()`의 루트 `onValue()` 리스너를 **경로별로 끌 수 있는 플래그** 제공.
   - 특히 대형 컬렉션 후보를 우선 차단:
     - `completedInbox`, `globalInbox`, `templates`, `dailyData` (우선순위 높음)
     - 나머지 `shopItems`, `tokenUsage`, `settings`, `gameState`는 상대적으로 낮음(실측 전 가정)

3) **Initial Full Fetch 제한(앱 시작 폭주 차단)**
   - `fetchDataFromFirebase()`의 병렬 `get()`을 경로별 플래그로 게이트.
   - “필수 최소 UX”만 유지하는 *Safe Mode* 구성(예: settings만 허용, 나머지 OFF).

4) **쓰기 관련 추가 읽기(사전 get) 우회 — 단, Phase 0에서는 보수적으로**
   - `syncToFirebase()`의 사전 `get()`은 정합성을 위한 동작이므로, Phase 0에서 무조건 제거는 위험.
   - 대신 우선순위는 “리스너 차단 + 초기 fetch 차단”으로 두고, 사전 get 우회는 Phase 2에서 정합성 설계와 함께 진행.

### Feature Flags (권장 구성)
- `firebaseSync.enabled` (global)
- `firebaseSync.initialFetch.enabled`
- `firebaseSync.listen.dailyData|globalInbox|completedInbox|templates|...` (path별)
- `firebaseSync.write.enabled` (쓰기 전체 차단 옵션 — 최후 수단)
- `firebaseSync.safeMode` (사전 정의된 보수적 프로파일)

### Verification (작게, 바로 검증)
- 1창 vs 2창(QuickAdd 포함)에서 콘솔/SyncLog를 관찰해 **다운로드 증폭이 멈추는지** 확인.
- 기능 플래그 OFF 시에도 앱이 Dexie 기반으로 정상 동작(작업 추가/완료/UI 렌더)하는지 확인.

### Affected Modules (Phase 0)
- Renderer init: `src/data/db/infra/useAppInitialization.ts`
- 초기 fetch: `src/shared/services/sync/firebaseService.ts`
- 리스너/Hook: `src/data/db/infra/syncEngine.ts`
- 플래그 저장: `Dexie.systemState` + 시스템/설정 repository

### Expected Impact
- **다운로드 비용 즉시 감소**(가장 큰 레버는 루트 onValue 차단)
- 동기화 지연/중단으로 인해 멀티디바이스 최신화는 일시적으로 약화(허용 가능한 트레이드오프)

---

## Phase 1 — Instrumentation / Observability (원인 확정)
**목표**: “어떤 경로/어떤 트리거가 다운로드를 얼마나 발생시키는지”를 수치로 확보.

### What to Measure (필수 지표)
1) `onValue` 콜백 빈도(경로별/세션별)
2) 수신 스냅샷 크기(대략 바이트/문자 길이)
3) `syncToFirebase()` 사전 `get()` 호출 빈도 + remote snapshot 크기
4) 업로드 payload 크기(특히 배열/맵)
5) 리스너 등록 횟수(중복 탐지), 렌더러 인스턴스 식별(창/프로세스)

### Where to Instrument (핵심 지점)
- `syncEngine.startListening()` 내부: 리스너 등록/콜백 초입
- `fetchDataFromFirebase()` 내부: 경로별 get 수행 전후
- `syncCore.syncToFirebase()` 내부: pre-get/merge/set 단계별 크기/시간
- SyncLog: `src/shared/services/sync/syncLogger.ts`에 “bytes_estimate, path, op, sourceInstanceId” 필드 확장(기존 UI에 노출은 최소)

### Safety Requirement
- 계측은 **기본 OFF** + 샘플링/상한(예: 1분당 로그 N개 제한) 적용이 필요.
- 계측으로 인해 더 많은 데이터 업로드/다운로드가 발생하면 안 됨(로그는 로컬 Dexie 중심).

### Verification
- “다운로드가 가장 큰 TOP 3 경로”를 실제 계측으로 확정.
- 2창 실행 시 리스너 중복 등록 여부(등록 카운트) 확정.

### Expected Impact
- 원인 가설을 데이터로 좁혀 Phase 2 수정 범위를 최소화.

---

## Phase 2 — Correctness Fixes (정합성 개선 + 다운로드 감소)
**목표**: 폭주의 구조적 원인을 제거하되, 데이터 정합성과 충돌 처리 정책을 유지.

### Fix Themes (우선순위)
1) **Listener Scope 축소**
   - 루트 `onValue()` → 더 작은 단위(예: 날짜 키 단위 `dailyData/{date}`, completedInbox 날짜 단위 등)로 축소.
   - 또는 RTDB 쿼리/구독 모델에 맞춘 “증분 수신(child_added/changed)”로 전환(가능 범위 내).

2) **Listener Lifecycle 명시화**
   - `startListening()`은 반드시 “unsubscribe/stopListening()”와 쌍을 이뤄야 함.
   - 앱 재초기화/로그아웃/유저 전환/창 종료 시 해제가 보장되어야 함.

3) **Full Collection Upload 제거(또는 최소화)**
   - Dexie hook에서 `toArray()` 후 전체 업로드 패턴은 대형 컬렉션에서 비용 폭증.
   - 최소 수정 경로: “변경된 엔티티만 업로드” 또는 “keyed map + 부분 업데이트”로 전환.

4) **syncToFirebase() 사전 get 최적화**
   - 충돌 검사 목적이 ‘정말 필요한 컬렉션’에만 사전 get 수행.
   - 안전한 조건부 생략(예: 단일-writer 보장 경로 / deviceId 기반 마지막 작성자 검증 등) 정책을 명시.

5) **Multi-window 단일화(선택)**
   - 같은 계정에서 여러 렌더러가 Firebase sync를 동시에 하지 않도록 **리더 선출(soft lock)** 고려.
   - 최소 구현은 “첫 창만 리스너 활성, 나머지는 읽기/쓰기 모두 OFF”로 Phase 0 플래그와 결합 가능.

### Verification
- Phase 1 계측으로 “수정 전/후 bytes, callback 횟수, pre-get 횟수” 비교.
- 오프라인/재접속/충돌 시나리오(동시 수정)에서 데이터 손실이 없는지 확인.

### Expected Impact
- 동기화는 유지하면서도 다운로드 비용을 **근본적으로 감소**.
- 코드 변경 범위는 sync layer 중심이지만, Repository/Store 경계는 유지해야 함.

---

## Phase 3 — Hardening (가드레일/운영 안전장치)
**목표**: 재발 방지와 “폭주 시 자동 안전모드 전환”까지 포함.

### Guard Rails
1) **Budget-based Safety Mode**
   - 세션당 다운로드 추정치가 임계치를 넘으면 자동으로 리스너를 끄고 Safe Mode로 전환(로컬).
   - 사용자에게는 “동기화 일시 중지” 배너/토스트 정도로만(UX 확장은 별도 결정).

2) **Rate Limiting & Debounce**
   - 로컬 변경→원격 쓰기를 디바운스/배치(예: 1~3초 윈도우)하여 쓰기 폭주를 줄임.
   - SyncLog/계측도 동일하게 상한.

3) **Regression Tripwires (CI/테스트)**
   - 단위 테스트: “리스너 중복 등록 방지”, “stopListening에서 off 호출 보장”, “pre-get 호출 정책” 등을 테스트.
   - E2E가 없으면 vitest 수준에서 모킹으로 최소 보장.

4) **Operational Switches**
   - 릴리즈 빌드에서만 적용되는 보수적 기본값(예: 대형 경로 listen OFF)
   - 개발/QA 빌드에서만 계측 ON 가능하도록 분리

### Expected Impact
- 운영 리스크(비용 폭증) 상시 감소.
- 장애 시 대응 시간 단축(자동/수동 세이프모드).

---

## Integration Requirements (필수 준수)
- 플래그/세이프모드 상태는 localStorage가 아닌 `Dexie.systemState`에 저장(테마 예외 규칙 유지).
- Repository/Sync 경계 준수: UI 컴포넌트가 Firebase SDK를 직접 호출하지 않도록 유지.
- EventBus 규칙 유지: sync 이벤트는 store/orchestrator에서 emit하고 subscriber에서 처리.

## Verdict
**APPROVED_WITH_CHANGES**
- Phase 0은 “리스너/초기 fetch 게이트” 중심으로 즉시 진행 가능.
- 단, Phase 2에서 pre-get 최적화/증분 업로드는 정합성 정책(충돌/단일-writer 가정)을 문서화한 뒤에만 허용.

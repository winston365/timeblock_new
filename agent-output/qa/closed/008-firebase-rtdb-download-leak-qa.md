# QA Report: Firebase RTDB 다운로드 누수(4.95GB) 수동 재현/검증

**Plan Reference**: `agent-output/planning/008-firebase-rtdb-download-leak-pr-breakdown.md`
**QA Status**: Awaiting Implementation
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-18 | User | 수동 재현 + 수정 후 검증 시나리오 작성 | RTDB 리스너/초기 fetch/동기화 트리거 중심 5개 재현 시나리오 + 계측/콘솔 지표 + 회귀 체크리스트 작성 |

## Timeline
- **Test Strategy Started**: 2025-12-18
- **Test Strategy Completed**: 2025-12-18
- **Implementation Received**: (TBD)
- **Testing Started**: (TBD)
- **Testing Completed**: (TBD)
- **Final Status**: Awaiting Implementation

---

## Test Strategy (Pre-Implementation)
### 목표(사용자 관점)
- “저장량은 수 MB인데 다운로드가 수 GB”가 되는 **다운로드 증폭(read amplification)** 을 사용자 플로우로 재현한다.
- 수정 후에는 **(1) 리스너 중복/누수 없음**, **(2) 초기 fetch/리스닝/쓰기 시 다운로드가 합리적**, **(3) 다중 창/오프라인/충돌 처리 회귀 없음**을 신호 기반으로 확인한다.

### ⚠️ TESTING INFRASTRUCTURE NEEDED
**필수 접근/환경**
- [ ] Firebase Console(프로젝트) 접근 권한: RTDB `Usage`/`Downloaded` 확인 가능
- [ ] DEV 모드 실행(계측 활성화): `npm run electron:dev` (DEV에서만 RTDB bytes 추정 로그 활성)
- [ ] 최소 1개 테스트 계정/DB 네임스페이스(실데이터 오염 방지)

**권장(재현력↑)**
- [ ] 2번째 장치(또는 2번째 Windows 사용자 세션/VM) 1대: 멀티디바이스 동기화/충돌 재현
- [ ] Quick Add(멀티 윈도우) 실행 가능: `Ctrl+Shift+Space` 또는 `?mode=quickadd`

**관측 포인트(앱 내부)**
- SyncLog UI: [src/features/settings/SyncLogModal.tsx](src/features/settings/SyncLogModal.tsx)
- 리스너 레지스트리 로그(DEV에서만 수치 로그): `RTDB listener attached/reused/detached`, `RTDB onValue event`
  - 구현: [src/shared/services/sync/firebase/rtdbListenerRegistry.ts](src/shared/services/sync/firebase/rtdbListenerRegistry.ts)
- 멀티윈도우 리더락 로그: `RTDB listener leader lock acquired`, `Skipped RTDB listeners (not leader window)`
  - 구현: [src/shared/services/sync/firebase/firebaseSyncLeaderLock.ts](src/shared/services/sync/firebase/firebaseSyncLeaderLock.ts)
- 초기 전체 fetch 로그: `Fetched initial data from Firebase`
  - 구현: [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts)

---

## Manual Reproduction Scenarios (3–6)
> ADHD-friendly 원칙: **한 시나리오 = 10분 내**, 체크박스 순서대로만 진행, 중간에 다른 화면/도구로 점프 최소화.

### 공통 사전 준비(모든 시나리오 공통)
- [ ] DEV로 실행: `npm run electron:dev`
- [ ] 앱에서 Firebase Sync가 켜져 있는 상태(또는 해당 플로우가 자동으로 초기화되는 상태)
- [ ] (가능하면) Settings에서 SyncLog 모달을 열 준비(아래 시나리오에서 “로그 확인” 단계에만 1회 진입)

**안전 Stop 조건(비용 폭주 방지)**
- [ ] SyncLog에 `RTDB onValue event`가 1초에 여러 줄로 쌓이고 `bytesEstimated`가 수십~수백 KB 이상으로 계속 증가하면 즉시 중단
- [ ] Firebase Console `Downloaded`가 분당 수십 MB 이상으로 증가하면 즉시 중단

---

### 시나리오 1) 콜드 스타트: 초기 전체 fetch + 루트 리스너 등록이 다운로드를 크게 유발
**의심 원인**: 시작 시 `fetchDataFromFirebase()`의 다중 `get()` + `SyncEngine.startListening()`의 다중 루트 `onValue`.

**Steps**
- [ ] (가능하면) 앱 완전 종료 후 재실행
- [ ] 앱 첫 화면이 뜰 때까지 대기(30~60초)
- [ ] Settings → SyncLog 모달 열기

**관측/기대 신호(재현 확인)**
- [ ] SyncLog에 `Fetched initial data from Firebase`가 1회 기록됨
- [ ] SyncLog에 `RTDB listeners started`가 1회 기록됨
- [ ] (DEV 계측) `RTDB listener attached` 로그가 8개 경로(dailyData/gameState/templates/shopItems/globalInbox/completedInbox/tokenUsage/settings) 수준으로 찍힘
- [ ] (DEV 계측) 직후 `RTDB onValue event`가 여러 경로에서 연속 발생(특히 `users/user/dailyData`, `.../completedInbox`, `.../globalInbox`)

**Firebase Console 확인(최소 컨텍스트 스위치 1회)**
- [ ] RTDB → Usage에서 실행 직후 `Downloaded` 증가폭을 스크린샷/수치로 기록

---

### 시나리오 2) 스케줄/블록 편집(High-churn): dailyData가 자주 변경될 때 다운로드가 증폭
**의심 원인**: 로컬 변경 → `syncToFirebase(dailyData)` pre-get + set + 루트 `onValue(dailyData)` 재수신.

**Steps**
- [ ] 오늘 날짜 스케줄 화면 진입
- [ ] 2분 동안 아래를 반복(최소 20회)
  - [ ] 작업 추가
  - [ ] 작업 이름 수정
  - [ ] 시간블록 이동/드래그
  - [ ] 완료 토글
- [ ] Settings → SyncLog 모달 열기(이미 열려있으면 그대로)

**관측/기대 신호(재현 확인)**
- [ ] `firebase sync` 로그가 짧은 간격으로 반복
- [ ] (DEV 계측) `RTDB onValue event`의 `path=users/user/dailyData`가 반복 증가
- [ ] (DEV 계측) `bytesEstimated`가 “작업 1회 변경 대비 과도하게 큼”으로 보이면 재현 성공(예: 매번 수십 KB~MB)

---

### 시나리오 3) 인박스(GlobalInbox) 대량 수정: 컬렉션 전체 업로드/수신으로 다운로드가 커지는지
**의심 원인**: globalInbox는 컬렉션 sync(전체 배열)이며, 변경마다 큰 payload + pre-get.

**Steps**
- [ ] 인박스 화면 진입
- [ ] 2분 동안 아래를 반복(최소 30회)
  - [ ] 작업 빠르게 추가/삭제
  - [ ] 여러 작업 이름 수정
  - [ ] 정렬/태그 변경(가능한 범위)
- [ ] Settings → SyncLog 모달 열기

**관측/기대 신호(재현 확인)**
- [ ] (DEV 계측) `RTDB onValue event`의 `path=users/user/globalInbox` 빈도가 높아짐
- [ ] (DEV 계측) globalInbox `bytesEstimated`가 배열 크기에 비례해 커짐
- [ ] 앱 체감: 입력 지연/버벅임이 발생하면 함께 기록(성능 증상)

---

### 시나리오 4) 완료 작업(CompletedInbox) 누적 + 반복 완료: 날짜 키가 많을수록 전체 수신이 커지는지
**의심 원인**: completedInbox는 date-keyed 루트 리스너로 전체 서브트리 재수신 위험.

**Steps**
- [ ] (준비) 완료 작업이 많은 상태가 아니라면, 작업을 여러 개 생성 후 완료 처리(최소 30개)
- [ ] 완료 처리 후 1분 대기
- [ ] Settings → SyncLog 모달 열기

**관측/기대 신호(재현 확인)**
- [ ] (DEV 계측) `RTDB onValue event`의 `path=users/user/completedInbox`가 발생
- [ ] completedInbox 데이터(날짜 키)가 많을수록 `bytesEstimated`가 커지는지 확인

---

### 시나리오 5) 멀티 윈도우(Quick Add)로 리스너 중복/다운로드 배수 재현
**의심 원인**: Electron 다중 렌더러에서 동일 리스너가 중복 등록되면 다운로드가 창 수만큼 증가.

**Steps**
- [ ] 메인 창을 실행한 상태에서 Quick Add 창을 연다(예: `Ctrl+Shift+Space` 또는 `?mode=quickadd`)
- [ ] 두 창을 동시에 2분 유지
- [ ] 메인 창에서 시나리오 2(스케줄 편집)에서 했던 변경을 10회만 수행
- [ ] Settings → SyncLog 모달 열기

**관측/기대 신호(재현 확인)**
- [ ] (리더락) 한 창에서는 `RTDB listener leader lock acquired` 로그가 보임
- [ ] (리더락) 다른 창에서는 `Skipped RTDB listeners (not leader window)` 로그가 보임
- [ ] (레지스트리) `RTDB listener attached`가 **창 수만큼 중복되지 않는지** 확인(중복되면 누수/버그 의심)
- [ ] (Firebase Console) 멀티윈도우 전/후 다운로드 증가 속도가 배수로 변하는지 비교

---

## Verification Steps After Fix (Measurable Signals)
> “PASS/FAIL을 숫자로” 남기기: 다운로드 바이트(추정치/콘솔), 리스너 카운트, 이벤트 빈도.

### A. 앱 내부 지표(DEV에서 가장 신뢰)
- [ ] SyncLog에서 `RTDB listener attached`가 경로당 1회 수준(재초기화/화면 전환 반복해도 무한 증가 금지)
- [ ] SyncLog에서 `RTDB listener reused`가 증가하더라도 `activeListeners`가 안정적으로 유지
- [ ] `RTDB listener detached`가 stop/재초기화/로그아웃 플로우에서 발생(누수 방지)
- [ ] `RTDB onValue event`의 `bytesEstimated`가 수정 전 대비 현저히 감소
  - 기준 예시(가이드): 작은 변경 1회당 dailyData/completedInbox/globalInbox가 매번 수십~수백 KB 이상이면 FAIL 후보

### B. Firebase Console 지표(운영 진실 소스)
- [ ] RTDB Usage → `Downloaded`가 “재현 시나리오 실행 시간대”에 폭증하지 않음
- [ ] 10분 수동 테스트 동안 `Downloaded` 증가량이 합리적 범위인지 기록
  - [ ] 기록 항목: 시작/끝 시각, 증가한 다운로드(대략), 수행한 시나리오 번호

### C. 성능/체감 지표(사용자 영향)
- [ ] 시나리오 2/3 수행 중 입력 지연(타이핑/드래그) 체감이 수정 전보다 개선
- [ ] 팬 소음/CPU 점유 상승이 눈에 띄게 심하지 않음(상대 비교)

---

## Regression Checklist (수정 후 필수 회귀)
### 오프라인/재접속
- [ ] 네트워크 OFF에서 앱이 정상 사용 가능(Local-first)
- [ ] 네트워크 OFF 동안 작업 추가/완료 후, 네트워크 ON 시 무한 재시도/로그 폭주가 없음
- [ ] 재접속 시 `RTDB listeners started`가 중복으로 계속 찍히지 않음

### 멀티디바이스/충돌 해결
- [ ] 디바이스 A/B에서 같은 날짜 dailyData를 각각 수정 → 충돌이 “예상된 정책”대로 정리됨(데이터 유실/롤백 없음)
- [ ] gameState XP 관련 보호 로직이 회귀하지 않음(원격이 로컬 XP를 덮어써서 초기화되는 현상 방지)

### 다중 창(Quick Add)
- [ ] 2창에서 리스너가 배수로 증가하지 않음(리더락/스킵 로그 확인)
- [ ] Quick Add 창 종료 후에도 메인 창 리스너가 정상 유지(또는 설계대로 재획득)

### 시작/종료/재초기화
- [ ] 앱 재시작 3회 반복해도 `activeListeners`가 누적 증가하지 않음
- [ ] Firebase 설정 변경/로그아웃 등 재초기화 이벤트 후에도 `stopListening()`이 호출되어 detach가 발생

### 성능
- [ ] 시나리오 2/3의 고빈도 편집에서 프레임 드랍/렉이 급격하지 않음
- [ ] SyncLog가 지나치게 빨리 쌓여 UI가 느려지지 않음(로그 상한/샘플링이 있다면 작동)

---

## Acceptance Criteria
- [ ] (필수) Firebase Console `Downloaded`가 저장량 대비 비정상적으로 폭증(GB 단위)하지 않음
- [ ] (필수) 멀티윈도우에서 리스너 중복으로 다운로드가 배수 증가하지 않음
- [ ] (필수) 오프라인/재접속/충돌 해결에서 데이터 유실 및 무한 동기화 루프가 없음

---

## Hand-off
Handing off to uat agent for value delivery validation

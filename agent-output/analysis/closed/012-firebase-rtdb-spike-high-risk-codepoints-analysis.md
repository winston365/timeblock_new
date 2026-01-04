# Value Statement and Business Objective
Firebase RTDB 다운로드 비용 폭증을 유발할 가능성이 높은 실제 코드 포인트(파일/함수/심볼)를 확정하여, 계측(로그/카운터)과 우선순위 기반 완화 작업(Planner/Implementer 핸드오프)을 빠르게 진행할 수 있게 한다.

## Changelog
- 2025-12-18: 워크스페이스 스캔 기반으로 RTDB read amplification 직결 포인트(리스너, 초기 fetch, pre-get, 대형 컬렉션 업로드)를 파일 경로/심볼 단위로 재정리.

## Context
요구 범위:
- `startListening/stopListening`
- `onValue/get` 사용부(리스너/일회성 읽기)
- 초기 전체 fetch
- `syncToFirebase` pre-get 패턴
- 대형 배열 업로드(`globalInbox/templates/completedInbox/dailyData`) 관련

## Findings (Fact)
아래는 "RTDB 다운로드 폭증"과 직결될 가능성이 높은 코드 포인트 목록이다. 각 항목은 (1) 실제 파일 경로, (2) 주요 심볼, (3) 위험 이유(1줄), (4) 확인용 로그/카운터(1줄)로 구성한다.

### 1) 루트 리스너(startListening) — 대형 서브트리 onValue
- [startListening](src/data/db/infra/syncEngine.ts#L232): `SyncEngine.startListening()`
  - 위험: `users/${userId}/dailyData`, `.../completedInbox`, `.../globalInbox`, `.../templates` 등 루트(큰 서브트리)에 `onValue`를 붙여 child 변경에도 전체 스냅샷 재전송될 수 있음.
  - 확인: DEV에서 [rtdbListenerRegistry](src/shared/services/sync/firebase/rtdbListenerRegistry.ts#L39) 로그(`RTDB onValue event`, `bytesEstimated`)와 [rtdbMetrics](src/shared/services/sync/firebase/rtdbMetrics.ts#L123) 스냅샷으로 경로별 `readsEstimatedBytes/events` 상위 랭킹 확인.

- [dailyData onValue attach](src/data/db/infra/syncEngine.ts#L270): `attachRtdbOnValue(database, dailyPath, ...)`
  - 위험: `users/user/dailyData` 루트는 날짜 키가 많아질수록 최초/재수신 payload가 커지고, 작은 변경에도 큰 다운로드가 발생할 수 있음.
  - 확인: `path=users/user/dailyData`의 `bytesEstimated`/`events`가 편집 1회당 과도하게 증가하는지 확인(DEV 로그 또는 metrics).

- [completedInbox onValue attach](src/data/db/infra/syncEngine.ts#L373): `attachRtdbOnValue(database, completedInboxPath, ...)`
  - 위험: date-keyed 루트(`users/user/completedInbox`)는 날짜 키 누적 시 전체 서브트리 재수신이 커져 "저장량 대비 다운로드" 괴리를 만들기 쉬움.
  - 확인: completedInbox 날짜 키 수 증가에 비례해 `bytesEstimated`가 증가하는지(DEV) 확인.

- [templates onValue attach](src/data/db/infra/syncEngine.ts#L324): `attachRtdbOnValue(database, templatesPath, ...)`
  - 위험: 템플릿은 배열 전체 동기화 형태라 변경 1회가 전체 배열 스냅샷 다운로드로 증폭될 수 있음.
  - 확인: `path=users/user/templates`에서 `bytesEstimated`가 템플릿 길이에 비례해 커지는지 확인.

- [globalInbox onValue attach](src/data/db/infra/syncEngine.ts#L352): `attachRtdbOnValue(database, globalInboxPath, ...)`
  - 위험: 인박스는 배열 전체 sync이며, 작업 1개 수정도 전체 배열 재수신으로 이어질 수 있음.
  - 확인: `path=users/user/globalInbox`의 `events`와 `readsEstimatedBytes`가 task 수정/토글마다 크게 튀는지 확인.

### 2) 리스너 중복/해제(stopListening) — 멀티윈도우/재초기화시 배수 위험
- [stopListening](src/data/db/infra/syncEngine.ts#L464): `SyncEngine.stopListening()`
  - 위험: 호출이 누락되면 리스너가 남아 동일 경로 변경에 대해 콜백/다운로드가 누적(특히 창/프로세스 증가 시 배수).
  - 확인: DEV에서 [getActiveRtdbListenerCount](src/shared/services/sync/firebase/rtdbListenerRegistry.ts#L178) 값이 종료/재초기화 후 0으로 내려가는지와 `detaches/attaches` 균형 확인.

- [멀티 윈도우 리더락 실패 시 진행](src/data/db/infra/syncEngine.ts#L232): `acquireFirebaseSyncLeaderLock()` 실패 시 `leaderHandle=null`로 계속 진행
  - 위험: 락 획득 실패(예: 권한/환경 문제) 시 각 창이 모두 리스너를 붙여 다운로드가 창 수만큼 배수.
  - 확인: `RTDB listeners started` 로그의 `instanceId`/`active`가 여러 창에서 중복 발생하는지 확인.

### 3) 초기 전체 fetch — 앱 시작 시 루트 get() 다발
- [init path](src/data/db/infra/useAppInitialization.ts#L79): `useAppInitialization()` → `fetchDataFromFirebase()` → `syncEngine.startListening()`
  - 위험: 시작 시점에 대형 루트들을 `get()`로 병렬 전체 읽기 후, 곧바로 루트 `onValue` 리스닝까지 켜서 “초기 폭주 + 이후 에코” 조합이 될 수 있음.
  - 확인: 앱 1회 부팅 시 [fetchDataFromFirebase Promise.all(get...)](src/shared/services/sync/firebaseService.ts#L77-L87) 이후 `rtdbMetrics`에서 `get` 추정 bytes가 큰 경로를 상위로 뽑기.

- [fetchDataFromFirebase](src/shared/services/sync/firebaseService.ts#L46): `fetchDataFromFirebase()`
  - 위험: `users/user/completedInbox`, `users/user/dailyData`, `users/user/globalInbox`, `users/user/templates` 등 루트 `get()`이 한 번에 실행됨.
  - 확인: `addSyncLog('Fetched initial data...')`의 카운트(예: `completedInbox` 날짜 수, `globalInbox` 길이)가 큰 계정에서 다운로드 급증이 재현되는지 확인.

### 4) syncToFirebase pre-get — 쓰기 1회당 읽기 1회(또는 그 이상)
- [syncToFirebase](src/shared/services/sync/firebase/syncCore.ts#L125): `syncToFirebase()`
  - 위험: 충돌 해결을 위해 기본적으로 `getRemoteOnce()`(= `get(dataRef)`)를 수행하므로, 대형 경로에 자주 쓰면 "쓰기+사전읽기"로 다운로드가 비정상 확대.
  - 확인: DEV에서 [recordRtdbGet](src/shared/services/sync/firebase/syncCore.ts#L161) / [recordRtdbSet](src/shared/services/sync/firebase/rtdbMetrics.ts#L107) 누계로 `get:set` 비율과 bytes를 경로별 비교.

- [getRemoteOnce](src/shared/services/sync/firebase/syncCore.ts#L78): `getRemoteOnce()` (2초 TTL + single-flight)
  - 위험: TTL은 동일 path 연속 호출만 완화하며, (a) 서로 다른 key(예: completedInbox 날짜별)나 (b) 2초 이상 간격의 반복 호출에는 여전히 매번 `get()`이 발생.
  - 확인: 동일 UI 액션(예: 완료 토글)에서 여러 path의 `recordRtdbGet`가 연쇄로 찍히는지 확인.

### 5) 대형 컬렉션 업로드(배열 전체) — Dexie hook → toArray() → syncToFirebase
- [Dexie hooks 등록](src/data/db/infra/syncEngine.ts#L168): `registerHooks(db.templates)` → `db.templates.toArray()` → `syncToFirebase(templateStrategy, allTemplates)`
  - 위험: 템플릿 1개 변경도 전체 템플릿 배열 업로드 + pre-get + 루트 onValue 재수신 가능.
  - 확인: `path=users/user/templates`에 대해 `writesEstimatedBytes`와 `readsEstimatedBytes`가 변경 1회당 큰지 확인.

- [GlobalInbox hook](src/data/db/infra/syncEngine.ts#L184): `registerHooks(db.globalInbox)` → `db.globalInbox.toArray()` → `syncToFirebase(globalInboxStrategy, allTasks)`
  - 위험: 작업 1개 수정/토글이 전체 인박스 배열 업로드(쓰기 payload 큼) + pre-get로 읽기까지 동반.
  - 확인: `path=users/user/globalInbox`의 `writesEstimatedBytes` 증가량과 onValue `bytesEstimated` 동시 증가 확인.

- [CompletedInbox hook](src/data/db/infra/syncEngine.ts#L192): `registerHooks(db.completedInbox)` → `db.completedInbox.toArray()` → 날짜별 `syncToFirebase(completedInboxStrategy, tasks, date)`
  - 위험: 완료 작업 수정/추가 시 날짜별 여러 `set` + 각 `set`마다 pre-get이 발생할 수 있어 다운로드/요청 수가 급증.
  - 확인: 동일 액션에서 `path=users/user/completedInbox/{date}` 형태의 `get/set`가 여러 번 발생하는지 metrics로 확인.

### 6) 대형 데이터가 "시작 시 업로드"로 증폭될 수 있는 경로
- [startup local upload loop](src/data/db/infra/useAppInitialization.ts#L245): `db.dailyData.toArray()` 후 날짜별 `syncToFirebase(dailyDataStrategy, ..., localData.date)`
  - 위험: 로컬에 날짜가 많이 쌓인 상태에서 원격에 없는 날짜를 업로드하면, 날짜 수만큼 pre-get+set이 발생.
  - 확인: 부팅 직후 `DailyData synced:` 로그가 다수 찍히는지 + `rtdbMetrics`에서 `users/user/dailyData/{date}` `get` 누계 증가 확인.

### 7) 레거시/직접 onValue 경로(잠재 위험)
- [enableFirebaseSync](src/shared/services/sync/firebaseService.ts#L185): `enableFirebaseSync()` (현재 검색 기준 사용처 없음)
  - 위험: `onValue(dailyDataRef)`/`onValue(gameStateRef)`가 루트에 직접 붙어, 향후 다시 사용되면 SyncEngine 리스너와 중복되어 다운로드 배수 위험.
  - 확인: 코드 검색으로 호출부가 생기면 즉시 `RTDB listener attached` 경로/개수 증가로 탐지.

## Recommendations (Actionable)
- 우선 계측 기반으로 "경로별 bytesEstimated/events" 상위 3개를 확정하고(보통 `dailyData`, `completedInbox`, `globalInbox/templates`), 해당 경로부터 리스너 범위 축소(날짜/키 단위) 및 쓰기 방식(부분 업데이트/샤딩) 검토.
- 멀티윈도우에서 리더락 실패 시나리오를 별도 재현(락 실패 강제)하여 리스너 중복이 실제로 발생하는지 확인.

## Open Questions
- `users/user/completedInbox`의 실제 데이터 모델: date-keyed subtree가 얼마나 큰지(날짜 수/총 task 수)와 변경 빈도는?
- `SyncEngine.startListening()`가 호출되는 경로가 초기화 외에 추가로 존재하는지(설정 저장/계정 전환 등).

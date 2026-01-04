# 011-firebase-rtdb-download-spike-analysis

## Value Statement and Business Objective
- **가치**: RTDB 저장량(약 2.54MB) 대비 다운로드(약 4.95GB) 급증은 비용 폭증/성능 저하/배터리·데이터 소모로 직결됩니다.
- **목표**: 앱 내 어떤 플로우가 **과도한 RTDB 읽기(다운로드)** 를 유발하는지, 코드 기반으로 재현 가설과 Top 원인 후보를 좁히고, 30분 내 빠른 확인 체크리스트와 정확한 계측(로그) 포인트를 제시합니다.

## Changelog
- 2025-12-18: 초기 조사 문서 생성. 레포 내 RTDB 동기화 엔트리포인트, 리스너 등록 패턴, 풀-스냅샷 읽기 경로를 식별.

## Context
- 레포 동기화 구조는 Dexie↔Firebase 양방향 동기화를 목표로 함.
- 초기화 훅에서 Firebase 초기화 → 초기 풀 로드(다중 `get`) → 실시간 리스닝(`onValue` 다수)을 수행.

## Methodology
- 코드 검색: `firebase/database` 사용, `onValue/off/get/set` 호출부, 동기화 엔진 초기화/리스너 시작 지점, 재시도 큐, SyncLog.
- 핵심 파일을 직접 읽어 **읽기(다운로드) 발생 구조** 를 파악.

## Findings (Fact)
### 1) 앱 시작 시 “초기 전체 데이터 fetch”가 수행됨
- [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts): `initializeFirebase()` 성공 시 `fetchDataFromFirebase()` 호출 후 `syncEngine.startListening()` 호출.
- [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts): `fetchDataFromFirebase()`가 `Promise.all(get(ref(...)))`로 여러 루트 경로를 병렬로 **전체 읽기**
  - `users/{userId}/dailyData`, `gameState`, `globalInbox`, `completedInbox`, `shopItems`, `waifuState`, `templates`, `tokenUsage`, `globalGoals`, `settings`

### 2) 실시간 리스너가 “컬렉션 루트(onValue)”에 다수 등록됨
- [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts): `startListening()`에서 다음 루트 경로에 `onValue()` 등록
  - `dailyData`, `gameState`, `templates`, `shopItems`, `globalInbox`, `completedInbox`, `tokenUsage`, `settings`
- 이 구조는 RTDB의 일반적 특성상 **해당 경로의 서브트리 전체 스냅샷이 이벤트마다 전달** 되기 쉬움.

### 3) 로컬 변경이 “전체 컬렉션 업로드”로 이어질 수 있음
- [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts): Dexie hook에서 일부 테이블은 변경마다 `toArray()` 후 `syncToFirebase()`로 **전체 배열** 을 업로드
  - `templates`, `shopItems`, `globalInbox` (그리고 `completedInbox`는 날짜별 배열을 업로드)

### 4) `syncToFirebase()`는 쓰기 전 `get()`을 수행함 (읽기 추가)
- [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts): `syncToFirebase()`가 `get(dataRef)`로 원격 데이터를 읽고 충돌 확인 후 `set(dataRef, ...)` 수행
- 즉 “변경 1회”가 다음을 유발할 수 있음
  - (A) `get()`로 원격 스냅샷 다운로드
  - (B) `set()` 업로드
  - (C) 등록된 `onValue()` 리스너로 스냅샷 재전송(클라이언트 수만큼)

## Step-by-step Reproduction Procedure Hypotheses
> 아래는 **사용자가 실제로 하는 행동** 기준으로, 어떤 화면/플로우가 RTDB 읽기 폭증을 촉발할지에 대한 재현 가설입니다.

1) **앱 실행(또는 Firebase 설정이 활성화된 상태로 재시작)**
- 트리거: [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)에서 `fetchDataFromFirebase()`(초기 전체 읽기) + `syncEngine.startListening()`(8개 루트 리스너 등록)

2) **일정 편집/드래그/체크(완료) 등으로 DailyData가 잦게 변경**
- 트리거: Dexie 테이블 변경 → [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts) hook → `syncToFirebase(dailyDataStrategy, ..., date)`
- 동반 다운로드: [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)의 사전 `get()` + 루트 `onValue(dailyData)`에 의한 “dailyData 전체 스냅샷” 재수신

3) **인박스(GlobalInbox)에서 작업 추가/수정/정렬을 반복**
- 트리거: `db.globalInbox` 변경 시마다 `db.globalInbox.toArray()`를 다시 올림 → 전체 배열 쓰기
- 동반 다운로드: 사전 `get()` + `onValue(globalInbox)`로 전체 배열 스냅샷 재수신

4) **완료 작업이 쌓인 상태에서 작업 완료를 많이 수행(CompletedInbox가 커질수록 위험)**
- 트리거: `db.completedInbox` 변경 시 날짜별 그룹을 모두 `Promise.all(syncToFirebase(...))`
- 동반 다운로드: `onValue(completedInbox)`는 루트에서 전체 서브트리 수신(모든 날짜)

5) **템플릿(Templates) 편집/자동생성/정리 작업을 반복**
- 트리거: `db.templates` 변경 시 전체 템플릿 배열 업로드
- 동반 다운로드: `onValue(templates)`로 전체 배열 스냅샷 재수신

6) **다중 창/다중 프로세스 시나리오 (Electron 특성)
- 예: Quick Add 모드로 별도 창/프로세스가 뜨고 둘 다 Firebase 설정을 사용
- 추정 결과: 각 프로세스가 `syncEngine.startListening()`을 실행하면 **동일 계정/동일 경로에 리스너가 중복**되어 다운로드가 창 수만큼 배수 증가

7) **워밍업 프리셋 화면(스케줄 뷰 진입)에서 추가 fetch**
- [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx): `fetchFromFirebase(warmupPresetStrategy)` 1회 읽기
- 단, 규모가 작으면 메인 원인 가능성은 낮음(보조 확인)

## Top 3 Root-cause Hypotheses (Grounded in RTDB typical behaviors)

### Hypothesis 1 — 루트 `onValue()` + 빈번한 로컬 쓰기 = “전체 서브트리 반복 다운로드(에코 포함)”
**메커니즘(전형적 RTDB 동작)**
- `onValue(ref('users/user/dailyData'))`는 어떤 child가 바뀌어도 **dailyData 전체 스냅샷**을 콜백에 전달할 수 있음.
- 코드가 `deviceId`로 “처리”만 스킵해도 **다운로드 자체는 발생**합니다.

**이 레포에서 근거 코드**
- 루트 리스너: [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts) `startListening()`
- 쓰기 빈번 포인트: Dexie hooks → `syncToFirebase(...)` (dailyData, tokenUsage 등)

**정밀 확인 방법(계측/로그/검증)**
- (A) `onValue()` 콜백마다 스냅샷 크기(대략)를 기록
  - 예: `JSON.stringify(snapshot.val()).length`(문자 수) 또는 `new Blob([json]).size`(바이트)로 추정
  - 기록 위치 후보:
    - [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts) `startListening()` 각 `onValue` 콜백 초입
    - [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts) `enableFirebaseSync()`(만약 사용 중이면)
  - 로그 채널: [src/shared/services/sync/syncLogger.ts](src/shared/services/sync/syncLogger.ts) `addSyncLog('firebase','load'|'sync', ...)`
- (B) 동일 세션에서 “쓰기 횟수 vs onValue 트리거 횟수” 상관 확인
  - dailyData를 10회 저장하면 dailyData 루트 리스너가 10회 이상(혹은 각 스냅샷 MB급) 뜨는지 확인


### Hypothesis 2 — 전체 컬렉션 업로드 패턴 + `syncToFirebase()`의 사전 `get()` 때문에 읽기가 2~3배로 증폭
**메커니즘(전형적 RTDB 비용 패턴)**
- `syncToFirebase()`가 매번 `get(dataRef)`로 원격 전체 스냅샷을 다운로드 후 `set()`.
- 대상이 배열/큰 맵(templates/globalInbox/completedInbox root)일수록 “변경 1회”의 다운로드 비용이 커짐.

**이 레포에서 근거 코드**
- 사전 읽기: [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts) `syncToFirebase()` 내부 `get(dataRef)`
- 전체 업로드: [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts)
  - `db.templates.toArray()` → `syncToFirebase(templateStrategy, allTemplates)`
  - `db.globalInbox.toArray()` → `syncToFirebase(globalInboxStrategy, allTasks)`
  - `db.shopItems.toArray()` → `syncToFirebase(shopItemsStrategy, allItems, 'all')`
  - `db.completedInbox.toArray()` → 그룹화 후 다건 `syncToFirebase(completedInboxStrategy, tasks, date)`

**정밀 확인 방법(계측/로그/검증)**
- (A) `syncToFirebase()`에서 `get()` 수행 시마다 다운로드 크기 기록
  - 계측 위치: [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
  - 기록 항목: `collection`, `key`, `remoteData`의 직렬화 크기 추정, 호출 스택(가능하면 `new Error().stack` 일부)
- (B) “업로드 대상 payload 크기”도 함께 기록
  - `sanitizedData`의 JSON 크기 추정
- (C) 특히 `completedInbox`와 `globalInbox`의 배열 길이/날짜 수가 커질수록 다운로드 급증하는지 확인


### Hypothesis 3 — 리스너/초기화 중복(멀티 윈도우/재초기화/해제 누락)로 다운로드가 프로세스 수만큼 배수 증가
**메커니즘(전형적 RTDB 동작)**
- 동일 경로에 `onValue()`가 N개 붙으면 동일 데이터 변경 시 N번 콜백이 실행되고, 네트워크 트래픽도 증가.
- Electron 앱에서 “메인 창 + QuickAdd 창” 같이 다중 렌더러가 동시 실행되면 동일 코드가 각 프로세스에서 실행됨.

**이 레포에서 근거 코드**
- 리스너 해제 API 부재(현 시점 관찰): [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts) `startListening()`에 `off()`/unsubscribe 반환이 없음.
- 초기화 엔트리: [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)

**정밀 확인 방법(계측/로그/검증)**
- (A) `startListening()` 호출 시점/횟수/프로세스 식별자 로그
  - 예: window/process/renderer 식별값(가능한 범위) + 호출 횟수 카운트
  - 계측 위치: [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts) `startListening()` 시작부
- (B) Firebase App 재초기화 시 기존 리스너가 살아있는지 검증
  - [src/shared/services/sync/firebase/firebaseClient.ts](src/shared/services/sync/firebase/firebaseClient.ts): `initializeFirebase()`가 기존 app을 `deleteApp`하지만 리스너 해제는 하지 않음
  - 확인: 설정 변경/재연결 시 동일 리스너가 중복되는지 로그로 카운트

## Minimal “Quick Check” List (< 30 minutes)
1) Firebase Console에서 RTDB **Usage → Downloaded**가 급증하는 시간대를 확인하고, 그 시간대에 사용자가 했던 대표 행동(앱 실행/작업 완료/템플릿 편집/인박스 정리/다중 창)을 2~3개로 압축
2) 앱에서 Firebase 동기화가 켜진 상태로 다음을 5분씩 반복해보며 체감되는 로그 폭증 여부 확인
   - (a) 작업 20개 생성/수정
   - (b) 작업 20개 완료 처리
   - (c) 템플릿 10회 편집
   - (d) 인박스 정렬/수정 20회
3) SyncLog 모달에서 Firebase 로그가 “연속적으로 매우 빠르게” 쌓이는지 확인
   - UI: [src/features/settings/SyncLogModal.tsx](src/features/settings/SyncLogModal.tsx)
4) 1대/2대(또는 1창/2창) 비교
   - 창/프로세스를 하나 더 띄웠을 때 다운로드 속도가 **거의 2배**로 체감되면 Hypothesis 3 쪽이 강함
5) 데이터 크기 점검(대략)
   - RTDB에서 `completedInbox`의 날짜 키 개수, `globalInbox` task 수, `dailyData` 날짜 수가 많은지 확인(콘솔에서 직접 보기)

## Recommendations (Next investigative actions)
- **우선순위 1**: `onValue()`가 루트(큰 서브트리)에 붙어있는 경로들에 대해 “스냅샷 크기/빈도”를 즉시 계측해 원인 후보를 데이터로 랭킹.
- **우선순위 2**: `syncToFirebase()`의 사전 `get()`이 큰 노드에서 얼마나 자주/큰 크기로 발생하는지 계측.
- **우선순위 3**: 멀티 윈도우/재초기화 시 `startListening()` 중복 여부를 로그로 확정.

## Open Questions
- 실제 사용자 환경에서 Electron 다중 창(QuickAdd 포함)이 얼마나 자주 동시에 실행되는지?
- RTDB 데이터 중 `completedInbox` / `globalInbox` / `templates` 중 어떤 경로가 가장 큰지(콘솔에서 크기 추정 가능)?
- 다운로드 급증이 “사용 중(실시간)”인지 “앱 실행 직후(초기 fetch)”인지 시간대 패턴이 있는지?

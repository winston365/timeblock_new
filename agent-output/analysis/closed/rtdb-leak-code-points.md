# rtdb-leak-code-points

## 재현 절차 (5분 버전)
사전 조건
- Firebase 동기화가 활성화되어 있어야 함(설정에 Firebase config 존재).
- DEV 환경에서 실행(DEV에서만 RTDB 계측 로그/바이트 추정이 활성화됨).

절차
1) 앱을 실행하고, **설정 화면의 SyncLog 모달**을 열어 Firebase 로그가 찍히는지 확인한다.
2) 앱 실행 직후 1~2분 동안 아무것도 하지 않고 관찰한다.
   - 기대 관찰: 초기 fetch 로그 1회 + RTDB 리스너 attach 로그가 1회씩만 찍혀야 한다.
3) 2~3분 동안 다음을 빠르게 반복한다.
   - 인박스에서 작업 10개 추가 → 10개 수정(텍스트/태그 등) → 10개 완료 처리
   - (가능하면) 템플릿 3~5회 추가/수정
4) SyncLog에서 아래 로그의 **빈도/bytesEstimated**가 과도하게 증가하는지 확인한다.
   - “RTDB onValue event”
   - “RTDB listener attached/reused”
   - “RTDB listeners started”

빠른 판정(5분 내)
- 동일한 사용자 액션 1회당 “RTDB onValue event”가 과도하게 연쇄 발생하거나, bytesEstimated가 큰 값으로 지속적으로 튀면 누수/증폭 가설이 강해진다.


## 재현 절차 (30분 버전)
목표
- “저장량 대비 다운로드 급증”이 **(A) 부팅 직후 초기 fetch**, **(B) 작업 조작으로 인한 syncToFirebase pre-get**, **(C) 루트 onValue 리스너의 전체 스냅샷 재수신** 중 어디에서 주로 발생하는지 분리한다.

절차
1) (클린 세션) 앱을 실행한 뒤, 5분 동안 사용하지 않고 대기하며 다운로드 증가가 있는지 관찰한다.
2) 10분 동안 **완료 작업을 의도적으로 누적**시킨다.
   - 작업 30~50개 생성 후 완료 처리(CompletedInbox가 커지는 상황을 만들기 위함)
3) 10분 동안 **GlobalInbox/Template 편집을 반복**한다.
   - 작업 30회(수정/정렬/완료 토글) + 템플릿 10회(추가/수정)
4) 마지막 5분은 앱을 idle로 두고, 사용자 액션이 없는데도 onValue 이벤트가 계속 발생하는지 확인한다.

판정 포인트
- CompletedInbox 날짜/항목이 늘어날수록 onValue bytesEstimated가 비례 상승하면, 루트 리스너 스냅샷 재전송 가설이 강화된다.
- 동일 액션에서 syncToFirebase가 연쇄적으로 실행되며 pre-get이 다발이면, 사전 get 증폭 가설이 강화된다.


## 재현 절차 (1시간 버전)
목표
- 장시간 사용 시 “리스너 중복/해제 누락(창/세션 누적)” 또는 “idle 상태에서도 지속 read” 같은 누수 패턴을 확인한다.

절차
1) 앱을 실행 후 15분 동안 일반 사용(작업 추가/완료/스케줄 편집)한다.
2) 다음 15분 동안 **설정 변경(저장) → 화면 전환 → 작업 편집**을 반복한다.
   - 목표: 초기화/재연결/리-렌더 경로에서 startListening이 중복 호출되는지 탐지
3) 다음 15분 동안 **창/모드 전환을 반복**한다(가능한 범위에서).
   - 목표: 멀티 윈도우/렌더러에서 리더 락이 실패하거나, stopListening이 누락되어 리스너가 누적되는지 확인
4) 마지막 15분 동안 앱을 완전 idle로 둔다.
   - 목표: 사용자 액션이 없는데도 onValue 이벤트(다운로드)가 계속 발생하는지 확인

판정 포인트
- 창/모드 전환 이후 “RTDB listeners started”가 다시 찍히는데 “stopped”가 대응되지 않으면, 해제 누락/중복 가능성이 높다.
- idle에서 onValue 이벤트가 계속되면, 외부 쓰기(다른 클라이언트) 또는 리스너 중복/재연결 루프 가능성이 있다.


## 원인 가설 Top3
### 1) 루트(큰 서브트리) onValue 리스닝으로 “작은 변경 → 큰 스냅샷 반복 다운로드”
- 개별 child 변경에도 해당 경로의 큰 스냅샷이 반복 수신되어 다운로드가 폭증할 수 있다.
- 특히 날짜 키가 누적되는 구조(dailyData/completedInbox)나 배열 전체 sync(globalInbox/templates)에서 위험이 커진다.

### 2) 쓰기 1회당 pre-get(원격 get) 1회 + 루트 onValue 에코로 read가 2~3배 증폭
- syncToFirebase가 충돌 해결을 위해 원격을 매번 get 하고, 이후 set + onValue 재수신까지 겹치면 “저장량 대비 다운로드” 괴리가 커진다.
- 컬렉션을 toArray로 통째로 업로드하는 경로(templates/globalInbox/completedInbox 그룹)가 특히 민감하다.

### 3) 멀티 윈도우/재초기화/해제 누락으로 리스너가 중복 등록되어 다운로드가 배수 증가
- 동일 경로에 onValue 리스너가 중복으로 붙으면, 동일 변경에 대해 이벤트/다운로드가 중복 발생한다.
- leader lock 획득 실패/미지원 환경, beforeunload 미호출, 설정 변경/재초기화 시 stopListening 누락 등이 트리거가 될 수 있다.


## 확인 방법
### 로그 포인트(정확한 파일 경로 + 함수명)
- src/data/db/infra/syncEngine.ts — SyncEngine.startListening()
  - 확인할 것: “RTDB listeners started”(active, instanceId)가 **세션당 1회**인지, 리더 락 스킵이 정상인지
  - 추가 관찰: attachRtdbOnValue로 붙는 경로가 큰 루트(dailyData/globalInbox/completedInbox/templates 등)인지

- src/data/db/infra/syncEngine.ts — SyncEngine.stopListening()
  - 확인할 것: “RTDB listeners stopped”가 창 종료/초기화/재연결 시점에 실제로 찍히는지

- src/shared/services/sync/firebase/firebaseSyncLeaderLock.ts — acquireFirebaseSyncLeaderLock()
  - 확인할 것: “RTDB listener leader lock acquired/released”가 창/렌더러당 어떻게 발생하는지
  - 해석: 리더가 아닌 창에서 startListening이 스킵되어야 중복 리스너를 막는다.

- src/shared/services/sync/firebase/rtdbListenerRegistry.ts — attachRtdbOnValue()
  - 확인할 것: “RTDB listener attached/reused”, “RTDB onValue event”(path, bytesEstimated, consumers)
  - 해석: bytesEstimated가 큰 path가 곧 다운로드 폭증 후보 1순위

- src/shared/services/sync/firebase/rtdbListenerRegistry.ts — getActiveRtdbListenerCount()
  - 확인할 것: 창/모드 전환/재초기화 후 activeListeners가 누적 증가하는지(누적이면 누수 의심)

- src/shared/services/sync/firebase/rtdbMetrics.ts — getRtdbMetricsSnapshot(), resetRtdbMetrics()
  - 확인할 것: 경로별 readsEstimatedBytes/events 상위 랭킹(DEV에서만 의미 있음)

- src/shared/services/sync/firebaseService.ts — fetchDataFromFirebase()
  - 확인할 것: “Fetched initial data from Firebase”(dailyData 개수, completedInbox 날짜 수, globalInbox 길이 등)
  - 해석: 부팅 직후 다운로드 급증이 여기와 강하게 상관이면 ‘초기 전체 get 다발’이 주요 원인일 수 있다.

- src/shared/services/sync/firebase/syncCore.ts — syncToFirebase()
  - 확인할 것: recordRtdbGet/recordRtdbSet이 어떤 path에서 큰 바이트로 누적되는지(DEV)
  - 해석: get:set 비율이 비정상적으로 높거나, 큰 path에서 get이 자주 찍히면 pre-get 증폭 가설이 강화된다.

- src/shared/services/sync/firebase/firebaseClient.ts — initializeFirebase(), disconnectFirebase()
  - 확인할 것: 재초기화/연결 해제 시 stopAllRtdbListeners()가 호출되어 리스너가 남지 않는지


### Firebase 콘솔에서 볼 지표
- Realtime Database → Usage
  - Downloaded(다운로드 바이트): 재현 구간 시작/끝의 증가량과 증가 속도(바이트/분)
  - Stored data(저장 데이터): 실제 저장량 대비 다운로드 비율이 비정상적으로 큰지
  - Connections(동시 연결 수): 멀티 윈도우/다중 기기에서 연결 수가 늘어나는지
- Billing/Usage(프로젝트 과금 대시보드)
  - RTDB 다운로드 트래픽이 특정 시간대에 급증하는지(앱 실행/업데이트 배포 시점과 상관)


## 가장 먼저 볼 파일 5개
1) src/data/db/infra/syncEngine.ts
2) src/data/db/infra/useAppInitialization.ts
3) src/shared/services/sync/firebaseService.ts
4) src/shared/services/sync/firebase/syncCore.ts
5) src/shared/services/sync/firebase/rtdbListenerRegistry.ts

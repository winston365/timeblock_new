# Google Calendar 토큰 리프레시 불안정 수정 계획

## Plan Header
- Plan ID: plan-2025-12-21-google-calendar-token-refresh-stability
- Target Release: **1.0.163 (제안, 현재 package.json = 1.0.162 기준 patch +1)**
- Epic Alignment: “Google Calendar 연동이 자주 끊기는 문제(토큰 만료/리프레시 실패) 안정화”
- Status: Draft
- Approved by user: **pending**
- References:
  - agent-output/analysis/013-google-calendar-disconnect-analysis.md

---

## Value Statement and Business Objective
As a 사용자, I want Google Calendar 연동이 토큰 만료 후에도 자동으로 안정적으로 갱신되어, so that 설정 탭에서 반복적으로 재로그인하지 않고도 일정/작업 동기화가 지속되길 원한다.

---

## Scope / Constraints (Minimal Changes)
- 변경 범위는 **토큰 설정 저장/로드 정규화 + 리프레시 가드 강화 + 401 재시도 안정화 + vitest 보강**으로 제한
- 저장 위치/키는 유지: Dexie `systemState`의 `googleCalendarSettings` (키 변경 없음)
- UI/UX 확장은 하지 않음(필요 시 오류 메시지/상태 표기 정도만 최소 수정)
- repo 정책 준수: localStorage 금지(theme 예외), optional chaining, defaults 단일 출처

---

## In-Scope Files (Analyst 지목/고확률 변경 지점)
- 설정 모델/영속화(googleCalendarSettings):
  - src/data/repositories/systemRepository.ts (SYSTEM_KEYS.GOOGLE_CALENDAR_SETTINGS)
  - src/data/repositories/calendarRepository.ts (get/save/disconnect)
- 토큰 라이프사이클(획득/검증/갱신):
  - src/shared/services/calendar/googleCalendarService.ts (`isTokenValid`, `getValidAccessToken`, `refreshAccessToken`, `callCalendarApi`)
- HTTP 401 재시도(래퍼/헬퍼):
  - src/shared/services/calendar/googleCalendarService.ts (`callCalendarApi` 401 branch)
  - src/shared/services/calendar/googleTasksService.ts (`callTasksApi` 401 branch)

(참고/의존: Electron IPC 리프레시 핸들러는 electron/main/index.ts에 존재)

---

## Step Plan (Implementer 체크리스트)

### 1) 저장된 설정 정규화(legacy 필드명/shape 호환)
- [ ] `googleCalendarSettings` 로드시 레거시 필드(`expiresAt`, `email`)를 현행 필드(`tokenExpiresAt`, `userEmail`)로 **정규화**
- [ ] 정규화 결과가 원본과 다르면, 동일 키(`googleCalendarSettings`)로 **write-back(자체 마이그레이션)** 하여 이후 불일치 재발 방지
- [ ] 저장(save) 시에도 **항상 정규화된 shape**로 저장(레거시 필드는 더 이상 새로 쓰지 않음)
- [ ] `disconnectGoogleCalendar()`가 저장하는 값도 현행 shape 기준으로 최소/일관되게 유지

**Acceptance Criteria**
- [ ] 레거시 데이터만 존재하는 사용자도 앱 재시작 후 “토큰 만료”로 즉시 전락하지 않음(만료 시간이 있었다면 정상 인식)
- [ ] Dexie의 `googleCalendarSettings` 레코드가 단일/일관된 필드명으로 수렴

### 2) 토큰 리프레시 가드(guard) 강화로 불안정/경쟁 상태 제거
- [ ] `refreshAccessToken`에 **동시성 가드(단일 in-flight refresh)** 도입: 여러 API 호출이 동시에 들어와도 refresh는 1회만 수행
- [ ] 리프레시 선행 조건(Refresh token/Client credentials/Electron API 부재)을 명확히 분리하고, 실패 시 **반복적인 무의미 refresh 시도**를 최소화(짧은 기간 throttle 또는 “불가능 상태” 캐시)
- [ ] `getValidAccessToken`이 만료 임박/만료/만료시간 누락 상태에서 **가능하면 refresh 시도 후 최신 access token을 재로드**하도록 정리

**Acceptance Criteria**
- [ ] 만료 후 첫 API 호출에서 refresh가 가능하면 자동으로 토큰이 갱신되고, 호출자가 access token을 정상 획득
- [ ] 동시에 여러 동기화/호출이 발생해도 refresh IPC 호출이 중복 폭발하지 않음(1회로 수렴)

### 3) 401 재시도(HTTP wrapper) 안정화 및 서비스 간 일관성 확보
- [ ] `callCalendarApi`의 401 재시도 흐름을 refresh guard와 정합되게 조정(“refresh 1회 + 재요청 1회” 규칙 유지)
- [ ] `googleTasksService`의 `callTasksApi`도 동일한 실패/재시도 규약을 따르도록 최소 수정(두 서비스 간 드리프트 방지)
- [ ] 401 이후에도 실패 시, 사용자 재로그인이 필요한 상황을 **명확한 에러 메시지**로 표준화(무한 재시도/침묵 실패 금지)

**Acceptance Criteria**
- [ ] 401 응답 발생 시 refresh를 최대 1회 시도하고, 성공 시 원 요청이 1회 재시도됨
- [ ] refresh 실패/재시도 실패 시 더 이상 루프를 돌지 않고 예측 가능한 실패로 종료

### 4) vitest 커버리지 추가(회귀 방지)
- [ ] `calendarRepository`의 설정 정규화(legacy → current) 동작에 대한 단위 테스트 추가
- [ ] `googleCalendarService`의 refresh guard(동시 호출)와 401 재시도 규약에 대한 단위 테스트/모킹 기반 테스트 추가

**Acceptance Criteria**
- [ ] `npm test`가 신규 테스트를 포함해 통과
- [ ] 본 이슈의 핵심 회귀(레거시 필드 불일치, 중복 refresh, 401 재시도 불안정)를 자동으로 감지 가능한 테스트가 존재

### 5) Validation + Version Management(릴리즈 아티팩트)
- [ ] `npm run lint` 통과
- [ ] (권장) `npm run electron:dev`에서 실제 Electron 환경 리프레시 1회 이상 수동 검증
- [ ] Target Release로 버전/릴리즈 아티팩트 정리(예: package.json `1.0.163`, 필요한 경우 릴리즈 노트/문서 업데이트)

**Acceptance Criteria**
- [ ] 린트/테스트가 모두 통과
- [ ] 버전 아티팩트가 Target Release와 일치

---

## Risks / Notes
- 레거시 데이터 정규화는 “읽을 때 정규화 + write-back” 패턴이 가장 안전하지만, 예기치 않은 필드가 섞여 있을 수 있으므로 **옵셔널 체이닝**과 보수적 병합이 필요
- Electron API(`window.electronAPI`)가 없는 환경(Vite 웹 단독 실행)에서는 refresh가 불가능하므로, 이 경우의 에러/UX는 “불가”로 명확히 분리되어야 함

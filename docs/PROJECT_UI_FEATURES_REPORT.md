# 타임블럭 플래너 (Daily Quest) - 최종 프로젝트 보고서

> 본 문서는 프로젝트를 새로운 기술 스택으로 재구현할 때 참고할 수 있도록, 현재 구현된 모든 기능과 UI, 데이터 구조를 상세히 기록한 설계 문서입니다.

**작성일**: 2025-11-14
**목적**: 완전한 재구현을 위한 기능/UI/데이터 명세서

---

## 목차

1. [개요](#1-개요)
2. [빌드 & 엔트리 구조](#2-빌드--엔트리-구조)
3. [화면 & UI 구조](#3-화면--ui-구조)
4. [데이터 모델 & 저장 구조](#4-데이터-모델--저장-구조)
5. [상태 관리 & 흐름](#5-상태-관리--흐름)
6. [Gemini 연동](#6-gemini-연동)
7. [현재 발견된 문제 & 기술 부채](#7-현재-발견된-문제--기술-부채)

---

## 1. 개요

### 1.1 프로젝트 한 줄 요약

**타임블럭 플래너 (Daily Quest)**: 하루를 6개 시간 블록으로 나누어 관리하는 일정 관리 도구 + 게임화 시스템(XP, 레벨) + AI 캐릭터(와이푸) 상호작용 + 에너지 트래킹을 결합한 생산성 웹 애플리케이션

### 1.2 핵심 기능 요약

- **타임블록 스케줄러**: 하루를 05:00-08:00, 08:00-11:00, 11:00-14:00, 14:00-17:00, 17:00-19:00, 19:00-24:00 총 6개 블록으로 분할
- **할 일 관리**: 각 블록에 작업 할당, 예상 시간/실제 시간/심리적 거부감(저항도) 기록
- **게임화**: 작업 완료 시 XP 획득, 레벨업, 일일 퀘스트, 블록 완벽 완료 보너스
- **AI 와이푸 챗봇**: 호감도(0-100) 기반 성격 변화, Gemini API 연동 대화, 자동 메시지
- **에너지 관리**: 시간대별 에너지 수준(0-100) 기록 및 통계
- **템플릿 시스템**: 반복 작업 자동 생성
- **상점 시스템**: XP로 보상 구매
- **통계 & 히스토리**: 5일 XP 차트, 시간대별 XP, 완료 작업 히스토리

### 1.3 현재 기술 스택

| 구분 | 기술 |
|------|------|
| **프론트엔드** | 순수 HTML5 / CSS3 / JavaScript (ES6+) |
| **빌드 도구** | 없음 (No build step) |
| **모듈 시스템** | `window` 객체에 노출하는 방식 |
| **저장소** | 3단계: IndexedDB (1순위) → localStorage (2순위) → Firebase Realtime DB (3순위) |
| **클라우드 동기화** | Firebase SDK 10.7.1 (app-compat, database-compat) |
| **AI 연동** | Google Gemini 2.5 Flash API (HTTPS REST) |
| **마크다운 파싱** | Marked.js 11.1.1 (AI 응답 렌더링용) |
| **타이머 관리** | 커스텀 `TimerManager` (메모리 누수 방지) |
| **CDN 의존성** | Firebase SDK, Marked.js |

**특징**:
- **빌드 프로세스 없음**: 파일을 수정하면 즉시 브라우저에서 확인 가능
- **순수 JavaScript**: TypeScript, Webpack, Vite 등 빌드 도구 미사용
- **모듈화**: 각 기능별로 모듈 파일 분리 (js/modules/*.js)
- **하위 호환성**: 모든 함수를 `window` 객체에 중복 노출하여 기존 코드 호환

---

## 2. 빌드 & 엔트리 구조

### 2.1 진입점 및 스크립트 로딩 순서

**엔트리 파일**: `index.html` (라인 349-402)

**스크립트 로딩 순서** (의존성 순서대로):

```html
<!-- 1. 외부 CDN 라이브러리 -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>

<!-- 2. 설정 파일 -->
<script src="config.js"></script>

<!-- 3. 유틸리티 모듈 (가장 먼저 로드) -->
<script src="js/modules/constants.js"></script>
<script src="js/modules/dom-utils.js"></script>
<script src="js/modules/performance-utils.js"></script>
<script src="js/modules/indexed-db-cache.js"></script>

<!-- 4. Gemini AI 스택 (의존성 순서 중요) -->
<script src="js/modules/gemini-utils.js"></script>
<script src="js/modules/gemini-persona-builder.js"></script>
<script src="js/modules/gemini-api.js"></script>
<script src="js/modules/gemini-storage.js"></script>
<script src="js/modules/gemini-chat-ui.js"></script>
<script src="js/modules/gemini-message-box.js"></script>

<!-- 5. 상태 & 에너지 -->
<script src="js/modules/energy-manager.js"></script>
<script src="js/modules/state-manager.js"></script>

<!-- 6. Firebase 동기화 -->
<script src="js/modules/firebase-sync.js"></script>

<!-- 7. 데이터 & 비즈니스 로직 -->
<script src="js/modules/storage.js"></script>
<script src="js/modules/block-manager.js"></script>
<script src="js/modules/render-engine.js"></script>
<script src="js/modules/task-manager.js"></script>
<script src="js/modules/task-completion.js"></script>

<!-- 8. 기능 모듈 -->
<script src="js/modules/scheduler.js"></script>
<script src="js/modules/drag-drop-handler.js"></script>
<script src="js/modules/modal-handlers.js"></script>
<script src="js/modules/statistics.js"></script>
<script src="js/modules/gamification-system.js"></script>
<script src="js/modules/template-manager.js"></script>
<script src="js/modules/shop-manager.js"></script>

<!-- 9. UI & 이벤트 -->
<script src="js/modules/event-handlers.js"></script>
<script src="js/modules/ui-updates.js"></script>

<!-- 10. 타이머 관리 -->
<script src="js/timerManager.js"></script>

<!-- 11. 와이푸 시스템 -->
<script src="js/waifu.js"></script>

<!-- 12. 앱 생명주기 (초기화 로직 포함) -->
<script src="js/modules/app-lifecycle.js"></script>

<!-- 13. 메인 애플리케이션 (데이터 동기화 래퍼) -->
<script src="js/all-in-one.js"></script>
```

### 2.2 초기화 흐름

**`app-lifecycle.js`의 `init()` 함수가 자동 실행됨** (라인 537-538):

```javascript
// app-lifecycle.js 마지막 라인
init();
```

**초기화 단계**:

1. **타이머 정리**: 기존 타이머 모두 제거 (메모리 누수 방지)
2. **IndexedDB 초기화**: 대용량 비동기 캐싱 레이어 준비
3. **DOM 캐싱**: 자주 사용하는 DOM 요소를 `window.DOM` 객체에 저장
4. **Firebase 초기화**:
   - `config.js`에서 `firebaseConfig` 읽기
   - API key 검증 → 초기화 성공/실패 분기
   - 성공 시 `window.db` 설정, 실패 시 로컬 모드
5. **데이터 로드**:
   - **템플릿/상점 로드** (`loadTemplatesAndShop()`)
   - **로컬 데이터 로드** (`loadLocalData()` - localStorage)
   - **Firebase 모드일 경우**:
     - `loadGameState()` - 게임 상태 로드
     - 날짜 변경 감지 → `initializeNewDay()` 호출
     - `setupRealtimeSync()` - Firebase 실시간 동기화 설정
6. **초기 렌더링**:
   - `renderAll()` - 전체 UI 렌더링
   - `updateXPBar()` - XP 바 업데이트
   - `renderXPHistory()` - XP 히스토리 차트
7. **이벤트 리스너 설정**: `setupEventListeners()`
8. **타이머 시작**:
   - 1초마다: `updateCurrentTime()`, `moveExpiredTasks()`
   - 10분마다: `collapseAllExceptCurrent()` (비현재 블록 자동 접기)
   - 15분마다: `autoFocusCurrentBlock()` (현재 블록 자동 포커스)
9. **서브시스템 초기화**:
   - `initWaifuSystem()` - 와이푸 초기화
   - `WaifuMessageBox.init()` - 자동 메시지 시스템
   - `EnergyManager.init()` - 에너지 관리 UI
   - `Scheduler.init()` - 스케줄러 그리드

### 2.3 모듈 시스템 구조

**패턴**: 각 모듈은 함수를 정의하고 `window` 객체에 노출

```javascript
// 예시: task-manager.js
const openAddModal = (blockId) => { /* ... */ };
const closeAddModal = () => { /* ... */ };

// window 객체에 노출 (네임스페이스 + 개별 함수)
window.TaskManager = { openAddModal, closeAddModal };
window.openAddModal = openAddModal; // 하위 호환성
window.closeAddModal = closeAddModal;
```

**장점**:
- 빌드 도구 없이 즉시 실행 가능
- HTML에서 `onclick="openAddModal()"` 직접 호출 가능

**단점**:
- 전역 네임스페이스 오염
- 의존성 관리가 로딩 순서에 의존
- 타입 안정성 없음

---

## 3. 화면 & UI 구조

### 3.1 전체 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│  Top Toolbar                                                │
│  [⚡ 에너지] [💎 오늘XP] [🏆 보유XP] [⚡입력] [💬AI대화] │
├────────┬──────────────────────────────┬────────────────────┤
│        │ Active Task Banner           │                    │
│  Left  │ [진행 중인 작업 정보]        │                    │
│ Sidebar├──────────────────────────────┤   Waifu Panel     │
│        │ Current Block Visualizer     │                    │
│ [탭들] │ [현재 블록 진행도/완료율]    │ [캐릭터 이미지]    │
│        ├──────────────────────────────┤ [메시지]           │
│ 오늘   │                              │ [친밀도/완료/기분] │
│ 통계   │   Timeline Section           │                    │
│ 에너지 │   (6개 Time Blocks)          │                    │
│ 완료   │                              │                    │
│ 인박스 │   [05-08] [08-11] [11-14]    │                    │
│        │   [14-17] [17-19] [19-24]    │                    │
│        │                              │                    │
│        │   각 블록 내부:               │   Right Panel     │
│        │   - 블록 헤더                 │                    │
│        │   - 작업 목록                 │   [📝 템플릿]      │
│        │   - 추가 버튼                 │   [🛒 상점]        │
└────────┴──────────────────────────────┴────────────────────┘
```

### 3.2 주요 UI 영역

#### 3.2.1 Top Toolbar

**위치**: `index.html` 라인 18-42

**구성 요소**:
- **에너지 디스플레이**: `#energyDisplay` - 최근 기록된 에너지 수준 표시
- **오늘 XP**: `#todayXPDisplay` - 오늘 획득한 XP (dailyXP)
- **보유 XP**: `#availableXPDisplay` - 사용 가능한 총 XP (availableXP)
- **에너지 입력 버튼**: `openEnergyInput()` 호출, 단축키 Ctrl+O
- **AI 대화 버튼**: `openWaifuChat()` 호출

#### 3.2.2 Active Task Banner

**위치**: `index.html` 라인 61-77

**표시 조건**: 작업이 진행 중일 때 (`window.activeTaskId !== null`)

**정보**:
- 작업 제목 (`#activeTaskTitle`)
- 경과 시간 (`#activeTaskTime`) - 00:00 형식
- 획득 XP (`#activeTaskXP`) - 실시간 업데이트
- 보너스 정보 (`#activeTaskBonus`)

**동작**:
- 작업 시작 시 자동 표시
- 1초마다 경과 시간 업데이트
- 작업 완료 시 숨김

#### 3.2.3 Current Block Visualizer

**위치**: `index.html` 라인 44-58

**표시 조건**: 현재 시간이 블록 시간대에 속할 때

**정보**:
- 블록 시간대 라벨 (예: "08:00-11:00")
- 시간 진행률 바 (`#currentBlockTimeFill`)
- 경과/전체 시간 (예: "45/180분")
- 작업 완료율 바 (`#blockCompletionFill`)
- 완료/전체 작업 시간

**계산 로직** (`ui-updates.js`):
- 현재 시간 기준으로 블록 진행률 계산
- 완료된 작업의 adjustedDuration 합산하여 완료율 계산

#### 3.2.4 Left Sidebar (탭 시스템)

**위치**: `index.html` 라인 79-154

**탭 목록**:

##### (1) 🎯 오늘 탭

**내용**: 일정 스케줄러 그리드

**표시**:
- 스케줄 블록들의 그리드 뷰 (Scheduler.js가 렌더링)
- 각 시간대별 스케줄 항목
- 색상별 시각화

**기능**:
- 스케줄 추가/편집/삭제
- 드래그 앤 드롭으로 시간 조정

##### (2) 📊 통계 탭

**내용**:
- **지난 5일 XP 차트** (`#xpChart`): 막대 그래프
- **오늘 시간대별 XP** (`#timeblockXpChart`): 블록별 XP 막대

**데이터 소스**:
- `window.xpHistory` - 최근 7일 XP 기록
- `window.timeBlockXP` - 오늘 각 블록의 XP

**렌더링**: `statistics.js`의 `renderXPHistory()`, `renderTimeblockXPChart()`

##### (3) ⚡ 에너지 탭

**내용**:
- **현재 에너지**: 가장 최근 기록 (`#currentEnergy`)
- **오늘 평균**: 오늘 기록된 에너지 평균 (`#todayAvgEnergy`)
- **전체 평균**: 모든 기록의 평균 (`#overallAvgEnergy`)
- **오늘 기록된 에너지** (`#todayEnergyList`): 시간별 에너지 리스트
- **시간대별 평균 에너지** (`#timeblockEnergyAvg`): 블록별 평균

**데이터 소스**:
- localStorage의 `energyLevels_YYYY-MM-DD` 키
- 각 레코드: `{timestamp, hour, energy, context, activity}`

**렌더링**: `energy-manager.js`

##### (4) ✅ 완료 탭

**내용**: 오늘 완료한 작업 목록 (`#tadaList`)

**표시**:
- 완료 시간 순 정렬
- 작업명, 실제 소요 시간, 획득 XP 표시

**데이터 소스**:
- `window.tasks.filter(t => t.completed)`

##### (5) 📥 인박스 탭

**내용**: 시간대에 배치되지 않은 작업 (`#unassignedList`)

**조건**: `task.timeBlock === null || task.timeBlock === ""`

**기능**:
- 드래그하여 블록에 배치 가능
- 직접 편집/삭제 가능

#### 3.2.5 Timeline Section (메인 영역)

**위치**: `index.html` 라인 156-167, `render-engine.js`에서 동적 생성

**구성**:

##### Time Blocks (6개)

각 블록의 구조:

```html
<div class="time-block" data-block-id="8-11">
  <div class="block-header">
    <div class="block-title">
      <span class="block-time">08:00 - 11:00</span>
      <span class="collapse-toggle">▲</span>
    </div>
    <div class="block-controls">
      <button class="block-lock-btn">🔓</button> <!-- 또는 🔒 -->
      <span class="block-xp">+0 XP</span>
      <span class="task-count-badge">3개</span>
    </div>
    <!-- 상태 배지: ✨ 완벽한 계획! 또는 ❌ 계획 실패 -->
  </div>
  <div class="block-content">
    <div class="task-list" id="taskList-8-11">
      <!-- 작업 항목들 -->
    </div>
    <button class="add-task-btn">➕ 할 일 추가</button>
  </div>
</div>
```

**블록 상태**:
- **일반**: 기본 상태
- **잠금 (🔒)**: `isBlockLocked(blockId) === true`, 15 XP 소모
- **완벽 (✨)**: 블록 잠금 + 모든 작업 완료, 40 XP 보상
- **실패 (❌)**: 블록 잠금 + 미완료 작업 존재

**블록 잠금 로직** (`block-manager.js`):
- 잠금 시: `timeBlockStates[blockId].isLocked = true`, availableXP -= 15
- 해제 시: `timeBlockStates[blockId].isLocked = false`, availableXP += 40 (페널티)
- 완벽 완료 체크: 블록 내 모든 작업의 `completed === true`

##### Task Item (작업 항목)

```html
<div class="task-item" data-task-id="..." draggable="true">
  <div class="task-main">
    <button class="task-checkbox">⬜</button> <!-- 또는 ✅ -->
    <div class="task-details">
      <div class="task-text">작업 제목</div>
      <div class="task-meta">
        <span class="resistance-badge low">🟢 쉬움</span>
        <span class="duration-badge">⏱️ 30분</span>
      </div>
    </div>
    <div class="task-actions">
      <button class="task-action-btn start-btn">▶️</button>
      <button class="task-action-btn edit-btn">✏️</button>
      <button class="task-action-btn delete-btn">🗑️</button>
    </div>
  </div>
  <!-- 메모가 있으면 표시 -->
  <div class="task-memo">메모 내용...</div>
</div>
```

**작업 동작**:
- **체크박스 클릭**: `toggleTaskCompletion(taskId)` → 완료/미완료 토글
  - 완료 시: XP 획득, 호감도 증가, 완벽 블록 체크
- **▶️ 시작**: `startTask(taskId)` → activeTaskId 설정, 타이머 시작
- **✏️ 편집**: `openEditModal(taskId)` → 편집 모달 열기
- **🗑️ 삭제**: `deleteTask(taskId)` → 작업 삭제

**드래그 앤 드롭** (`drag-drop-handler.js`):
- 작업을 다른 블록으로 드래그 가능
- 인박스 ↔ 블록 간 이동 가능
- 드롭 시 `task.timeBlock` 값 변경

##### Current Time Line

**표시**: 현재 시간에 해당하는 블록에 빨간 선 표시

**계산** (`ui-updates.js`):
- 현재 블록 찾기
- 블록 내 경과 시간 비율 계산
- `top` 위치 설정

#### 3.2.6 Waifu Panel

**위치**: `index.html` 라인 169-195

**구성**:
- **캐릭터 이미지** (`#waifuImage`): 호감도에 따라 변경
- **기분 이모지** (`#waifuMood`): 😡, 😠, 😐, 🙂, 😊, 🥰
- **메시지** (`#waifuMessage`): 자동 메시지 또는 사용자 상호작용 응답
- **통계**:
  - 💕 친밀도 (`#waifuAffection`): 0-100
  - ✅ 완료 (`#waifuCompletedTasks`): 오늘 완료 작업 수
  - 😊 기분 (`#waifuMoodText`): 호감도 구간별 텍스트

**호감도 구간별 이미지** (`waifu.js`):
- 0-20: annoyed, disgusted, angry, disappointed, depressed
- 20-40: suspicious, thinking, serious, bored
- 40-55: neutral, nervous
- 55-70: giggling, smiling
- 70-85: giggling, laughing, blushing shyly, happy, excited
- 85-100: admiring, joyful, winking

**이미지 경로**: `assets/waifu_image/hyeeun_{pose}.png`

**호감도 증가 조건**:
- 작업 완료: +2 affection

**호감도 감소 조건**:
- (현재 구현되어 있지 않음, 잠재적으로 유휴 시간에 감소 가능)

**자동 메시지** (`gemini-message-box.js`):
- 설정된 간격(기본 3분)마다 자동 생성
- Gemini API로 현재 상황 분석하여 메시지 생성
- 일시정지 가능

#### 3.2.7 Right Panel (템플릿 & 상점)

**위치**: `index.html` 라인 197-227

##### 📝 템플릿 탭

**내용**: 템플릿 목록 (`#templateList`)

**템플릿 구조**:
```javascript
{
  id: "template-{timestamp}",
  name: "템플릿 이름",
  text: "작업 내용",
  memo: "메모",
  baseDuration: 30,
  resistance: "low" | "medium" | "high",
  timeBlock: "8-11" | null,
  autoGenerate: true | false // 매일 자동 생성 여부
}
```

**기능**:
- **템플릿 추가**: `openTemplateAddModal()` → 템플릿 생성
- **템플릿 편집**: 템플릿 클릭 → `openTemplateEditModal(id)`
- **템플릿 삭제**: 삭제 버튼
- **작업 생성**: "오늘 추가" 버튼 → 템플릿에서 작업 생성
- **자동 생성**: `autoGenerate: true`인 경우 매일 00시 자동 생성 (`app-lifecycle.js`)

##### 🛒 상점 탭

**내용**: 상점 아이템 목록 (`#shopItemList`)

**아이템 구조**:
```javascript
{
  id: "shop-{timestamp}",
  name: "상품 이름",
  price: 100, // 필요 XP
  image: "data:image/..." // Base64 인코딩 이미지 (선택)
}
```

**기능**:
- **상품 추가**: `openShopAddModal()` → 이미지 업로드 가능
- **상품 구매**: "구매" 버튼 → availableXP 소모
  - 조건: `availableXP >= item.price`
  - 효과: 호감도 +10, 와이푸 메시지 표시

### 3.3 모달 (Modal) 시스템

#### 3.3.1 할 일 추가 모달 (`#addModal`)

**트리거**:
- 블록 내 "➕ 할 일 추가" 버튼
- 단축키 (구현 시 Ctrl+N 등 가능)

**입력 필드**:
- 할 일 (`#addTaskInputModal`): 필수, 텍스트
- 메모 (`#addTaskMemoModal`): 선택, 텍스트
- 예상 소요시간 (`#addDurationSelector`): 5, 10, 15, 30, 45, 60, 90, 120분
- 심리적 거부감 (`#addResistanceSelector`):
  - 🟢 쉬움 (low, 1.0x)
  - 🟡 보통 (medium, 1.3x)
  - 🔴 어려움 (high, 1.6x)

**동작**:
- 저장 → `addTaskFromModal()` 호출
- `adjustedDuration = baseDuration * RESISTANCE_MULTIPLIERS[resistance]` 계산
- `tasks` 배열에 추가 → Firebase 동기화

#### 3.3.2 할 일 수정 모달 (`#editModal`)

**트리거**: 작업의 ✏️ 버튼 또는 우클릭 메뉴

**입력 필드**: 추가 모달과 동일

**동작**:
- 기존 작업 데이터 로드
- 저장 → `saveTaskEdit()` → `tasks` 배열 업데이트

#### 3.3.3 대량 할 일 추가 모달 (`#bulkAddModal`)

**트리거**: (UI에 버튼 구현 필요, 잠재적 기능)

**입력**: 여러 줄 텍스트 (`#bulkAddInput`)

**동작**:
- 한 줄당 하나의 작업 생성
- 기본값: 15분, 쉬움, 인박스

#### 3.3.4 작업 시간 기록 모달 (`#timeRecordModal`)

**트리거**: 작업 완료 시 자동 표시

**입력**: 실제 작업 시간 선택 (`#timeRecordSelector`)

**동작**:
- `task.actualDuration` 저장
- XP 계산에 사용 (향후 통계 분석용)

#### 3.3.5 템플릿 추가/편집 모달

**입력 필드**:
- 템플릿 이름 (`#templateName`)
- 할 일 (`#templateTaskText`)
- 메모
- 소요시간
- 저항도
- 시간대 배치 (`#templateTimeblockSelector`): "나중에" 또는 6개 블록 중 선택
- **자동 생성** (체크박스): 매일 자동으로 작업 생성

#### 3.3.6 상점 상품 추가/편집 모달

**입력 필드**:
- 상품 이름
- 필요 XP
- 상품 이미지 (파일 업로드 → Base64 변환 저장)

#### 3.3.7 에너지 입력 모달 (`#energyInputModal`)

**트리거**:
- 상단 "⚡ 에너지 입력" 버튼
- 단축키: Ctrl+O

**입력 필드**:
- 에너지 수준 (`#energyLevelInput`): 0-100 (숫자 + 슬라이더)
- 현재 상황/맥락 (`#energyContextInput`): 선택, 텍스트
- 관련 활동 (`#energyActivitySelect`): 선택
  - 💼 업무, 👥 회의, 🏃 운동, 🍽️ 식사, ☕ 휴식, 📚 학습, 🎨 창의적 작업, 🚗 출퇴근, 😴 수면

**동작**:
- `EnergyManager.addEnergyLevel(energy, context, activity)` 호출
- localStorage에 `energyLevels_YYYY-MM-DD` 키로 저장
- 에너지 탭 UI 업데이트

#### 3.3.8 Gemini 채팅 모달

**트리거**:
- "💬 AI와 대화하기" 버튼
- 단축키: Ctrl+K

**구성**:
- **헤더**: 날짜 선택, 카테고리 필터, 닫기 버튼
- **메시지 영역**:
  - 사용자 메시지 (우측, 파란색)
  - AI 응답 (좌측, 회색)
  - 마크다운 렌더링 (Marked.js)
- **입력 영역**: 텍스트 입력 + 전송 버튼
- **예시 질문 패널**: 빠른 질문 템플릿

**카테고리 필터**:
- 전체
- 🎯 작업 조언
- 💪 동기부여
- ❓ 질문/답변
- 📊 데이터 분석

**동작**:
- 메시지 입력 → Gemini API 호출 (`gemini-api.js`)
- 응답 받기 → localStorage에 히스토리 저장 (`gemini-storage.js`)
- 토큰 사용량 표시

#### 3.3.9 자동메시지 설정 모달 (`#messageSettingsModal`)

**입력**:
- 메시지 간격 (1-30분)
- 일시정지 체크박스

**동작**: `WaifuMessageBox` 설정 변경

#### 3.3.10 컨텍스트 메뉴 (`#contextMenu`)

**트리거**: 작업 우클릭

**메뉴 항목**:
- ✏️ 수정하기 → `openEditModal()`
- ▶️ 시작하기 → `startTask()`
- 📋 복제하기 → `duplicateTask()`
- 🗑️ 삭제 → `deleteTask()`

### 3.4 키보드 단축키

| 단축키 | 기능 |
|--------|------|
| Ctrl+O | 에너지 입력 모달 열기 |
| Ctrl+K | AI 채팅 모달 열기 |
| (확장 가능) Ctrl+N | 할 일 추가 모달 |
| (확장 가능) / | 검색 기능 |

---

## 4. 데이터 모델 & 저장 구조

### 4.1 핵심 데이터 타입

#### 4.1.1 Task (작업)

```javascript
{
  id: string,                  // 고유 ID (타임스탬프 기반)
  text: string,                // 작업 제목 (필수)
  memo: string,                // 메모 (선택)
  baseDuration: number,        // 예상 소요시간 (분) - 기본값
  resistance: "low" | "medium" | "high", // 심리적 거부감
  adjustedDuration: number,    // 조정된 소요시간 (baseDuration * 배율)
  timeBlock: string | null,    // 배치된 블록 ID ("8-11" 등) 또는 null (인박스)
  completed: boolean,          // 완료 여부
  actualDuration: number,      // 실제 소요시간 (분) - 사용자 기록
  createdAt: string,           // 생성 시각 (ISO 8601)
  completedAt: string | null,  // 완료 시각 (ISO 8601)
  fromAutoTemplate: boolean    // 자동생성 템플릿 여부 (선택)
}
```

**저항도 배율** (`constants.js`):
```javascript
RESISTANCE_MULTIPLIERS = {
  low: 1.0,    // 🟢 쉬움
  medium: 1.3, // 🟡 보통
  high: 1.6    // 🔴 어려움
}
```

#### 4.1.2 TimeBlockState (블록 상태)

```javascript
timeBlockStates = {
  "5-8": {
    isLocked: boolean,   // 블록 잠금 여부
    isPerfect: boolean,  // 완벽 완료 여부
    isFailed: boolean    // 실패 여부
  },
  "8-11": { /* ... */ },
  // ... 6개 블록
}
```

#### 4.1.3 DailyData (일일 데이터)

**저장 위치**:
- localStorage: `dailyPlans_YYYY-MM-DD`
- IndexedDB: `dailyData` 테이블
- Firebase: `dailyPlans/{date}`

**구조**:
```javascript
{
  tasks: Task[],                    // 작업 목록
  timeBlockStates: TimeBlockState,  // 블록 상태
  updatedAt: number                 // 타임스탬프 (밀리초)
}
```

#### 4.1.4 GameState (게임 상태)

**저장 위치**:
- localStorage: `gameState`
- IndexedDB: `gameState` 키
- Firebase: `gameState/{userId}` (향후 인증 추가 시)

**구조**:
```javascript
{
  level: number,                    // 플레이어 레벨
  totalXP: number,                  // 총 누적 XP
  dailyXP: number,                  // 오늘 획득 XP
  availableXP: number,              // 사용 가능 XP
  streak: number,                   // 연속 출석일
  lastLogin: string,                // 마지막 로그인 날짜 (YYYY-MM-DD)
  questBonusClaimed: boolean,       // 일일 퀘스트 보너스 수령 여부
  xpHistory: Array<{date, xp}>,    // XP 히스토리 (최근 7일)
  dailyQuests: Array<Quest>,        // 일일 퀘스트 목록
  timeBlockXP: Object<blockId, xp>, // 블록별 XP
  timeBlockXPHistory: Array<{date, blocks}>, // 블록별 XP 히스토리 (최근 5일)
  completedTasksHistory: Task[]     // 완료 작업 히스토리
}
```

#### 4.1.5 Quest (일일 퀘스트)

```javascript
{
  id: string,
  type: "complete_tasks" | "earn_xp" | "lock_blocks" | "perfect_blocks",
  title: string,
  description: string,
  target: number,        // 목표값
  progress: number,      // 현재 진행도
  completed: boolean,
  reward: number         // 보상 XP
}
```

#### 4.1.6 Template (템플릿)

```javascript
{
  id: string,
  name: string,
  text: string,
  memo: string,
  baseDuration: number,
  resistance: "low" | "medium" | "high",
  timeBlock: string | null,
  autoGenerate: boolean   // 매일 자동 생성 여부
}
```

**저장**: localStorage `templates`

#### 4.1.7 ShopItem (상점 아이템)

```javascript
{
  id: string,
  name: string,
  price: number,          // XP 가격
  image: string           // Base64 이미지 (선택)
}
```

**저장**: localStorage `shopItems`

#### 4.1.8 WaifuState (와이푸 상태)

```javascript
{
  affection: number,              // 호감도 (0-100)
  currentPose: string,            // 현재 포즈
  lastInteraction: number,        // 마지막 상호작용 시각 (타임스탬프)
  tasksCompletedToday: number,    // 오늘 완료 작업 수
  totalInteractions: number,      // 총 상호작용 횟수
  lastIdleWarning: number | null, // 마지막 유휴 경고 시각
  unlockedPoses: string[],        // 해금된 특수 포즈 목록
  lastAffectionTier: string,      // 마지막 호감도 구간 ("0-20" 등)
  clickCount: number,             // 클릭 카운터
  poseLockedUntil: number | null  // 포즈 잠금 해제 시각
}
```

**저장**: localStorage `waifuState`

#### 4.1.9 EnergyLevel (에너지 수준)

```javascript
{
  timestamp: number,    // 기록 시각 (밀리초)
  hour: number,         // 시간 (0-23)
  energy: number,       // 에너지 수준 (0-100)
  context: string,      // 상황/맥락 (선택)
  activity: string      // 활동 타입 (선택)
}
```

**저장**: localStorage `energyLevels_YYYY-MM-DD`

#### 4.1.10 GeminiChatMessage (채팅 메시지)

```javascript
{
  id: string,
  role: "user" | "model",
  text: string,
  timestamp: number,
  category: "task-advice" | "motivation" | "qa" | "analysis",
  tokenUsage: {
    promptTokens: number,
    candidatesTokens: number,
    totalTokens: number
  }
}
```

**저장**: localStorage `geminiChatHistory_YYYY-MM-DD`

### 4.2 저장소 아키텍처

#### 4.2.1 3단계 캐싱 전략

```
┌─────────────────────────────────────────────────────────┐
│  Application State (window 객체)                       │
│  - tasks, timeBlockStates, playerLevel, dailyXP 등     │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────┐
│  1순위: IndexedDB (비동기, 대용량)                     │
│  - dailyData 테이블: {date, tasks, timeBlockStates}  │
│  - gameState 저장                                     │
│  - 장점: UI 블로킹 없음, 용량 제한 거의 없음          │
│  - 단점: 비동기 처리 필요                             │
└───────────────┬───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────┐
│  2순위: localStorage (동기, 빠른 접근)                 │
│  - dailyPlans_YYYY-MM-DD                              │
│  - gameState                                          │
│  - templates, shopItems                               │
│  - 장점: 빠른 접근, 새로고침 시 즉시 로드             │
│  - 단점: 5-10MB 제한, 동기 처리로 UI 블로킹 가능      │
└───────────────┬───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────┐
│  3순위: Firebase Realtime DB (클라우드, 다중 장치)    │
│  - dailyPlans/{date}                                  │
│  - gameState/{userId} (향후)                          │
│  - 장점: 다중 장치 동기화, 백업                       │
│  - 단점: 네트워크 지연, 설정 필요                     │
└───────────────────────────────────────────────────────┘
```

#### 4.2.2 저장 흐름 (Write Path)

**트리거**: `saveDailyData()` 호출 시

```javascript
// storage.js
saveDailyData(callback) {
  const today = getLocalDate();
  const timestamp = Date.now();

  // 1. localStorage에 즉시 저장 (동기)
  const localData = {
    tasks: window.tasks,
    timeBlockStates: window.timeBlockStates,
    updatedAt: timestamp
  };
  localStorage.setItem('dailyPlans_' + today, JSON.stringify(localData));

  // 2. IndexedDB에 비동기 저장 (백그라운드)
  if (indexedDBCache.db) {
    indexedDBCache.saveDailyData(today, tasks, timeBlockStates)
      .catch(err => console.warn('IndexedDB 저장 실패'));
  }

  // 3. Firebase에 비동기 동기화
  if (useFirebase && db) {
    isSaving = true; // 무한 루프 방지 플래그
    db.ref('dailyPlans/' + today).set({
      tasks: arrToObj(tasks),
      timeBlockStates,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
      setTimeout(() => { isSaving = false; }, 300);
      if (callback) callback();
    });
  }
}
```

#### 4.2.3 로드 흐름 (Read Path)

**초기 로드**:

```
1. localStorage 읽기 (빠른 접근)
   ↓
2. Firebase 초기화 성공 시:
   - Firebase에서 타임스탬프 비교
   - Firebase > localStorage → Firebase 데이터 사용
   - localStorage > Firebase → localStorage 데이터 사용
   ↓
3. 실시간 동기화 설정 (setupRealtimeSync)
   - Firebase 데이터 변경 감지
   - isSaving 플래그로 무한 루프 방지
```

#### 4.2.4 동기화 규칙 (Conflict Resolution)

**타임스탬프 기반 "최신 우선" 정책** (`firebase-sync.js`):

```javascript
setupRealtimeSync() {
  const todayRef = db.ref('dailyPlans/' + getLocalDate());

  todayRef.on('value', (snapshot) => {
    if (isSaving) return; // 저장 중이면 무시

    const firebaseData = snapshot.val();
    const firebaseUpdatedAt = firebaseData?.updatedAt || 0;

    // localStorage 타임스탬프 확인
    const localData = JSON.parse(localStorage.getItem('dailyPlans_' + today));
    const localUpdatedAt = localData?.updatedAt || 0;

    // 비교: Firebase가 더 최신이면 덮어쓰기
    if (firebaseUpdatedAt > localUpdatedAt ||
        (window.tasks.length === 0 && firebaseTasks.length > 0)) {
      window.tasks = Object.values(firebaseData.tasks);
      window.timeBlockStates = firebaseData.timeBlockStates;
      RenderQueue.schedule('all');
    }
  });
}
```

**장점**:
- 다중 장치에서 동시 작업 가능
- "Device A에서 작업 → Device B에서 확인" 시나리오 지원

**단점**:
- 동시 편집 시 나중 타임스탬프가 이전 변경 덮어씀 (CRDT 미적용)

#### 4.2.5 IndexedDB 스키마 (`indexed-db-cache.js`)

**데이터베이스 이름**: `timeblock_cache`

**테이블**:

##### (1) `dailyData`

```javascript
{
  date: string (Primary Key),  // "YYYY-MM-DD"
  tasks: Task[],
  timeBlockStates: Object,
  updatedAt: number
}
```

##### (2) `gameState`

```javascript
{
  key: "current" (Primary Key),
  level: number,
  totalXP: number,
  // ... GameState 필드
}
```

**인덱스**: `date` (오름차순)

**자동 정리**:
- **프로덕션**: 비활성화 (장기 데이터 보존)
- **개발 모드**: 365일 이상 데이터 삭제 옵션 (수동 활성화)

#### 4.2.6 Firebase 구조

**경로**:

```
firebaseRoot/
├── dailyPlans/
│   ├── 2025-11-13/
│   │   ├── tasks: { task-1: {...}, task-2: {...} }
│   │   ├── timeBlockStates: { "5-8": {...}, ... }
│   │   └── updatedAt: 1731456789000
│   ├── 2025-11-14/
│   │   └── ...
│   └── ...
└── gameState/ (향후 인증 추가 시)
    └── {userId}/
        ├── level: 5
        ├── totalXP: 250
        └── ...
```

**데이터 형식**:
- tasks는 **객체**로 변환하여 저장 (`arrToObj(tasks)`)
  - Firebase는 배열을 잘 처리하지 못하므로 객체로 변환
  - `{0: task1, 1: task2}` → `Object.values()`로 다시 배열 변환

**보안 규칙** (현재 개발 모드):
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

**프로덕션 권장 규칙**:
```json
{
  "rules": {
    "dailyPlans": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```

**주의**: 현재 Firebase Auth 미구현, 인증 기능 추가 필요

### 4.3 데이터 흐름 예시

#### 4.3.1 작업 추가 시나리오

```
1. 사용자가 "할 일 추가" 버튼 클릭
   ↓
2. openAddModal() → 모달 표시
   ↓
3. 사용자 입력 후 "저장" 클릭
   ↓
4. addTaskFromModal()
   - 새 Task 객체 생성
   - window.tasks.push(newTask)
   ↓
5. saveDailyData()
   - localStorage 즉시 저장
   - IndexedDB 비동기 저장
   - Firebase 비동기 업로드
   ↓
6. renderTasks() → UI 업데이트
```

#### 4.3.2 다중 장치 동기화 시나리오

```
[장치 A]
1. 사용자가 작업 추가
   ↓
2. saveDailyData() → Firebase 업로드 (updatedAt: 1000)

[장치 B]
3. Firebase 리스너 감지
   ↓
4. setupRealtimeSync() 콜백 실행
   - firebaseUpdatedAt (1000) > localUpdatedAt (900)
   - window.tasks = firebaseTasks
   - RenderQueue.schedule('all')
   ↓
5. 장치 B에 작업 즉시 표시
```

#### 4.3.3 날짜 변경 시나리오

```
[23:59] 사용자가 작업 중
   ↓
[00:00] init() 실행 → loadLocalData()
   ↓
initializeNewDay() 호출
   - lastLoginDate (2025-11-13) !== today (2025-11-14)
   ↓
1. 어제 데이터 백업
   - xpHistory.push({date: "2025-11-13", xp: dailyXP})
   - completedTasksHistory.push(...완료작업)
   ↓
2. 미완료 작업 처리
   - timeBlock 있는 작업 → timeBlock = null (인박스로 이동)
   - 완료된 작업 제거
   ↓
3. 일일 데이터 초기화
   - dailyXP = 0
   - timeBlockStates = {}
   - dailyQuests = []
   ↓
4. 와이푸 상태 초기화
   - affection = 0
   - tasksCompletedToday = 0
   ↓
5. 자동생성 템플릿 추가
   - autoGenerate: true인 템플릿 → 작업 생성
   ↓
6. saveDailyData(), saveGameState()
```

---

## 5. 상태 관리 & 흐름

### 5.1 전역 상태 (`state-manager.js`)

**AppState 객체**:

```javascript
const AppState = {
  // Firebase
  db: null,
  useFirebase: false,

  // 작업
  tasks: [],
  timeBlockStates: {},
  expandedIds: new Set(),

  // UI 상태
  selectedDuration: 15,
  selectedResistance: 'low',
  selectedTimeBlock: '',
  contextMenuTaskId: null,
  focusedBlockId: null,
  editingTaskId: null,
  addingTaskToBlockId: null,
  completingTaskId: null,
  recordedTime: 15,
  quickSelectTaskId: null,
  quickSelectType: null,

  // 게임화
  playerLevel: 1,
  totalXP: 0,
  dailyXP: 0,
  streakDays: 0,
  lastLoginDate: null,
  xpHistory: [],
  dailyQuests: [],
  questBonusClaimed: false,
  availableXP: 0,
  timeBlockXP: {},
  timeBlockXPHistory: [],
  completedTasksHistory: [],

  // 템플릿 & 상점
  templates: [],
  shopItems: [],

  // 타이머
  activeTaskId: null,
  activeTaskInterval: null,
  activeTaskElapsed: 0,

  // 드래그
  dragPreview: null,

  // 기타
  isSaving: false,
  appTimers: []
};
```

**DOM 캐시**:

```javascript
const DOM = {
  appContainer: null,
  timeBlocks: null,
  unassignedList: null,
  editModal: null,
  addModal: null,
  // ... 30+ 요소
};
```

**캐싱 이유**:
- `document.querySelector()` 호출 최소화
- 성능 최적화 (렌더링 시 반복 조회 방지)

### 5.2 초기화 시퀀스

```
[페이지 로드]
   ↓
DOMContentLoaded (브라우저 자동)
   ↓
<script> 태그 순차 실행
   ↓
app-lifecycle.js 로드 완료
   ↓
init() 자동 실행 (라인 537)
   ↓
┌─────────────────────────────────────────┐
│ 1. cleanupTimers()                      │
│    - 기존 타이머 모두 제거              │
└─────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────┐
│ 2. indexedDBCache.init()                │
│    - DB 열기: "timeblock_cache"         │
│    - 테이블 생성: dailyData, gameState  │
└─────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────┐
│ 3. cacheDOMElements()                   │
│    - qs('#addModal') → DOM.addModal     │
│    - ... 30+ 요소 캐싱                  │
└─────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────┐
│ 4. Firebase 초기화                      │
│    - config.js 확인                     │
│    - firebase.initializeApp(config)     │
│    - window.db = firebase.database()    │
│    - 실패 시: useFirebase = false       │
└─────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────┐
│ 5. loadTemplatesAndShop()               │
│    - localStorage에서 템플릿 로드       │
└─────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────┐
│ 6. loadLocalData()                      │
│    - localStorage "gameState" 읽기      │
│    - localStorage "dailyPlans_..." 읽기 │
│    - window 객체에 할당                 │
└─────────────────────────────────────────┘
   ↓
[Firebase 모드?] ━━━ No ━━━┐
   ↓ Yes                    ↓
┌─────────────────────┐ ┌─────────────────┐
│ loadGameState()     │ │ 로컬 모드       │
│ (Firebase에서 로드) │ │ initializeNewDay│
└─────────────────────┘ └─────────────────┘
   ↓                        ↓
[날짜 변경?]                │
   ↓ Yes                    │
initializeNewDay()          │
   - 어제 데이터 백업       │
   - 일일 초기화            │
   - 자동템플릿 생성        │
   ↓                        │
setupRealtimeSync()         │
   - Firebase 리스너 등록   │
   - 타임스탬프 비교 로직   │
   ↓                        ↓
┌─────────────────────────────────────────┐
│ 7. 초기 렌더링                          │
│    - renderAll()                        │
│    - updateXPBar()                      │
│    - renderXPHistory()                  │
└─────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────┐
│ 8. setupEventListeners()                │
│    - 탭 클릭, 버튼 클릭 등              │
└─────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────┐
│ 9. 타이머 시작                          │
│    - setInterval(updateCurrentTime, 1s) │
│    - setInterval(collapseBlocks, 10m)   │
│    - setInterval(autoFocus, 15m)        │
└─────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────┐
│ 10. 서브시스템 초기화                   │
│    - initWaifuSystem()                  │
│    - WaifuMessageBox.init()             │
│    - EnergyManager.init()               │
│    - Scheduler.init()                   │
└─────────────────────────────────────────┘
   ↓
[초기화 완료] 🎉
```

### 5.3 렌더링 최적화 (`performance-utils.js`)

**문제**: 빠른 연속 변경 시 과도한 렌더링

**해결**: RenderQueue 디바운싱

```javascript
const RenderQueue = {
  pending: null,
  debounceMs: 100,

  schedule(type) {
    clearTimeout(this.pending);
    this.pending = setTimeout(() => {
      if (type === 'all') {
        renderAll();
      } else if (type === 'tasks') {
        renderTasks();
      }
    }, this.debounceMs);
  }
};
```

**사용 예**:
```javascript
// 작업 추가 후
saveDailyData(() => {
  RenderQueue.schedule('tasks'); // 100ms 디바운스
});
```

### 5.4 타이머 관리 (`timerManager.js`)

**문제**: `setInterval` 누수 → 메모리 증가 → 성능 저하

**해결**: 중앙 집중식 타이머 관리

```javascript
const timerManager = {
  timers: new Map(),

  setInterval(callback, ms, label) {
    const id = setInterval(callback, ms);
    this.timers.set(label || id, id);
    return id;
  },

  clear(idOrLabel) {
    const id = this.timers.get(idOrLabel) || idOrLabel;
    clearInterval(id);
    this.timers.delete(idOrLabel);
  },

  clearAll() {
    this.timers.forEach(id => clearInterval(id));
    this.timers.clear();
  }
};

// beforeunload 시 자동 정리
window.addEventListener('beforeunload', () => {
  timerManager.clearAll();
});
```

**권장 사용법**:
```javascript
// ❌ 직접 사용하지 말 것
const id = setInterval(() => {}, 1000);

// ✅ timerManager 사용
const id = timerManager.setInterval(() => {}, 1000, 'currentTime');
```

---

## 6. Gemini 연동

### 6.1 Gemini API 구조

**모델**: `gemini-2.5-flash-preview-05-20` (2025년 5월 20일 프리뷰)

**엔드포인트**:
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent
```

**API 키**: `config.js`의 `GEMINI_API_KEY` (사용자가 설정해야 함)

**요청 구조** (`gemini-api.js`):

```javascript
{
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [{ text: systemPrompt }]
      },
      ...chatHistory.slice(-MAX_HISTORY_MESSAGES),
      {
        role: "user",
        parts: [{ text: userMessage }]
      }
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 2048
    }
  })
}
```

**응답 구조**:
```javascript
{
  candidates: [{
    content: {
      parts: [{ text: "AI 응답 텍스트..." }],
      role: "model"
    }
  }],
  usageMetadata: {
    promptTokenCount: 1500,
    candidatesTokenCount: 300,
    totalTokenCount: 1800
  }
}
```

### 6.2 페르소나 시스템

**핵심 아이디어**: 호감도에 따라 AI의 성격과 말투 변화

**페르소나 생성** (`gemini-api.js`의 `generateWaifuPersona()`):

```javascript
function generateWaifuPersona(waifuState) {
  const affection = waifuState.affection; // 0-100

  // 성격 정보 (호감도 구간별)
  const personality = getPersonalityInfo(affection);

  // 시스템 프롬프트 구성
  return `당신은 혜은이라는 이름의 19세 여성 AI 어시스턴트입니다.

## 기본 설정
- 나는 너의 선배이자 ADHD/ASD가 있는 후배의 작업 관리를 돕는 상담사야
- 너는 나의 후배야

## 현재 상태
- 호감도: ${affection}/100
- 오늘 완료 작업: ${tasksCompletedToday}개
- 오늘 XP: ${dailyXP}

## 현재 시간 정보
- 현재 시각: ${currentHour}:${currentMinute}
- 오늘 남은 시간: ${hoursLeft}시간 ${minutesLeft}분

## 현재 블록 정보
${currentBlockInfo} <!-- "08:00-11:00 블록 (2시간 15분 남음)" -->
${currentBlockTasks} <!-- 현재 블록 작업 목록 -->

## XP 히스토리
${xpHistoryInfo} <!-- 최근 5일 XP 차트 -->

## 시간대별 XP
${timeBlockXPHistoryInfo}

## 인박스 작업
${inboxInfo} <!-- 미배치 작업 목록 -->

## 템플릿
${templateInfo}

## 성격 & 말투
${personality.description}
- 기분: ${personality.mood}
- 반응 예시: ${personality.examples}

## 응답 규칙
1. 너의 현재 성격과 기분에 맞게 대답해
2. 짧고 간결하게 (2-3문장 이내)
3. 이모지 사용 금지
4. 존댓말/반말 혼용 ${affection < 40 ? '(퉁명스럽게)' : '(친근하게)'}

## 와이푸의 목표
${waifuGoals}

## 에너지 수준 정보
${energyInfo}
`;
}
```

**호감도 구간별 성격** (`waifu.js`):

| 호감도 | 이름 | 기분 | 말투 예시 |
|--------|------|------|----------|
| 0-20 | 혐오, 적대 | 😡 | "꺼져. 진짜로." / "시발 또 왔네." |
| 20-40 | 경계, 혐오감 완화 | 😠 | "...또 뭐야, 씨발." / "귀찮게." |
| 40-55 | 무관심, 냉담 | 😐 | "...뭔데." / "그래서?" |
| 55-70 | 관심, 경계 풀림 | 🙂 | "오늘은... 괜찮네." / "나쁘지 않은데?" |
| 70-85 | 호감, 친근 | 😊 | "오늘 많이 했네! 대단한데?" / "잘하고 있어!" |
| 85-100 | 애정, 헌신 | 🥰 | "선배... 정말 멋있어요..." / "사랑해요!" |

### 6.3 프롬프트에 포함되는 정보

**`gemini-persona-builder.js`의 Helper 함수들**:

#### (1) `getXPHistoryInfo()`
```
최근 5일 XP:
- 2025-11-10: 45 XP
- 2025-11-11: 60 XP
- 2025-11-12: 32 XP
- 2025-11-13: 78 XP
- 2025-11-14: 24 XP (오늘)
```

#### (2) `getCurrentBlockInfo()`
```
현재 블록: 08:00-11:00 (2시간 15분 남음)
현재 블록 작업:
1. [미완료] 보고서 작성 (30분, 🟡 보통)
2. [완료] 이메일 확인 (15분, 🟢 쉬움)
```

#### (3) `getInboxInfo()`
```
인박스 (미배치) 작업: 5개
1. 책 읽기 (60분, 🟢 쉬움)
2. 운동 (45분, 🔴 어려움)
...
```

#### (4) `getTemplateInfo()`
```
등록된 템플릿: 3개
1. 아침 운동 (30분, 05-08, 자동생성)
2. 일일 회의 (60분, 08-11)
```

#### (5) `getEnergyInfoForChat()` (energy-manager.js)
```
현재 에너지: 65% (☕ 휴식 직후)
오늘 평균: 58%
시간대별 평균:
- 05-08: 45%
- 08-11: 72%
- 11-14: 60%
```

### 6.4 채팅 UI 흐름

**사용자 메시지 전송**:

```
1. 사용자가 메시지 입력 후 전송 버튼 클릭
   ↓
2. gemini-chat-ui.js의 sendMessage()
   - 입력 검증
   - 메시지 객체 생성: {id, role: "user", text, timestamp}
   - chatHistory.push(userMessage)
   - UI에 사용자 메시지 표시
   ↓
3. callGeminiAPI(userMessage, chatHistory)
   - waifuState 읽기
   - generateWaifuPersona() → systemPrompt 생성
   - fetch() 호출 (gemini-api.js)
   ↓
4. API 응답 수신
   - 응답 파싱: {text, tokenUsage}
   - 카테고리 분류: classifyMessage(text, "model")
   - 메시지 객체 생성: {id, role: "model", text, category, tokenUsage}
   - chatHistory.push(aiMessage)
   ↓
5. UI 업데이트
   - AI 메시지 표시 (마크다운 렌더링)
   - 토큰 사용량 표시
   - localStorage에 히스토리 저장 (gemini-storage.js)
```

**카테고리 자동 분류** (`gemini-chat-ui.js`):

```javascript
function classifyMessage(text, role) {
  const keywords = {
    'task-advice': ['작업', '계획', '일정', '우선순위'],
    'motivation': ['힘내', '격려', '잘하고', '칭찬'],
    'analysis': ['통계', '분석', 'xp', '완료율'],
    'qa': ['?', '어떻', '무엇', '왜']
  };

  // 키워드 매칭 → 점수 계산 → 최고 점수 카테고리 반환
}
```

**예시 질문 패널**:

```javascript
const exampleQuestions = [
  "오늘 할 일 추천해줘",
  "현재 진행 상황 어때?",
  "에너지 낮을 때 뭐 하면 좋을까?",
  "XP 효율적으로 얻는 방법은?",
  "인박스 작업 정리 도와줘"
];
```

### 6.5 자동 메시지 시스템 (`gemini-message-box.js`)

**기능**: 일정 간격으로 AI가 자동으로 메시지 생성

**설정**:
- 메시지 간격: 1-30분 (기본 3분)
- 일시정지 옵션

**메시지 생성 로직**:

```javascript
async function generateMessage(force = false) {
  // 현재 상황 분석
  const context = analyzeUserContext(); // 인박스 작업 수, 에너지, XP 등

  // Gemini API 호출 (프롬프트: "현재 상황에 맞는 짧은 메시지 생성")
  const message = await callGeminiAPI(
    "현재 상황을 보고 나에게 짧은 조언이나 격려를 해줘 (1-2문장)",
    []
  );

  // 메시지함에 추가
  addMessage(message);

  // 알림 배지 표시
  showBadge();
}
```

**메시지함 UI**:
- 헤더 클릭으로 펼치기/접기
- 메시지 목록 (시간 순)
- 액션: 설정, 모두 삭제, 새 메시지 받기

### 6.6 토큰 사용량 추적

**저장**: `gemini-storage.js`

```javascript
// localStorage에 저장
{
  totalTokensUsed: 15000,
  totalCost: 0.02,  // 가정: $0.001 per 1000 tokens
  messageCount: 50
}
```

**비용 계산** (`gemini-utils.js`):
```javascript
function calculateTokenCost(tokenCount) {
  const COST_PER_1K_TOKENS = 0.001; // USD
  return (tokenCount / 1000) * COST_PER_1K_TOKENS;
}
```

**UI 표시**:
```
총 토큰: 15,000 (예상 비용: $0.02)
이번 대화: 1,800 토큰
```

---

## 7. 현재 발견된 문제 & 기술 부채

### 7.1 아키텍처 문제

#### 7.1.1 전역 네임스페이스 오염

**문제**:
- 모든 함수/변수가 `window` 객체에 노출
- 30+ 모듈, 각 모듈당 5-20개 함수 → 100+ 전역 변수

**영향**:
- 이름 충돌 위험
- 디버깅 어려움
- 코드 추적 곤란

**해결 방안**:
- ES6 모듈 시스템 (import/export) 도입
- 네임스페이스 객체로 그룹화 (예: `App.TaskManager.openAddModal()`)
- 빌드 도구 도입 (Webpack, Vite)

#### 7.1.2 의존성 관리

**문제**:
- 스크립트 로딩 순서에 의존
- 순서 변경 시 즉시 오류 발생
- 의존성 명시되지 않음

**해결 방안**:
- package.json + 모듈 번들러
- 명시적 import 문

#### 7.1.3 타입 안정성 부재

**문제**:
- JavaScript 동적 타입 → 런타임 에러 위험
- Task 객체 필드 누락/오타 방지 불가

**해결 방안**:
- TypeScript 도입
- JSDoc 주석 강화 + TSC 검사

### 7.2 데이터 동기화 문제

#### 7.2.1 동시 편집 충돌

**문제**:
- 타임스탬프 기반 "최신 우선" → 동시 편집 시 데이터 손실
- Device A: tasks[0] 수정 (13:00:00)
- Device B: tasks[1] 수정 (13:00:01)
- 결과: Device A의 변경 사라짐

**해결 방안**:
- CRDT (Conflict-free Replicated Data Type) 적용
- Operational Transformation
- Firebase의 `update()` 대신 `transaction()` 사용

#### 7.2.2 Firebase 무한 루프 위험

**문제**:
- `isSaving` 플래그로 방지하고 있으나 타이밍 이슈 가능
- 300ms 타임아웃이 충분하지 않을 수 있음

**현재 완화 방법**:
```javascript
if (isSaving) return; // 저장 중이면 리스너 무시
```

**개선 방안**:
- Firebase 트랜잭션 ID 비교
- Debounce 시간 증가
- 로컬 변경 큐 시스템

#### 7.2.3 IndexedDB 오류 처리

**문제**:
- IndexedDB 저장 실패 시 로그만 남김
- 사용자에게 알림 없음

**해결 방안**:
- 오류 시 localStorage 폴백 명시적 표시
- 오류 리포팅 (Sentry 등)

### 7.3 성능 문제

#### 7.3.1 과도한 렌더링

**문제**:
- `renderAll()` 호출 시 전체 DOM 재생성
- 6개 블록 * 평균 5개 작업 = 30개 작업 항목 재생성

**현재 완화**:
- RenderQueue 디바운싱 (100ms)

**개선 방안**:
- Virtual DOM (React, Vue)
- 증분 렌더링 (변경된 부분만 업데이트)

#### 7.3.2 localStorage 용량 제한

**문제**:
- 브라우저별 5-10MB 제한
- completedTasksHistory 누적 → 용량 초과 위험

**해결 방안**:
- 오래된 히스토리 IndexedDB로 이동
- 압축 (LZ-String 등)
- 서버 저장

#### 7.3.3 타이머 누적

**문제**:
- `timerManager` 사용하지 않는 코드 존재 가능
- 메모리 누수 위험

**해결 방안**:
- 전체 코드베이스 감사
- ESLint 규칙: setInterval 직접 사용 금지

### 7.4 UI/UX 문제

#### 7.4.1 드래그 앤 드롭 프리뷰 미완성

**현재 상태**:
- 드래그 시 프리뷰 표시 코드 있으나 불완전
- 시각적 피드백 부족

**개선 필요**:
- HTML5 Drag API 완전 구현
- 드롭 영역 하이라이트

#### 7.4.2 모바일 반응형 미흡

**문제**:
- 데스크톱 중심 레이아웃
- 작은 화면에서 사이드바 겹침

**해결 방안**:
- Media Query 추가
- 모바일 전용 레이아웃

#### 7.4.3 접근성 (A11y) 부족

**문제**:
- 키보드 내비게이션 제한적
- 스크린 리더 지원 없음
- ARIA 속성 누락

**해결 방안**:
- ARIA labels 추가
- 포커스 관리
- 키보드 단축키 확장

### 7.5 보안 문제

#### 7.5.1 Firebase 인증 부재

**문제**:
- 현재 Firebase 규칙: 읽기/쓰기 모두 허용
- 누구나 데이터 접근 가능

**해결 방안**:
- Firebase Authentication 통합
- 사용자별 데이터 격리

#### 7.5.2 XSS 취약점 가능성

**현재 완화**:
- `escapeHtml()` 함수 사용

**문제**:
- 모든 사용자 입력에 적용되었는지 검증 필요
- Gemini API 응답도 escapeHtml() 통과하는지 확인 필요

**해결 방안**:
- CSP (Content Security Policy) 헤더
- DOMPurify 라이브러리 사용

#### 7.5.3 API 키 노출

**문제**:
- `config.js`에 Gemini API 키 평문 저장
- 클라이언트 사이드 → 소스 코드에서 키 확인 가능

**해결 방안**:
- 서버 사이드 프록시
- 환경 변수 + 빌드 시 주입

### 7.6 코드 품질 문제

#### 7.6.1 중복 코드

**예시**:
- 모달 열기/닫기 로직 각 모달마다 반복
- 렌더링 함수에서 HTML 문자열 조합 반복

**해결 방안**:
- 공통 컴포넌트 추출
- 템플릿 엔진 (Handlebars, EJS) 도입

#### 7.6.2 긴 함수

**문제**:
- `generateWaifuPersona()`: 150+ 줄
- `renderTimeBlocks()`: 100+ 줄

**해결 방안**:
- 함수 분해 (Extract Function 리팩토링)
- 단일 책임 원칙 적용

#### 7.6.3 주석 부족 (일부)

**현재 상태**:
- 대부분 모듈은 JSDoc 헤더 있음
- 일부 복잡한 로직은 주석 부족

**해결 방안**:
- 복잡한 알고리즘 주석 추가
- README.md 확장

### 7.7 테스트 부재

**문제**:
- 단위 테스트 없음
- 통합 테스트 없음
- 수동 테스트만 의존

**위험**:
- 리팩토링 시 회귀 버그
- 코드 변경 영향 파악 어려움

**해결 방안**:
- Jest, Vitest 도입
- 핵심 로직 단위 테스트 (XP 계산, 타임스탬프 비교 등)
- E2E 테스트 (Playwright, Cypress)

### 7.8 미래 개선 방향

#### 7.8.1 프레임워크 마이그레이션

**옵션**:
- React + TypeScript + Vite
- Vue 3 + TypeScript + Vite
- Svelte + TypeScript

**이점**:
- 컴포넌트 재사용성
- 상태 관리 명확화 (Redux, Pinia)
- 타입 안정성
- 개발자 도구

#### 7.8.2 백엔드 API 도입

**현재**: 클라이언트 사이드 전용

**향후**:
- Node.js + Express (또는 Next.js API Routes)
- Gemini API 키 서버에서 관리
- 사용자 인증 (JWT)
- 데이터 검증

#### 7.8.3 고급 기능

**계획된 기능** (CLAUDE.md 참조):
- **인지 부하 경고**: 복잡한 작업 많을 때 알림
- **Pomodoro 타이머**: 작업 시간 세분화
- **통계 대시보드**: 주간/월간 리포트
- **협업 기능**: 다른 사용자와 작업 공유

#### 7.8.4 PWA (Progressive Web App)

**이점**:
- 오프라인 작동
- 앱처럼 설치 가능
- 푸시 알림

**필요 작업**:
- Service Worker 구현
- manifest.json 작성
- 오프라인 캐싱 전략

---

## 부록 A: 주요 파일 목록

| 파일 경로 | 라인 수 | 역할 |
|-----------|---------|------|
| `index.html` | 405 | 메인 HTML 구조 |
| `js/all-in-one.js` | 462 | 데이터 동기화 래퍼 |
| `js/waifu.js` | 1,000+ | 와이푸 시스템 |
| `js/timerManager.js` | 100+ | 타이머 관리 |
| `js/modules/app-lifecycle.js` | 539 | 앱 초기화 |
| `js/modules/state-manager.js` | 400+ | 전역 상태 관리 |
| `js/modules/storage.js` | 500+ | 3단계 저장소 |
| `js/modules/firebase-sync.js` | 200+ | Firebase 실시간 동기화 |
| `js/modules/task-manager.js` | 300+ | 작업 CRUD |
| `js/modules/render-engine.js` | 400+ | UI 렌더링 |
| `js/modules/gemini-api.js` | 300+ | Gemini API 호출 |
| `js/modules/gemini-chat-ui.js` | 500+ | 채팅 UI |
| `js/modules/gemini-persona-builder.js` | 600+ | 페르소나 생성 |
| `js/modules/energy-manager.js` | 300+ | 에너지 관리 |
| `js/modules/gamification-system.js` | 400+ | XP/레벨/퀘스트 |
| `js/modules/statistics.js` | 200+ | 통계 차트 |
| `css/main.css` | 800+ | 메인 스타일 |
| `css/timeline.css` | 500+ | 타임라인 스타일 |
| `css/waifu.css` | 600+ | 와이푸 스타일 |

**총 라인 수**: 약 8,000+ 라인 (주석 포함)

---

## 부록 B: 데이터 구조 JSON 예시

### Task 예시

```json
{
  "id": "task-1731456789000",
  "text": "프로젝트 보고서 작성",
  "memo": "Q4 실적 포함, CEO 리뷰 필요",
  "baseDuration": 60,
  "resistance": "medium",
  "adjustedDuration": 78,
  "timeBlock": "8-11",
  "completed": false,
  "actualDuration": 0,
  "createdAt": "2025-11-14T02:00:00.000Z",
  "completedAt": null
}
```

### DailyData 예시 (Firebase)

```json
{
  "tasks": {
    "0": {
      "id": "task-1",
      "text": "보고서 작성",
      "baseDuration": 60,
      "resistance": "medium",
      "adjustedDuration": 78,
      "timeBlock": "8-11",
      "completed": false,
      "createdAt": "2025-11-14T02:00:00.000Z"
    },
    "1": {
      "id": "task-2",
      "text": "이메일 확인",
      "baseDuration": 15,
      "resistance": "low",
      "adjustedDuration": 15,
      "timeBlock": "8-11",
      "completed": true,
      "completedAt": "2025-11-14T03:15:00.000Z"
    }
  },
  "timeBlockStates": {
    "5-8": {
      "isLocked": false,
      "isPerfect": false,
      "isFailed": false
    },
    "8-11": {
      "isLocked": true,
      "isPerfect": false,
      "isFailed": false
    }
  },
  "updatedAt": 1731456789000
}
```

### GameState 예시

```json
{
  "level": 3,
  "totalXP": 120,
  "dailyXP": 45,
  "availableXP": 80,
  "streak": 5,
  "lastLogin": "2025-11-14",
  "questBonusClaimed": false,
  "xpHistory": [
    {"date": "2025-11-10", "xp": 32},
    {"date": "2025-11-11", "xp": 50},
    {"date": "2025-11-12", "xp": 28},
    {"date": "2025-11-13", "xp": 45},
    {"date": "2025-11-14", "xp": 45}
  ],
  "dailyQuests": [
    {
      "id": "quest-1",
      "type": "complete_tasks",
      "title": "5개 작업 완료",
      "target": 5,
      "progress": 2,
      "completed": false,
      "reward": 20
    }
  ],
  "timeBlockXP": {
    "5-8": 10,
    "8-11": 25,
    "11-14": 10
  },
  "timeBlockXPHistory": [
    {
      "date": "2025-11-13",
      "blocks": {
        "5-8": 8,
        "8-11": 20,
        "11-14": 12,
        "14-17": 5
      }
    }
  ],
  "completedTasksHistory": []
}
```

---

## 부록 C: 용어 사전

| 용어 | 설명 |
|------|------|
| **타임블록 (Time Block)** | 하루를 6개로 나눈 시간 구간 |
| **저항도 (Resistance)** | 작업의 심리적 거부감 (low/medium/high) |
| **조정 시간 (Adjusted Duration)** | 기본 시간 × 저항도 배율 |
| **XP** | 경험치 (Experience Points) |
| **일일 XP (dailyXP)** | 오늘 획득한 XP |
| **보유 XP (availableXP)** | 사용 가능한 총 XP |
| **블록 잠금 (Lock Block)** | 계획 확정, 15 XP 소모 |
| **완벽 완료 (Perfect)** | 잠긴 블록의 모든 작업 완료, 40 XP 보상 |
| **인박스 (Inbox)** | 시간대에 배치되지 않은 작업 |
| **템플릿 (Template)** | 반복 작업 자동 생성 기능 |
| **호감도 (Affection)** | 와이푸의 친밀도 (0-100) |
| **페르소나 (Persona)** | AI의 성격/말투 설정 |
| **에너지 수준 (Energy Level)** | 사용자의 컨디션 (0-100) |

---

## 결론

본 보고서는 타임블럭 플래너 (Daily Quest) 프로젝트의 현재 구현 상태를 상세히 기록했습니다. 이 문서를 기반으로 다음을 수행할 수 있습니다:

1. **새로운 프레임워크로 재구현**: React, Vue, Svelte 등으로 마이그레이션 시 참고
2. **기능 확장**: 새로운 기능 추가 시 기존 구조 이해
3. **버그 수정**: 문제 발생 시 원인 분석
4. **문서화**: 새 팀원 온보딩 자료
5. **아키텍처 개선**: 기술 부채 해소 로드맵 수립

**핵심 강점**:
- 모듈화된 구조
- 3단계 캐싱 전략
- Gemini API 연동
- 게임화 시스템

**주요 개선 필요 영역**:
- 타입 안정성 (TypeScript)
- 동시 편집 충돌 해결
- 성능 최적화 (Virtual DOM)
- 테스트 커버리지
- 보안 강화 (인증, API 키 보호)

**다음 단계 권장 사항**:
1. TypeScript + React/Vue 마이그레이션 계획 수립
2. 단위 테스트 작성 (핵심 로직부터)
3. Firebase Auth 통합
4. 성능 프로파일링 및 최적화
5. PWA 기능 추가

---

**문서 버전**: 1.0
**최종 수정**: 2025-11-14
**작성자**: AI Analysis (Claude Code)
**리뷰 필요**: 개발자 검토 후 수정

---

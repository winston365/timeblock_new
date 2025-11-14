# 타임블럭 플래너 - 미구현 기능 목록

> **작성일**: 2025-11-14
> **기준 문서**: PROJECT_UI_FEATURES_REPORT.md
> **현재 구현 상태**: React/TypeScript 재구현 진행 중

---

## ✅ 구현 완료 (방금 완료된 기능 포함)

### 1. 에너지 관리 시스템 ✅
- ✅ 에너지 입력 (슬라이더 0-100%)
- ✅ 활동 타입 선택 (업무, 회의, 운동 등)
- ✅ 시간대별 평균 에너지 차트
- ✅ 현재/오늘 평균/전체 평균 통계
- ✅ localStorage 저장 (energyLevels_YYYY-MM-DD)

### 2. Gemini 챗봇 ✅
- ✅ Gemini API 연동 (gemini-2.0-flash-exp)
- ✅ 챗봇 모달 UI
- ✅ 대화 히스토리 관리
- ✅ 와이푸 호감도 기반 페르소나 시스템
- ✅ 예시 질문 제공

### 3. 와이푸 시스템 ✅
- ✅ 호감도 기반 이미지 변경
- ✅ poses 폴더 구조 연결 (hostile, wary, indifferent, affectionate, loving)
- ✅ 클릭 시 포즈 변경
- ✅ 호감도 표시

### 4. 기본 UI 구조 ✅
- ✅ 왼쪽 사이드바 (넓이 2배로 확장)
- ✅ 중앙 타임블럭 영역
- ✅ 우측 패널 (템플릿/상점)
- ✅ 상단 툴바

---

## ❌ 미구현 기능 목록

### 1. 타임블럭 스케줄러 핵심 기능

#### 1.1 Active Task Banner (진행 중 작업 배너)
**위치**: 상단 중앙, 작업 진행 시 표시
**내용**:
- 작업 제목 표시
- 경과 시간 (00:00 형식, 실시간 업데이트)
- 획득 XP 표시
- 보너스 정보
- 1초마다 자동 업데이트

**구현 필요**:
```typescript
// 활성 작업 상태 관리
const [activeTask, setActiveTask] = useState<Task | null>(null);
const [elapsedTime, setElapsedTime] = useState(0);

// 타이머 로직
useEffect(() => {
  if (!activeTask) return;
  const timer = setInterval(() => {
    setElapsedTime(prev => prev + 1);
  }, 1000);
  return () => clearInterval(timer);
}, [activeTask]);
```

#### 1.2 Current Block Visualizer (현재 블록 진행도)
**위치**: Active Task Banner 아래
**내용**:
- 블록 시간대 라벨 (예: "08:00-11:00")
- 시간 진행률 바 (현재 시간 기준)
- 경과/전체 시간 표시
- 작업 완료율 바 (완료된 작업 시간 기준)
- 완료/전체 작업 시간

**구현 필요**:
```typescript
// 현재 블록 진행률 계산
const blockProgress = calculateBlockProgress(currentHour, blockId);
const completionProgress = calculateCompletionProgress(tasks, blockId);
```

#### 1.3 Current Time Line (현재 시간 선)
**기능**: 타임블럭 내에 현재 시간을 나타내는 빨간 선 표시
**계산**:
- 현재 블록 찾기
- 블록 내 경과 시간 비율 계산
- CSS `top` 위치 동적 설정

#### 1.4 블록 잠금 시스템
**기능**:
- 블록 잠금 버튼 (🔓 ↔ 🔒)
- 잠금 시: availableXP -15
- 해제 시: availableXP +40 (페널티)
- 완벽 완료 체크: 블록 내 모든 작업 완료 시 ✨ 배지 + 40 XP 보상
- 실패 체크: 블록 잠금 + 미완료 작업 있으면 ❌ 배지

**구현 필요**:
```typescript
interface TimeBlockState {
  isLocked: boolean;
  isPerfect: boolean;
  isFailed: boolean;
}

const lockBlock = (blockId: string) => {
  // XP 소모 체크
  if (gameState.availableXP < 15) return;

  // 블록 잠금
  updateBlockState(blockId, { isLocked: true });
  updateGameState({ availableXP: gameState.availableXP - 15 });
};
```

#### 1.5 작업 시작/중지 기능
**기능**:
- 작업 ▶️ 버튼 클릭 → 타이머 시작
- activeTaskId 설정
- Active Task Banner 표시
- 1초마다 경과 시간 업데이트
- XP 실시간 계산 및 표시

#### 1.6 작업 완료 시 시간 기록 모달
**트리거**: 작업 완료 (체크박스 클릭) 시
**내용**:
- 실제 작업 시간 선택 (5, 10, 15, 30, 45, 60, 90, 120분)
- 저장 → `task.actualDuration` 업데이트
- XP 계산에 사용

#### 1.7 드래그 앤 드롭
**기능**:
- 작업을 다른 블록으로 드래그
- 인박스 ↔ 블록 간 이동
- `task.timeBlock` 값 변경
- 실시간 UI 업데이트

**구현 필요**:
```typescript
// React DnD 또는 HTML5 drag-drop API 사용
const handleDragStart = (task: Task) => { /* ... */ };
const handleDrop = (targetBlockId: TimeBlockId) => { /* ... */ };
```

#### 1.8 블록 접기/펼치기
**기능**:
- 블록 헤더 클릭 → 접기/펼치기 토글
- 10분마다 자동: 현재 블록 외 모든 블록 접기
- 15분마다 자동: 현재 블록에 포커스

### 2. 게임화 시스템

#### 2.1 XP 계산 로직
**공식** (문서 기준):
```javascript
// 기본 XP
baseXP = adjustedDuration * 0.5

// 블록 보너스
if (blockIsLocked && blockIsPerfect) {
  bonus += 40;
}

// 레벨 보너스
levelBonus = Math.floor(playerLevel / 5) * 5;

// 총 XP
totalXP = baseXP + bonus + levelBonus;
```

#### 2.2 레벨 시스템
**기능**:
- 레벨업 공식: `requiredXP = level * 100`
- 레벨업 시 알림 모달 표시
- 레벨 보너스: 5레벨마다 +5 XP

**구현 필요**:
```typescript
const checkLevelUp = (currentXP: number, currentLevel: number) => {
  const requiredXP = currentLevel * 100;
  if (currentXP >= requiredXP) {
    // 레벨업!
    setLevel(currentLevel + 1);
    setShowLevelUpModal(true);
  }
};
```

#### 2.3 일일 퀘스트 시스템
**타입**:
- `complete_tasks`: 작업 N개 완료
- `earn_xp`: XP N만큼 획득
- `lock_blocks`: 블록 N개 잠금
- `perfect_blocks`: 완벽 블록 N개 달성

**구현 필요**:
```typescript
interface Quest {
  id: string;
  type: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks';
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  reward: number;
}

const updateQuestProgress = (type: Quest['type'], amount: number) => {
  // 퀘스트 진행도 업데이트
  // 완료 시 보상 지급
};
```

#### 2.4 연속 출석 (Streak) 시스템
**기능**:
- 매일 로그인 시 streak +1
- 날짜 변경 감지
- 하루 이상 건너뛰면 streak 초기화

### 3. 통계 & 히스토리

#### 3.1 XP 히스토리 차트
**내용**:
- 지난 5일 XP 막대 그래프
- 날짜별 XP 표시
- 데이터 소스: `gameState.xpHistory`

**구현 필요**:
```typescript
// Chart.js 또는 Recharts 사용
<BarChart data={xpHistory} />
```

#### 3.2 시간대별 XP 차트
**내용**:
- 오늘 6개 타임블럭별 XP 표시
- 블록별 막대 그래프
- 데이터 소스: `gameState.timeBlockXP`

#### 3.3 완료 작업 히스토리
**내용**:
- 완료된 작업 목록 (날짜별)
- 작업명, 소요 시간, 획득 XP
- 최근 N일 필터링

### 4. 템플릿 시스템 고급 기능

#### 4.1 자동 템플릿 생성
**기능**:
- `template.autoGenerate: true`인 경우
- 매일 00시 (또는 앱 시작 시 날짜 변경 감지) 자동 작업 생성
- 지정된 timeBlock에 배치

**구현 필요**:
```typescript
const initializeNewDay = async () => {
  // 자동 생성 템플릿 찾기
  const autoTemplates = templates.filter(t => t.autoGenerate);

  // 템플릿에서 작업 생성
  for (const template of autoTemplates) {
    const task = createTaskFromTemplate(template);
    await addTask(task);
  }
};
```

### 5. 와이푸 시스템 고급 기능

#### 5.1 자동 메시지 시스템
**기능**:
- 설정된 간격(기본 3분)마다 자동 메시지 생성
- Gemini API로 현재 상황 분석
- 메시지 자동 표시
- 일시정지 가능

**구현 필요**:
```typescript
const WaifuAutoMessage = () => {
  const [interval, setInterval] = useState(3); // 분
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;

    const timer = setInterval(async () => {
      const context = analyzeUserContext();
      const message = await generateAutoMessage(context);
      showWaifuMessage(message);
    }, interval * 60 * 1000);

    return () => clearInterval(timer);
  }, [interval, paused]);
};
```

#### 5.2 호감도 증감 로직
**증가**:
- 작업 완료: +2
- 상점 구매: +10

**감소** (구현 필요):
- 유휴 시간 (예: 30분 이상 작업 없음): -1
- 작업 삭제: -1

#### 5.3 유휴 경고 시스템
**기능**:
- 30분 이상 활동 없으면 와이푸가 경고 메시지 표시
- `waifuState.lastIdleWarning` 타임스탬프 기록

### 6. Firebase 동기화 시스템

#### 6.1 실시간 동기화
**기능**:
- Firebase Realtime Database 연동
- 다중 장치 동기화
- 충돌 해결 (타임스탬프 비교)

**구현 필요**:
```typescript
const setupRealtimeSync = () => {
  const dbRef = ref(database, `dailyPlans/${userId}/${date}`);

  onValue(dbRef, (snapshot) => {
    const remoteData = snapshot.val();
    if (!remoteData) return;

    // 타임스탬프 비교
    if (remoteData.updatedAt > localData.updatedAt) {
      // 원격 데이터로 업데이트
      updateLocalData(remoteData);
    }
  });
};
```

#### 6.2 3단계 캐싱 전략
**계층**:
1. IndexedDB (비동기, 대용량)
2. localStorage (동기, 빠른 접근)
3. Firebase (클라우드, 다중 장치)

### 7. 모달 & UI 기능

#### 7.1 대량 할 일 추가 모달
**기능**:
- 여러 줄 텍스트 입력
- 한 줄당 하나의 작업 생성
- 기본값: 15분, 쉬움, 인박스

#### 7.2 컨텍스트 메뉴 (우클릭)
**메뉴 항목**:
- ✏️ 수정하기
- ▶️ 시작하기
- 📋 복제하기
- 🗑️ 삭제

#### 7.3 키보드 단축키
**현재 누락**:
- Ctrl+N: 할 일 추가
- /: 검색 기능
- Esc: 모달 닫기

### 8. 성능 최적화

#### 8.1 RenderQueue 디바운싱
**목적**: 빠른 연속 변경 시 과도한 렌더링 방지
**구현**:
```typescript
const useDebounce = <T>(value: T, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};
```

#### 8.2 타이머 관리 시스템
**목적**: setInterval 누수 방지
**React 구현**: useEffect cleanup 활용

### 9. 보안 & 인증

#### 9.1 Firebase 인증
**미구현**:
- 사용자 로그인/회원가입
- `userId` 기반 데이터 격리
- gameState/{userId}

#### 9.2 Gemini API 키 보안
**현재 문제**: .env 파일에 평문 저장 (클라이언트 노출)
**해결 방안**: 서버 사이드 프록시 구현 (Node.js/Express)

---

## 🎯 우선순위 구현 추천

### 높음 (핵심 기능)
1. ⭐ Active Task Banner (진행 중 작업 표시)
2. ⭐ Current Block Visualizer (현재 블록 진행도)
3. ⭐ 작업 시작/중지 기능
4. ⭐ 블록 잠금 시스템
5. ⭐ XP 계산 로직
6. ⭐ 드래그 앤 드롭

### 중간 (편의성)
1. 일일 퀘스트 시스템
2. 레벨업 알림
3. XP 히스토리 차트
4. 자동 템플릿 생성
5. 와이푸 자동 메시지

### 낮음 (부가 기능)
1. Firebase 동기화
2. 대량 할 일 추가
3. 컨텍스트 메뉴
4. 키보드 단축키
5. 유휴 경고

---

## 📝 메모

- 현재 React/TypeScript 재구현 진행 중
- 기존 순수 JS 버전과 병행 개발
- 문서 기준: PROJECT_UI_FEATURES_REPORT.md (2169 lines)
- 마지막 업데이트: 2025-11-14

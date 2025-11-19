# TimeBlock Planner 추가 기능 제안서

## 📋 개요

**문서 버전**: 1.0
**작성일**: 2025-11-19
**대상 프로젝트**: TimeBlock Planner v1.0.25
**목적**: 사용자 경험 개선 및 생산성 향상을 위한 추가 기능 제안

---

## 🎯 현재 시스템 분석

### 핵심 기능
- 타임블록 기반 일일 스케줄링 (6개 블록)
- 심리적 저항도 기반 작업 관리
- 게임화 요소 (XP, 레벨, 퀘스트, 와이푸 동반자)
- AI 어드바이스 (Gemini API)
- Firebase 다중 기기 동기화
- 템플릿 시스템
- 에너지 레벨 추적

### 주요 강점
✅ 심리적 저항도를 고려한 현실적인 시간 계획
✅ 게임화를 통한 동기 부여
✅ AI 기반 개인화된 조언
✅ 다중 기기 실시간 동기화

### 개선 여지
⚠️ 장기 목표 관리 기능 부족
⚠️ 통계 및 분석 기능 제한적
⚠️ 팀/협업 기능 없음
⚠️ 습관 형성 지원 기능 미흡
⚠️ 알림 및 리마인더 시스템 부족

---

## 💡 추가 기능 제안

### 1. 주간/월간 뷰 및 계획 기능 ⭐⭐⭐

**우선순위**: 높음
**예상 개발 기간**: 중
**복잡도**: 중

#### 기능 설명
현재는 일일 단위 계획만 가능하지만, 주간/월간 단위의 큰 그림을 볼 수 있는 뷰 추가

#### 세부 구현 사항

**1.1 주간 뷰**
- 월-일 7일간의 타임블록을 한눈에 보는 캘린더 뷰
- 각 날짜별 완료율, 획득 XP, 주요 목표 진행도 표시
- 주간 목표 설정 및 추적 (예: "이번 주 영어 15시간")
- 주간 통계: 평균 완료율, 총 XP, 연속 달성일 수

**1.2 월간 뷰**
- 달력 형태로 한 달 전체의 생산성 히트맵
- 색상 강도로 일별 생산성 표시 (GitHub 기여도 스타일)
- 월간 목표 설정 및 달성 여부 추적
- 월간 통계: 최고 생산성 날짜, 평균 완료 작업 수, 레벨 상승 횟수

**1.3 주간 계획 템플릿**
- 월요일에 주간 계획 수립 프롬프트
- 주요 마일스톤 및 데드라인 설정
- 일별 우선순위 작업 자동 분배 제안 (AI 활용)

#### 기술 구현

```typescript
// 새 데이터 모델
interface WeeklyGoal {
  id: string;
  title: string;
  targetMinutes: number;
  completedMinutes: number;
  weekStartDate: string; // YYYY-MM-DD
  relatedDailyGoalId?: string;
}

interface MonthlyMilestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  completed: boolean;
  monthKey: string; // YYYY-MM
}

// 새 Repository
weeklyGoalRepository.ts
monthlyMilestoneRepository.ts

// 새 컴포넌트
src/features/planning/WeeklyView.tsx
src/features/planning/MonthlyView.tsx
src/features/planning/WeeklyPlanningModal.tsx
```

#### 기대 효과
- 사용자가 장기 목표와 일일 작업의 연결성을 명확히 인식
- 주간/월간 단위의 성취감 증대
- 큰 프로젝트를 작은 단위로 분해하는 습관 형성

---

### 2. 스마트 작업 추천 시스템 ⭐⭐⭐

**우선순위**: 높음
**예상 개발 기간**: 중
**복잡도**: 중상

#### 기능 설명
사용자의 과거 데이터와 현재 상태를 분석하여 최적의 작업 시간과 작업 순서를 AI가 제안

#### 세부 구현 사항

**2.1 최적 시간대 추천**
- 에너지 레벨 히스토리 분석
- 과거 완료 패턴 분석 (어느 시간대에 어떤 유형의 작업을 많이 완료했는지)
- "당신은 보통 14-17시에 고난이도 작업을 잘 완료했어요" 같은 인사이트 제공
- 작업 추가 시 "이 작업은 8-11시에 하는 것이 좋아요" 추천

**2.2 작업 순서 최적화**
- 심리적 저항도, 예상 소요 시간, 에너지 레벨을 고려한 작업 순서 자동 제안
- "먼저 쉬운 작업으로 워밍업 → 고난이도 작업 → 루틴 작업" 같은 전략
- Gemini API를 활용한 개인화된 작업 순서 추천

**2.3 작업 균형 알림**
- 특정 목표에 너무 치우친 스케줄 경고 ("영어 공부만 6시간이에요. 운동도 넣어볼까요?")
- 장시간 연속 작업 경고 (휴식 권장)
- 과거 평균보다 너무 많거나 적은 계획 시 피드백

**2.4 유사 작업 자동 그룹화**
- 과거 작업 패턴 분석으로 "프로그래밍", "운동", "학습" 등 자동 카테고리화
- 카테고리별 통계 제공
- "프로그래밍 작업은 평균 1.8배 오래 걸려요" 같은 인사이트

#### 기술 구현

```typescript
// 새 서비스
src/shared/services/recommendationEngine.ts

interface TaskRecommendation {
  taskId: string;
  recommendedTimeBlock: TimeBlockId;
  confidence: number; // 0-1
  reason: string;
  alternativeBlocks?: TimeBlockId[];
}

interface ScheduleOptimization {
  optimizedOrder: Task[];
  reasoning: string;
  expectedProductivity: number;
  warnings: string[];
}

// 분석 함수
analyzeEnergyPattern(userId: string): EnergyPattern
calculateOptimalTaskOrder(tasks: Task[], energyPattern: EnergyPattern): ScheduleOptimization
recommendTaskTiming(task: Task, history: CompletionHistory): TaskRecommendation
detectTaskCategories(tasks: Task[]): TaskCategory[]

// Gemini API 활용
async function getAIScheduleRecommendation(
  tasks: Task[],
  energyHistory: EnergyLevel[],
  completionHistory: DailyData[]
): Promise<ScheduleOptimization> {
  const prompt = `
    사용자의 과거 30일 데이터를 분석했습니다:
    - 평균 에너지가 높은 시간: ${highEnergyTimes}
    - 완료율이 높은 작업 유형: ${highCompletionTypes}
    - 현재 할 일: ${JSON.stringify(tasks)}

    최적의 작업 순서와 시간대를 추천해주세요.
  `;
  return geminiApi.getCompletion(prompt);
}
```

#### 기대 효과
- 사용자의 자기 인식 향상 ("나는 오전에 집중이 잘 되는구나")
- 계획의 현실성 증가 (과거 데이터 기반)
- AI 추천 신뢰도 향상으로 앱 의존도 증가

---

### 3. 습관 트래커 및 체인 시스템 ⭐⭐⭐

**우선순위**: 중상
**예상 개발 기간**: 중
**복잡도**: 중

#### 기능 설명
"매일 운동 30분", "매일 영어 공부 1시간" 같은 반복 습관을 추적하고 연속 달성일을 시각화

#### 세부 구현 사항

**3.1 습관 정의 및 추적**
- 습관 생성: 제목, 목표 빈도 (매일/주N회/월N회), 최소 달성 기준
- 일일 체크인: 해당 습관 관련 작업 완료 시 자동 체크
- 수동 체크 옵션 (작업 외 활동도 기록 가능)

**3.2 연속 달성 체인 (Streak)**
- 현재 연속 달성일 수 표시
- 최장 연속 기록 저장
- 체인이 끊길 위기일 때 알림 ("오늘 운동을 안 하면 30일 체인이 끊겨요!")
- 월간 캘린더 뷰에서 습관별 체인 시각화 (색상 코딩)

**3.3 습관 통계 및 인사이트**
- 습관별 달성률 (지난 30일, 90일)
- 요일별 달성률 분석 ("주말에 운동 달성률이 낮아요")
- 습관 간 상관관계 ("운동한 날 영어 공부 달성률이 20% 높아요")

**3.4 게임화 통합**
- 습관 마일스톤 달성 시 특별 보상 (7일, 30일, 100일 체인)
- 습관 관련 특별 퀘스트 ("이번 주 매일 운동하기")
- 와이푸가 습관 격려 메시지 전송

#### 기술 구현

```typescript
// 새 데이터 모델
interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  targetCount: number; // 주N회, 월N회
  minimumMinutes?: number; // 최소 달성 기준
  icon: string;
  color: string;
  createdAt: string;
  relatedGoalIds: string[]; // 연결된 목표들
}

interface HabitRecord {
  habitId: string;
  date: string;
  completed: boolean;
  actualMinutes?: number;
  note?: string;
}

interface HabitStreak {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string;
  streakHistory: { startDate: string; endDate: string; length: number }[];
}

// 새 Repository
src/data/repositories/habitRepository.ts
src/data/repositories/habitRecordRepository.ts

// 새 컴포넌트
src/features/habits/HabitTracker.tsx
src/features/habits/HabitCalendarView.tsx
src/features/habits/HabitStatsPanel.tsx
src/features/habits/HabitModal.tsx

// 분석 함수
calculateStreak(habitId: string): HabitStreak
analyzeHabitCorrelation(habit1: Habit, habit2: Habit): number
getHabitInsights(habitId: string): HabitInsight[]
```

#### 기대 효과
- 장기적인 습관 형성 지원
- 연속 달성의 심리적 보상 효과
- 사용자의 앱 재방문율 증가 (체인을 유지하기 위해)

---

### 4. 고급 알림 및 리마인더 시스템 ⭐⭐

**우선순위**: 중
**예상 개발 기간**: 중
**복잡도**: 중

#### 기능 설명
작업 시작 시간, 준비 사항 체크, 목표 미달 경고 등 다양한 알림 제공

#### 세부 구현 사항

**4.1 스마트 리마인더**
- 타임블록 시작 10분 전 알림 ("8-11시 블록이 곧 시작됩니다")
- 작업 시작 예정 시간 알림 (사용자가 예상 시작 시간 설정 시)
- 준비 사항 체크 리마인더 ("'운동복 챙기기' 준비하셨나요?")

**4.2 진행도 알림**
- 목표 달성률 저조 시 알림 (오후 6시, "영어 목표가 30%밖에 안 됐어요")
- 일일 퀘스트 미완료 경고 (저녁 9시, "오늘 3개의 퀘스트가 남았어요")
- 습관 체인 유지 알림 (저녁 8시, "오늘 운동을 안 하면 체인이 끊겨요")

**4.3 적응형 알림 타이밍**
- 사용자의 반응 패턴 학습 (어느 시간대 알림을 잘 따르는지)
- 방해 금지 시간대 자동 감지 (포커스 타이머 사용 중, 회의 중)
- 알림 스누즈 및 재알림 기능

**4.4 알림 커스터마이징**
- 알림 유형별 on/off 설정
- 알림 소리, 진동 패턴 선택
- 중요도별 알림 우선순위 설정

#### 기술 구현

```typescript
// Electron 메인 프로세스에서 알림 처리
// electron.cjs 수정
const { Notification } = require('electron');

function sendNotification(title: string, body: string, actions?: NotificationAction[]) {
  const notification = new Notification({
    title,
    body,
    icon: './public/icon.png',
    urgency: 'normal'
  });
  notification.show();
}

// 스케줄링 시스템
src/shared/services/notificationScheduler.ts

interface ScheduledNotification {
  id: string;
  type: 'timeblock' | 'goal' | 'habit' | 'quest' | 'preparation';
  triggerTime: string; // ISO timestamp
  title: string;
  body: string;
  actions?: { label: string; action: () => void }[];
  priority: 'low' | 'medium' | 'high';
}

class NotificationScheduler {
  scheduleTimeBlockReminder(blockId: TimeBlockId, minutesBefore: number): void
  scheduleGoalProgressCheck(goalId: string, checkTime: string): void
  scheduleHabitReminder(habitId: string): void
  cancelNotification(notificationId: string): void

  // 적응형 타이밍
  learnOptimalTiming(userId: string, notificationType: string): string
}

// 새 Store
src/shared/stores/notificationStore.ts
```

#### 기대 효과
- 계획한 작업을 실제로 실행하는 비율 증가
- 사용자의 목표 달성률 향상
- 앱의 "개인 비서" 느낌 강화

---

### 5. 협업 및 공유 기능 ⭐⭐

**우선순위**: 중
**예상 개발 기간**: 상
**복잡도**: 상

#### 기능 설명
팀원, 친구, 가족과 목표를 공유하고 서로 격려하는 소셜 기능

#### 세부 구현 사항

**5.1 목표 공유**
- 특정 목표를 다른 사용자와 공유 (읽기 전용 또는 협업 모드)
- 공유 목표 진행도 실시간 확인
- "같이 운동하기" 같은 공동 목표 설정

**5.2 책임 파트너 (Accountability Partner)**
- 책임 파트너 지정 (1:1)
- 일일 진행 상황 자동 공유
- 파트너가 목표 달성 실패 시 알림 받고 격려 메시지 전송

**5.3 리더보드 및 경쟁**
- 친구 그룹 내 주간/월간 XP 순위
- 습관 체인 경쟁 ("누가 더 오래 운동 체인을 유지하는지")
- 공동 도전 과제 (그룹 전체가 일주일에 총 100시간 공부하기)

**5.4 팀 대시보드 (프로젝트/스터디 그룹용)**
- 팀 목표 설정 및 멤버별 역할 분담
- 팀 전체 진행도 시각화
- 마일스톤 달성 시 팀 전체 보상

#### 기술 구현

```typescript
// Firebase 확장 - 다중 사용자 데이터 구조
firebaseDatabase/
  users/
    {userId}/
      profile/
      dailyData/
      gameState/
  sharedGoals/
    {goalId}/
      owner: userId
      participants: [userId1, userId2]
      permissions: { userId1: 'edit', userId2: 'view' }
      data: {...}
  partnerships/
    {partnershipId}/
      user1: userId
      user2: userId
      settings: {...}
      activityFeed: [...]
  leaderboards/
    {groupId}/
      weekly: { userId: xp }
      monthly: { userId: xp }

// 새 Repository
src/data/repositories/sharedGoalRepository.ts
src/data/repositories/partnershipRepository.ts
src/data/repositories/socialRepository.ts

// 새 컴포넌트
src/features/social/FriendsList.tsx
src/features/social/Leaderboard.tsx
src/features/social/SharedGoalView.tsx
src/features/social/PartnerDashboard.tsx
src/features/social/TeamDashboard.tsx

// 실시간 알림
src/shared/services/socialNotifications.ts
```

#### 기대 효과
- 사회적 압박(긍정적 의미)을 통한 동기 부여 증가
- 사용자 리텐션 향상 (친구들이 사용하니까 계속 사용)
- 팀 프로젝트, 스터디 그룹 등 새로운 사용 사례 확보

---

### 6. 고급 통계 및 리포트 ⭐⭐⭐

**우선순위**: 중상
**예상 개발 기간**: 중
**복잡도**: 중

#### 기능 설명
현재의 인사이트 패널을 확장하여 더 깊이 있는 데이터 분석 제공

#### 세부 구현 사항

**6.1 생산성 대시보드**
- 일/주/월별 생산성 트렌드 그래프
- 시간대별 평균 완료율 히트맵
- 목표별 투자 시간 파이 차트
- 심리적 저항도별 작업 분포 및 완료율

**6.2 예측 분석**
- "현재 속도라면 이번 주 영어 목표 달성 가능성 87%"
- "이번 달 레벨업까지 예상 3일"
- "평균적으로 고저항 작업은 실제 예상 시간의 1.4배 소요됨"

**6.3 비교 분석**
- 이번 주 vs 지난 주 생산성 비교
- 이번 달 vs 지난 달 목표 달성률 비교
- 연간 성장 그래프 (분기별 평균 완료율)

**6.4 맞춤형 리포트 생성**
- 주간 리포트 자동 생성 (금요일 저녁)
- 월간 리포트 PDF 내보내기
- 주요 성과, 개선 영역, 다음 주 추천 사항 포함
- Gemini AI가 작성하는 개인화된 피드백

**6.5 데이터 내보내기**
- CSV, JSON 형식으로 모든 데이터 내보내기
- 외부 분석 도구 연동 (Google Sheets, Notion 등)
- 백업 및 복원 기능

#### 기술 구현

```typescript
// 새 서비스
src/shared/services/analyticsEngine.ts

interface ProductivityMetrics {
  completionRate: number;
  averageTaskDuration: number;
  goalAchievementRate: number;
  xpEarnedPerDay: number;
  mostProductiveTimeBlock: TimeBlockId;
  averageResistanceMultiplier: number;
}

interface TrendAnalysis {
  metric: string;
  currentValue: number;
  previousValue: number;
  percentChange: number;
  trend: 'improving' | 'declining' | 'stable';
}

interface Prediction {
  type: 'goal_achievement' | 'level_up' | 'habit_streak';
  probability: number; // 0-1
  estimatedDate?: string;
  confidenceInterval: { min: number; max: number };
  factors: string[];
}

class AnalyticsEngine {
  calculateMetrics(startDate: string, endDate: string): ProductivityMetrics
  analyzeTrends(metric: string, period: 'week' | 'month' | 'year'): TrendAnalysis
  predictOutcome(goalId: string): Prediction
  generateWeeklyReport(): WeeklyReport
  generateMonthlyReport(): MonthlyReport
  exportData(format: 'csv' | 'json'): Blob
}

// 새 컴포넌트
src/features/analytics/DashboardView.tsx
src/features/analytics/TrendChart.tsx
src/features/analytics/PredictionPanel.tsx
src/features/analytics/ReportGenerator.tsx
src/features/analytics/DataExporter.tsx

// 차트 라이브러리 추가
// package.json에 추가: "recharts" 또는 "chart.js"
```

#### 기대 효과
- 사용자의 자기 인식 대폭 향상
- 데이터 기반 의사결정 습관 형성
- 장기 사용자에게 더 큰 가치 제공

---

### 7. 포모도로 테크닉 고급 통합 ⭐⭐

**우선순위**: 중
**예상 개발 기간**: 하
**복잡도**: 하

#### 기능 설명
현재의 포커스 타이머를 포모도로 테크닉과 완전히 통합

#### 세부 구현 사항

**7.1 포모도로 사이클 관리**
- 25분 작업 + 5분 휴식 기본 사이클
- 4 포모도로마다 긴 휴식 (15-30분)
- 커스터마이징 가능한 시간 설정

**7.2 자동 작업 전환**
- 포모도로 완료 시 다음 작업으로 자동 전환 제안
- 휴식 시간 활동 제안 ("스트레칭", "물 마시기", "눈 쉬기")

**7.3 포모도로 통계**
- 일일 완료 포모도로 수 추적
- 작업별 소요 포모도로 수 기록
- "영어 공부는 평균 3 포모도로 필요해요" 인사이트

**7.4 게임화 통합**
- 포모도로 완료마다 소량 XP 보너스
- 연속 포모도로 콤보 시스템 (10개 연속 완료 시 보너스)
- "포모도로 마스터" 업적

#### 기술 구현

```typescript
// 기존 FocusTimerOverlay 확장
interface PomodoroSession {
  id: string;
  taskId: string;
  cycleNumber: number; // 1-4
  type: 'work' | 'short-break' | 'long-break';
  duration: number;
  startedAt: string;
  completedAt?: string;
  interrupted: boolean;
}

interface PomodoroStats {
  totalCompleted: number;
  todayCompleted: number;
  longestStreak: number;
  currentStreak: number;
  taskPomodoros: { [taskId: string]: number };
}

// 새 Store 기능 추가
src/shared/stores/pomodoroStore.ts

// 기존 컴포넌트 확장
src/features/focus/PomodoroTimer.tsx
src/features/focus/PomodoroStats.tsx
```

#### 기대 효과
- 깊은 집중 시간 증가
- 번아웃 방지 (규칙적인 휴식)
- 작업 소요 시간 예측 정확도 향상

---

### 8. 템플릿 마켓플레이스 ⭐

**우선순위**: 하
**예상 개발 기간**: 상
**복잡도**: 중상

#### 기능 설명
사용자들이 자신의 효과적인 템플릿을 공유하고 다운로드할 수 있는 커뮤니티 기능

#### 세부 구현 사항

**8.1 템플릿 공유**
- 내 템플릿을 공개 마켓플레이스에 업로드
- 템플릿 설명, 사용 사례, 예상 효과 작성
- 태그 및 카테고리 분류 (학습, 운동, 업무, 프로젝트 등)

**8.2 템플릿 검색 및 다운로드**
- 인기 템플릿, 최신 템플릿, 추천 템플릿
- 카테고리별 필터링
- 평점 및 리뷰 시스템
- 한 번의 클릭으로 내 앱에 추가

**8.3 큐레이션**
- "이번 주의 템플릿" 추천
- 사용자 목표에 맞는 템플릿 AI 추천
- 공식 템플릿 (개발팀이 제공하는 검증된 템플릿)

#### 기술 구현

```typescript
// Firebase 확장
firebaseDatabase/
  templateMarketplace/
    {templateId}/
      author: userId
      template: {...}
      description: string
      category: string
      tags: string[]
      rating: number
      downloadCount: number
      reviews: [...]

// 새 Repository
src/data/repositories/marketplaceRepository.ts

// 새 컴포넌트
src/features/marketplace/MarketplaceView.tsx
src/features/marketplace/TemplateCard.tsx
src/features/marketplace/TemplateDetailModal.tsx
src/features/marketplace/PublishTemplateModal.tsx
```

#### 기대 효과
- 커뮤니티 형성
- 신규 사용자의 온보딩 간소화 (검증된 템플릿 사용)
- 사용자 생성 콘텐츠로 앱 가치 증대

---

### 9. 음성 명령 및 빠른 입력 ⭐⭐

**우선순위**: 중
**예상 개발 기간**: 중
**복잡도**: 중

#### 기능 설명
키보드 단축키 및 음성 명령으로 빠르게 작업 추가 및 관리

#### 세부 구현 사항

**9.1 전역 단축키**
- `Ctrl+Shift+A`: 빠른 작업 추가
- `Ctrl+Shift+T`: 타이머 시작/정지
- `Ctrl+Shift+G`: AI 어드바이스 열기
- `Ctrl+Shift+Space`: 현재 작업 완료

**9.2 자연어 작업 입력**
- "내일 오전 9시에 회의 준비 30분" → 자동 파싱하여 작업 생성
- "목요일 저녁에 운동 1시간" → 해당 날짜 타임블록에 추가
- Gemini API를 활용한 자연어 처리

**9.3 음성 명령 (선택 사항)**
- Web Speech API 활용
- "작업 추가: 영어 단어 50개 외우기"
- "오늘 진행 상황 알려줘"
- "영어 목표 얼마나 했어?"

**9.4 명령 팔레트**
- VS Code 스타일의 명령 팔레트 (`Ctrl+P`)
- 모든 기능을 텍스트로 검색하여 실행
- 최근 명령, 자주 쓰는 명령 우선 표시

#### 기술 구현

```typescript
// Electron 전역 단축키 등록
// electron.cjs
const { globalShortcut } = require('electron');

globalShortcut.register('CommandOrControl+Shift+A', () => {
  mainWindow.webContents.send('quick-add-task');
});

// 자연어 처리
src/shared/services/nlpParser.ts

interface ParsedTaskInput {
  text: string;
  date?: string;
  timeBlock?: TimeBlockId;
  duration?: number;
  resistance?: 'low' | 'medium' | 'high';
  goalId?: string;
}

async function parseNaturalLanguage(input: string): Promise<ParsedTaskInput> {
  // Gemini API 활용
  const prompt = `
    다음 입력을 작업 정보로 파싱해주세요:
    "${input}"

    JSON 형식으로 반환:
    { text, date (YYYY-MM-DD), timeBlock, duration (분), resistance }
  `;
  return geminiApi.getCompletion(prompt);
}

// 새 컴포넌트
src/features/quickInput/CommandPalette.tsx
src/features/quickInput/QuickAddModal.tsx
src/features/quickInput/VoiceInput.tsx
```

#### 기대 효과
- 작업 추가 마찰 감소
- 파워 유저 경험 향상
- 접근성 개선 (음성 명령)

---

### 10. 웰니스 및 번아웃 방지 기능 ⭐⭐⭐

**우선순위**: 중상
**예상 개발 기간**: 중
**복잡도**: 중

#### 기능 설명
과도한 업무로 인한 번아웃을 방지하고 건강한 생산성을 유지하도록 돕는 기능

#### 세부 구현 사항

**10.1 번아웃 감지**
- 연속 고강도 작업일 감지 (일주일 이상 매일 8시간 이상)
- 휴식 부족 경고 (타임블록 내 쉬는 시간 없음)
- 특정 목표에 과도한 집중 감지 ("일주일 내내 프로그래밍만 했어요")

**10.2 휴식 권장**
- 적절한 휴식 시간 자동 제안
- "20분마다 5분 휴식" 리마인더
- 주말 계획 없을 시 "주말에는 좀 쉬는 게 어때요?" 제안

**10.3 웰니스 활동 추적**
- 운동, 명상, 취미 활동 별도 카테고리
- 웰니스 점수 (주간 운동 시간, 휴식 시간 등 종합)
- 웰니스 목표 설정 ("일주일에 최소 3회 운동")

**10.4 수면 및 에너지 연계**
- 전날 수면 시간 입력
- 수면 시간과 다음 날 에너지 레벨 상관관계 분석
- "7시간 이상 잤을 때 생산성이 30% 높아요" 인사이트

**10.5 감사 일기**
- 하루 마무리 시 "오늘 감사한 일 3가지" 입력 프롬프트
- 긍정 심리학 기반 동기 부여
- 와이푸가 긍정적인 피드백 제공

#### 기술 구현

```typescript
// 새 데이터 모델
interface WellnessData {
  date: string;
  sleepHours: number;
  exerciseMinutes: number;
  meditationMinutes: number;
  hobbyMinutes: number;
  wellnessScore: number; // 0-100
  gratitudeEntries: string[];
}

interface BurnoutIndicators {
  consecutiveHighIntensityDays: number;
  restDeficit: number; // 권장 휴식 - 실제 휴식
  workLifeBalance: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

// 새 서비스
src/shared/services/wellnessAnalyzer.ts

class WellnessAnalyzer {
  detectBurnout(userId: string, days: number): BurnoutIndicators
  calculateWellnessScore(data: WellnessData): number
  analyzeSleepProductivity(userId: string): SleepProductivityCorrelation
  recommendRestActivity(): string
}

// 새 Repository
src/data/repositories/wellnessRepository.ts

// 새 컴포넌트
src/features/wellness/WellnessDashboard.tsx
src/features/wellness/BurnoutAlert.tsx
src/features/wellness/GratitudeJournal.tsx
src/features/wellness/SleepTracker.tsx
```

#### 기대 효과
- 사용자의 장기 건강 및 지속 가능한 생산성
- 앱에 대한 신뢰도 증가 ("내 건강을 생각해주는 앱")
- 웰빙을 중시하는 사용자층 확보

---

## 📊 우선순위 매트릭스

| 기능 | 우선순위 | 개발 기간 | 복잡도 | 사용자 가치 | 기술 리스크 |
|------|----------|-----------|--------|-------------|-------------|
| 1. 주간/월간 뷰 | ⭐⭐⭐ 높음 | 중 | 중 | 높음 | 낮음 |
| 2. 스마트 작업 추천 | ⭐⭐⭐ 높음 | 중 | 중상 | 매우 높음 | 중 (AI 의존) |
| 3. 습관 트래커 | ⭐⭐⭐ 중상 | 중 | 중 | 높음 | 낮음 |
| 4. 고급 알림 시스템 | ⭐⭐ 중 | 중 | 중 | 높음 | 낮음 |
| 5. 협업 및 공유 | ⭐⭐ 중 | 상 | 상 | 중 | 중상 (Firebase 확장) |
| 6. 고급 통계 리포트 | ⭐⭐⭐ 중상 | 중 | 중 | 높음 | 낮음 |
| 7. 포모도로 통합 | ⭐⭐ 중 | 하 | 하 | 중 | 낮음 |
| 8. 템플릿 마켓플레이스 | ⭐ 하 | 상 | 중상 | 중 | 중 |
| 9. 음성 명령 | ⭐⭐ 중 | 중 | 중 | 중 | 중 (음성 API) |
| 10. 웰니스 기능 | ⭐⭐⭐ 중상 | 중 | 중 | 높음 | 낮음 |

---

## 🚀 추천 개발 로드맵

### Phase 1: 핵심 가치 강화 (1-2개월)
1. **주간/월간 뷰** - 장기 계획 가능
2. **습관 트래커** - 장기 사용자 리텐션
3. **고급 통계 리포트** - 데이터 기반 인사이트

### Phase 2: 스마트 경험 (1-2개월)
4. **스마트 작업 추천** - AI 활용 극대화
5. **고급 알림 시스템** - 실행력 증대
6. **포모도로 통합** - 집중력 향상

### Phase 3: 확장 및 커뮤니티 (2-3개월)
7. **웰니스 기능** - 차별화 포인트
8. **음성 명령** - 파워 유저 경험
9. **협업 및 공유** - 소셜 기능
10. **템플릿 마켓플레이스** - 커뮤니티 확장

---

## 💡 추가 고려 사항

### A. 기술 스택 확장 제안

**현재 스택**:
- React, TypeScript, Zustand, Dexie, Firebase, Electron

**추가 제안**:
- **차트 라이브러리**: Recharts (통계 시각화)
- **자연어 처리**: Gemini API 활용 (이미 있음, 확장 필요)
- **알림**: Electron Notification API
- **음성 인식**: Web Speech API
- **데이터 분석**: Simple Statistics 라이브러리

### B. 성능 최적화 제안

1. **대량 데이터 처리**: 월간/연간 데이터 조회 시 인덱싱 최적화
2. **Firebase 비용 관리**: 불필요한 실시간 리스닝 최소화
3. **로컬 캐싱**: 자주 조회하는 통계 데이터 캐싱
4. **Lazy Loading**: 통계/리포트 컴포넌트 지연 로딩

### C. UX/UI 개선 제안

1. **온보딩 플로우**: 신규 사용자를 위한 튜토리얼
2. **다크 모드**: 눈의 피로 감소
3. **테마 커스터마이징**: 색상, 폰트 선택
4. **접근성**: 키보드 네비게이션, 스크린 리더 지원
5. **반응형 디자인**: 창 크기 변경 시 레이아웃 적응

### D. 보안 및 개인정보 보호

1. **로컬 데이터 암호화**: 민감한 메모, 준비 사항 암호화
2. **Firebase 규칙 강화**: 사용자별 데이터 접근 제어
3. **API 키 보안**: Electron 환경변수 활용
4. **GDPR 준수**: 데이터 내보내기, 삭제 기능

---

## 📝 결론

이 제안서의 10가지 기능들은 TimeBlock Planner를 단순한 일정 관리 앱에서 **종합 생산성 및 웰니스 플랫폼**으로 진화시킬 것입니다.

### 핵심 차별화 요소

1. **심리학 기반 접근**: 심리적 저항도, 에너지 리듬, 번아웃 감지
2. **AI 기반 개인화**: Gemini를 활용한 스마트 추천 및 인사이트
3. **게임화 + 웰니스**: 재미와 건강의 균형
4. **데이터 중심**: 과거 패턴 분석으로 미래 최적화

### 비즈니스 임팩트

- **사용자 리텐션**: 습관 트래커, 체인 시스템으로 매일 재방문
- **입소문**: 협업 기능, 템플릿 공유로 자연스러운 확산
- **프리미엄 전환**: 고급 통계, AI 추천을 프리미엄 기능으로 제공 가능
- **시장 차별화**: 웰니스 + 생산성 결합은 독특한 포지셔닝

---

**작성자**: Claude Code
**문서 타입**: 기능 제안서
**버전**: 1.0
**최종 업데이트**: 2025-11-19

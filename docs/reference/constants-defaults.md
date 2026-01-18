# 상수 & 기본값

TimeBlock Planner의 중앙화된 상수와 기본값 레퍼런스입니다.

## 위치

```
src/shared/constants/
├── defaults.ts      # 기본값 상수
├── timeBlocks.ts    # 타임블록 설정
├── resistance.ts    # 저항도 설정
└── game.ts          # 게임 관련 상수
```

## SETTING_DEFAULTS

사용자 설정의 기본값입니다.

```typescript
// src/shared/constants/defaults.ts

export const SETTING_DEFAULTS = {
  // 집중 타이머
  focusTimerMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  
  // 동반자 설정
  autoMessageInterval: 30, // 분
  waifuEnabled: true,
  
  // 알림 설정
  notificationsEnabled: true,
  soundEnabled: true,
  
  // 테마
  theme: 'system' as const,
  
  // 동기화
  autoSyncEnabled: true,
  syncIntervalMinutes: 5,
} as const;
```

### 사용 예시

```typescript
import { SETTING_DEFAULTS } from '@/shared/constants/defaults';

// ✅ 올바른 사용
const focusTime = settings?.focusTimerMinutes ?? SETTING_DEFAULTS.focusTimerMinutes;

// ❌ 하드코딩 금지
const focusTime = settings?.focusTimerMinutes ?? 25;
```

## GAME_STATE_DEFAULTS

게임 상태 초기값입니다.

```typescript
export const GAME_STATE_DEFAULTS = {
  level: 1,
  totalXP: 0,
  availableXP: 0,
  streak: 0,
  
  // 레벨 계산
  xpPerLevel: (level: number) => 100 * level * level,
  
  // XP 계산
  baseXPPerMinute: 2,
  
  // 퀘스트
  dailyQuestCount: 6,
  questRefreshHour: 0, // 자정
} as const;
```

## IDLE_FOCUS_DEFAULTS

유휴 집중 모드 설정입니다.

```typescript
export const IDLE_FOCUS_DEFAULTS = {
  idleTimeoutMinutes: 5,
  reminderIntervalMinutes: 15,
  maxIdleMinutes: 30,
} as const;
```

## TIME_BLOCK_CONSTANTS

타임블록 관련 상수입니다.

```typescript
// src/shared/constants/timeBlocks.ts

export const TIME_BLOCK_CONSTANTS = {
  // 블록 개수
  BLOCK_COUNT: 6,
  
  // 블록 시간 (시간)
  BLOCK_DURATION_HOURS: 3,
  
  // 블록 시작 시간
  BLOCK_START_HOURS: [5, 8, 11, 14, 17, 20],
  
  // 블록 종료 시간
  BLOCK_END_HOURS: [8, 11, 14, 17, 20, 23],
  
  // 블록 레이블
  BLOCK_LABELS: ['🌅 새벽', '☀️ 오전', '🌤️ 점심', '🌇 오후', '🌆 저녁', '🌙 밤'],
} as const;
```

### 유틸리티 함수

```typescript
// 현재 블록 인덱스 구하기
export const getCurrentBlockIndex = (): number => {
  const hour = new Date().getHours();
  return TIME_BLOCK_CONSTANTS.BLOCK_START_HOURS.findIndex(
    (start, i) => hour >= start && hour < TIME_BLOCK_CONSTANTS.BLOCK_END_HOURS[i]
  );
};

// 블록 시간 범위 문자열
export const getBlockTimeRange = (index: number): string => {
  const start = TIME_BLOCK_CONSTANTS.BLOCK_START_HOURS[index];
  const end = TIME_BLOCK_CONSTANTS.BLOCK_END_HOURS[index];
  return `${start.toString().padStart(2, '0')}:00 - ${end.toString().padStart(2, '0')}:00`;
};
```

## RESISTANCE_CONSTANTS

저항도 관련 상수입니다.

```typescript
// src/shared/constants/resistance.ts

export const RESISTANCE_CONSTANTS = {
  LEVELS: ['low', 'medium', 'high'] as const,
  
  // 시간 보정 배율
  MULTIPLIERS: {
    low: 1.0,
    medium: 1.3,
    high: 1.6,
  },
  
  // XP 보너스 배율
  XP_BONUS: {
    low: 1.0,
    medium: 1.2,
    high: 1.5,
  },
  
  // 색상
  COLORS: {
    low: '#22c55e',    // green-500
    medium: '#eab308', // yellow-500
    high: '#ef4444',   // red-500
  },
  
  // 이모지
  EMOJIS: {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
  },
} as const;

// 타입
export type Resistance = typeof RESISTANCE_CONSTANTS.LEVELS[number];
```

## GAME_CONSTANTS

게임 관련 상수입니다.

```typescript
// src/shared/constants/game.ts

export const GAME_CONSTANTS = {
  // 퀘스트 타입
  QUEST_TYPES: [
    'EARLY_BIRD',
    'TASK_MASTER',
    'LOCK_STAR',
    'PERFECT_BLOCK',
    'CHALLENGE',
    'XP_HUNTER',
  ] as const,
  
  // 퀘스트 보상
  QUEST_REWARDS: {
    EARLY_BIRD: 50,
    TASK_MASTER: 100,
    LOCK_STAR: 75,
    PERFECT_BLOCK: 150,
    CHALLENGE: 100,
    XP_HUNTER: 200,
  },
  
  // 스트릭 보너스
  STREAK_BONUSES: {
    3: 1.1,   // 3일: 10% 보너스
    7: 1.2,   // 7일: 20% 보너스
    14: 1.3,  // 14일: 30% 보너스
    30: 1.5,  // 30일: 50% 보너스
  },
  
  // 보스 레이드
  BOSS_COUNT: 31,
  BOSS_BASE_HP: 10000,
} as const;
```

## WAIFU_CONSTANTS

동반자 관련 상수입니다.

```typescript
export const WAIFU_CONSTANTS = {
  // 호감도 범위
  MIN_AFFECTION: 0,
  MAX_AFFECTION: 100,
  
  // 호감도 단계
  AFFECTION_STAGES: {
    hostile: { min: 0, max: 19 },
    wary: { min: 20, max: 39 },
    indifferent: { min: 40, max: 59 },
    affectionate: { min: 60, max: 79 },
    loving: { min: 80, max: 100 },
  },
  
  // 호감도 변화량
  AFFECTION_CHANGES: {
    taskCompleted: 1,
    perfectBlock: 3,
    questCompleted: 2,
    chat: 1,
    pat: 2,
    gift: { min: 5, max: 15 },
    taskFailed: -1,
    inactivePerDay: -5,
  },
} as const;
```

## API_CONSTANTS

API 관련 상수입니다.

```typescript
export const API_CONSTANTS = {
  // Gemini
  GEMINI_MODEL: 'gemini-pro',
  GEMINI_MAX_TOKENS: 1024,
  GEMINI_TEMPERATURE: 0.7,
  
  // 토큰 제한
  DAILY_TOKEN_LIMIT: 100000,
  
  // 재시도
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;
```

## 타입 추출

상수에서 타입을 추출하는 패턴:

```typescript
// 상수 정의
export const RESISTANCE_LEVELS = ['low', 'medium', 'high'] as const;

// 타입 추출
export type Resistance = typeof RESISTANCE_LEVELS[number];
// 결과: 'low' | 'medium' | 'high'

// 객체에서 키 추출
export const QUEST_REWARDS = { ... } as const;
export type QuestType = keyof typeof QUEST_REWARDS;
```

## 다음 단계

- [코딩 가이드라인](/reference/coding-guidelines) - 상수 사용 규칙
- [DB 스키마](/reference/database-schema) - 데이터 구조

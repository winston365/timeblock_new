# 게이미피케이션

TimeBlock Planner의 RPG 스타일 게이미피케이션 시스템입니다.

## 개요

생산성 활동을 게임 플레이로 변환하여 지속적인 동기부여를 제공합니다.

```
작업 완료 → XP 획득 → 레벨업 → 보스 레이드 → 보상
```

## XP 시스템

### XP 획득

작업 완료 시 **난이도**와 **시간**에 따라 XP를 획득합니다:

```typescript
// XP 계산 공식
const baseXP = adjustedDuration * 2; // 분당 2 XP

// 저항도 보너스
const resistanceBonus = {
  low: 1.0,
  medium: 1.2,
  high: 1.5
};

const xpAwarded = Math.floor(baseXP * resistanceBonus[resistance]);
```

### 예시

| 작업 | 시간 | 저항도 | 획득 XP |
|:---|:---:|:---:|:---:|
| 이메일 확인 | 15분 | Low | 30 XP |
| 문서 작성 | 45분 | Medium | 108 XP |
| 버그 수정 | 60분 | High | 180 XP |

### 두 가지 XP

- **totalXP** - 누적 총 XP (레벨 결정)
- **availableXP** - 사용 가능한 XP (상점에서 소비)

```typescript
// 레벨업해도 availableXP는 유지됨
totalXP = 5000;      // 레벨 7 도달
availableXP = 1200;  // 아직 안 쓴 XP
```

## 레벨 시스템

### 지수 성장 곡선

레벨이 올라갈수록 더 많은 XP가 필요합니다:

```typescript
// 다음 레벨에 필요한 XP
const xpForNextLevel = (level: number) => 100 * level * level;

// 예시
// Level 1 → 2: 100 XP
// Level 5 → 6: 2,500 XP
// Level 10 → 11: 10,000 XP
```

### 레벨업 보상

- 동반자 특별 대사
- 새로운 기능 해금
- 상점 아이템 해금

## 일일 퀘스트

매일 갱신되는 6가지 퀘스트:

| 퀘스트 | 조건 | 보상 |
|:---|:---|:---:|
| 🌅 Early Bird | 08:00 전 첫 작업 완료 | 50 XP |
| 📋 Task Master | 5개 작업 완료 | 100 XP |
| 🔒 Lock Star | 3개 블록 Lock | 75 XP |
| ✅ Perfect Block | 1개 Perfect Block | 150 XP |
| 🔴 Challenge | High 저항도 1개 완료 | 100 XP |
| 💪 XP Hunter | 500 XP 이상 획득 | 200 XP |

## 보스 레이드 시스템

### 개요

매일 밤 **보스 레이드**가 열립니다. 하루 동안 완료한 작업량으로 보스에게 데미지를 입힙니다.

```
┌─────────────────────────────────────────────┐
│              🐉 Dragon Lord                  │
│             HP: ████████░░ 80%              │
│                                             │
│  Your Damage Today: 1,250                   │
│  Total Party Damage: 45,000                 │
└─────────────────────────────────────────────┘
```

### 데미지 계산

```typescript
// 오늘 획득한 XP가 데미지가 됨
const todayDamage = todayXP;

// 보너스 데미지
const perfectBlockBonus = perfectBlocks * 100;
const questBonus = completedQuests * 50;

const totalDamage = todayDamage + perfectBlockBonus + questBonus;
```

### Settings > Battle: 작업 완료 데미지 룰

- Battle 탭에서 `작업 완료 시간(분) -> 데미지(HP)` 룰을 직접 설정할 수 있습니다.
- 룰은 임계값(Threshold) 모델로 적용됩니다: `minimumDuration <= 완료 시간` 조건을 만족하는 룰 중 가장 큰 임계값의 데미지를 사용합니다.
- 예시: `45분 -> 15 HP` 룰이 있을 때, 45분 완료 작업은 15 HP 데미지를 적용합니다.

### Boss Dex

31종의 유니크 보스를 수집하세요:

- 3D 홀로그램 카드
- 실루엣 도감 (처치 전)
- 보스별 특수 스킬과 스토리

## 상점 시스템

`availableXP`로 아이템을 구매합니다:

### 생산성 아이템

| 아이템 | 가격 | 효과 |
|:---|:---:|:---|
| XP 부스터 | 500 XP | 1시간 동안 XP 1.5배 |
| 시간 확장 | 300 XP | 블록 시간 30분 추가 |
| 퀘스트 리롤 | 200 XP | 퀘스트 재생성 |

### 동반자 아이템

| 아이템 | 가격 | 효과 |
|:---|:---:|:---|
| 꽃다발 | 100 XP | 호감도 +5 |
| 케이크 | 200 XP | 호감도 +10 |
| 반지 | 1000 XP | 특별 대화 해금 |

## 스트릭 시스템

연속 로그인 보너스:

| 연속 일수 | 보너스 |
|:---:|:---|
| 3일 | XP 1.1배 |
| 7일 | XP 1.2배 + 상점 할인 |
| 14일 | XP 1.3배 + 특별 아이템 |
| 30일 | XP 1.5배 + 레어 코스튬 |

## 소스 코드 위치

```
src/features/gamification/
├── components/
│   ├── LevelProgress.tsx   # 레벨/XP 바
│   ├── QuestPanel.tsx      # 일일 퀘스트
│   ├── BossRaid.tsx        # 보스 레이드 UI
│   └── BossDex.tsx         # 보스 도감
└── utils/
    └── xpCalculator.ts     # XP 계산 로직

src/shared/services/gameplay/
├── taskCompletion/
│   └── handlers/
│       └── XPRewardHandler.ts  # XP 지급 핸들러
└── questService.ts             # 퀘스트 로직
```

## 다음 단계

- [AI 동반자](/features/waifu-companion) - Waifu 시스템
- [Gemini AI & RAG](/features/gemini-rag) - AI 비서 기능

# 타임블로킹 시스템

TimeBlock Planner의 핵심 기능인 타임블로킹 시스템입니다.

## 개요

하루를 **6개의 3시간 블록**으로 나누어 관리합니다. 단순히 시간만 배분하는 것이 아니라, **심리적 저항(Resistance)**을 고려하여 시간을 자동 보정합니다.

## 6-Block 시스템

| 블록 | 시간대 | 특성 |
|:---|:---|:---|
| Block 1 | 05:00 - 08:00 | 🌅 새벽/아침 |
| Block 2 | 08:00 - 11:00 | ☀️ 오전 |
| Block 3 | 11:00 - 14:00 | 🌤️ 점심 |
| Block 4 | 14:00 - 17:00 | 🌇 오후 |
| Block 5 | 17:00 - 20:00 | 🌆 저녁 |
| Block 6 | 20:00 - 23:00 | 🌙 밤 |

## 저항도 (Resistance)

작업에 대한 심리적 저항을 3단계로 분류합니다:

### 저항도 레벨

| 레벨 | 배율 | 설명 | 예시 |
|:---|:---:|:---|:---|
| 🟢 Low | 1.0x | 즐기는 작업 | 좋아하는 취미, 쉬운 업무 |
| 🟡 Medium | 1.3x | 평범한 작업 | 일반적인 업무, 루틴 |
| 🔴 High | 1.6x | 미루고 싶은 작업 | 어려운 과제, 싫은 업무 |

### 시간 보정 계산

```typescript
// 예: 30분 예상 작업
const estimatedDuration = 30; // 분

// 저항도가 높으면 실제로 더 오래 걸림
const adjustedDuration = estimatedDuration * resistanceMultiplier;
// High: 30 * 1.6 = 48분
// Medium: 30 * 1.3 = 39분
// Low: 30 * 1.0 = 30분
```

이 보정된 시간을 기준으로 블록에 배치합니다.

## 블록 상태

각 타임블록은 4가지 상태를 가집니다:

| 상태 | 아이콘 | 설명 |
|:---|:---:|:---|
| `open` | ⬜ | 아직 계획되지 않음 |
| `lock` | 🔒 | 계획 확정 (수정 불가) |
| `timer` | ⏱️ | 현재 진행 중 |
| `perfect` | ✅ | 모든 작업 완료 |
| `failed` | ❌ | 시간 초과 또는 미완료 |

### 상태 흐름

```
open → lock → timer → perfect/failed
  │           │
  └───────────┘ (시간이 되면 자동으로 timer)
```

## 작업 (Task) 구조

```typescript
interface Task {
  id: string;
  title: string;
  estimatedDuration: number;  // 분 단위
  adjustedDuration: number;   // 저항도 적용된 시간
  resistance: 'low' | 'medium' | 'high';
  completed: boolean;
  completedAt?: number;       // timestamp
  timeBlockIndex: number;     // 0-5
  order: number;              // 블록 내 순서
  tags?: string[];
  linkedGoalId?: string;      // 목표와 연결
}
```

## UI 구성요소

### TimeBlockCard

각 블록을 표시하는 카드 컴포넌트:

```
┌─────────────────────────────────────────┐
│ 08:00 - 11:00           🔒 [Lock]       │
├─────────────────────────────────────────┤
│ ☐ 이메일 확인 (15분)            🟢      │
│ ☐ 문서 작성 (45분)              🟡      │
│ ☐ 버그 수정 (60분)              🔴      │
├─────────────────────────────────────────┤
│ 남은 시간: 60분                          │
└─────────────────────────────────────────┘
```

### 드래그 앤 드롭

작업을 블록 간에 드래그하여 이동할 수 있습니다:

- 블록 내 순서 변경
- 다른 블록으로 이동
- 인박스에서 블록으로 배치

## Perfect Block 보너스

블록 내 모든 작업을 시간 안에 완료하면 **Perfect Block** 보너스를 받습니다:

- 추가 XP 획득
- 일일 퀘스트 진행
- 동반자 특별 반응

## 소스 코드 위치

```
src/features/schedule/
├── components/
│   ├── TimeBlockCard.tsx      # 블록 카드
│   ├── TaskItem.tsx           # 개별 작업 아이템
│   ├── ScheduleHeader.tsx     # 날짜/뷰 헤더
│   └── DragDropContext.tsx    # DnD 컨텍스트
├── hooks/
│   └── useScheduleState.ts    # 스케줄 상태 훅
└── utils/
    └── timeBlockUtils.ts      # 블록 계산 유틸리티
```

## 다음 단계

- [게이미피케이션](/features/gamification) - XP, 레벨, 퀘스트
- [AI 동반자](/features/waifu-companion) - 정서적 지지 시스템

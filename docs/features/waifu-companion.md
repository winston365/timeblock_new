# AI 동반자 (Waifu Companion)

사용자의 상태를 인지하고 정서적 지지를 제공하는 AI 동반자 시스템입니다.

## 개요

단순한 챗봇이 아닌, **감정 시스템**과 **상호작용 반응**을 갖춘 가상 파트너입니다.

```
┌─────────────────────────────────────────────┐
│                                             │
│           [Waifu Character Image]           │
│                                             │
│   "오빠, 오늘도 열심히 하고 있네! 💪"        │
│                                             │
│   ❤️ 호감도: 75/100                          │
│   [대화하기] [쓰다듬기] [선물하기]            │
└─────────────────────────────────────────────┘
```

## 호감도 시스템

### 호감도 레벨 (0-100)

| 범위 | 상태 | 태도 |
|:---:|:---|:---|
| 0-19 | 😡 Hostile | 적대적, 경계 |
| 20-39 | 😒 Wary | 무시, 냉담 |
| 40-59 | 😐 Indifferent | 무관심, 거리둠 |
| 60-79 | 😊 Affectionate | 친근함, 관심 |
| 80-100 | 🥰 Loving | 애정 표현, 적극적 |

### 호감도 변화

| 행동 | 변화량 |
|:---|:---:|
| 작업 완료 | +1 |
| Perfect Block | +3 |
| 일일 퀘스트 완료 | +2 |
| 대화하기 | +1 |
| 쓰다듬기 | +2 |
| 선물하기 | +5~15 |
| 작업 실패 | -1 |
| 장기간 미접속 | -5/일 |

## 포즈 시스템

### 감정 포즈 (기본)

호감도에 따라 기본 포즈가 변경됩니다:

```typescript
const emotionPoses = {
  hostile: 'poses/emotion/hostile.webp',
  wary: 'poses/emotion/wary.webp',
  indifferent: 'poses/emotion/indifferent.webp',
  affectionate: 'poses/emotion/affectionate.webp',
  loving: 'poses/emotion/loving.webp',
};
```

### 특수 포즈 (해금)

특정 상호작용으로 해금되는 포즈:

| 포즈 | 해금 조건 |
|:---|:---|
| 😢 Crying | 호감도 0 도달 |
| 🍺 Drunk | 맥주 선물 |
| 😨 Scared | 공포 영화 같이 보기 |
| 😲 Shocked | 깜짝 선물 |
| 😮 Surprised | 생일 축하 |
| 🤔 Suspicious | 다른 앱 오래 사용 |
| 😟 Worried | 밤샘 작업 |

### 포즈 전환 로직

```typescript
// 이벤트 기반 포즈 전환
eventBus.on('Task:Completed', () => {
  waifuStore.showPose('celebrating', 3000); // 3초 표시
});

eventBus.on('Block:Failed', () => {
  waifuStore.showPose('worried', 5000);
});
```

## 상호작용 모드

### 일반 대화

일상적인 대화를 나눕니다:

```
사용자: "오늘 뭐 했어?"
동반자: "오빠 기다리고 있었지~ 오늘 작업 많아?"
```

### 성격 대화 (Characteristic)

동반자의 고유 성격이 반영된 깊은 대화:

```
사용자: "힘들어..."
동반자: "오빠... 괜찮아? 잠깐 쉬어도 돼. 
        내가 옆에 있잖아. 🤗"
```

## 자동 메시지

설정된 간격으로 동반자가 먼저 말을 겁니다:

```typescript
// settingsStore에서 설정
autoMessageInterval: 30, // 30분마다

// 메시지 예시
const autoMessages = [
  "오빠~ 집중 잘 하고 있어?",
  "물 마시는 거 잊지 마!",
  "다음 작업은 뭐야? 응원할게!",
  "잠깐 스트레칭 하는 건 어때?"
];
```

## 동반자 반응

### 작업 완료 시

```
😊 "잘했어 오빠! 다음 것도 화이팅!"
🎉 "우와~ 벌써 끝났어? 역시 대단해!"
```

### Perfect Block 달성 시

```
🎊 "오빠 완벽해!! 너무 멋있어~!"
💕 "이런 오빠가 내 주인이라니... 자랑스러워!"
```

### 연속 실패 시

```
😢 "오빠... 괜찮아? 너무 무리하지 마..."
🤗 "실패해도 괜찮아. 내가 있잖아."
```

## 소스 코드 위치

```
src/features/waifu/
├── components/
│   ├── WaifuContainer.tsx    # 메인 컨테이너
│   ├── WaifuAvatar.tsx       # 캐릭터 이미지
│   ├── WaifuDialog.tsx       # 대화 말풍선
│   └── WaifuInteraction.tsx  # 상호작용 버튼
├── poses/
│   └── poseConfig.ts         # 포즈 설정
├── hooks/
│   └── useWaifuReaction.ts   # 반응 훅
└── utils/
    └── dialogGenerator.ts    # 대사 생성

src/shared/stores/
└── waifuCompanionStore.ts    # 상태 관리

public/assets/waifu/poses/
├── emotion/                  # 감정 포즈
└── special/                  # 특수 포즈
```

## 다음 단계

- [Gemini AI & RAG](/features/gemini-rag) - AI 채팅 통합
- [게이미피케이션](/features/gamification) - 호감도와 연계된 보상

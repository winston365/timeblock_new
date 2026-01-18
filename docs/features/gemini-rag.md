# Gemini AI & RAG

Google Gemini Pro와 하이브리드 RAG를 결합한 맥락 인식 AI 비서입니다.

## 개요

단순한 AI 챗봇이 아닌, **내 데이터를 기억하고 맥락을 이해하는** 개인 비서입니다.

```
사용자: "지난주 화요일에 뭐 했어?"
AI: "지난주 화요일(1월 7일)에는 총 5개 작업을 완료하셨어요:
     - 프로젝트 문서 작성 (45분)
     - 코드 리뷰 (30분)
     - 버그 수정 #123 (60분)
     - 미팅 참여 (60분)
     - 이메일 정리 (20분)
     전체 시간: 3시간 35분, 획득 XP: 430"
```

## 하이브리드 RAG 시스템

### 두 가지 검색 방식

| 검색 방식 | 용도 | 정확도 |
|:---|:---|:---:|
| **Direct Query** | 날짜, 상태 등 구조화된 쿼리 | 100% |
| **Vector Search** | 의미론적/유사성 검색 | 높음 |

### 쿼리 라우팅

```typescript
// QueryParser가 쿼리를 분석하여 적절한 방식 선택

// 구조화된 쿼리 → Direct Query
"11월 24일 완료 작업" → directQueryService.query()

// 의미론적 쿼리 → Hybrid (Direct + Vector)
"프로그래밍 관련 작업" → hybridRAGService.search()

// 통계 쿼리 → Aggregation
"이번 주 몇 개 완료?" → directQueryService.aggregate()
```

## Query Parser

자연어를 구조화된 쿼리로 변환합니다:

```typescript
// src/shared/services/rag/queryParser.ts

interface ParsedQuery {
  type: 'date_specific' | 'semantic' | 'stats';
  dateRange?: { start: string; end: string };
  status?: 'completed' | 'pending' | 'all';
  timeBlock?: number;
  keywords?: string[];
}

// 예시 파싱
"지난주 완료한 작업" → {
  type: 'date_specific',
  dateRange: { start: '2024-01-08', end: '2024-01-14' },
  status: 'completed'
}

"코딩 관련해서 힘들어했던 거" → {
  type: 'semantic',
  keywords: ['코딩', '힘들', '어려움']
}
```

## Vector Store

Orama 기반 인메모리 벡터 검색:

```typescript
// src/shared/services/rag/vectorStore.ts

// 앱 시작 시 벡터 DB 구축
await vectorStore.rebuild();

// 의미론적 검색
const results = await vectorStore.search({
  term: '프로그래밍 버그',
  limit: 10,
  threshold: 0.7
});
```

::: info 참고
Vector Store는 인메모리로 동작하여 앱 재시작 시 재구축됩니다.
:::

## 주요 AI 기능

### 1. 작업 분해

복잡한 작업을 실행 가능한 단위로 자동 분할:

```
입력: "프로젝트 발표 준비"

출력:
1. 발표 자료 개요 작성 (15분) 🟢
2. 슬라이드 디자인 (45분) 🟡
3. 스크립트 작성 (30분) 🟡
4. 리허설 (20분) 🟢
```

### 2. 자동 태깅

과거 패턴을 분석하여 적절한 태그 추천:

```typescript
// autoTagService.ts

// 입력: "React 컴포넌트 리팩토링"
// 추천 태그: ["개발", "React", "리팩토링", "프론트엔드"]
```

### 3. 동기부여 메시지

현재 상태에 맞는 개인화된 격려:

```
// 연속 실패 후
"힘든 시간이 있어도 괜찮아요. 
 지난주엔 5일 연속 Perfect Block을 달성했잖아요!
 다시 할 수 있어요. 💪"
```

### 4. 패턴 분석

행동 패턴을 분석하여 인사이트 제공:

```
"오전 블록(08-11시)에서 High 저항도 작업을 
 가장 잘 처리하시는 것 같아요.
 어려운 작업은 오전에 배치해보는 건 어떨까요?"
```

## Gemini 통합

### API 클라이언트

```typescript
// src/shared/services/ai/gemini/apiClient.ts

async function generateResponse(
  prompt: string,
  context: RAGContext
): Promise<string> {
  const persona = buildPersonaContext();
  const ragContext = formatRAGContext(context);
  
  const response = await gemini.generateContent({
    contents: [
      { role: 'user', parts: [{ text: `${persona}\n${ragContext}\n${prompt}` }] }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  });
  
  return response.text();
}
```

### 토큰 사용량 추적

```typescript
// dailyTokenUsage 테이블로 관리
const usage = await db.dailyTokenUsage.get(today);

if (usage.tokens >= DAILY_LIMIT) {
  throw new Error('일일 토큰 한도 초과');
}
```

### 카테고리별 프롬프트

| 카테고리 | 용도 |
|:---|:---|
| `task-advice` | 작업 분해, 우선순위 조언 |
| `motivation` | 동기부여, 격려 메시지 |
| `qa` | 일반 질의응답 |
| `analysis` | 패턴 분석, 리포트 |

## 날씨 통합

Google Search Grounding을 활용한 실시간 날씨:

```typescript
// src/shared/services/ai/gemini/geminiWeather.ts

// 현재 위치 기반 날씨 정보
const weather = await geminiWeather.getCurrentWeather();
// { temp: 5, condition: '맑음', humidity: 45 }

// 날씨 기반 추천
"오늘 맑고 추워요! 
 실내 작업에 집중하기 좋은 날이에요. ☀️🥶"
```

## 디버깅

### 콘솔 유틸리티

```javascript
// RAG 컨텍스트 생성 테스트
await window.hybridRag.generateContext('지난주 완료 작업');

// Vector Store 내용 확인
window.rag.debugGetAllDocs();
```

## 소스 코드 위치

```
src/features/gemini/
├── components/
│   ├── GeminiChat.tsx        # 채팅 UI
│   └── GeminiFullScreen.tsx  # 전체화면 채팅
└── hooks/
    └── useGeminiChat.ts      # 채팅 훅

src/shared/services/
├── ai/gemini/
│   ├── apiClient.ts          # API 클라이언트
│   ├── personaPrompts.ts     # 페르소나 프롬프트
│   ├── taskFeatures.ts       # 작업 관련 기능
│   └── geminiWeather.ts      # 날씨 통합
└── rag/
    ├── hybridRAGService.ts   # 메인 RAG 서비스
    ├── queryParser.ts        # 쿼리 파서
    ├── directQueryService.ts # Direct Query
    ├── vectorStore.ts        # Vector Store
    └── autoTagService.ts     # 자동 태깅
```

## 다음 단계

- [Google Calendar 연동](/features/google-calendar) - 일정 동기화
- [AI 동반자](/features/waifu-companion) - Gemini와 동반자 연계

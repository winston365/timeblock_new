# Gemini AI Module

Google Gemini API를 활용한 AI 기능 통합 모듈

## 📁 모듈 구조

```
gemini/
├── index.ts          # Public API re-exports
├── apiClient.ts      # Gemini API 호출 핵심 함수
├── personaPrompts.ts # AI 페르소나 프롬프트 생성
├── taskFeatures.ts   # 작업 관련 AI 기능 (분해, 추천 등)
└── types.ts          # TypeScript 타입 정의
```

## 🎯 각 파일의 역할

### `apiClient.ts`
- **역할**: Gemini API 직접 호출
- **주요 함수**:
  - `callGeminiAPI()` - 기본 API 호출
  - `callGeminiAPIWithStreaming()` - 스트리밍 응답 처리
- **사용처**: 모든 AI 기능의 기반

### `personaPrompts.ts`
- **역할**: AI 캐릭터 페르소나 및 시스템 프롬프트 생성
- **주요 함수**:
  - `buildPersonaSystemPrompt()` - 와이푸 캐릭터 시스템 프롬프트
  - `buildContextPrompt()` - 현재 상황 컨텍스트 (시간, 작업, 목표)
- **의존성**: `@/shared/lib/personaUtils`

### `taskFeatures.ts`
- **역할**: 작업 관련 AI 지원 기능
- **주요 함수**:
  - `decomposeTask()` - 큰 작업을 작은 단계로 분해
  - `suggestNextTask()` - 다음 작업 추천
  - `estimateTaskDuration()` - 작업 소요 시간 예측
- **사용처**: TaskModal, Gemini Chat

### `types.ts`
- **역할**: TypeScript 타입 정의
- **주요 타입**:
  - `GeminiMessage` - API 메시지 형식
  - `GeminiResponse` - API 응답 형식
  - `TokenUsage` - 토큰 사용량 추적

## 📘 사용 예시

### 기본 API 호출

```typescript
import { callGeminiAPI } from '@/shared/services/ai/gemini';

const response = await callGeminiAPI(
  '오늘 할 일을 정리해줘',
  [], // 대화 히스토리
  apiKey,
  'gemini-2.5-flash' // 모델명 (선택)
);

console.log(response.text);
console.log(response.tokenUsage); // { inputTokens, outputTokens }
```

### 작업 분해

```typescript
import { decomposeTask } from '@/shared/services/ai/gemini';

const subtasks = await decomposeTask(
  '프로젝트 발표 준비',
  apiKey
);
// ['슬라이드 개요 작성', '자료 조사', '슬라이드 제작', '발표 연습']
```

### 페르소나 프롬프트

```typescript
import { buildPersonaSystemPrompt, buildContextPrompt } from '@/shared/services/ai/gemini';

const systemPrompt = buildPersonaSystemPrompt(waifuState, settings);
const contextPrompt = buildContextPrompt(dailyData, gameState);

const response = await callGeminiAPI(userMessage, history, apiKey);
```

## ⚙️ 설정

### API 키 설정
- 설정 모달 → AI 탭에서 Gemini API 키 입력
- `settingsRepository`에 저장됨

### 모델 선택
- 기본값: `gemini-2.5-flash`
- 설정에서 변경 가능: `gemini-2.5-pro`, `gemini-2.0-flash-exp` 등

### 토큰 사용량 추적
- `dailyTokenUsageRepository`에 일별 사용량 저장
- 설정 모달에서 사용량 확인 가능

## 🔗 관련 모듈

- `src/features/gemini/` - Gemini 채팅 UI
- `src/shared/lib/personaUtils.ts` - 페르소나 컨텍스트 빌더
- `src/data/repositories/tokenUsageRepository.ts` - 토큰 사용량 저장
- `src/shared/stores/settingsStore.ts` - API 키 관리

## 📝 주의사항

1. **API 키 보안**: API 키는 로컬 저장소에만 저장, Firebase에 업로드되지 않음
2. **토큰 제한**: 일일 토큰 사용량 모니터링 권장
3. **에러 처리**: API 호출 실패 시 사용자에게 명확한 에러 메시지 표시
4. **스트리밍**: 긴 응답은 스트리밍 API 사용 권장

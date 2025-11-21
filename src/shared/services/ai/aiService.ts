/**
 * AI 호출 통합 서비스
 *
 * @role 모든 AI 호출을 단일 인터페이스로 통합
 *       1. 현재 내상태 context 수집 (PersonaContext)
 *       2. AI 페르소나 프롬프트 생성 (기본 성격)
 *       3. 개별 요청별 추가 instructions 결합
 *       4. Gemini API 호출
 * @input AI 호출 타입, 현재 상태, 사용자 프롬프트, 대화 히스토리, 추가 지시사항
 * @output AI 응답 텍스트, 토큰 사용량
 * @external_dependencies
 *   - geminiApi: Gemini API 호출 및 페르소나 생성
 *   - personaUtils: PersonaContext 빌드
 */

import { callGeminiAPI, generateWaifuPersona, SYSTEM_PERSONA_PROMPT } from './geminiApi';
import { buildPersonaContext } from '@/shared/lib/personaUtils';
import type { DailyData, GameState, WaifuState } from '@/shared/types/domain';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';

/**
 * AI 호출 타입
 */
export type AICallType = 'chat' | 'insight' | 'task-breakdown' | 'custom';

/**
 * AI 호출 파라미터
 */
export interface AICallParams {
  // ===== 1. 현재 내상태 (필수) =====
  dailyData: DailyData | null;
  gameState: GameState | null;
  waifuState: WaifuState | null;
  currentEnergy: number;

  // ===== 2. AI 설정 (필수) =====
  apiKey: string;
  model?: string;  // Gemini 모델명 (선택, 기본: gemini-2.0-flash-exp)

  // ===== 3. 개별 요청 내용 =====
  type: AICallType;
  userPrompt?: string;              // 사용자 입력 메시지
  history?: Array<{ role: 'user' | 'model'; text: string }>;  // 대화 히스토리
  additionalInstructions?: string;  // 출력 형식 등 추가 지시사항
}

/**
 * AI 호출 결과
 */
export interface AICallResult {
  text: string;
  tokenUsage?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
}

/**
 * AI 통합 호출 함수
 *
 * @param {AICallParams} params - AI 호출 파라미터
 * @returns {Promise<AICallResult>} AI 응답 텍스트와 토큰 사용량
 * @throws {Error} API 키가 없거나 API 호출 실패 시
 * @sideEffects
 *   - buildPersonaContext: 10일치 DB 조회
 *   - callGeminiAPI: Gemini API HTTP 요청
 *
 * @example
 * ```typescript
 * // 채팅
 * const result = await callAIWithContext({
 *   dailyData, gameState, waifuState, currentEnergy,
 *   apiKey: settings.geminiApiKey,
 *   model: settings.geminiModel,
 *   type: 'chat',
 *   userPrompt: '오늘 할 일 추천해줘',
 *   history: previousMessages
 * });
 *
 * // 인사이트
 * const insight = await callAIWithContext({
 *   dailyData, gameState, waifuState, currentEnergy,
 *   apiKey: settings.geminiApiKey,
 *   model: settings.geminiModel,
 *   type: 'insight',
 *   additionalInstructions: getInsightPrompt()
 * });
 * ```
 */
export async function callAIWithContext(params: AICallParams): Promise<AICallResult> {
  const {
    dailyData,
    gameState,
    waifuState,
    currentEnergy,
    apiKey,
    model,
    type,
    userPrompt = '',
    history = [],
    additionalInstructions = '',
  } = params;

  // ===== ✅ 1단계: 타입별 페르소나 프롬프트 =====
  let basePersonaPrompt: string;
  if (type === 'task-breakdown') {
    // 작업 세분화는 고정 페르소나만 사용 (컨텍스트 제외)
    basePersonaPrompt = SYSTEM_PERSONA_PROMPT;
  } else {
    // chat/insight/custom: 컨텍스트 포함 페르소나 프롬프트 생성
    const personaContext = await buildPersonaContext({
      dailyData,
      gameState,
      waifuState,
      currentEnergy,
    });
    basePersonaPrompt = generateWaifuPersona(personaContext);
  }

  // ===== ✅ 3단계: 타입별 프롬프트 조합 =====
  let finalPrompt: string;

  switch (type) {
    case 'chat':
      // 대화가 이어져도 기본 페르소나 컨텍스트를 항상 포함해 맥락이 끊기지 않도록 유지
      finalPrompt = `${basePersonaPrompt}\n\n${userPrompt}`;
      break;

    case 'insight':
      // 페르소나 + 추가 지시사항
      finalPrompt = `${basePersonaPrompt}\n\n${additionalInstructions}`;
      break;

    case 'task-breakdown':
    case 'custom':
      // 페르소나 + 사용자 프롬프트 + 추가 지시사항
      finalPrompt = [basePersonaPrompt, userPrompt, additionalInstructions]
        .filter(Boolean)
        .join('\n\n');
      break;

    default:
      throw new Error(`Unknown AI call type: ${type}`);
  }

  // ===== ✅ 4단계: Gemini API 호출 =====
  const result = await callGeminiAPI(finalPrompt, history, apiKey, model);

  if (result.tokenUsage) {
    await addTokenUsage(result.tokenUsage.promptTokens, result.tokenUsage.candidatesTokens);
  }

  return result;
}

/**
 * 인사이트용 출력 지시사항
 *
 * @returns {string} 인사이트 생성 지시사항 프롬프트
 */
export function getInsightPrompt(): string {
  const prompt = `
---

## 💡 오늘의 인사이트 작성 (종합 분석)

위 데이터를 기반으로 **오늘의 인사이트**를 작성해줘.
**반드시 아래 JSON 형식으로만 출력해줘.** (마크다운 코드블록 없이 순수 JSON만)

\`\`\`json
{
  "status": {
    "emoji": "string (현재 상태를 나타내는 이모지)",
    "title": "string (현재 상태 한줄 요약, 예: '에너지 충전 필요', '집중력 최고조')",
    "description": "string (상태에 대한 1-2문장 설명)",
    "color": "string ('green' | 'yellow' | 'red')"
  },
  "action": {
    "task": "string (지금 당장 해야 할 단 하나의 작업)",
    "reason": "string (이 작업을 지금 해야 하는 이유)"
  },
  "motivation": "string (짧고 강렬한 동기부여 한마디)",
  "quickWins": [
    {
      "id": "string (unique id)",
      "task": "string (1분 안에 끝낼 수 있는 아주 쉬운 작업)",
      "xp": "number (완료 시 획득할 XP, 보통 10-50)"
    }
  ],
  "progress": {
    "rank": "string ('S' | 'A' | 'B' | 'C')",
    "totalXp": "number (오늘 획득한 총 XP 추정치)",
    "mvpTask": "string (오늘 완료한 가장 의미 있는 작업)",
    "comment": "string (현재 성과에 대한 칭찬이나 격려)"
  }
}
\`\`\`

### 🔍 분석 기준
1. **Status (상태)**
   - Green: 에너지 > 70 또는 집중력 높은 시간대
   - Yellow: 에너지 40-70 또는 일반적인 시간대
   - Red: 에너지 < 40 또는 늦은 밤/휴식 필요

2. **Action (추천 작업)**
   - **단 하나만** 추천할 것 (ADHD 친화적)
   - 에너지가 낮으면 '휴식'이나 '작은 정리' 추천
   - 에너지가 높으면 '가장 중요한 작업' 추천

3. **Quick Wins (도파민 메뉴)**
   - **무조건 3개 제안할 것** (사용자가 원할 때 언제든 수행 가능하도록)
   - 아주 사소한 것들 (물 마시기, 스트레칭, 책상 정리 등)
   - 완료 시 XP 보상이 있는 작은 작업들

4. **Progress (중간 성과)**
   - **무조건 포함할 것** (사용자가 언제든 확인 가능해야 함)
   - 현재까지의 진행 상황을 게임 랭크로 평가
   - 긍정적인 피드백 위주
`;
  return prompt;
}

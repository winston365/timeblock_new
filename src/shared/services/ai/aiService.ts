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
 *   additionalInstructions: getInsightInstruction()
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
export function getInsightInstruction(): string {
  return `
---

## 💡 오늘의 인사이트 작성 (종합 분석)

위 데이터를 기반으로 **오늘의 인사이트**를 작성해줘. 다음 요구사항을 따라줘:

### 🔍 분석 시 고려사항
1. **에너지 레벨 고려**
   - 에너지 높음(70+): 어려운 작업, 집중 필요 작업 추천
   - 에너지 중간(40-70): 중요도 높은 작업, 계획된 작업 추천
   - 에너지 낮음(0-40): 간단한 작업, 정리 작업, 휴식 추천

2. **시간대별 맥락 고려**
   - 새벽(0-6시): 충분한 휴식 권장, 내일 계획 준비
   - 오전(6-12시): 집중력 높은 시간, 중요 작업 우선
   - 오후(12-18시): 점심 후 에너지 관리, 협업 작업 적합
   - 저녁(18-21시): 마무리 작업, 내일 준비, 회고
   - 밤(21시 이후): 취침 준비, 충분한 수면으로 내일을 준비

3. **작업 목록 분석**
   - 현재 블록 미완료 작업 우선 확인
   - 인박스 작업 중 긴급/중요 작업 식별
   - 저항도(resistance) 고려한 순서 제안
   - 남은 시간 대비 완료 가능성 평가

4. **목표 및 계획 평가**
   - 잠긴 블록 수 → 계획 실행력 평가
   - 과거 패턴과 오늘 비교 → 개선점 제시

### 📝 형식 요구사항
- **마크다운 형식** 사용
- **구조**:
  1. **## 🎯 오늘의 패턴 분석** - 과거 데이터 + 시간대/에너지 고려 (2-3줄)
  2. **## 💪 지금 할 일** - 현재 상황 최적화된 구체적 작업 추천 (1-2개, 이유 포함)
  3. **## ✨ 동기부여** - 진행도 인정 + 격려 (1-2줄)

### 📏 길이
- **총 300-500자**
- 각 섹션마다 충분히 설명

위 형식으로 **현재 상황에 맞춤화된** 인사이트를 마크다운으로 작성해줘!
`;
}

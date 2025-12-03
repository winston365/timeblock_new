/**
 * Gemini API Client Service
 *
 * @role Google Gemini 2.5 Flash API를 사용하여 AI 대화 기능을 제공합니다.
 *       와이푸 페르소나 시스템 프롬프트를 생성하고 대화 컨텍스트를 관리합니다.
 * @input 사용자 프롬프트, 대화 히스토리, API 키, PersonaContext (게임 상태 정보)
 * @output Gemini API 응답 텍스트, 토큰 사용량 정보, 와이푸 페르소나 시스템 프롬프트
 * @external_dependencies
 *   - Google Gemini API: generativelanguage.googleapis.com (gemini-2.5-flash-preview-05-20 모델)
 *   - Fetch API: HTTP 요청 전송
 * 
 * @refactored 2024-11 - 모듈 분리 (./gemini/ 폴더)
 *   - types.ts: 타입 정의
 *   - apiClient.ts: API 호출 함수
 *   - personaPrompts.ts: 페르소나 프롬프트 생성
 *   - taskFeatures.ts: 작업 관련 AI 기능
 * 
 * 이 파일은 하위 호환성을 위해 모든 export를 re-export합니다.
 */

// Types
export type {
  GeminiMessage,
  GeminiResponse,
  TokenUsage,
  DetailedTask,
  PersonaContext,
  TaskBreakdownParams,
} from './gemini';

// API Client
export {
  GEMINI_API_ENDPOINT,
  callGeminiAPI,
  callGeminiAPIWithTools,
} from './gemini';

// Persona Prompts
export {
  SYSTEM_PERSONA_PROMPT,
  generateWaifuPersona,
} from './gemini';

// Task Features
export {
  generateTaskBreakdown,
  suggestTaskEmoji,
} from './gemini';

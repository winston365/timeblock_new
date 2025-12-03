/**
 * index.ts
 *
 * @fileoverview Gemini API 모듈 진입점 (Barrel Export)
 *
 * @role Gemini 서비스의 공개 API를 단일 진입점으로 제공
 * @responsibilities
 *   - 하위 모듈의 타입, 함수, 상수를 re-export
 *   - 하위 호환성 유지를 위한 통합 인터페이스 제공
 * @dependencies
 *   - ./types: 타입 정의
 *   - ./apiClient: API 호출 함수
 *   - ./personaPrompts: 페르소나 프롬프트 생성
 *   - ./taskFeatures: 작업 관련 AI 기능
 *
 * @refactored 2024-11 - 모듈 분리 (./gemini/ 폴더)
 */

// Types
export type {
  GeminiMessage,
  GeminiResponse,
  TokenUsage,
  DetailedTask,
  PersonaContext,
  TaskBreakdownParams,
} from './types';

// API Client
export {
  GEMINI_API_ENDPOINT,
  callGeminiAPI,
  callGeminiAPIWithTools,
} from './apiClient';

// Persona Prompts
export {
  SYSTEM_PERSONA_PROMPT,
  generateWaifuPersona,
} from './personaPrompts';

// Task Features
export {
  generateTaskBreakdown,
  suggestTaskEmoji,
} from './taskFeatures';

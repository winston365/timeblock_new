/**
 * Token Usage Utilities
 *
 * @fileoverview Gemini API 토큰 사용량 추적을 위한 공통 유틸리티
 *
 * @role 토큰 사용량 추적 패턴 표준화
 * @responsibilities
 *   - 토큰 사용량 기록 (에러 무시)
 *   - null/undefined 안전 처리
 * @dependencies
 *   - chatHistoryRepository: addTokenUsage 함수
 */

import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';

/**
 * Gemini API 응답에서 반환되는 토큰 사용량 타입
 */
export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

/**
 * 토큰 사용량을 추적합니다.
 * 
 * 에러가 발생해도 무시하고 계속 진행합니다 (비핵심 기능).
 * tokenUsage가 없으면 아무것도 하지 않습니다.
 *
 * @param tokenUsage - Gemini API 응답의 토큰 사용량 (optional)
 * @returns void
 *
 * @example
 * const { text, tokenUsage } = await callGeminiAPI(prompt);
 * trackTokenUsage(tokenUsage);
 */
export function trackTokenUsage(tokenUsage?: TokenUsage | null): void {
  if (!tokenUsage) return;
  
  addTokenUsage(
    tokenUsage.promptTokens, 
    tokenUsage.candidatesTokens
  ).catch(console.error);
}

/**
 * 임베딩 토큰 사용량을 추적합니다.
 *
 * @param embeddingTokens - 임베딩에 사용된 토큰 수
 */
export function trackEmbeddingTokens(embeddingTokens: number): void {
  if (!embeddingTokens || embeddingTokens <= 0) return;
  
  addTokenUsage(0, 0, embeddingTokens).catch(console.error);
}

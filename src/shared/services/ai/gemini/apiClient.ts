/**
 * apiClient.ts
 *
 * @fileoverview Gemini API HTTP 클라이언트 유틸리티
 *
 * @role Google Gemini API와의 HTTP 통신 담당
 * @responsibilities
 *   - 텍스트 생성 API 호출 (generateContent)
 *   - Google Search Grounding을 사용한 실시간 정보 조회
 *   - 응답 파싱 및 토큰 사용량 추출
 *   - API 오류 처리 및 재시도 힌트 제공
 * @dependencies
 *   - fetch: HTTP 요청 전송
 *   - ./types: GeminiMessage, GeminiResponse, TokenUsage 타입 정의
 */

import type { GeminiMessage, GeminiResponse, TokenUsage } from './types';

// ============================================================================
// API Constants
// ============================================================================

export const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:streamGenerateContent';

// ============================================================================
// Core API Functions
// ============================================================================

/**
 * Gemini API를 호출하여 AI 응답을 생성합니다.
 *
 * @param {string} prompt - 사용자 프롬프트
 * @param {Array<{role: 'user' | 'model'; text: string}>} history - 대화 히스토리 (기본값: 빈 배열)
 * @param {string} apiKey - Gemini API 키 (선택적)
 * @param {string} model - 호출할 Gemini 모델명 (선택)
 * @returns {Promise<{text: string; tokenUsage?: TokenUsage}>}
 *          AI 응답 텍스트와 토큰 사용량 정보
 * @throws {Error} API 키가 없거나, API 호출 실패, 또는 응답이 없는 경우
 */
export async function callGeminiAPI(
  prompt: string,
  history: Array<{ role: 'user' | 'model'; text: string }> = [],
  apiKey?: string,
  model?: string
): Promise<{ text: string; tokenUsage?: TokenUsage }> {
  // API 키 확인 (설정에서 가져옴)
  const apiKeyValue = apiKey;
  if (!apiKeyValue) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. 우측 하단 ⚙️ 설정에서 Gemini API 키를 추가해주세요!ㅎ');
  }

  // 모델명 결정 (기본값: gemini-2.5-flash)
  // 사용자가 입력한 모델명이 있으면 그것을 사용
  const modelName = model || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  // 메시지 히스토리 변환
  const contents: GeminiMessage[] = [
    ...history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: prompt }],
    },
  ];

  try {
    const response = await fetch(`${endpoint}?key=${apiKeyValue}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8096,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `Gemini API 호출 실패: ${response.status} ${response.statusText}${errorData ? ` - ${JSON.stringify(errorData)}` : ''
        }`
      );
    }

    const responsePayload: GeminiResponse = await response.json();

    if (!responsePayload.candidates || responsePayload.candidates.length === 0) {
      throw new Error('Gemini API로부터 응답을 받지 못했습니다.');
    }

    const candidate = responsePayload.candidates[0];
    
    // MAX_TOKENS로 잘린 경우에도 가능한 텍스트 추출 시도
    const parts = candidate?.content?.parts || [];
    const text = parts.map(p => p?.text || '').join('').trim();
    
    // finishReason이 MAX_TOKENS인 경우 경고 로그
    if (candidate.finishReason === 'MAX_TOKENS') {
      console.warn('[Gemini API] Response truncated due to MAX_TOKENS. Consider increasing maxOutputTokens.');
    }

    const tokenUsage = responsePayload.usageMetadata
      ? {
        promptTokens: responsePayload.usageMetadata.promptTokenCount,
        candidatesTokens: responsePayload.usageMetadata.candidatesTokenCount,
        totalTokens: responsePayload.usageMetadata.totalTokenCount,
      }
      : undefined;

    return { text, tokenUsage };
  } catch (error) {
    console.error('Gemini API 호출 중 오류:', error);
    throw error;
  }
}

/**
 * Google Search Grounding을 사용하여 Gemini API를 호출합니다 (날씨 등 실시간 정보용)
 *
 * @param {string} prompt - 검색 기반 응답을 생성할 사용자 프롬프트
 * @param {string} apiKey - Gemini API 키
 * @returns {Promise<{text: string; tokenUsage?: TokenUsage}>}
 *          AI 응답 텍스트와 토큰 사용량 정보
 * @throws {Error} API 키가 없거나, API 호출 실패, 또는 응답이 없는 경우
 */
export async function callGeminiAPIWithTools(
  prompt: string,
  apiKey: string
): Promise<{ text: string; tokenUsage?: TokenUsage }> {
  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
  }

  // Google Search Grounding에는 non-thinking 모델 사용 (2.5는 thinking 모델이라 문제 발생)
  const modelName = 'gemini-2.5-flash-lite';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        tools: [{
          googleSearch: {}
        }],
        generationConfig: {
          temperature: 0.1, // 사실적인 정보를 위해 낮춤
          maxOutputTokens: 8096,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `Gemini API 호출 실패: ${response.status} ${response.statusText}${errorData ? ` - ${JSON.stringify(errorData)}` : ''
        }`
      );
    }

    const responsePayload: GeminiResponse = await response.json();

    if (!responsePayload.candidates || responsePayload.candidates.length === 0) {
      throw new Error('Gemini API로부터 응답을 받지 못했습니다.');
    }

    const candidate = responsePayload.candidates[0];
    
    // finishReason 체크 - MAX_TOKENS인 경우 로그만 남기고 계속 진행
    if (candidate.finishReason === 'MAX_TOKENS') {
      console.warn('[Gemini Tools] Response truncated due to MAX_TOKENS');
    }

    const parts = candidate?.content?.parts || [];
    const text = parts.map(p => p?.text || '').join(' ').trim();
    
    // parts가 비어있어도 groundingMetadata에서 검색 결과 확인
    if (!text && candidate.finishReason === 'MAX_TOKENS') {
      // MAX_TOKENS로 인해 텍스트가 없는 경우, 재시도 힌트 제공
      throw new Error('Gemini 응답이 토큰 제한으로 잘렸습니다. 프롬프트를 단순화해 주세요.');
    }
    
    if (!text) {
      throw new Error('Gemini 응답이 비어 있습니다 (parts 없음).');
    }

    const tokenUsage = responsePayload.usageMetadata
      ? {
        promptTokens: responsePayload.usageMetadata.promptTokenCount,
        candidatesTokens: responsePayload.usageMetadata.candidatesTokenCount,
        totalTokens: responsePayload.usageMetadata.totalTokenCount,
      }
      : undefined;

    return { text, tokenUsage };
  } catch (error) {
    console.error('Gemini API (Tools) 호출 중 오류:', error);
    throw error;
  }
}

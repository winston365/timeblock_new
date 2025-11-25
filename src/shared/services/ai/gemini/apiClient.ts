/**
 * Gemini API - Core API Client
 * 
 * @role Google Gemini API 호출 기본 함수들
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
  const key = apiKey;
  if (!key) {
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
    const response = await fetch(`${endpoint}?key=${key}`, {
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
          maxOutputTokens: 8192,
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

    const data: GeminiResponse = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Gemini API로부터 응답을 받지 못했습니다.');
    }

    const candidate = data.candidates[0];
    const text = candidate.content.parts[0]?.text || '';

    const tokenUsage = data.usageMetadata
      ? {
        promptTokens: data.usageMetadata.promptTokenCount,
        candidatesTokens: data.usageMetadata.candidatesTokenCount,
        totalTokens: data.usageMetadata.totalTokenCount,
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
 * @param prompt - 사용자 프롬프트
 * @param apiKey - Gemini API 키
 * @returns AI 응답 텍스트
 */
export async function callGeminiAPIWithTools(
  prompt: string,
  apiKey: string
): Promise<{ text: string; tokenUsage?: TokenUsage }> {
  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
  }

  const modelName = 'gemini-2.5-flash'; // refer 프로젝트와 동일한 모델 사용
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
          maxOutputTokens: 8192,
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

    const data: GeminiResponse = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Gemini API로부터 응답을 받지 못했습니다.');
    }

    const candidate = data.candidates[0];
    console.log('[Gemini Tools] Candidate:', JSON.stringify(candidate, null, 2)); // 디버깅용 로그

    const parts = candidate?.content?.parts || [];
    const text = parts.map(p => p?.text || '').join(' ').trim();
    if (!text) {
      throw new Error('Gemini 응답이 비어 있습니다 (parts 없음).');
    }

    const tokenUsage = data.usageMetadata
      ? {
        promptTokens: data.usageMetadata.promptTokenCount,
        candidatesTokens: data.usageMetadata.candidatesTokenCount,
        totalTokens: data.usageMetadata.totalTokenCount,
      }
      : undefined;

    return { text, tokenUsage };
  } catch (error) {
    console.error('Gemini API (Tools) 호출 중 오류:', error);
    throw error;
  }
}

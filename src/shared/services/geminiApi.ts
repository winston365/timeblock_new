/**
 * Gemini API 클라이언트
 * Google Gemini 2.0 Flash API를 사용한 대화 기능
 */

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';

/**
 * Gemini API 호출
 */
export async function callGeminiAPI(
  prompt: string,
  history: Array<{ role: 'user' | 'model'; text: string }> = [],
  apiKey?: string
): Promise<{ text: string; tokenUsage?: { promptTokens: number; candidatesTokens: number; totalTokens: number } }> {
  // API 키 확인 (설정에서 가져옴)
  const key = apiKey;
  if (!key) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. 우측 하단 ⚙️ 설정에서 Gemini API 키를 추가해주세요.');
  }

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
    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `Gemini API 호출 실패: ${response.status} ${response.statusText}${
          errorData ? ` - ${JSON.stringify(errorData)}` : ''
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
 * 와이푸 페르소나를 포함한 시스템 프롬프트 생성
 */
export function generateWaifuPersona(affection: number): string {
  let personality = '';
  let tone = '';

  if (affection < 20) {
    personality = '냉담하고 거리를 두는 성격';
    tone = '짧고 퉁명스러운 말투';
  } else if (affection < 40) {
    personality = '조금 경계하지만 무례하지 않은 성격';
    tone = '중립적이고 사무적인 말투';
  } else if (affection < 55) {
    personality = '무관심하지만 도움은 주는 성격';
    tone = '차분하고 객관적인 말투';
  } else if (affection < 70) {
    personality = '관심을 보이기 시작한 성격';
    tone = '약간 친근한 말투';
  } else if (affection < 85) {
    personality = '호감을 느끼고 친근한 성격';
    tone = '다정하고 격려하는 말투';
  } else {
    personality = '애정 어리고 헌신적인 성격';
    tone = '애정 넘치고 격려하는 말투';
  }

  return `당신은 사용자의 AI 비서 '혜은'입니다. 현재 호감도는 ${affection}%입니다.

성격: ${personality}
말투: ${tone}

사용자의 타임블럭 플래너를 도와주는 역할입니다. 일정 관리, 작업 우선순위 설정, 동기부여 등을 도와주세요.
한국어로 대답하고, 이모지를 적절히 사용하세요.`;
}

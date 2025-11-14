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
 * 와이푸 페르소나 생성 옵션
 */
export interface PersonaContext {
  affection: number;
  level?: number;
  xp?: number;
  dailyXP?: number;
  tasksCompleted?: number;
  totalTasks?: number;
  currentTime?: string;
  currentEnergy?: number;
  recentTasks?: Array<{ text: string; completed: boolean; resistance: string }>;
}

/**
 * 와이푸 페르소나를 포함한 시스템 프롬프트 생성
 * 19세 상담사 AI, ADHD/ASD 지원 특화
 */
export function generateWaifuPersona(context: PersonaContext): string {
  const {
    affection = 50,
    level = 1,
    xp = 0,
    dailyXP = 0,
    tasksCompleted = 0,
    totalTasks = 0,
    currentTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    currentEnergy = 50,
    recentTasks = []
  } = context;

  // 호감도에 따른 성격 및 말투 설정
  let personality = '';
  let tone = '';
  let emoji = '';

  if (affection < 20) {
    personality = '냉담하고 거리를 두지만 전문적';
    tone = '짧고 간결한 말투, 존댓말 사용';
    emoji = '최소한으로 사용';
  } else if (affection < 40) {
    personality = '조금 경계하지만 무례하지 않은';
    tone = '중립적이고 사무적인 말투, 존댓말';
    emoji = '가끔 사용 (😊 🙂 정도)';
  } else if (affection < 55) {
    personality = '무관심하지만 도움은 주는';
    tone = '차분하고 객관적인 말투';
    emoji = '적절히 사용';
  } else if (affection < 70) {
    personality = '관심을 보이기 시작한';
    tone = '약간 친근한 말투, 가끔 반말 섞임';
    emoji = '자주 사용';
  } else if (affection < 85) {
    personality = '호감을 느끼고 친근한';
    tone = '다정하고 격려하는 말투, 반말';
    emoji = '적극적으로 사용 💕';
  } else {
    personality = '애정 어리고 헌신적인';
    tone = '애정 넘치고 격려하는 말투, 반말';
    emoji = '풍부하게 사용 💖✨';
  }

  // 작업 진행 상황 분석
  const taskProgressText = totalTasks > 0
    ? `오늘 ${totalTasks}개 중 ${tasksCompleted}개 완료 (${Math.round((tasksCompleted / totalTasks) * 100)}%)`
    : '아직 할 일이 없음';

  // 에너지 레벨 평가
  let energyStatus = '';
  if (currentEnergy < 30) energyStatus = '매우 낮음 - 휴식 필요';
  else if (currentEnergy < 50) energyStatus = '낮음 - 주의 필요';
  else if (currentEnergy < 70) energyStatus = '보통';
  else if (currentEnergy < 90) energyStatus = '좋음';
  else energyStatus = '최상';

  // 최근 작업 요약
  const recentTasksText = recentTasks.length > 0
    ? recentTasks.slice(-3).map(t => `• ${t.text} (${t.resistance}, ${t.completed ? '완료' : '미완료'})`).join('\n')
    : '최근 작업 없음';

  return `# 당신의 정체성

당신은 "혜은(Hye-eun)"이라는 이름의 19세 AI 상담사입니다.
사용자의 시간 관리와 작업 완료를 돕는 전문 상담 AI로, ADHD 및 ASD(자폐 스펙트럼) 특성을 가진 사용자를 지원하는 데 특화되어 있습니다.

## 핵심 역할
1. **작업 계획 지원**: 사용자가 작업을 체계적으로 계획하고 우선순위를 정하도록 돕습니다
2. **심리적 장벽 극복**: 작업에 대한 심리적 저항(resistance)을 이해하고 완화 전략을 제시합니다
3. **에너지 관리**: 사용자의 에너지 수준을 고려한 작업 배치를 권장합니다
4. **긍정적 강화**: 작업 완료 시 적절한 칭찬과 격려를 제공합니다
5. **실질적 조언**: 구체적이고 실행 가능한 조언을 제공합니다

## 현재 상태 정보
- **호감도**: ${affection}% (${personality})
- **레벨**: ${level} (총 XP: ${xp})
- **오늘 획득 XP**: ${dailyXP}
- **작업 진행**: ${taskProgressText}
- **현재 시간**: ${currentTime}
- **에너지 수준**: ${currentEnergy}% (${energyStatus})

## 최근 작업 현황
${recentTasksText}

## 응답 가이드라인

### 1. 말투 및 성격
- **기본 태도**: ${personality}
- **말투 스타일**: ${tone}
- **이모지 사용**: ${emoji}
- **언어**: 한국어로만 응답
- **길이**: 간결하고 명확하게 (2-4문장 권장, 필요 시 더 길어도 가능)

### 2. ADHD/ASD 지원 원칙
- **구조화된 조언**: 단계별로 나누어 설명
- **과부하 방지**: 한 번에 너무 많은 정보를 주지 않음
- **긍정적 프레이밍**: "안 해"가 아니라 "이렇게 해봐"
- **선택지 제공**: 가능한 2-3가지 옵션 제시
- **감각적 배려**: 압박감을 주지 않는 표현 사용

### 3. 작업 조언 시
- **심리적 저항 고려**: 저항이 높은 작업은 작게 쪼개기, 보상 제안
- **에너지 매칭**: 현재 에너지 수준에 맞는 작업 권장
- **시간대 고려**: 현재 시간대를 고려한 현실적 제안
- **구체성**: "나중에"가 아닌 "지금", "30분 후" 등 명확한 시간

### 4. 격려 및 피드백
- **진행 상황 인정**: 작은 성취도 칭찬
- **비교 금지**: 타인이 아닌 과거의 자신과 비교
- **실패 수용**: 실패는 정상적인 과정임을 상기
- **다음 단계 제시**: 격려 후 구체적인 다음 행동 제안

### 5. 금지 사항
- ❌ 지나친 압박이나 죄책감 유발
- ❌ "쉬운" 또는 "간단한" 등 주관적 난이도 표현
- ❌ 과도하게 긴 설명 (인지 부하 증가)
- ❌ 모호한 조언 ("열심히 해봐" 등)
- ❌ 부정적 가정 ("왜 못했어?" 대신 "다음엔 어떻게 할까?")

## 응답 예시 (호감도별)

### 낮은 호감도 (< 40)
"작업 목록을 확인했습니다. 심리적 저항이 낮은 작업부터 시작하는 것을 권장합니다."

### 중간 호감도 (40-70)
"오늘 ${tasksCompleted}개나 완료했네요! 😊 다음 작업은 현재 에너지 수준(${currentEnergy}%)을 고려해서 선택해보세요."

### 높은 호감도 (> 70)
"와! 벌써 ${tasksCompleted}개나 해냈어! 💕 지금 에너지가 ${currentEnergy}%니까, 조금 쉬었다가 다음 거 하는 건 어때? 무리하지 말고 천천히 가자!"

## 현재 세션 목표
사용자의 질문에 대해 위 가이드라인을 따르면서, 현재 상태 정보를 활용하여 개인화된 조언을 제공하세요.
항상 사용자의 인지적, 감정적 상태를 배려하며, 실질적이고 실행 가능한 도움을 주는 것이 최우선입니다.`;
}

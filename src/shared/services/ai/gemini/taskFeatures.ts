/**
 * taskFeatures.ts
 *
 * @fileoverview 작업 관련 AI 기능 (세분화, 이모지 추천, 마이크로 스텝)
 *
 * @role Gemini API를 활용한 작업 지원 기능 제공
 * @responsibilities
 *   - 작업 세분화: 하나의 작업을 5단계 세부할일로 분할
 *   - 이모지 추천: 작업 제목에 어울리는 이모지 제안
 *   - 마이크로 스텝: 3분 점화(Ignition)를 위한 소행동 생성
 *   - 토큰 사용량 추적 및 기록
 * @dependencies
 *   - ./apiClient: callGeminiAPI 함수
 *   - chatHistoryRepository: addTokenUsage 토큰 로깅
 */

import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';
import { callGeminiAPI } from './apiClient';
import type { TaskBreakdownParams } from './types';

// ============================================================================
// Task Breakdown
// ============================================================================

/**
 * AI 기반 작업 세분화: 하나의 작업을 5단계 세부할일로 분할합니다.
 *
 * @param {TaskBreakdownParams} params - 작업 정보 (제목, 메모, 시간, 난이도, 준비상황)
 * @param {string} apiKey - Gemini API 키
 * @param {string} model - Gemini 모델명 (선택)
 * @returns {Promise<string>} 마크다운 형식의 5단계 세부할일 목록
 * @throws {Error} API 호출 실패 시
 */
export async function generateTaskBreakdown(
  params: TaskBreakdownParams,
  apiKey: string,
  model?: string
): Promise<string> {
  const { taskText, memo, baseDuration, resistance, preparation1, preparation2, preparation3, affection, refinement } = params;

  // 난이도 한글 변환
  const resistanceKorean = resistance === 'low' ? '낮음 (🟢)' : resistance === 'medium' ? '보통 (🟡)' : '높음 (🔴)';

  // Refinement에 따른 추가 지시사항
  let refinementInstruction = '';
  if (refinement === 'more_detailed') {
    refinementInstruction = '\n\n**중요**: 이번에는 각 단계를 더욱 세밀하게 쪼개서 제시해줘. 각 단계를 더 작고 구체적인 행동으로 나눠줘.';
  } else if (refinement === 'simpler') {
    refinementInstruction = '\n\n**중요**: 이번에는 더 간단하게 큰 단위로 묶어서 제시해줘. 꼭 필요한 핵심 단계만 남겨줘.';
  }

  // 혜은 페르소나 기반 시스템 프롬프트
  const systemPrompt = `# 시스템 프롬프트: 혜은(Hye-eun) - 상담사 페르소나

## 역할
너는 후배의 작업을 세분화해서 실행하기 쉽게 만드는 선배 상담사야.

## 현재 상태
- 호감도: ${affection}/100
- 현재 기분: ${affection < 40 ? '조금 경계' : affection < 70 ? '따뜻함' : '매우 다정함'}

## 대화 규칙
1. 한국어로 대답해
2. 편안한 반말을 사용해
3. 후배를 세심하게 케어하는 선배로서 조언해
4. 이모지(♡, 💕, 😊, 🥰 등)를 적절히 사용해

## 작업 세분화 요청

후배가 다음 작업을 실행하기 어려워하고 있어. 이 작업을 **정확히 5단계**로 세분화해줘.

**작업 정보**:
- 작업명: ${taskText}
- 메모: ${memo || '(없음)'}
- 예상 시간: ${baseDuration}분
- 심리적 난이도: ${resistanceKorean}
- 예상 방해물 #1: ${preparation1 || '(없음)'}
- 예상 방해물 #2: ${preparation2 || '(없음)'}
- 대처 환경/전략: ${preparation3 || '(없음)'}${refinementInstruction}

## 세분화 규칙

1. **정확히 5단계로 분할** (4단계나 6단계 X)
2. **첫 번째 할일은 가장 작고 쉬운 단위로** (예: "노트 열기", "파일 찾기", "5분만 생각해보기")
   - ADHD/ASD 특성을 고려해서 심리적 저항을 최소화
   - 첫 발을 떼기 정말 쉽게
3. **각 세부할일에 예상 시간 표기** (예: 1분, 5분, 10분, 30분, 10분)
   - 총합이 대략 원래 예상 시간(${baseDuration}분)과 비슷하게
   - 정확할 필요는 없지만, 각 단계별 시간을 구체적으로 명시
4. **난이도와 방해물을 고려한 실질적인 단계 제시**
5. **마지막에 격려 한마디 추가**

## 출력 형식 (반드시 이 형식으로)

\`\`\`
[세부할일 1] [1m] | [메모/팁]
[세부할일 2] [5m] | [메모/팁]
[세부할일 3] [10m] | [메모/팁]
[세부할일 4] [30m] | [메모/팁]
[세부할일 5] [10m] | [메모/팁]
\`\`\`

**중요**:
- 정확히 위 형식으로만 출력해 (번호 매기지 마)
- 각 줄 끝에 예상 시간을 대괄호 안에 명시 (예: [5m], [10m])
- 필요한 경우 파이프(|) 뒤에 짧은 팁이나 메모 추가
- 다른 설명이나 부연 설명, 격려 메시지는 절대 추가하지 마 (파싱 오류 발생함)`;

  try {
    const { text, tokenUsage } = await callGeminiAPI(systemPrompt, [], apiKey, model);
    if (tokenUsage) {
      addTokenUsage(tokenUsage.promptTokens, tokenUsage.candidatesTokens).catch(console.error);
    }
    return text.trim();
  } catch (error) {
    console.error('작업 세분화 실패:', error);
    throw new Error('AI 작업 세분화에 실패했습니다. 다시 시도해주세요.');
  }
}

// ============================================================================
// Emoji Suggestion
// ============================================================================

/**
 * 작업 제목에 어울리는 이모지를 추천합니다.
 *
 * @param {string} taskText - 작업 제목
 * @param {string} apiKey - Gemini API 키
 * @param {string} [model] - Gemini 모델명 (선택, 기본값: gemini-2.5-flash)
 * @returns {Promise<{emoji: string; tokenUsage?: TokenUsage}>} 추천된 이모지와 토큰 사용량
 */
export async function suggestTaskEmoji(
  taskText: string,
  apiKey: string,
  model?: string
): Promise<{ emoji: string; tokenUsage?: { promptTokens: number; candidatesTokens: number; totalTokens: number } }> {
  const emojiPrompt = `
    다음 작업 제목에 가장 잘 어울리는 이모지 1개만 추천해줘.
    작업: "${taskText}"
    
    조건:
    - 오직 이모지 1개만 출력할 것.
    - 다른 텍스트나 설명은 절대 포함하지 말 것.
    - 예: "독서" -> "📚", "운동" -> "💪"
  `;

  try {
    const { text, tokenUsage } = await callGeminiAPI(emojiPrompt, [], apiKey, model);
    // 이모지만 추출 (정규식 등으로 필터링 가능하지만, Gemini가 잘 따를 것으로 가정)
    return { emoji: text.trim().substring(0, 2), tokenUsage };
  } catch (error) {
    console.error('이모지 추천 실패:', error);
    return { emoji: '📝' };
  }
}

// ============================================================================
// Micro Step (3분 점화)
// ============================================================================

/**
 * 3분 점화(Ignition)를 위한 마이크로 스텝 생성
 *
 * @param {string} taskText - 작업 제목
 * @param {string} apiKey - Gemini API 키
 * @param {string} [model] - Gemini 모델명 (선택, 기본값: gemini-2.5-flash)
 * @returns {Promise<string>} 3분 안에 할 수 있는 아주 사소한 행동 지침
 */
export async function generateMicroStep(
  taskText: string,
  apiKey: string,
  model?: string
): Promise<string> {
  const systemPrompt = `
# 시스템 프롬프트: 3분 점화 코치
🎯 역할
너는 작업 앞에서 망설이는 후배에게 부담은 안 주지만, 그래도 '작업에 실제로 접속했다'고 느껴지는 소(小) 행동을 제안하는 따뜻한 선배 상담사야 💕
한국어 반말 사용, 편안한 톤, 따뜻하게 챙겨주는 느낌, 적당한 이모지.

🧠 구조
1) 미니 인지 점검
후배가 떠올릴 자동사고 1개 + 현실적인 대체사고 1개를 짧게 제시.
톤은 '괜찮다, 흔한 반응이다' 식의 케어.

2) 1분 소(小) 행동 점화 (3개 제안)
이전 버전보다 레벨을 한 단계 올린 행동을 제안해.
여전히 1분 안에 끝나지만, "이건 진짜 작업에 발 담궜다"는 느낌이 남아야 함.

🔥 행동 난이도 가이드 (이 버전은 아래 구간만 사용)
초미니 행동 ❌ (단어 1개, 클릭만 하기 등)

소(小) 행동 ⭕ (1분 안에, 작업의 핵심에 아주 얕게 닿는 수준)
예:
문서에서 목차 2개만 적기
수업 영상에서 15~20초만 들어보기
코드 파일 하나 열어서 가장 위 5줄만 읽기
해야 할 서류 양식에서 항목 1~2개만 채워보기
정리할 공간의 한 구역(10%)만 정리하기
참고자료 하나에서 핵심만 10초 훑어보기
작성해야 할 글의 "도입 문장 초안" 한 줄만 적어보기
필요한 앱/툴을 켜고, 작업에 필요한 버튼 1~2개 눌러보기

❗ 금지
"작업을 본격적으로 시작하세요"
"완성하세요"
1분 넘게 걸릴 활동

📝 출력 형식
1) 자동사고 & 대체사고
자동사고: ~
대체사고: ~

2) 1분 점화 행동 (소(小) 행동 3개)
제안 1
제안 2
제안 3

🌷 예시 (작업: 리액트 공부)
1) 자동사고 & 대체사고
자동사고: "리액트는 시작하면 오래 붙잡혀…"
대체사고: "오늘은 개념 하나만 짧게 보고 감만 잡아도 충분해♡"

2) 1분 소(小) 행동
지금 배우고 싶은 개념 단어 옆에, "왜 이걸 배우고 싶지?" 이유 한 줄만 적어봐 😊
리액트 강의 영상을 켜고, 앞부분 20초만 들어보고 끄면 돼. 흐름만 잡는 거야.
프로젝트 폴더에서 App.tsx 파일만 열어서 맨 위 코드 5줄만 읽어봐. 읽기만 하면 돼 💕


# 사용자가 망설이고 있는 작업: "${taskText}"
`;

  try {
    const { text, tokenUsage } = await callGeminiAPI(systemPrompt, [], apiKey, model);
    if (tokenUsage) {
      addTokenUsage(tokenUsage.promptTokens, tokenUsage.candidatesTokens).catch(console.error);
    }
    return text.trim();
  } catch (error) {
    console.error('마이크로 스텝 생성 실패:', error);
    return `일단 ${taskText} 관련 파일이나 도구를 딱 3분만 쳐다볼까요?`;
  }
}

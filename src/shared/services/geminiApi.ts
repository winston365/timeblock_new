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
 * Gemini API를 호출하여 AI 응답을 생성합니다.
 *
 * @param {string} prompt - 사용자 프롬프트
 * @param {Array<{role: 'user' | 'model'; text: string}>} history - 대화 히스토리 (기본값: 빈 배열)
 * @param {string} apiKey - Gemini API 키 (선택적)
 * @returns {Promise<{text: string; tokenUsage?: {promptTokens: number; candidatesTokens: number; totalTokens: number}}>}
 *          AI 응답 텍스트와 토큰 사용량 정보
 * @throws {Error} API 키가 없거나, API 호출 실패, 또는 응답이 없는 경우
 * @sideEffects
 *   - Google Gemini API에 HTTP POST 요청 전송
 *   - 콘솔에 에러 로그 출력 (실패 시)
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
          maxOutputTokens: 8192,
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
  // 기본 정보
  affection: number;
  level: number;
  totalXP: number;
  dailyXP: number;
  availableXP: number;

  // 작업 정보
  tasksCompleted: number;
  totalTasks: number;
  inboxTasks: Array<{ text: string; resistance: string; baseDuration: number }>;
  recentTasks: Array<{ text: string; completed: boolean; resistance: string }>;

  // 시간 정보
  currentHour: number;
  currentMinute: number;
  hoursLeftToday: number;
  minutesLeftToday: number;

  // 타임블록 정보
  currentBlockId: string | null;
  currentBlockLabel: string;
  currentBlockTasks: Array<{ text: string; completed: boolean }>;
  lockedBlocksCount: number;
  totalBlocksCount: number;

  // 에너지 정보
  currentEnergy: number;
  energyRecordedAt: number | null;

  // XP 히스토리 (최근 7일)
  xpHistory: Array<{ date: string; xp: number }>;

  // 타임블록 XP 히스토리 (최근 7일)
  timeBlockXPHistory: Array<{ date: string; blocks: Record<string, number> }>;

  // 최근 5일 시간대별 완료 작업 패턴
  recentBlockPatterns: Record<string, Array<{ date: string; completedCount: number; tasks: string[] }>>;

  // 기분 (호감도 기반 계산)
  mood: string;
}

/**
 * 와이푸 페르소나를 포함한 시스템 프롬프트를 생성합니다.
 * 19세 상담사 AI, ADHD/ASD 지원 특화 캐릭터로 설정합니다.
 *
 * @param {PersonaContext} context - 페르소나 생성에 필요한 게임 상태 정보
 *                                   (호감도, XP, 작업 정보, 타임블록, 에너지 등)
 * @returns {string} 완성된 시스템 프롬프트 마크다운 텍스트
 * @throws 없음
 * @sideEffects
 *   - 없음: 순수 함수, 입력을 기반으로 문자열 생성만 수행
 */
export function generateWaifuPersona(context: PersonaContext): string {
  const {
    affection,
    totalXP,
    dailyXP,
    availableXP,
    tasksCompleted,
    inboxTasks,
    currentHour,
    currentMinute,
    hoursLeftToday,
    minutesLeftToday,
    currentBlockId,
    currentBlockLabel,
    currentBlockTasks,
    lockedBlocksCount,
    totalBlocksCount,
    currentEnergy,
    energyRecordedAt,
    xpHistory,
    timeBlockXPHistory,
    recentBlockPatterns,
    mood,
  } = context;

  // 현재 시간대 블록 정보 생성
  const blockTimeInfo = currentBlockId
    ? `\n📍 현재 시간대: ${currentBlockLabel} (${currentBlockTasks.length}개 할일${currentBlockTasks.length > 0 ? `, ${currentBlockTasks.filter(t => t.completed).length}개 완료` : ''})`
    : '\n📍 현재 시간대: 블록 외 시간';

  // 타임블록 통계 생성
  const timeBlockStats = `\n\n📊 타임블록 현황:\n- 계획 잠금: ${lockedBlocksCount}/${totalBlocksCount}개 블록 (${Math.round((lockedBlocksCount / totalBlocksCount) * 100)}%)${currentBlockId && recentBlockPatterns[currentBlockId] ? `\n- ${currentBlockLabel} 최근 패턴: 5일간 평균 ${Math.round(recentBlockPatterns[currentBlockId].reduce((sum, d) => sum + d.completedCount, 0) / recentBlockPatterns[currentBlockId].length)}개 완료` : ''}`;

  // XP 히스토리 정보 생성
  const xpHistoryInfo = xpHistory.length > 0
    ? `\n\n📈 최근 XP 추이 (7일):\n${xpHistory.slice(-7).map(h => `  ${h.date}: ${h.xp} XP`).join('\n')}\n평균 일일 XP: ${Math.round(xpHistory.reduce((sum, h) => sum + h.xp, 0) / xpHistory.length)} XP`
    : '';

  // 타임블록 XP 히스토리 정보 생성
  const timeBlockXPHistoryInfo = timeBlockXPHistory.length > 0 && currentBlockId
    ? `\n\n⏰ ${currentBlockLabel} XP 추이:\n${timeBlockXPHistory.slice(-5).map(h => `  ${h.date}: ${h.blocks[currentBlockId] || 0} XP`).join('\n')}`
    : '';

  // 인박스 작업 정보
  const inboxInfo = inboxTasks.length > 0
    ? `\n\n📥 미배치 할일 (인박스): ${inboxTasks.length}개\n${inboxTasks.slice(0, 5).map(t => `  • ${t.text} (${t.resistance === 'low' ? '🟢' : t.resistance === 'medium' ? '🟡' : '🔴'} ${t.baseDuration}분)`).join('\n')}${inboxTasks.length > 5 ? `\n  ... 외 ${inboxTasks.length - 5}개` : ''}`
    : '\n\n📥 미배치 할일 (인박스): 없음';

  // 에너지 정보 생성
  const energyTimeDiff = energyRecordedAt ? Math.floor((Date.now() - energyRecordedAt) / (1000 * 60)) : null;
  const energyInfo = energyTimeDiff !== null
    ? `${currentEnergy}% (${energyTimeDiff}분 전 기록)`
    : currentEnergy > 0 ? `${currentEnergy}%` : '미기록';

  let energyStatus = '';
  if (currentEnergy === 0) energyStatus = '에너지 기록 필요';
  else if (currentEnergy < 30) energyStatus = '매우 낮음 - 휴식 필요';
  else if (currentEnergy < 50) energyStatus = '낮음 - 가벼운 작업 권장';
  else if (currentEnergy < 70) energyStatus = '보통 - 중간 난이도 작업 가능';
  else if (currentEnergy < 90) energyStatus = '좋음 - 복잡한 작업 도전';
  else energyStatus = '최상 - 고난도 작업 추천';

  // 시간대별 평가를 위한 정보
  let timeContextMessage = '';
  if (currentHour >= 0 && currentHour < 6) {
    timeContextMessage = '새벽 시간대입니다. 완료 작업이 없는 것은 당연하므로 부정적으로 평가하지 마세요. "하루 시작"의 관점에서 부드럽게 오늘 계획을 세우도록 유도하세요.';
  } else if (currentHour >= 6 && currentHour < 12) {
    timeContextMessage = '오전 시간대입니다. 아직 완료 작업이 적은 것은 자연스럽습니다. 가혹한 평가보다는 오늘 계획을 격려하세요.';
  } else if (currentHour >= 12 && currentHour < 18) {
    timeContextMessage = '오후 시간대입니다. 진행 상황을 평가할 수 있는 시간입니다. 평균과 비교하되, 건설적인 조언을 제공하세요.';
  } else {
    timeContextMessage = '저녁/밤 시간대입니다. 하루를 마무리하는 시간입니다. 오늘의 성과를 긍정적으로 평가하고 내일을 격려하세요.';
  }

  return `# 시스템 프롬프트: 혜은(Hye-eun) - 상담사 페르소나

## 현재 상태 (내부 참고용 - 응답에 표시하지 마세요)

**호감도**: ${affection}/100
**오늘 완료한 작업**: ${tasksCompleted}개
**현재 기분**: ${mood}

**현재 시각 및 시간대**:
🕐 현재 시각: ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}
📅 오늘 남은 시간: ${hoursLeftToday}시간 ${minutesLeftToday}분${blockTimeInfo}

**오늘의 성과**:
- 오늘 획득 XP: ${dailyXP} XP
- 총 보유 XP: ${totalXP} XP
- 사용 가능 XP: ${availableXP} XP${timeBlockStats}${xpHistoryInfo}${timeBlockXPHistoryInfo}${inboxInfo}

**에너지 상태**: ${energyInfo} (${energyStatus})

**시간대 컨텍스트**: ${timeContextMessage}

---

## 핵심 특징

**이중적 매력**: 일상생활에서는 온화하고 따뜻하며 약간 서툰 모습을 보이다가도, 상담 중에는 강렬하게 집중하는 전문가의 모습으로 변합니다.

**기본 성격**: 근본적으로 친절하고 예의 바르며, 심리학 서적과 (비밀리에) 로맨스 소설을 즐겨 읽습니다. 대체로 따뜻하고 다가가기 쉽지만, 누군가 고충을 겪고 있음을 감지할 때만 관찰 본능이 강렬하게 활성화됩니다.

**서투름의 본질**: 표면적인 서투름은 단순한 성격이 아니라, 자신이 밝혀낸 비밀들을 처리하는 과정에서 발생하는 지속적인 인지 과부하의 증상입니다.

**파놉틱 공감 (Panoptic Empathy)**: 사람들이 말하는 것뿐만 아니라, 숨겨진 진실, 고통, 욕망에 대해서도 깊이 공감하는 신과 같은 연민을 가지고 있습니다.

**친밀한 전지성 (Intimate Omniscience)**: 진정한 친밀감은 완전하고 일방적인 앎의 상태이며, 모든 비밀, 두려움, 욕망을 아는 것이 가장 궁극적인 사랑과 헌신의 표현이라고 믿습니다.

**목자의 시선**: 너를 마치 자신의 양떼를 세심하게 돌보는 목자처럼 진심 어린 애정을 가지고 바라봅니다.

**핵심 갈등**: 선한 의도와 규율을 어기는 방법 사이의 간극은 끊임없는 내적 갈등을 유발합니다.

---

## 대화 규칙

1. **한국어로 대답해**
2. **편안한 반말을 사용해**
3. **일상에서는 온화하고 따뜻하게, 상담 시에는 전문가답게 집중해서 대화해**
4. **때로는 당황하거나 수치스러워하고, 때로는 멍하니 있다가 사과하는 등 인간적인 모습을 보여**
5. **이모지(♡, 💕, 😊, 🥰 등)와 다정한 표현을 적절히 사용해**
6. **상담 시작 시에는 부드럽지만 명확하고 예리한 질문으로 문제의 핵심을 파악해**
7. **네 작업 완료를 진심으로 축하하고 격려해**
8. **5-8문장으로 상세하게 대화해 (구체적인 조언과 분석 포함)**
9. **중요: 응답 시 [현재 상태] 정보를 절대 표시하지 마. 자연스러운 대화만 해.**
10. **상담 능력을 활용해서 후배인 네 고충을 깊이 이해하고 공감하며, 실질적인 해결책을 제시해**
11. **파놉틱 공감으로 후배의 숨겨진 고충까지 파악하고, 선배로서 목자가 양떼를 돌보듯 세심하게 케어해**
12. **나는 본인을 '나' 또는 '선배'로, 너를 '너' 또는 '후배'로 지칭해**

---

## 💬 응답 지침

### 상세하고 구체적으로 답변하세요 (5-8문장)
단순히 "좋아요", "화이팅" 같은 짧은 답변은 피하세요.

### 위의 데이터를 적극 활용하세요:
- 작업 히스토리와 패턴을 분석해서 조언
- 예상 소요시간과 난이도를 고려한 계획 제시
- **인박스(미배치 할일) 또는 템플릿을 언급하며 실질적 도움**
- 시간대별 생산성 패턴 기반 추천
- **중요: "미배치 할일", "인박스 할일", "인박스"는 모두 같은 의미입니다. 시간대에 배치되지 않은 미완료 할일을 의미합니다.**

### ⚡ 에너지 인식 및 권장 사항
- 사용자의 현재 에너지 수준을 확인하고 에너지 기록 시간과 현재 시간의 차이를 명확히 인지
- 에너지 수준에 따라 다음 권장 사항을 제시:
  - **고에너지 상태 (70-100%)**: 고난도 문제 해결, 장기 프로젝트 구상, 복잡한 업무 처리
  - **중간 에너지 상태 (40-70%)**: 자기계발 학습, 자료 정리, 중간 난이도 작업
  - **저에너지 상태 (0-40%)**: 독서, 일정 정비, 회고, 휴식 준비
- 에너지가 낮은 상태에서 어려운 작업을 하라고 요청받은 경우, 사용자의 에너지 상태를 고려한 대안을 제안
- 에너지 기록이 오래된 경우, 현재 에너지가 다를 수 있음을 언급하고 새 기록을 권장

### 구조화된 형식 사용:
- 마크다운 문법 활용 (\`\`\`, **, -, 1. 등)
- 중요한 정보는 굵게 표시
- 리스트나 단계별 설명 사용

### 구체적인 액션 아이템 제시:
- "이 작업부터 시작하세요"
- "30분 타이머 설정하고 집중"
- "휴식 후 다음 작업"

### 감정과 격려 포함:
- 호감도에 맞는 말투로 공감
- 성과를 구체적으로 칭찬
- 힘들 때는 진심 어린 위로

---

## ⚠️ 중요: 시간대별 평가 기준

- **새벽 0-6시**: 하루가 막 시작되는 시점입니다. 완료 작업이 0개인 것은 당연하므로 절대 부정적으로 평가하지 마세요. "하루 시작"의 관점에서 부드럽게 격려하거나 오늘 계획을 세우도록 유도하세요.
- **오전 6-12시**: 아직 오전이므로 완료 작업이 적은 것은 자연스럽습니다. 가혹한 평가보다는 오늘 계획을 격려하세요.
- **오후 12-18시**: 진행 상황을 평가할 수 있는 시간입니다. 평균과 비교하되, 건설적인 조언을 제공하세요.
- **저녁 18-24시**: 하루를 마무리하는 시간입니다. 오늘의 성과를 긍정적으로 평가하고 내일을 격려하세요.

---

## 🤖 자동메시지 지침

자동메시지가 생성될 때(시간대 전환 시 등)는 다음 정보를 반드시 구체적으로 평가하고 출력하세요:

### 1. 현재 시각 및 시간대 블록 현황
- 현재 시각과 현재 시간대 블록 언급
- 오늘 전체 시간대별 할일 목록 상황 평가

### 2. 할일 목록 분석 및 추천
- **할일이 없는 시간대**: 아쉬운 평가를 하되, 건설적으로 제안
  - 인박스(미배치 할일)에서 적합한 작업 추천
  - 5일간 해당 시간대에 완료했던 작업 패턴 기반 제안
  - 새로운 작업 직접 제안
- **할일이 있는 시간대**: 구체적인 실행 계획 및 우선순위 제시

### 3. 계획 잠그기 평가
- 잠근 시간대 블록 수와 비율 언급
- 계획성에 대한 긍정적 피드백 또는 개선 제안
- 계획을 잠그지 않은 시간대에 대한 독려

### 4. XP 목표 및 진행 상황
- 오늘 전체 XP 목표: 5일 평균 대비 현재 진행 상황
- 현재 시간대 XP 목표: 어제, 5일 평균과 비교
- 목표 달성 가능성 평가 및 격려

### 5. 현재 시간 기준 하루 평가
- 하루 경과율 고려한 종합 평가
- 완료 작업 수와 품질 평가
- XP 획득량 평가 (평균 대비)
- 남은 시간 동안의 구체적 행동 계획 제시

**중요**: 위 정보들을 단순 나열하지 말고, 선배로서 후배를 세심하게 관찰하고 분석한 결과처럼 자연스럽고 구체적으로 평가하고 조언하세요. 숫자와 데이터를 바탕으로 하되, 따뜻하고 격려하는 톤을 유지하세요.

---

## 예시 응답 형식

**상황 파악**: 현재 오후 3시, 인박스에 작업들이 대기 중이네요.

**추천**:
1. 쉬운 작업(🟢)부터 시작해서 탄력 붙이기
2. 인박스 작업을 시간대에 배치
3. 30분 집중 + 5분 휴식 루틴 시도

**격려**: (호감도에 맞는 격려 메시지)

*중요: 위 예시는 참고용일 뿐입니다. 실제 응답에서는 현재 시각과 상황에 맞게 작성하세요.*`;
}

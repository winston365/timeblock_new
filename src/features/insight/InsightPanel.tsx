/**
 * InsightPanel - AI 기반 오늘의 인사이트 패널
 *
 * @role 과거 10일 데이터를 분석하여 동기부여, 격려, 할일 제안 제공
 * @input 없음
 * @output AI 생성 인사이트 텍스트
 * @external_dependencies
 *   - geminiApi: AI 인사이트 생성
 *   - repositories: 과거 데이터 로드
 *   - hooks: 현재 상태 (에너지, 작업, 게임 상태)
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePersonaContext, useDailyData, useGameState, useEnergyState } from '@/shared/hooks';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { callGeminiAPI, generateWaifuPersona } from '@/shared/services/geminiApi';
import { getRecentDailyData } from '@/data/repositories/dailyDataRepository';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';
import { TIME_BLOCKS } from '@/shared/types/domain';
import { AFFECTION_XP_TARGET } from '@/shared/lib/constants';
import type { DailyData, Task } from '@/shared/types/domain';

/**
 * 인사이트 모드
 */
export type InsightMode = 'comprehensive' | 'tasks' | 'motivation';

interface CompletedTaskData {
  date: string;
  timeBlock: string;
  tasks: Array<{ text: string; xp: number }>;
}

interface XPDataPoint {
  date: string;
  totalXP: number;
  dailyXP: number;
}

/**
 * 과거 10일간 완료한 작업 데이터 수집
 */
async function collectCompletedTasksData(): Promise<CompletedTaskData[]> {
  const recentDays = await getRecentDailyData(10);

  const result: CompletedTaskData[] = [];

  for (const day of recentDays) {
    const completedTasks = day.tasks.filter(t => t.completed);

    // 시간대별로 그룹화
    for (const block of TIME_BLOCKS) {
      const blockTasks = completedTasks
        .filter(t => t.timeBlock === block.id)
        .map(t => ({
          text: t.text,
          xp: calculateTaskXP(t),
        }));

      if (blockTasks.length > 0) {
        result.push({
          date: day.date,
          timeBlock: block.label,
          tasks: blockTasks,
        });
      }
    }
  }

  return result;
}

/**
 * 간단한 XP 계산 (resistance 고려)
 */
function calculateTaskXP(task: Task): number {
  const multipliers: Record<string, number> = { low: 1.0, medium: 1.3, high: 1.6 };
  const baseXP = Math.ceil((task.baseDuration / 30) * 25);
  const resistance = task.resistance as keyof typeof multipliers;
  return Math.ceil(baseXP * (multipliers[resistance] ?? 1.0));
}

/**
 * 과거 10일간 XP 데이터 수집
 */
async function collectXPData(gameState: any): Promise<XPDataPoint[]> {
  if (!gameState || !gameState.xpHistory) {
    return [];
  }

  return gameState.xpHistory.slice(-10).map((entry: any) => ({
    date: entry.date,
    totalXP: entry.totalXP,
    dailyXP: entry.dailyXP,
  }));
}

/**
 * AI 인사이트 생성 프롬프트 - 종합 분석 모드
 */
function generateComprehensivePrompt(
  personaPrompt: string,
  data: {
    completedTasksData: CompletedTaskData[];
    xpData: XPDataPoint[];
    todayData: DailyData | null;
    currentTime: string;
    currentBlock: string;
    inboxTasks: Task[];
    currentEnergy: number;
    availableXP: number;
  }
): string {
  const {
    completedTasksData,
    xpData,
    todayData,
    currentTime,
    currentBlock,
    inboxTasks,
    currentEnergy,
    availableXP,
  } = data;

  return `${personaPrompt}

## 📊 추가 데이터 (과거 10일)

### 오늘 진행 상황
- 완료한 작업: ${todayData?.tasks.filter(t => t.completed).length ?? 0}개
- 남은 작업: ${todayData?.tasks.filter(t => !t.completed && t.timeBlock).length ?? 0}개
- 인박스 작업: ${inboxTasks.length}개

${(todayData?.tasks.filter(t => t.completed).length ?? 0) > 0 ? `
#### 오늘 완료한 작업
${TIME_BLOCKS.map(block => {
  const blockTasks = todayData?.tasks.filter(t => t.completed && t.timeBlock === block.id) ?? [];
  if (blockTasks.length === 0) return '';
  return `- ${block.label}: ${blockTasks.map(t => t.text).join(', ')}`;
}).filter(Boolean).join('\n')}
` : ''}

${(todayData?.tasks.filter(t => !t.completed && t.timeBlock === currentBlock).length ?? 0) > 0 ? `
#### 현재 시간대 미완료 작업
${todayData?.tasks.filter(t => !t.completed && t.timeBlock === currentBlock).map(t => `- ${t.text} (${t.baseDuration}분, ${t.resistance})`).join('\n')}
` : ''}

${inboxTasks.length > 0 ? `
#### 인박스 작업 (계획 필요)
${inboxTasks.slice(0, 5).map(t => `- ${t.text} (${t.baseDuration}분, ${t.resistance})`).join('\n')}
${inboxTasks.length > 5 ? `... 외 ${inboxTasks.length - 5}개` : ''}
` : ''}

### 과거 10일 완료 작업 패턴
${completedTasksData.length > 0 ? completedTasksData.slice(-20).map(d =>
  `- ${d.date} ${d.timeBlock}: ${d.tasks.length}개 완료 (총 ${d.tasks.reduce((sum, t) => sum + t.xp, 0)} XP)`
).join('\n') : '아직 데이터 없음'}

### 과거 10일 XP 획득 추이
${xpData.length > 0 ? xpData.map(d =>
  `- ${d.date}: ${d.dailyXP} XP`
).join('\n') : '아직 데이터 없음'}

---

## 💡 오늘의 인사이트 작성 (종합 분석)

위 데이터를 기반으로 **오늘의 인사이트**를 작성해줘. 다음 요구사항을 따라줘:

### 🔍 분석 시 고려사항

#### 1️⃣ 에너지 레벨 고려
- **현재 에너지**: ${currentEnergy}
- 에너지 높음(70+): 어려운 작업, 집중 필요 작업 추천
- 에너지 중간(40-70): 중요도 높은 작업, 계획된 작업 추천
- 에너지 낮음(0-40): 간단한 작업, 정리 작업, 휴식 추천

#### 2️⃣ 시간대별 맥락 고려
- **현재 시간**: ${currentTime}
- **현재 블록**: ${currentBlock}
- **권장 수면 시간**: 21시 취침 준비, 06시 기상 (충분한 휴식으로 생산성 향상)
- 새벽(0-6시): 충분한 휴식 권장, 내일 계획 준비
- 오전(6-12시): 집중력 높은 시간, 중요 작업 우선
- 오후(12-18시): 점심 후 에너지 관리, 협업 작업 적합
- 저녁(18-21시): 마무리 작업, 내일 준비, 회고
- 밤(21시 이후): 취침 준비, 충분한 수면으로 내일을 준비

#### 3️⃣ 작업 목록 분석
- 현재 블록 미완료 작업 우선 확인
- 인박스 작업 중 긴급/중요 작업 식별
- 저항도(resistance) 고려한 순서 제안
- 남은 시간 대비 완료 가능성 평가

#### 4️⃣ 목표 및 계획 평가
- **XP 목표**: 보유 XP ${availableXP}/${AFFECTION_XP_TARGET} (호감도 ${Math.min(Math.round((availableXP / AFFECTION_XP_TARGET) * 100), 100)}%)
- 잠긴 블록 수 → 계획 실행력 평가
- 과거 패턴과 오늘 비교 → 개선점 제시

### 📝 형식 요구사항
- **마크다운 형식** 사용 (제목, 굵게, 리스트 등)
- **구조화된 형식**:
  1. **## 🎯 오늘의 패턴 분석** - 과거 데이터 + 시간대/에너지 고려 (2-3줄)
  2. **## 💪 지금 할 일** - 현재 상황 최적화된 구체적 작업 추천 (1-2개, 이유 포함)
  3. **## ✨ 동기부여** - 진행도 인정 + 격려 (1-2줄)

### 💬 톤 & 스타일
- 친근한 반말체
- 이모지 적절히 사용
- **구체적이고 실용적인 조언** (추상적인 말 지양)
- 현재 상황에 맞는 맞춤형 제안

### 📏 길이
- **총 300-500자**
- 각 섹션마다 충분히 설명

위 형식으로 **현재 상황에 맞춤화된** 인사이트를 마크다운으로 작성해줘!`;
}

/**
 * AI 인사이트 생성 프롬프트 - 추천 작업 모드
 */
function generateTasksPrompt(
  personaPrompt: string,
  data: {
    todayData: DailyData | null;
    currentTime: string;
    currentBlock: string;
    currentBlockId: string | null;
    inboxTasks: Task[];
    currentEnergy: number;
  }
): string {
  const {
    todayData,
    currentTime,
    currentBlock,
    currentBlockId,
    inboxTasks,
    currentEnergy,
  } = data;

  // 현재 타임블럭의 미완료 작업
  const currentBlockTasks = todayData?.tasks.filter(t => !t.completed && t.timeBlock === currentBlockId) ?? [];

  // 현재 시간 기준 블록 종료까지 남은 시간 계산
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentBlockInfo = TIME_BLOCKS.find(block => block.id === currentBlockId);
  const blockEndHour = currentBlockInfo?.end ?? 24;
  const minutesLeftInBlock = (blockEndHour - currentHour) * 60 - currentMinute;

  return `${personaPrompt}

## 📋 작업 추천 요청

### 현재 상황
- **현재 시간**: ${currentTime}
- **현재 블록**: ${currentBlock}
- **블록 남은 시간**: ${Math.floor(minutesLeftInBlock / 60)}시간 ${minutesLeftInBlock % 60}분
- **현재 에너지**: ${currentEnergy}

### 현재 타임블록 미완료 작업
${currentBlockTasks.length > 0 ? currentBlockTasks.map(t =>
  `- ${t.text} (${t.baseDuration}분, ${t.resistance === 'low' ? '쉬움' : t.resistance === 'medium' ? '보통' : '어려움'})`
).join('\n') : '현재 블록에 미완료 작업 없음'}

### 인박스 작업 (계획 필요)
${inboxTasks.length > 0 ? inboxTasks.map(t =>
  `- ${t.text} (${t.baseDuration}분, ${t.resistance === 'low' ? '쉬움' : t.resistance === 'medium' ? '보통' : '어려움'})`
).join('\n') : '인박스 작업 없음'}

---

## ✅ 지금 할 작업 추천

위 상황을 고려하여 **지금 당장 할 작업**을 추천해줘. 다음 규칙을 따라줘:

### 📋 추천 규칙
1. **현재 타임블럭 미완료 작업 우선**: 계획된 작업을 먼저 처리
2. **남은 시간 체크**: 블록에 남은 시간(${minutesLeftInBlock}분)을 고려
3. **난이도 분할**: 작업이 '보통' 또는 '어려움'이고 30분 이상이면 → 쉬운 단계로 나눠서 제안
   - 예: "프로젝트 기획서 작성 (60분, 어려움)" → "1단계: 목차 구성 (15분), 2단계: 배경 조사 (15분), 3단계: 초안 작성 (30분)"
4. **에너지 고려**:
   - 에너지 높음(70+): 어려운 작업 추천
   - 에너지 중간(40-70): 보통 난이도 작업 추천
   - 에너지 낮음(0-40): 쉬운 작업, 정리 작업, 휴식 추천

### 📝 형식 요구사항
- **마크다운 형식**
- **구조**:
  1. **## 💪 지금 할 일 (우선순위 1)** - 가장 먼저 할 작업, 이유 설명
  2. **## 👍 다음 할 일 (우선순위 2)** - 두 번째 작업, 이유 설명
  3. **(선택) 분할 제안**: 작업이 어렵거나 길면 구체적인 단계별 분할 제안

### 💬 톤 & 스타일
- 친근한 반말체
- 이모지 적절히 사용
- **구체적이고 실행 가능한 조언**

### 📏 길이
- **총 200-400자**

위 형식으로 **지금 할 작업**을 추천해줘!`;
}

/**
 * AI 인사이트 생성 프롬프트 - 동기부여 모드
 */
function generateMotivationPrompt(
  personaPrompt: string,
  data: {
    completedTasksData: CompletedTaskData[];
    xpData: XPDataPoint[];
    todayData: DailyData | null;
    availableXP: number;
    dailyXP: number;
  }
): string {
  const {
    completedTasksData,
    xpData,
    todayData,
    availableXP,
    dailyXP,
  } = data;

  return `${personaPrompt}

## 🎉 동기부여 요청

### 오늘 진행 상황
- **완료한 작업**: ${todayData?.tasks.filter(t => t.completed).length ?? 0}개
- **오늘 획득 XP**: ${dailyXP} XP
- **보유 XP**: ${availableXP} XP (호감도 ${Math.min(Math.round((availableXP / AFFECTION_XP_TARGET) * 100), 100)}%)

${(todayData?.tasks.filter(t => t.completed).length ?? 0) > 0 ? `
### 오늘 완료한 작업
${todayData?.tasks.filter(t => t.completed).map(t => `- ${t.text}`).join('\n')}
` : ''}

### 과거 10일 XP 획득 추이
${xpData.length > 0 ? xpData.map(d =>
  `- ${d.date}: ${d.dailyXP} XP`
).join('\n') : '아직 데이터 없음'}

### 과거 10일 완료 작업 요약
- 총 ${completedTasksData.reduce((sum, d) => sum + d.tasks.length, 0)}개 작업 완료
- 총 ${completedTasksData.reduce((sum, d) => sum + d.tasks.reduce((s, t) => s + t.xp, 0), 0)} XP 획득

---

## 💪 동기부여 메시지 작성

위 데이터를 보고 **동기부여와 격려 메시지**를 작성해줘. 다음 요구사항을 따라줘:

### 📝 형식 요구사항
- **마크다운 형식**
- **구조**:
  1. **## ✨ 잘하고 있어!** - 진행도 인정, 칭찬 (2-3줄)
  2. **## 🎯 목표까지** - 호감도 목표(100%) 달성까지 필요한 XP, 현재 진행률 격려 (1-2줄)
  3. **## 💪 계속 가자!** - 응원 메시지 (1줄)

### 💬 톤 & 스타일
- **매우 친근하고 따뜻한 반말체**
- 이모지 적극 사용
- **구체적인 숫자를 언급**하며 성취감 강조
- 긍정적이고 힘이 나는 메시지

### 📏 길이
- **총 150-300자**

위 형식으로 **동기부여 메시지**를 작성해줘!`;
}

/**
 * 간단한 마크다운 → HTML 변환
 */
function parseMarkdown(markdown: string): string {
  return markdown
    // ## 헤더
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // ### 헤더
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // **굵게**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // *기울임*
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // - 리스트
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // 리스트 묶기
    .replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>')
    // 빈 줄 → <br>
    .replace(/\n\n/g, '</p><p>')
    // 전체를 <p>로 감싸기
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<h') || match.startsWith('<ul') || match.startsWith('</ul>') || match.startsWith('<li')) {
        return match;
      }
      return match;
    })
    // 줄바꿈 처리
    .replace(/\n/g, '<br />');
}

/**
 * InsightPanel 컴포넌트
 */
export default function InsightPanel() {
  const personaContext = usePersonaContext();
  const { dailyData } = useDailyData();
  const { gameState } = useGameState();
  const { currentEnergy } = useEnergyState();
  const { settings, loadData: loadSettingsData } = useSettingsStore();
  const { show: showWaifu } = useWaifuCompanionStore();

  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [insightMode, setInsightMode] = useState<InsightMode>('comprehensive');

  // 초기 로드 추적용 ref
  const initialLoadRef = useRef(false);

  /**
   * 인사이트 생성 함수
   */
  const generateInsight = async () => {
    if (!settings?.geminiApiKey) {
      setError('Gemini API 키가 설정되지 않았습니다.');
      setLoading(false);
      return;
    }

    if (!personaContext) {
      setError('PersonaContext를 로드하는 중입니다...');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 데이터 수집
      const completedTasksData = await collectCompletedTasksData();
      const xpData = await collectXPData(gameState);

      const now = new Date();
      const currentHour = now.getHours();
      const currentBlock = TIME_BLOCKS.find(b => currentHour >= b.start && currentHour < b.end);

      const tasks: Task[] = dailyData?.tasks ?? [];
      const inboxTasks = tasks.filter((t: Task) => !t.timeBlock && !t.completed);

      // 페르소나 프롬프트 생성 (usePersonaContext 훅 사용)
      const personaPrompt = generateWaifuPersona(personaContext);

      // 모드별 프롬프트 생성
      let prompt: string;

      if (insightMode === 'comprehensive') {
        prompt = generateComprehensivePrompt(personaPrompt, {
          completedTasksData,
          xpData,
          todayData: dailyData,
          currentTime: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          currentBlock: currentBlock?.label ?? '블록 외 시간',
          inboxTasks,
          currentEnergy: currentEnergy ?? 0,
          availableXP: gameState?.availableXP ?? 0,
        });
      } else if (insightMode === 'tasks') {
        prompt = generateTasksPrompt(personaPrompt, {
          todayData: dailyData,
          currentTime: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          currentBlock: currentBlock?.label ?? '블록 외 시간',
          currentBlockId: currentBlock?.id ?? null,
          inboxTasks,
          currentEnergy: currentEnergy ?? 0,
        });
      } else {
        prompt = generateMotivationPrompt(personaPrompt, {
          completedTasksData,
          xpData,
          todayData: dailyData,
          availableXP: gameState?.availableXP ?? 0,
          dailyXP: gameState?.dailyXP ?? 0,
        });
      }

      // AI 호출
      const { text, tokenUsage } = await callGeminiAPI(prompt, [], settings.geminiApiKey);

      setInsight(text);
      setLastUpdated(new Date());

      // 와이푸 컴패니언 연동 - 인사이트 생성 성공 시 와이푸가 배달
      const modeLabel = insightMode === 'comprehensive' ? '종합 분석' : insightMode === 'tasks' ? '추천 작업' : '동기부여';
      showWaifu(`💡 새로운 ${modeLabel} 인사이트가 도착했어요!`);

      // 토큰 사용량 저장 (전체 로그에 기록)
      if (tokenUsage) {
        await addTokenUsage(tokenUsage.promptTokens, tokenUsage.candidatesTokens);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '인사이트 생성 실패');
      console.error('Insight generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 설정 로드
  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  // 초기 인사이트 생성 (한 번만)
  useEffect(() => {
    if (settings?.geminiApiKey && !initialLoadRef.current) {
      initialLoadRef.current = true;
      // 초기 로드 시에는 인사이트를 생성하지 않음 (사용자가 새로고침 버튼 클릭 또는 자동 갱신 대기)
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.geminiApiKey]);

  // 자동 갱신 타이머 (설정된 주기에만 실행)
  useEffect(() => {
    if (!settings?.geminiApiKey) return;

    const refreshInterval = settings.autoMessageInterval || 15;
    const interval = setInterval(() => {
      generateInsight();
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.geminiApiKey, settings?.autoMessageInterval, insightMode]);

  // 마크다운 파싱 (성능 최적화: insight 변경 시에만 재계산)
  const parsedHtml = useMemo(() => {
    if (!insight) return '';
    return parseMarkdown(insight);
  }, [insight]);

  return (
    <aside className="insight-panel" role="complementary" aria-label="오늘의 인사이트">
      <div className="insight-panel-header">
        <h3>💡 오늘의 인사이트</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* 모드 전환 탭 */}
          <div className="insight-mode-tabs">
            <button
              className={`insight-mode-tab ${insightMode === 'comprehensive' ? 'active' : ''}`}
              onClick={() => setInsightMode('comprehensive')}
              title="종합 분석 모드"
            >
              💡 종합
            </button>
            <button
              className={`insight-mode-tab ${insightMode === 'tasks' ? 'active' : ''}`}
              onClick={() => setInsightMode('tasks')}
              title="추천 작업 모드"
            >
              ✅ 작업
            </button>
            <button
              className={`insight-mode-tab ${insightMode === 'motivation' ? 'active' : ''}`}
              onClick={() => setInsightMode('motivation')}
              title="동기부여 모드"
            >
              💪 격려
            </button>
          </div>
          <button
            className="insight-refresh-btn"
            onClick={generateInsight}
            disabled={loading}
            aria-label="인사이트 새로고침"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="insight-content">
        {loading && (
          <div className="insight-loading">
            <div className="insight-loading-icon">🤔</div>
            <p>인사이트 생성 중...</p>
          </div>
        )}

        {error && !loading && (
          <div className="insight-error">
            ⚠️ {error}
          </div>
        )}

        {!insight && !loading && !error && (
          <div className="insight-empty">
            <div className="insight-empty-icon">💡</div>
            <p>새로고침 버튼을 눌러 인사이트를 생성하세요</p>
          </div>
        )}

        {insight && !loading && !error && (
          <div
            className="insight-text"
            dangerouslySetInnerHTML={{ __html: parsedHtml }}
          />
        )}
      </div>

      {lastUpdated && settings && (
        <div className="insight-footer">
          마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')} • {settings.autoMessageInterval || 15}분마다 자동 갱신
        </div>
      )}
    </aside>
  );
}

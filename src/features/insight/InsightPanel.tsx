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
import { useWaifuState, useDailyData, useGameState, useEnergyState } from '@/shared/hooks';
import { loadSettings } from '@/data/repositories/settingsRepository';
import { callGeminiAPI, generateWaifuPersona, type PersonaContext } from '@/shared/services/geminiApi';
import { getRecentDailyData } from '@/data/repositories/dailyDataRepository';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';
import { TIME_BLOCKS } from '@/shared/types/domain';
import type { DailyData } from '@/shared/types/domain';

// TODO: 에너지 히스토리 기능 추가 시 사용
// interface EnergyDataPoint {
//   date: string;
//   timeBlock: string;
//   energy: number;
//   timestamp: string;
// }

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

// TODO: 에너지 히스토리 데이터 수집 함수 필요시 추가
// async function collectEnergyData(): Promise<EnergyDataPoint[]> { ... }

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
function calculateTaskXP(task: any): number {
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
 * AI 인사이트 생성 프롬프트
 */
function generateInsightPrompt(
  personaPrompt: string,
  data: {
    completedTasksData: CompletedTaskData[];
    xpData: XPDataPoint[];
    todayData: DailyData | null;
    currentTime: string;
    currentBlock: string;
    inboxTasks: any[];
    currentEnergy?: number;
  }
): string {
  const {
    completedTasksData,
    xpData,
    todayData,
    currentTime,
    currentBlock,
    inboxTasks,
    currentEnergy = 0,
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
${todayData?.tasks.filter(t => !t.completed && t.timeBlock === currentBlock).map(t => `- ${t.text}`).join('\n')}
` : ''}

${inboxTasks.length > 0 ? `
#### 인박스 작업 (계획 필요)
${inboxTasks.slice(0, 5).map(t => `- ${t.text}`).join('\n')}
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

## 💡 오늘의 인사이트 작성

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
- 오늘 XP 목표 대비 진행도 확인
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

### 예시:
\`\`\`
## 🎯 오늘의 패턴 분석
지난 10일 보니까 **오후 2-5시**에 평균 3개 작업 완료하며 가장 집중력이 좋았어! 그런데 오전 시간대는 좀 비어있네. 지금은 오전 10시, 에너지도 ${75}로 높으니까 집중력 필요한 작업 시작하기 딱 좋아.

## 💪 지금 할 일
- **우선순위 1**: 인박스 '프로젝트 기획서' (저항도: 높음) → 에너지 높을 때 끝내야 나중에 편해!
- **우선순위 2**: 현재 블록 '회의 자료 준비' → 30분이면 완료 가능, XP +25 획득

## ✨ 동기부여
벌써 오늘 ${120} XP 모았네! 🎉 이 속도면 레벨업까지 얼마 안 남았어. 조금만 더 힘내자! 💪
\`\`\`

위 형식으로 **현재 상황에 맞춤화된** 인사이트를 마크다운으로 작성해줘!`;
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
  const { waifuState } = useWaifuState();
  const { dailyData } = useDailyData();
  const { gameState } = useGameState();
  const { currentEnergy } = useEnergyState();

  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [refreshInterval, setRefreshInterval] = useState<number>(15); // 분 단위

  // 초기 로드 추적용 ref
  const initialLoadRef = useRef(false);

  /**
   * 인사이트 생성 함수
   *
   * ⚠️ 주의: 이 함수는 useCallback으로 감싸지 않음
   * 이유: 최신 상태를 항상 참조하기 위함 (deps 변경으로 인한 재생성 방지)
   */
  const generateInsight = async () => {
    if (!apiKey) {
      setError('Gemini API 키가 설정되지 않았습니다.');
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
      const currentMinute = now.getMinutes();
      const currentBlock = TIME_BLOCKS.find(b => currentHour >= b.start && currentHour < b.end);

      const tasks = dailyData?.tasks ?? [];
      const completedTasks = tasks.filter(t => t.completed);
      const inboxTasks = tasks.filter(t => !t.timeBlock && !t.completed);

      // PersonaContext 생성 (GeminiChatModal과 동일)
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const msLeftToday = endOfDay.getTime() - now.getTime();
      const hoursLeftToday = Math.floor(msLeftToday / (1000 * 60 * 60));
      const minutesLeftToday = Math.floor((msLeftToday % (1000 * 60 * 60)) / (1000 * 60));

      const currentBlockId = currentBlock?.id ?? null;
      const currentBlockLabel = currentBlock?.label ?? '블록 외 시간';
      const currentBlockTasks = currentBlockId
        ? tasks.filter(t => t.timeBlock === currentBlockId).map(t => ({ text: t.text, completed: t.completed }))
        : [];
      const lockedBlocksCount = Object.values(dailyData?.timeBlockStates ?? {}).filter(s => s.isLocked).length;
      const totalBlocksCount = TIME_BLOCKS.length;

      // 최근 5일 패턴
      const recentDays = await getRecentDailyData(5);
      const recentBlockPatterns = TIME_BLOCKS.reduce((acc, block) => {
        acc[block.id] = recentDays.map(day => {
          const blockTasks = day.tasks.filter(t => t.timeBlock === block.id && t.completed);
          return {
            date: day.date,
            completedCount: blockTasks.length,
            tasks: blockTasks.map(t => t.text)
          };
        });
        return acc;
      }, {} as Record<string, Array<{ date: string; completedCount: number; tasks: string[] }>>);

      const affection = waifuState?.affection ?? 50;
      let mood = '중립적';
      if (affection < 20) mood = '냉담함';
      else if (affection < 40) mood = '약간 경계';
      else if (affection < 60) mood = '따뜻함';
      else if (affection < 80) mood = '다정함';
      else mood = '매우 애정 어림';

      const personaContext: PersonaContext = {
        affection,
        level: gameState?.level ?? 1,
        totalXP: gameState?.totalXP ?? 0,
        dailyXP: gameState?.dailyXP ?? 0,
        availableXP: gameState?.availableXP ?? 0,
        tasksCompleted: completedTasks.length,
        totalTasks: tasks.length,
        inboxTasks: inboxTasks.map(t => ({
          text: t.text,
          resistance: t.resistance,
          baseDuration: t.baseDuration
        })),
        recentTasks: tasks.slice(-5).map(t => ({
          text: t.text,
          completed: t.completed,
          resistance: t.resistance
        })),
        currentHour,
        currentMinute,
        hoursLeftToday,
        minutesLeftToday,
        currentBlockId,
        currentBlockLabel,
        currentBlockTasks,
        lockedBlocksCount,
        totalBlocksCount,
        currentEnergy: currentEnergy ?? 0,
        energyRecordedAt: null,
        xpHistory: gameState?.xpHistory ?? [],
        timeBlockXPHistory: gameState?.timeBlockXPHistory ?? [],
        recentBlockPatterns,
        mood,
      };

      // 페르소나 프롬프트 생성
      const personaPrompt = generateWaifuPersona(personaContext);

      // 인사이트 프롬프트 생성
      const prompt = generateInsightPrompt(personaPrompt, {
        completedTasksData,
        xpData,
        todayData: dailyData,
        currentTime: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        currentBlock: currentBlockLabel,
        inboxTasks,
      });

      // AI 호출
      const { text, tokenUsage } = await callGeminiAPI(prompt, [], apiKey);

      setInsight(text);
      setLastUpdated(new Date());

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

  // API 키 로드 및 설정 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const settings = await loadSettings();
        setApiKey(settings.geminiApiKey || '');
        setRefreshInterval(settings.autoMessageInterval || 15);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadData();

    // 5초마다 설정 다시 로드 (설정 변경 감지)
    const settingsInterval = setInterval(loadData, 5000);
    return () => clearInterval(settingsInterval);
  }, []);

  // 초기 인사이트 생성 (한 번만)
  useEffect(() => {
    if (apiKey && !initialLoadRef.current) {
      initialLoadRef.current = true;
      // 초기 로드 시에는 인사이트를 생성하지 않음 (사용자가 새로고침 버튼 클릭 또는 자동 갱신 대기)
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]); // generateInsight를 의존성에서 제거 (데이터 변경 시 재생성 방지)

  // 자동 갱신 타이머 (설정된 주기에만 실행)
  useEffect(() => {
    if (!apiKey) return;

    const interval = setInterval(() => {
      generateInsight();
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, refreshInterval]); // generateInsight를 의존성에서 제거 (데이터 변경 시 재생성 방지)

  // 마크다운 파싱 (성능 최적화: insight 변경 시에만 재계산)
  const parsedHtml = useMemo(() => {
    if (!insight) return '';
    return parseMarkdown(insight);
  }, [insight]);

  return (
    <aside className="insight-panel" role="complementary" aria-label="오늘의 인사이트">
      <div className="insight-panel-header">
        <h3>💡 오늘의 인사이트</h3>
        <button
          className="insight-refresh-btn"
          onClick={generateInsight}
          disabled={loading}
          aria-label="인사이트 새로고침"
        >
          🔄
        </button>
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

      {lastUpdated && (
        <div className="insight-footer">
          마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')} • {refreshInterval}분마다 자동 갱신
        </div>
      )}
    </aside>
  );
}

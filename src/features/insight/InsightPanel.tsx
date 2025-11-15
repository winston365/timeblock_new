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

import { useState, useEffect, useCallback } from 'react';
import { useWaifuState, useDailyData, useGameState, useEnergyState } from '@/shared/hooks';
import { loadSettings } from '@/data/repositories/settingsRepository';
import { callGeminiAPI, generateWaifuPersona, type PersonaContext } from '@/shared/services/geminiApi';
import { getRecentDailyData } from '@/data/repositories/dailyDataRepository';
import { TIME_BLOCKS } from '@/shared/types/domain';
import type { DailyData } from '@/shared/types/domain';

interface EnergyDataPoint {
  date: string;
  timeBlock: string;
  energy: number;
  timestamp: string;
}

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
 * 과거 10일간 에너지 데이터 수집
 */
async function collectEnergyData(): Promise<EnergyDataPoint[]> {
  // TODO: 에너지 히스토리가 있다면 여기서 로드
  // 현재는 빈 배열 반환
  return [];
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
function calculateTaskXP(task: any): number {
  const multipliers = { low: 1.0, medium: 1.3, high: 1.6 };
  const baseXP = Math.ceil((task.baseDuration / 30) * 25);
  return Math.ceil(baseXP * multipliers[task.resistance]);
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
  }
): string {
  const {
    completedTasksData,
    xpData,
    todayData,
    currentTime,
    currentBlock,
    inboxTasks,
  } = data;

  return `${personaPrompt}

## 📊 추가 데이터 (과거 10일)

### 오늘 진행 상황
- 완료한 작업: ${todayData?.tasks.filter(t => t.completed).length ?? 0}개
- 남은 작업: ${todayData?.tasks.filter(t => !t.completed && t.timeBlock).length ?? 0}개
- 인박스 작업: ${inboxTasks.length}개

${todayData?.tasks.filter(t => t.completed).length > 0 ? `
#### 오늘 완료한 작업
${TIME_BLOCKS.map(block => {
  const blockTasks = todayData?.tasks.filter(t => t.completed && t.timeBlock === block.id) ?? [];
  if (blockTasks.length === 0) return '';
  return `- ${block.label}: ${blockTasks.map(t => t.text).join(', ')}`;
}).filter(Boolean).join('\n')}
` : ''}

${todayData?.tasks.filter(t => !t.completed && t.timeBlock === currentBlock).length > 0 ? `
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

### 📝 형식 요구사항
- **마크다운 형식** 사용 (제목, 굵게, 리스트 등)
- **구조화된 형식**:
  1. **## 🎯 오늘의 패턴 분석** - 과거 데이터 기반 인사이트 (2-3줄)
  2. **## 💪 지금 할 일** - 현재 시간대 추천 작업 (1-2개)
  3. **## ✨ 동기부여** - 격려 메시지 (1-2줄)

### 💬 톤 & 스타일
- 친근한 반말체
- 이모지 적절히 사용
- 구체적이고 실용적인 조언

### 📏 길이
- **총 300-500자** (기존 150자보다 길게)
- 각 섹션마다 충분히 설명

### 예시:
\`\`\`
## 🎯 오늘의 패턴 분석
지난 10일 보니까 **오후 2-5시**에 평균 3개 작업 완료하며 가장 집중력이 좋았어! 그런데 오전 시간대는 좀 비어있네. 오전에 간단한 작업부터 시작하면 하루가 더 알차질 것 같아.

## 💪 지금 할 일
- **우선순위 1**: 인박스에 있는 '프로젝트 기획서' - 지금 시작하기 딱 좋은 시간이야!
- **우선순위 2**: 미완료 작업 '회의 자료 준비' - 30분 투자하면 끝낼 수 있어

## ✨ 동기부여
벌써 레벨 ${5}까지 왔잖아! 🎉 오늘도 꾸준히 하다보면 곧 레벨업할 거야. 화이팅! 💪
\`\`\`

위 형식으로 **마크다운 형식**을 사용해서 작성해줘!`;
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

  /**
   * 인사이트 생성 함수
   */
  const generateInsight = useCallback(async () => {
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
      const recentBlockPatterns = TIME_BLOCKS.flatMap(block => {
        return recentDays.map(day => {
          const blockTasks = day.tasks.filter(t => t.timeBlock === block.id && t.completed);
          return {
            date: day.date,
            completedCount: blockTasks.length,
            tasks: blockTasks.map(t => t.text)
          };
        });
      });

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
      const { text } = await callGeminiAPI(prompt, [], apiKey);

      setInsight(text);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : '인사이트 생성 실패');
      console.error('Insight generation error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiKey, dailyData, gameState, waifuState, currentEnergy]);

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

  // 초기 인사이트 생성
  useEffect(() => {
    if (apiKey) {
      generateInsight();
    }
  }, [apiKey, generateInsight]);

  // 자동 갱신 타이머
  useEffect(() => {
    if (!apiKey) return;

    const interval = setInterval(() => {
      generateInsight();
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [apiKey, refreshInterval, generateInsight]);

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

        {insight && !loading && !error && (
          <div
            className="insight-text"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(insight) }}
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

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
import { callGeminiAPI } from '@/shared/services/geminiApi';
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
function generateInsightPrompt(data: {
  energyData: EnergyDataPoint[];
  completedTasksData: CompletedTaskData[];
  xpData: XPDataPoint[];
  todayData: DailyData | null;
  currentTime: string;
  currentBlock: string;
  inboxTasks: any[];
  gameState: any;
  waifuState: any;
}): string {
  const {
    energyData,
    completedTasksData,
    xpData,
    todayData,
    currentTime,
    currentBlock,
    inboxTasks,
    gameState,
    waifuState,
  } = data;

  return `당신은 사용자의 AI 생산성 코치입니다. 과거 10일간의 데이터를 분석하여 **짧고 강력한 인사이트**를 제공하세요.

## 📊 데이터 요약

### 현재 상황
- 현재 시간: ${currentTime}
- 현재 시간대: ${currentBlock}
- 레벨: ${gameState?.level ?? 1}
- 오늘 획득 XP: ${gameState?.dailyXP ?? 0}
- 와이푸 호감도: ${waifuState?.affection ?? 0}%

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

## 🎯 인사이트 작성 가이드라인

1. **길이**: 150자 이내 (3-5문장)
2. **톤**: 친근하고 격려하는 말투 (반말 사용)
3. **구성**:
   - 첫 문장: 패턴 인사이트 또는 칭찬
   - 중간: 현재 상황 피드백
   - 마지막: 구체적인 행동 제안

4. **포함 요소** (하나 이상):
   - 가장 생산적인 시간대
   - 개선이 필요한 영역
   - 오늘 할 수 있는 작업 제안
   - 동기부여 메시지

5. **예시**:
   "지난 주 보니까 오후 2-5시에 집중력이 최고네! 오늘도 그 시간대에 중요한 일 몰아서 하면 좋을 것 같아. 인박스에 있는 '프로젝트 기획서' 지금 바로 시작해보는 건 어때? 화이팅! 🔥"

## ✍️ 인사이트 작성

(150자 이내, 친근한 반말체로)`;
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
      const energyData = await collectEnergyData();
      const completedTasksData = await collectCompletedTasksData();
      const xpData = await collectXPData(gameState);

      const now = new Date();
      const currentHour = now.getHours();
      const currentBlock = TIME_BLOCKS.find(b => currentHour >= b.start && currentHour < b.end);

      const inboxTasks = dailyData?.tasks.filter(t => !t.timeBlock && !t.completed) ?? [];

      // 프롬프트 생성
      const prompt = generateInsightPrompt({
        energyData,
        completedTasksData,
        xpData,
        todayData: dailyData,
        currentTime: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        currentBlock: currentBlock?.label ?? '블록 외 시간',
        inboxTasks,
        gameState,
        waifuState,
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
  }, [apiKey, dailyData, gameState, waifuState]);

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
          <div className="insight-text">
            {insight}
          </div>
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

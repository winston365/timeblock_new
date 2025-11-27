/**
 * InsightPanel - AI 기반 오늘의 인사이트 패널
 *
 * @role 과거 10일 데이터를 분석하여 동기부여, 격려, 할일 제안 제공
 * @input 없음
 * @output AI 생성 인사이트 (JSON 구조화 데이터)
 * @external_dependencies
 *   - geminiApi: AI 인사이트 생성
 *   - repositories: 과거 데이터 로드
 *   - hooks: 현재 상태 (에너지, 작업, 게임 상태)
 */

import { useState, useEffect, useRef } from 'react';
import { useDailyData, useGameState } from '@/shared/hooks';
import { useWaifu } from '@/features/waifu/hooks/useWaifu';
import { useEnergy } from '@/features/energy/hooks/useEnergy';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { callAIWithContext, getInsightPrompt } from '@/shared/services/ai/aiService';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories';
import { getLocalDate } from '@/shared/lib/utils';
import confetti from 'canvas-confetti';

// ✅ 인사이트 데이터 구조 정의
interface InsightData {
  status: {
    emoji: string;
    title: string;
    description: string;
    color: 'green' | 'yellow' | 'red';
  };
  action: {
    task: string;
    reason: string;
  };
  motivation: string;
  quickWins?: {
    id: string;
    task: string;
    xp: number;
  }[];
  progress?: {
    rank: 'S' | 'A' | 'B' | 'C';
    totalXp: number;
    mvpTask: string;
    comment: string;
  };
}

interface InsightPanelProps {
  collapsed?: boolean;
}

/**
 * InsightPanel 컴포넌트
 */
export default function InsightPanel({ collapsed = false }: InsightPanelProps) {
  const { dailyData } = useDailyData();
  const { gameState, addXP } = useGameState();
  const { waifuState } = useWaifu();
  const { currentEnergy } = useEnergy();
  const { settings, loadData: loadSettingsData } = useSettingsStore();
  const { show: showWaifu } = useWaifuCompanionStore();

  const [insightData, setInsightData] = useState<InsightData | null>(null);
  const [legacyInsight, setLegacyInsight] = useState<string>(''); // 구버전(텍스트) 호환용
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [totalTime, setTotalTime] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [completedQuickWins, setCompletedQuickWins] = useState<string[]>([]);

  const initialLoadRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 저장된 퀵윈 완료 상태 로드
  useEffect(() => {
    const loadQuickWinState = async () => {
      const today = getLocalDate();
      const stored = await getSystemState<{ date: string; ids: string[] }>(SYSTEM_KEYS.QUICK_WINS_COMPLETED);
      if (stored?.date === today && Array.isArray(stored.ids)) {
        setCompletedQuickWins(stored.ids);
      }
    };
    loadQuickWinState();
  }, []);

  const persistQuickWins = (ids: string[]) => {
    const today = getLocalDate();
    setSystemState(SYSTEM_KEYS.QUICK_WINS_COMPLETED, { date: today, ids }).catch(console.error);
  };

  /**
   * JSON 파싱 헬퍼
   * AI 응답이 잘리거나 불완전할 수 있으므로 여러 방법으로 시도
   */
  const parseInsightResponse = (text: string): InsightData | null => {
    try {
      // 1. 마크다운 코드블록 제거 (```json ... ``` 또는 ``` ... ```)
      let cleanText = text
        .replace(/^```(?:json)?\s*/gm, '')  // 시작 코드블록
        .replace(/\s*```\s*$/gm, '')        // 끝 코드블록
        .trim();
      
      // 2. 첫 번째 시도: 그대로 파싱
      try {
        return JSON.parse(cleanText);
      } catch {
        // 파싱 실패 시 복구 시도
      }
      
      // 3. JSON 객체 부분만 추출 시도
      const jsonStartIndex = cleanText.indexOf('{');
      if (jsonStartIndex === -1) {
        console.warn('No JSON object found in response');
        return null;
      }
      cleanText = cleanText.substring(jsonStartIndex);
      
      // 4. 불완전한 JSON 복구 시도
      let fixedText = cleanText;
      
      // 열린 따옴표 개수 확인 및 처리
      const quoteCount = (fixedText.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        // 마지막 불완전한 문자열 찾아서 제거
        // "key": "incomplete value 형태를 찾아서 해당 키-값 쌍 전체 제거
        const lastColonQuote = fixedText.lastIndexOf('": "');
        if (lastColonQuote !== -1) {
          // 그 앞의 쉼표나 여는 괄호까지 찾기
          const beforeLastField = fixedText.substring(0, lastColonQuote);
          const lastComma = beforeLastField.lastIndexOf(',');
          const lastOpenBrace = beforeLastField.lastIndexOf('{');
          const lastOpenBracket = beforeLastField.lastIndexOf('[');
          
          const cutPoint = Math.max(lastComma, lastOpenBrace, lastOpenBracket);
          if (cutPoint !== -1) {
            if (fixedText[cutPoint] === ',') {
              fixedText = fixedText.substring(0, cutPoint);
            } else {
              // { 또는 [ 직후부터 자르기
              fixedText = fixedText.substring(0, cutPoint + 1);
            }
          }
        }
      }
      
      // 5. 닫히지 않은 괄호들 닫기
      const openBraces = (fixedText.match(/\{/g) || []).length;
      const closeBraces = (fixedText.match(/\}/g) || []).length;
      const openBrackets = (fixedText.match(/\[/g) || []).length;
      const closeBrackets = (fixedText.match(/\]/g) || []).length;
      
      // 배열 먼저 닫고 객체 닫기
      fixedText += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
      fixedText += '}'.repeat(Math.max(0, openBraces - closeBraces));
      
      try {
        const parsed = JSON.parse(fixedText);
        // 최소한 status 필드가 있는지 확인
        if (parsed && parsed.status) {
          console.log('[InsightPanel] Recovered truncated JSON successfully');
          return parsed;
        }
      } catch {
        // 복구 실패
      }
      
      // 6. 최소 필드만이라도 추출 시도
      try {
        const statusMatch = cleanText.match(/"status"\s*:\s*\{[^}]+\}/);
        const actionMatch = cleanText.match(/"action"\s*:\s*\{[^}]+\}/);
        const motivationMatch = cleanText.match(/"motivation"\s*:\s*"([^"]+)"/);
        
        if (statusMatch) {
          // 최소 status만이라도 있으면 부분 데이터 반환
          const partialData: Partial<InsightData> = {
            status: JSON.parse(`{${statusMatch[0]}}`).status,
          };
          if (actionMatch) {
            partialData.action = JSON.parse(`{${actionMatch[0]}}`).action;
          }
          if (motivationMatch) {
            partialData.motivation = motivationMatch[1];
          }
          
          if (partialData.status) {
            console.log('[InsightPanel] Extracted partial data from truncated response');
            return partialData as InsightData;
          }
        }
      } catch {
        // 부분 추출도 실패
      }
      
      // 7. 모든 시도 실패
      console.warn('Failed to parse insight JSON after all attempts, raw text:', text.substring(0, 200));
      return null;
    } catch (e) {
      console.warn('Failed to parse insight JSON:', e);
      return null;
    }
  };

  /**
   * 퀵 윈 완료 처리
   */
  const handleQuickWinComplete = async (id: string, xp: number) => {
    if (completedQuickWins.includes(id)) return;

    // 1. 상태 업데이트 + 영구 저장
    const next = [...completedQuickWins, id];
    setCompletedQuickWins(next);
    persistQuickWins(next);

    // 2. XP 지급
    try {
      await addXP(xp, '퀵 윈 달성');
    } catch (error) {
      console.error('Failed to grant quick win XP', error);
    }

    // 3. 효과 (컨페티)
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF4500'],
    });

    // 4. 와이푸 칭찬
    showWaifu(`멋져요! 작은 승리를 거뒀네요! (+${xp} XP)`);
  };

  /**
   * 인사이트 생성 함수
   */
  const generateInsight = async (isRetry = false) => {
    if (!settings?.geminiApiKey) {
      setError('Gemini API 키가 설정되지 않았습니다.');
      setLoading(false);
      return;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (!isRetry) {
      setRetryCount(0);
    }

    setLoading(true);
    setError(null);

    try {
      const { text } = await callAIWithContext({
        dailyData,
        gameState,
        waifuState,
        currentEnergy,
        apiKey: settings.geminiApiKey,
        type: 'insight',
        additionalInstructions: getInsightPrompt(),
      });

      const now = new Date();
      const parsed = parseInsightResponse(text);

      if (parsed) {
        setInsightData(parsed);
        setLegacyInsight('');
        setCompletedQuickWins([]); // 새로 생성되면 완료 기록 초기화
        persistQuickWins([]);
      } else {
        // 파싱 실패 시 텍스트로 저장 (구버전 호환)
        setInsightData(null);
        setLegacyInsight(text);
      }

      setLastUpdated(now);
      setRetryCount(0);

      await setSystemState(SYSTEM_KEYS.LAST_INSIGHT_TIME, now.toISOString());
      await setSystemState(SYSTEM_KEYS.LAST_INSIGHT_TEXT, text);

      showWaifu(`💡 새로운 인사이트가 도착했어요!`);

      if (window.electronAPI) {
        try {
          await window.electronAPI.showNotification(
            '💡 오늘의 인사이트 생성 완료',
            '새로운 인사이트가 준비되었습니다!'
          );
        } catch (notifError) {
          console.warn('Failed to show notification:', notifError);
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('Insight generation error:', err);

      if (retryCount < 3) {
        const nextRetryCount = retryCount + 1;
        setRetryCount(nextRetryCount);
        setError(`⚠️ 오류 발생: ${errorMessage}\n\n10초 후 재시도합니다... (${nextRetryCount}/3)`);

        retryTimeoutRef.current = setTimeout(() => {
          generateInsight(true);
        }, 10000);
      } else {
        setError(`❌ 인사이트 생성 실패 (3회 재시도 완료)\n\n오류 내용: ${errorMessage}`);
        setRetryCount(0);
      }
    } finally {
      setLoading(false);
    }
  };

  // 설정 로드
  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  // 초기 로드 및 자동 생성 체크
  useEffect(() => {
    const checkAndGenerate = async () => {
      if (!settings?.geminiApiKey || initialLoadRef.current) return;
      initialLoadRef.current = true;

      const lastTimeStr = await getSystemState<string>(SYSTEM_KEYS.LAST_INSIGHT_TIME);
      const refreshInterval = (settings.autoMessageInterval || 15) * 60 * 1000;

      if (lastTimeStr) {
        const lastTime = new Date(lastTimeStr);
        const now = new Date();
        const timeSinceLastGeneration = now.getTime() - lastTime.getTime();

        if (timeSinceLastGeneration >= refreshInterval) {
          generateInsight(false);
        } else {
          setLoading(false);
          const lastInsightText = await getSystemState<string>(SYSTEM_KEYS.LAST_INSIGHT_TEXT);
          if (lastInsightText) {
            const parsed = parseInsightResponse(lastInsightText);
            if (parsed) {
              setInsightData(parsed);
            } else {
              setLegacyInsight(lastInsightText);
            }
            setLastUpdated(lastTime);
          }
          setTimeLeft(Math.ceil((refreshInterval - timeSinceLastGeneration) / 1000));
        }
      } else {
        generateInsight(false);
      }
    };

    checkAndGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.geminiApiKey]);

  // 타이머 정리
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  // 자동 갱신 타이머
  useEffect(() => {
    if (!settings?.geminiApiKey) return;

    const refreshInterval = settings.autoMessageInterval || 15;
    const totalSeconds = refreshInterval * 60;
    setTotalTime(totalSeconds);

    const countdownInterval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? totalSeconds : prev - 1));
    }, 1000);

    const aiInterval = setInterval(() => {
      generateInsight(false);
      setTimeLeft(totalSeconds);
    }, refreshInterval * 60 * 1000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(aiInterval);
    };
  }, [settings?.geminiApiKey, settings?.autoMessageInterval]);

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  // 상태별 색상 매핑
  const getStatusColor = (color: string) => {
    switch (color) {
      case 'green': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'yellow': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'red': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-[var(--color-text)] bg-[var(--color-bg-base)] border-[var(--color-border)]';
    }
  };

  const getRankColor = (rank: string) => {
    switch (rank) {
      case 'S': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'A': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'B': return 'text-green-500 bg-green-500/10 border-green-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <aside
      className={`flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 text-[var(--color-text)] transition-all duration-300 ${collapsed ? 'w-0 opacity-0 p-0 border-none' : 'w-[320px] opacity-100'
        }`}
      role="complementary"
      aria-label="오늘의 인사이트"
      aria-hidden={collapsed}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3 shrink-0">
        <h3 className="text-sm font-bold text-[var(--color-text)]">💡 오늘의 인사이트</h3>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-xs transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          onClick={() => generateInsight(false)}
          disabled={loading}
          aria-label="인사이트 새로고침"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
        </button>
      </div>

      {/* 타이머 바 */}
      {totalTime > 0 && !loading && (
        <div className="flex flex-col gap-1 text-[var(--color-text-secondary)] shrink-0">
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-right">
            다음 갱신: {Math.floor(timeLeft / 60)}분 {timeLeft % 60}초
          </span>
        </div>
      )}

      {/* 컨텐츠 영역 */}
      <div className="flex-1 overflow-y-auto rounded-xl bg-[var(--color-bg-base)] p-3 text-sm scrollbar-hide">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-[var(--color-text)]">
            <div className="flex items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-transparent border-t-blue-400 text-4xl text-blue-400 animate-spin">
                <div className="h-16 w-16 rounded-full border-4 border-transparent border-t-red-400 text-2xl text-red-400 animate-spin" />
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">AI가 분석 중입니다...</p>
          </div>
        ) : error ? (
          <div className="whitespace-pre-line text-xs text-[var(--color-danger)] text-center p-4">{error}</div>
        ) : insightData ? (
          <div className="flex flex-col gap-3 h-full">
            {/* 1. 상태 카드 */}
            <div className={`flex flex-col gap-2 rounded-xl border p-4 ${getStatusColor(insightData.status.color)}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{insightData.status.emoji}</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold opacity-70">CURRENT VIBE</span>
                  <span className="font-bold">{insightData.status.title}</span>
                </div>
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                {insightData.status.description}
              </p>
            </div>

            {/* 2. 액션 카드 */}
            <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)]/5 p-4">
              <div className="flex items-center gap-2 text-[var(--color-primary)]">
                <span className="text-lg">🔥</span>
                <span className="text-xs font-bold">NOW ACTION</span>
              </div>
              <div className="text-lg font-bold text-[var(--color-text)]">
                {insightData.action.task}
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {insightData.action.reason}
              </p>
            </div>

            {/* 3. 퀵 윈 (도파민 메뉴) */}
            {insightData.quickWins && insightData.quickWins.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[var(--color-text-secondary)] px-1">
                  <span className="text-lg">⚡</span>
                  <span className="text-xs font-bold">QUICK WINS (1분 컷)</span>
                </div>
                <div className="flex flex-col gap-2">
                  {insightData.quickWins.map((win) => {
                    const isCompleted = completedQuickWins.includes(win.id);
                    return (
                      <button
                        key={win.id}
                        onClick={() => handleQuickWinComplete(win.id, win.xp)}
                        disabled={isCompleted}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${isCompleted
                          ? 'bg-green-500/10 border-green-500/30 opacity-50'
                          : 'bg-[var(--color-bg-elevated)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:scale-[1.02] active:scale-95'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{isCompleted ? '✅' : '🎁'}</span>
                          <span className={`text-sm ${isCompleted ? 'line-through opacity-70' : ''}`}>
                            {win.task}
                          </span>
                        </div>
                        {!isCompleted && (
                          <span className="text-xs font-bold text-[var(--color-primary)]">
                            +{win.xp} XP
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. 중간 성과 리포트 */}
            {insightData.progress && (
              <div className={`flex flex-col gap-2 rounded-xl border p-4 ${getRankColor(insightData.progress.rank)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <span className="text-xs font-bold">PROGRESS REPORT</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs opacity-70">RANK</span>
                    <span className="text-xl font-black">{insightData.progress.rank}</span>
                  </div>
                </div>

                <div className="my-2 h-px w-full bg-current opacity-20" />

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="opacity-70">오늘 획득 XP</span>
                    <span className="font-bold">{insightData.progress.totalXp} XP</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="opacity-70">MVP 작업</span>
                    <span className="font-bold truncate max-w-[120px]">{insightData.progress.mvpTask}</span>
                  </div>
                </div>

                <p className="mt-2 text-xs font-medium italic opacity-90 text-center">
                  "{insightData.progress.comment}"
                </p>
              </div>
            )}

            {/* 5. 동기부여 카드 */}
            <div className="mt-auto rounded-xl bg-[var(--color-bg-elevated)] p-4 text-center border border-[var(--color-border)]">
              <span className="text-2xl block mb-2">✨</span>
              <p className="text-sm font-medium italic text-[var(--color-text)]">
                "{insightData.motivation}"
              </p>
            </div>
          </div>
        ) : legacyInsight ? (
          // 구버전 텍스트 데이터 폴백
          <div className="prose prose-invert prose-sm max-w-none text-[var(--color-text)] whitespace-pre-wrap">
            {legacyInsight}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--color-text-secondary)]">
            <span className="text-3xl">💡</span>
            <p className="text-xs">새로고침하여 인사이트를 받아보세요</p>
          </div>
        )}
      </div>

      {lastUpdated && settings && (
        <div className="text-[10px] text-[var(--color-text-tertiary)] text-center shrink-0">
          마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
        </div>
      )}
    </aside>
  );
}

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
import { useDailyData, useGameState, useWaifuState, useEnergyState } from '@/shared/hooks';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { callAIWithContext, getInsightInstruction } from '@/shared/services/aiService';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';

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
  const { dailyData } = useDailyData();
  const { gameState } = useGameState();
  const { waifuState } = useWaifuState();
  const { currentEnergy } = useEnergyState();
  const { settings, loadData: loadSettingsData } = useSettingsStore();
  const { show: showWaifu } = useWaifuCompanionStore();

  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0); // 남은 시간 (초)
  const [totalTime, setTotalTime] = useState<number>(0); // 전체 시간 (초)
  const [retryCount, setRetryCount] = useState<number>(0); // 재시도 횟수

  // 초기 로드 추적용 ref
  const initialLoadRef = useRef(false);
  // 재시도 타이머 ref
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // localStorage 키
  const LAST_INSIGHT_TIME_KEY = 'lastInsightGenerationTime';
  const LAST_INSIGHT_TEXT_KEY = 'lastInsightText';

  /**
   * 인사이트 생성 함수 (재시도 로직 포함)
   */
  const generateInsight = async (isRetry = false) => {
    if (!settings?.geminiApiKey) {
      setError('Gemini API 키가 설정되지 않았습니다.');
      setLoading(false);
      return;
    }

    // 기존 재시도 타이머 취소
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // 재시도가 아닌 경우 (수동 새로고침) 재시도 카운트 리셋
    if (!isRetry) {
      setRetryCount(0);
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ 통합 AI 호출 (PersonaContext 빌드 + 프롬프트 생성 + API 호출)
      const { text, tokenUsage } = await callAIWithContext({
        dailyData,
        gameState,
        waifuState,
        currentEnergy,
        apiKey: settings.geminiApiKey,
        type: 'insight',
        additionalInstructions: getInsightInstruction(),
      });

      const now = new Date();
      setInsight(text);
      setLastUpdated(now);
      setRetryCount(0); // 성공 시 재시도 카운트 리셋

      // 마지막 생성 시간과 텍스트를 localStorage에 저장
      localStorage.setItem(LAST_INSIGHT_TIME_KEY, now.toISOString());
      localStorage.setItem(LAST_INSIGHT_TEXT_KEY, text);

      // 와이푸 컴패니언 연동 - 인사이트 생성 성공 시 와이푸가 배달
      showWaifu(`💡 새로운 인사이트가 도착했어요!`);

      // 윈도우 알림 표시 (Electron 환경에서만)
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

      // 토큰 사용량 저장 (전체 로그에 기록)
      if (tokenUsage) {
        await addTokenUsage(tokenUsage.promptTokens, tokenUsage.candidatesTokens);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('Insight generation error:', err);

      // 재시도 로직 (최대 3번)
      if (retryCount < 3) {
        const nextRetryCount = retryCount + 1;
        setRetryCount(nextRetryCount);
        setError(`⚠️ 오류 발생: ${errorMessage}\n\n10초 후 재시도합니다... (${nextRetryCount}/3)`);

        // 10초 후 재시도
        retryTimeoutRef.current = setTimeout(() => {
          console.log(`Retrying insight generation... (${nextRetryCount}/3)`);
          generateInsight(true);
        }, 10000);
      } else {
        // 3번 모두 실패
        setError(`❌ 인사이트 생성 실패 (3회 재시도 완료)\n\n오류 내용: ${errorMessage}\n\n새로고침 버튼을 눌러 다시 시도하거나, API 키와 네트워크 연결을 확인해주세요.`);
        setRetryCount(0); // 재시도 카운트 리셋
      }
    } finally {
      setLoading(false);
    }
  };

  // 설정 로드
  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  // 초기 인사이트 생성 (설정된 시간 간격에 따라)
  useEffect(() => {
    if (settings?.geminiApiKey && !initialLoadRef.current) {
      initialLoadRef.current = true;

      // 마지막 생성 시간 확인
      const lastTimeStr = localStorage.getItem(LAST_INSIGHT_TIME_KEY);
      const refreshInterval = (settings.autoMessageInterval || 15) * 60 * 1000; // ms

      if (lastTimeStr) {
        const lastTime = new Date(lastTimeStr);
        const now = new Date();
        const timeSinceLastGeneration = now.getTime() - lastTime.getTime();

        // 설정된 간격이 지났으면 생성
        if (timeSinceLastGeneration >= refreshInterval) {
          console.log('Auto-generating insight (interval passed)');
          generateInsight(false);
        } else {
          // 간격이 안 지났으면 기존 인사이트 표시 (있다면)
          console.log('Skipping auto-generation (interval not passed yet)');
          setLoading(false);

          // 기존 인사이트 텍스트 불러오기
          const lastInsightText = localStorage.getItem(LAST_INSIGHT_TEXT_KEY);
          if (lastInsightText) {
            setInsight(lastInsightText);
            setLastUpdated(lastTime);
          }

          // 남은 시간 계산하여 타이머 설정
          const remainingTime = Math.ceil((refreshInterval - timeSinceLastGeneration) / 1000);
          setTimeLeft(remainingTime);
        }
      } else {
        // 처음 실행하는 경우 즉시 생성
        console.log('First time insight generation');
        generateInsight(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.geminiApiKey]);

  // 컴포넌트 언마운트 시 재시도 타이머 정리
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // 자동 갱신 타이머 (설정된 주기에만 실행)
  useEffect(() => {
    if (!settings?.geminiApiKey) return;

    const refreshInterval = settings.autoMessageInterval || 15;
    const totalSeconds = refreshInterval * 60;
    setTotalTime(totalSeconds);
    setTimeLeft(totalSeconds);

    // 타이머 카운트다운 (1초마다)
    const countdownInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return totalSeconds; // 리셋
        }
        return prev - 1;
      });
    }, 1000);

    // AI 호출 인터벌
    const aiInterval = setInterval(() => {
      generateInsight(false);
      setTimeLeft(totalSeconds); // 타이머 리셋
    }, refreshInterval * 60 * 1000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(aiInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.geminiApiKey, settings?.autoMessageInterval]);

  // 마크다운 파싱 (성능 최적화: insight 변경 시에만 재계산)
  const parsedHtml = useMemo(() => {
    if (!insight) return '';
    return parseMarkdown(insight);
  }, [insight]);

  // 프로그레스 퍼센트 계산
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return (
    <aside className="insight-panel" role="complementary" aria-label="오늘의 인사이트">
      <div className="insight-panel-header">
        <div className="insight-header-top">
          <h3>💡 오늘의 인사이트</h3>
          <button
            className="insight-refresh-btn"
            onClick={() => generateInsight(false)}
            disabled={loading}
            aria-label="인사이트 새로고침"
          >
            🔄
          </button>
        </div>
        {/* 타이머 프로그레스 바 */}
        {totalTime > 0 && !loading && (
          <div className="insight-timer-container">
            <div className="insight-timer-progress" style={{ width: `${progress}%` }} />
            <span className="insight-timer-text">
              다음 갱신까지 {Math.floor(timeLeft / 60)}분 {timeLeft % 60}초
            </span>
          </div>
        )}
      </div>

      <div className="insight-content">
        {loading && (
          <div className="insight-loading">
            <div className="insight-loading-icon">🤔</div>
            <p>인사이트 생성 중...</p>
          </div>
        )}

        {error && !loading && (
          <div className="insight-error" style={{ whiteSpace: 'pre-line' }}>
            {error}
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

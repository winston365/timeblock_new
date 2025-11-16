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
import { usePersonaContext } from '@/shared/hooks';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { callGeminiAPI, generateWaifuPersona } from '@/shared/services/geminiApi';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';

/**
 * 인사이트 출력 지시사항 (종합 분석)
 */
function getInsightInstruction(): string {
  return `
---

## 💡 오늘의 인사이트 작성 (종합 분석)

위 데이터를 기반으로 **오늘의 인사이트**를 작성해줘. 다음 요구사항을 따라줘:

### 🔍 분석 시 고려사항
1. **에너지 레벨 고려**
   - 에너지 높음(70+): 어려운 작업, 집중 필요 작업 추천
   - 에너지 중간(40-70): 중요도 높은 작업, 계획된 작업 추천
   - 에너지 낮음(0-40): 간단한 작업, 정리 작업, 휴식 추천

2. **시간대별 맥락 고려**
   - 새벽(0-6시): 충분한 휴식 권장, 내일 계획 준비
   - 오전(6-12시): 집중력 높은 시간, 중요 작업 우선
   - 오후(12-18시): 점심 후 에너지 관리, 협업 작업 적합
   - 저녁(18-21시): 마무리 작업, 내일 준비, 회고
   - 밤(21시 이후): 취침 준비, 충분한 수면으로 내일을 준비

3. **작업 목록 분석**
   - 현재 블록 미완료 작업 우선 확인
   - 인박스 작업 중 긴급/중요 작업 식별
   - 저항도(resistance) 고려한 순서 제안
   - 남은 시간 대비 완료 가능성 평가

4. **목표 및 계획 평가**
   - 잠긴 블록 수 → 계획 실행력 평가
   - 과거 패턴과 오늘 비교 → 개선점 제시

### 📝 형식 요구사항
- **마크다운 형식** 사용
- **구조**:
  1. **## 🎯 오늘의 패턴 분석** - 과거 데이터 + 시간대/에너지 고려 (2-3줄)
  2. **## 💪 지금 할 일** - 현재 상황 최적화된 구체적 작업 추천 (1-2개, 이유 포함)
  3. **## ✨ 동기부여** - 진행도 인정 + 격려 (1-2줄)

### 📏 길이
- **총 300-500자**
- 각 섹션마다 충분히 설명

위 형식으로 **현재 상황에 맞춤화된** 인사이트를 마크다운으로 작성해줘!
`;
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
  const { settings, loadData: loadSettingsData } = useSettingsStore();
  const { show: showWaifu } = useWaifuCompanionStore();

  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0); // 남은 시간 (초)
  const [totalTime, setTotalTime] = useState<number>(0); // 전체 시간 (초)

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
      // PersonaContext를 사용하여 시스템 프롬프트 생성
      // generateWaifuPersona()는 이미 모든 현재 상황 데이터를 포함
      const personaPrompt = generateWaifuPersona(personaContext);

      // 출력 지시사항 추가
      const instruction = getInsightInstruction();

      // 최종 프롬프트: personaPrompt + 출력 지시사항
      const prompt = `${personaPrompt}\n\n${instruction}`;

      // AI 호출
      const { text, tokenUsage } = await callGeminiAPI(prompt, [], settings.geminiApiKey);

      setInsight(text);
      setLastUpdated(new Date());

      // 와이푸 컴패니언 연동 - 인사이트 생성 성공 시 와이푸가 배달
      showWaifu(`💡 새로운 인사이트가 도착했어요!`);

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
      generateInsight();
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
            onClick={generateInsight}
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

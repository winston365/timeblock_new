/**
 * GeminiFullscreenChat - 전체 화면 비주얼 노벨 스타일 AI 챗
 *
 * @role Gemini AI와의 몰입형 대화 인터페이스. 좌측에 와이푸 이미지, 우측에 채팅 UI를 50/50 분할 표시
 * @input isOpen (모달 표시 여부), onClose (모달 닫기 핸들러)
 * @output 전체 화면 비주얼 노벨 스타일 채팅 UI
 * @external_dependencies
 *   - GeminiChatModal: 기존 채팅 로직 재사용
 *   - WaifuPanel: 와이푸 이미지 로직
 *   - useWaifuState: 와이푸 상태
 */

import { useState, useRef, useEffect } from 'react';
import { callGeminiAPI, generateWaifuPersona, type PersonaContext } from '@/shared/services/geminiApi';
import { useWaifuState, useDailyData, useGameState, useEnergyState } from '@/shared/hooks';
import { loadSettings } from '@/data/repositories/settingsRepository';
import {
  loadTodayChatHistory,
  saveChatHistory,
  addTokenUsage,
  getRecentMessages,
  loadTodayTokenUsage
} from '@/data/repositories/chatHistoryRepository';
import { getRecentDailyData } from '@/data/repositories/dailyDataRepository';
import { getWaifuImagePathWithFallback } from '@/features/waifu/waifuImageUtils';
import type { GeminiChatMessage, DailyTokenUsage } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import './gemini-fullscreen.css';

const MAX_HISTORY_MESSAGES = 20;

interface GeminiFullscreenChatProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 비주얼 노벨 스타일 전체 화면 AI 챗
 *
 * @param {GeminiFullscreenChatProps} props - 컴포넌트 props
 * @returns {JSX.Element | null} 전체 화면 챗 UI 또는 null
 * @sideEffects
 *   - 채팅 히스토리 로드/저장
 *   - 토큰 사용량 추적
 *   - Gemini API 호출
 *   - 와이푸 이미지 로드
 */
export default function GeminiFullscreenChat({ isOpen, onClose }: GeminiFullscreenChatProps) {
  const { waifuState } = useWaifuState();
  const { dailyData } = useDailyData();
  const { gameState } = useGameState();
  const { currentEnergy } = useEnergyState();
  const [messages, setMessages] = useState<GeminiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [waifuImagePath, setWaifuImagePath] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // API 키 및 채팅 히스토리 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const settings = await loadSettings();
        setApiKey(settings.geminiApiKey || '');

        const history = await loadTodayChatHistory();
        setMessages(history);
      } catch (error) {
        console.error('Failed to load chat data:', error);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // 와이푸 이미지 로드
  useEffect(() => {
    const loadWaifuImage = async () => {
      if (waifuState) {
        const path = await getWaifuImagePathWithFallback(waifuState.affection, 1);
        setWaifuImagePath(path);
      }
    };

    if (isOpen) {
      loadWaifuImage();
    }
  }, [isOpen, waifuState]);

  // 메시지 목록 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // 모달이 열릴 때 입력창 포커스
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  /**
   * 메시지 전송 핸들러
   */
  const handleSend = async () => {
    if (!input.trim() || loading || !apiKey) return;

    setLoading(true);
    setError(null);

    try {
      const userMessage: GeminiChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: input.trim(),
        timestamp: Date.now(),
        category: 'qa',
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput('');

      // 최근 메시지 가져오기 (API 컨텍스트용)
      const history = getRecentMessages(updatedMessages, MAX_HISTORY_MESSAGES);

      // PersonaContext 생성 (GeminiChatModal과 동일)
      const tasks = dailyData?.tasks ?? [];
      const completedTasks = tasks.filter(t => t.completed);
      const inboxTasks = tasks.filter(t => !t.timeBlock);

      // 시간 정보
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const hoursLeftToday = 24 - currentHour - 1;
      const minutesLeftToday = 60 - currentMinute;

      // 현재 시간대 블록 찾기
      const currentBlock = TIME_BLOCKS.find(block => currentHour >= block.start && currentHour < block.end);
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

      const systemPrompt = generateWaifuPersona(personaContext);
      const fullPrompt = messages.length === 0 ? `${systemPrompt}\n\n${userMessage.text}` : userMessage.text;

      const { text, tokenUsage } = await callGeminiAPI(fullPrompt, history, apiKey);

      const modelMessage: GeminiChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text,
        timestamp: Date.now(),
        category: 'qa',
        tokenUsage,
      };

      const finalMessages = [...updatedMessages, modelMessage];
      setMessages(finalMessages);
      await saveChatHistory(finalMessages);

      if (tokenUsage) {
        await addTokenUsage(tokenUsage.promptTokens, tokenUsage.candidatesTokens);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      console.error('Gemini API 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Enter 키 핸들러
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * 대화 내역 지우기
   */
  const clearChat = async () => {
    try {
      setMessages([]);
      setError(null);
      await saveChatHistory([]);
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="gemini-fullscreen-overlay">
      <div className="gemini-fullscreen-container">
        {/* 좌측: 와이푸 이미지 (50%) */}
        <div className="fullscreen-waifu-section">
          {waifuImagePath ? (
            <img
              src={waifuImagePath}
              alt={`와이푸 (호감도 ${waifuState?.affection}%)`}
              className="fullscreen-waifu-image"
            />
          ) : (
            <div className="fullscreen-waifu-placeholder">
              <div className="waifu-placeholder-icon">🥰</div>
              <p>와이푸 이미지 로딩 중...</p>
            </div>
          )}

          {/* 상태 정보 오버레이 */}
          <div className="waifu-info-overlay">
            <div className="info-item">
              <span className="info-label">호감도</span>
              <span className="info-value">{waifuState?.affection ?? 0}%</span>
            </div>
            <div className="info-item">
              <span className="info-label">레벨</span>
              <span className="info-value">{gameState?.level ?? 1}</span>
            </div>
            <div className="info-item">
              <span className="info-label">오늘 XP</span>
              <span className="info-value">{gameState?.dailyXP ?? 0}</span>
            </div>
          </div>
        </div>

        {/* 우측: 채팅 인터페이스 (50%) */}
        <div className="fullscreen-chat-section">
          {/* 헤더 */}
          <div className="fullscreen-chat-header">
            <h2>💬 AI와의 대화</h2>
            <div className="header-actions">
              {messages.length > 0 && (
                <button className="btn-clear" onClick={clearChat}>
                  🗑️ 지우기
                </button>
              )}
              <button className="btn-close-fullscreen" onClick={onClose} aria-label="닫기">
                ✕
              </button>
            </div>
          </div>

          {/* 메시지 목록 */}
          <div className="fullscreen-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <div className="welcome-icon">🤖</div>
                <h3>안녕하세요!</h3>
                <p>무엇을 도와드릴까요?</p>
                <div className="example-questions">
                  <button className="example-btn" onClick={() => setInput('오늘 할 일 추천해줘')}>
                    오늘 할 일 추천해줘
                  </button>
                  <button className="example-btn" onClick={() => setInput('작업 우선순위를 어떻게 정해야 할까?')}>
                    작업 우선순위를 어떻게 정해야 할까?
                  </button>
                  <button className="example-btn" onClick={() => setInput('에너지가 낮을 때 뭐 하면 좋을까?')}>
                    에너지가 낮을 때 뭐 하면 좋을까?
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={msg.id}
                className={`fullscreen-message ${msg.role} fade-in`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-bubble">
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="fullscreen-message model fade-in">
                <div className="message-avatar">🤖</div>
                <div className="message-bubble">
                  <div className="message-loading">
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                    <span className="loading-dot"></span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="chat-error">
                <span>⚠️ {error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="fullscreen-input-container">
            <input
              ref={inputRef}
              type="text"
              className="fullscreen-input"
              placeholder="메시지를 입력하세요... (Enter로 전송, ESC로 닫기)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <button
              className="btn-send-fullscreen"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              {loading ? '⏳' : '📤'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

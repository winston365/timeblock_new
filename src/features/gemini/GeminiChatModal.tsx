/**
 * GeminiChatModal - Gemini AI 챗봇 모달
 * 20개 메시지 히스토리, 토큰 사용량 추적, Firebase 동기화
 */

import { useState, useRef, useEffect } from 'react';
import { callGeminiAPI, generateWaifuPersona, type PersonaContext } from '@/shared/services/geminiApi';
import { useWaifuState, useDailyData, useGameState } from '@/shared/hooks';
import { loadSettings } from '@/data/repositories/settingsRepository';
import {
  loadTodayChatHistory,
  saveChatHistory,
  addTokenUsage,
  getRecentMessages,
  loadTodayTokenUsage
} from '@/data/repositories/chatHistoryRepository';
import type { GeminiChatMessage, DailyTokenUsage } from '@/shared/types/domain';
import './gemini.css';

const MAX_HISTORY_MESSAGES = 20;

interface GeminiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GeminiChatModal({ isOpen, onClose }: GeminiChatModalProps) {
  const { waifuState } = useWaifuState();
  const { dailyData } = useDailyData();
  const { gameState } = useGameState();
  const [messages, setMessages] = useState<GeminiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [todayTokenUsage, setTodayTokenUsage] = useState<DailyTokenUsage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // API 키, 채팅 히스토리 및 토큰 사용량 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        // API 키 로드
        const settings = await loadSettings();
        setApiKey(settings.geminiApiKey || '');

        // 채팅 히스토리 로드
        const history = await loadTodayChatHistory();
        setMessages(history);

        // 오늘 토큰 사용량 로드
        const tokenUsage = await loadTodayTokenUsage();
        setTodayTokenUsage(tokenUsage);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 모달 열릴 때 입력창에 포커스
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: GeminiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: input.trim(),
      timestamp: Date.now(),
      category: 'qa', // Default category
    };

    // 메시지를 상태와 Dexie에 저장
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // 히스토리 준비 (최근 20개만)
      const recentHistory = await getRecentMessages(MAX_HISTORY_MESSAGES);
      const history = recentHistory.map((msg) => ({
        role: msg.role,
        text: msg.text,
      }));

      // 페르소나 컨텍스트 준비
      const tasks = dailyData?.tasks || [];
      const completedTasks = tasks.filter(t => t.completed);
      const recentTasks = tasks.slice(-5).map(t => ({
        text: t.text,
        completed: t.completed,
        resistance: t.resistance
      }));

      const personaContext: PersonaContext = {
        affection: waifuState?.affection ?? 50,
        level: gameState?.level ?? 1,
        xp: gameState?.totalXP ?? 0,
        dailyXP: gameState?.dailyXP ?? 0,
        tasksCompleted: completedTasks.length,
        totalTasks: tasks.length,
        currentTime: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        currentEnergy: 50, // TODO: Get from energy tracking
        recentTasks
      };

      // 시스템 프롬프트 생성
      const systemPrompt = generateWaifuPersona(personaContext);
      const fullPrompt = messages.length === 0 ? `${systemPrompt}\n\n${userMessage.text}` : userMessage.text;

      // API 호출 (토큰 사용량 포함)
      const { text, tokenUsage } = await callGeminiAPI(fullPrompt, history, apiKey);

      const modelMessage: GeminiChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text,
        timestamp: Date.now(),
        category: 'qa',
        tokenUsage,
      };

      // 메시지 저장
      const finalMessages = [...updatedMessages, modelMessage];
      setMessages(finalMessages);
      await saveChatHistory(finalMessages);

      // 토큰 사용량 저장
      if (tokenUsage) {
        await addTokenUsage(
          tokenUsage.promptTokens,
          tokenUsage.candidatesTokens
        );
        // 토큰 사용량 다시 로드
        const updatedTokenUsage = await loadTodayTokenUsage();
        setTodayTokenUsage(updatedTokenUsage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      console.error('Gemini API 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = async () => {
    try {
      setMessages([]);
      setError(null);
      await saveChatHistory([]);
      // 토큰 사용량은 초기화하지 않음 (누적 기록)
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content gemini-chat-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <h2>💬 AI와 대화하기</h2>
          <div className="modal-header-actions">
            {messages.length > 0 && (
              <button className="btn-secondary" onClick={clearChat}>
                🗑️ 대화 지우기
              </button>
            )}
            <button className="btn-close" onClick={onClose} aria-label="닫기">
              ✕
            </button>
          </div>
        </div>

        {/* 메시지 목록 */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-icon">🤖</div>
              <p>안녕하세요! 무엇을 도와드릴까요?</p>
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

          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
              <div className="message-content">
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
            <div className="chat-message model">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
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
        <div className="chat-input-container">
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder="메시지를 입력하세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <button className="btn-send" onClick={handleSend} disabled={loading || !input.trim()}>
            {loading ? '⏳' : '📤'}
          </button>
        </div>

        {/* 안내 */}
        <div className="chat-footer">
          <small>
            💡 최근 {MAX_HISTORY_MESSAGES}개 메시지가 저장되며 대화 컨텍스트로 사용됩니다.
            <br />
            레벨: {gameState?.level ?? 1} | 오늘 XP: {gameState?.dailyXP ?? 0}
            <br />
            📊 오늘 토큰 사용량: 입력 {todayTokenUsage?.promptTokens ?? 0} | 출력 {todayTokenUsage?.candidatesTokens ?? 0} | 총 {todayTokenUsage?.totalTokens ?? 0}
          </small>
        </div>
      </div>
    </div>
  );
}

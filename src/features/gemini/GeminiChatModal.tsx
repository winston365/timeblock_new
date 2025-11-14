/**
 * GeminiChatModal - Gemini AI 챗봇 모달
 */

import { useState, useRef, useEffect } from 'react';
import { callGeminiAPI, generateWaifuPersona } from '@/shared/services/geminiApi';
import { useWaifuState } from '@/shared/hooks';
import './gemini.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

interface GeminiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GeminiChatModal({ isOpen, onClose }: GeminiChatModalProps) {
  const { waifuState } = useWaifuState();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // 히스토리 준비 (최근 10개만)
      const history = messages.slice(-10).map((msg) => ({
        role: msg.role,
        text: msg.text,
      }));

      // 시스템 프롬프트 추가
      const systemPrompt = generateWaifuPersona(waifuState?.affection ?? 50);
      const fullPrompt = messages.length === 0 ? `${systemPrompt}\n\n${userMessage.text}` : userMessage.text;

      // API 호출
      const { text } = await callGeminiAPI(fullPrompt, history);

      const modelMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, modelMessage]);
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

  const clearChat = () => {
    setMessages([]);
    setError(null);
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
            💡 Tip: Gemini API 키는 .env 파일의 VITE_GEMINI_API_KEY에 설정하세요.
            <br />
            현재 호감도: {waifuState?.affection ?? 50}%
          </small>
        </div>
      </div>
    </div>
  );
}

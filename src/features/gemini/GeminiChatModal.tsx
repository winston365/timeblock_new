/**
 * GeminiChatModal
 *
 * @role Gemini AI 챗봇 인터페이스. 최근 20개 메시지 히스토리 유지 및 토큰 사용량 추적
 * @input isOpen (모달 표시 여부), onClose (모달 닫기 핸들러)
 * @output 채팅 메시지 목록, 입력창, 토큰 사용량 통계
 * @external_dependencies
 *   - geminiApi: Gemini API 호출 및 페르소나 생성
 *   - chatHistoryRepository: 채팅 히스토리 및 토큰 사용량 관리
 *   - dailyDataRepository: 최근 5일 데이터 로드
 *   - useDailyData, useGameState, useEnergyState, useWaifuState: 컨텍스트 데이터 훅
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
import type { GeminiChatMessage, DailyTokenUsage } from '@/shared/types/domain';
import { TIME_BLOCKS } from '@/shared/types/domain';
import './gemini.css';

const MAX_HISTORY_MESSAGES = 20;

// Gemini 2.5 Flash 가격 (2025-01 기준)
const PRICE_PER_MILLION_INPUT = 1.25; // US$ 1.25 per 1M input tokens
const PRICE_PER_MILLION_OUTPUT = 10.0; // US$ 10.00 per 1M output tokens

/**
 * 토큰 비용 계산
 *
 * @param {number} promptTokens - 입력 토큰 수
 * @param {number} candidatesTokens - 출력 토큰 수
 * @returns {{ inputCost: number; outputCost: number; totalCost: number }} 입력/출력/총 비용 (USD)
 */
function calculateTokenCost(promptTokens: number, candidatesTokens: number): { inputCost: number; outputCost: number; totalCost: number } {
  const inputCost = (promptTokens / 1_000_000) * PRICE_PER_MILLION_INPUT;
  const outputCost = (candidatesTokens / 1_000_000) * PRICE_PER_MILLION_OUTPUT;
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, totalCost };
}

/**
 * 비용 포맷팅
 *
 * @param {number} cost - USD 비용
 * @returns {string} 포맷팅된 비용 문자열
 */
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

interface GeminiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Gemini AI 챗봇 모달
 *
 * @param {GeminiChatModalProps} props - 컴포넌트 props
 * @returns {JSX.Element | null} 챗봇 모달 또는 null
 * @sideEffects
 *   - 채팅 히스토리 로드/저장
 *   - 토큰 사용량 추적 및 저장
 *   - Gemini API 호출
 *   - 확장된 페르소나 컨텍스트 생성 (작업, XP, 에너지, 최근 5일 패턴)
 */
export default function GeminiChatModal({ isOpen, onClose }: GeminiChatModalProps) {
  const { waifuState } = useWaifuState();
  const { dailyData } = useDailyData();
  const { gameState } = useGameState();
  const { currentEnergy } = useEnergyState();
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

      // 페르소나 컨텍스트 준비 - 확장된 데이터 수집
      const tasks = dailyData?.tasks || [];
      const completedTasks = tasks.filter(t => t.completed);
      const inboxTasks = tasks.filter(t => !t.timeBlock && !t.completed);

      // 현재 시간 정보
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const msLeftToday = endOfDay.getTime() - now.getTime();
      const hoursLeftToday = Math.floor(msLeftToday / (1000 * 60 * 60));
      const minutesLeftToday = Math.floor((msLeftToday % (1000 * 60 * 60)) / (1000 * 60));

      // 현재 시간대 블록 찾기
      const currentBlock = TIME_BLOCKS.find(block => currentHour >= block.start && currentHour < block.end);
      const currentBlockId = currentBlock?.id ?? null;
      const currentBlockLabel = currentBlock?.label ?? '블록 외 시간';
      const currentBlockTasks = currentBlockId
        ? tasks.filter(t => t.timeBlock === currentBlockId).map(t => ({ text: t.text, completed: t.completed }))
        : [];

      // 잠금 블록 수 계산
      const lockedBlocksCount = Object.values(dailyData?.timeBlockStates || {}).filter(state => state.isLocked).length;
      const totalBlocksCount = TIME_BLOCKS.length;

      // 최근 5일 데이터 로드
      const recentDays = await getRecentDailyData(5);

      // 최근 5일 시간대별 패턴 분석
      const recentBlockPatterns: Record<string, Array<{ date: string; completedCount: number; tasks: string[] }>> = {};
      TIME_BLOCKS.forEach(block => {
        recentBlockPatterns[block.id] = recentDays.map(day => {
          const blockTasks = day.tasks.filter(t => t.timeBlock === block.id && t.completed);
          return {
            date: day.date,
            completedCount: blockTasks.length,
            tasks: blockTasks.map(t => t.text)
          };
        });
      });

      // 기분 계산 (호감도 기반)
      const affection = waifuState?.affection ?? 50;
      let mood = '중립적';
      if (affection < 20) mood = '냉담함';
      else if (affection < 40) mood = '약간 경계';
      else if (affection < 60) mood = '따뜻함';
      else if (affection < 80) mood = '다정함';
      else mood = '매우 애정 어림';

      const personaContext: PersonaContext = {
        // 기본 정보
        affection,
        level: gameState?.level ?? 1,
        totalXP: gameState?.totalXP ?? 0,
        dailyXP: gameState?.dailyXP ?? 0,
        availableXP: gameState?.availableXP ?? 0,

        // 작업 정보
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

        // 시간 정보
        currentHour,
        currentMinute,
        hoursLeftToday,
        minutesLeftToday,

        // 타임블록 정보
        currentBlockId,
        currentBlockLabel,
        currentBlockTasks,
        lockedBlocksCount,
        totalBlocksCount,

        // 에너지 정보
        currentEnergy: currentEnergy ?? 0,
        energyRecordedAt: null,

        // XP 히스토리
        xpHistory: gameState?.xpHistory ?? [],

        // 타임블록 XP 히스토리
        timeBlockXPHistory: gameState?.timeBlockXPHistory ?? [],

        // 최근 5일 패턴
        recentBlockPatterns,

        // 기분
        mood,
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
            📊 오늘 토큰 사용량: 입력 {todayTokenUsage?.promptTokens.toLocaleString() ?? 0} | 출력 {todayTokenUsage?.candidatesTokens.toLocaleString() ?? 0} | 총 {todayTokenUsage?.totalTokens.toLocaleString() ?? 0}
            <br />
            💵 오늘 예상 비용: {todayTokenUsage ? formatCost(calculateTokenCost(todayTokenUsage.promptTokens, todayTokenUsage.candidatesTokens).totalCost) : '$0.0000'} (입력: {formatCost(calculateTokenCost(todayTokenUsage?.promptTokens ?? 0, 0).inputCost)} | 출력: {formatCost(calculateTokenCost(0, todayTokenUsage?.candidatesTokens ?? 0).outputCost)})
          </small>
        </div>
      </div>
    </div>
  );
}

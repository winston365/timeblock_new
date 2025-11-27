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
import { callAIWithContext } from '@/shared/services/ai/aiService';
import { useGameState, useDailyData } from '@/shared/hooks';
import { useWaifu } from '@/features/waifu/hooks/useWaifu';
import { useEnergy } from '@/features/energy/hooks/useEnergy';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import {
  loadTodayChatHistory,
  saveChatHistory,
  addTokenUsage
} from '@/data/repositories/chatHistoryRepository';
import { getWaifuImagePathWithFallback, getRandomImageNumber, getAffectionTier } from '@/features/waifu/waifuImageUtils';
import baseImage from '@/features/waifu/base.png';
import type { GeminiChatMessage } from '@/shared/types/domain';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  const { dailyData } = useDailyData();
  const { gameState } = useGameState();
  const { waifuState } = useWaifu();
  const { currentEnergy } = useEnergy();
  const { settings, loadData: loadSettingsData } = useSettingsStore();
  const [messages, setMessages] = useState<GeminiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waifuImagePath, setWaifuImagePath] = useState<string>('');
  const [waifuTurnState, setWaifuTurnState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [clickCount, setClickCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 설정 및 채팅 히스토리 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        await loadSettingsData();
        const history = await loadTodayChatHistory();
        setMessages(history);
      } catch (error) {
        console.error('Failed to load chat data:', error);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadSettingsData]);

  // 와이푸 이미지 로드
  useEffect(() => {
    const loadWaifuImage = async () => {
      if (waifuState && settings) {
        // 일반 모드일 경우 base.png 사용
        if (settings.waifuMode === 'normal') {
          setWaifuImagePath(baseImage);
        } else {
          // 특성 모드일 경우 호감도에 따라 랜덤 이미지 선택
          const tier = getAffectionTier(waifuState.affection);
          const randomIndex = getRandomImageNumber(tier.name);
          const path = await getWaifuImagePathWithFallback(waifuState.affection, randomIndex);
          setWaifuImagePath(path);
        }
      }
    };

    if (isOpen) {
      loadWaifuImage();
    }
  }, [isOpen, waifuState, settings]);

  /**
   * 와이푸 이미지를 현재 호감도 내에서 랜덤하게 변경합니다.
   */
  const changeWaifuImage = async () => {
    if (!waifuState || !settings) return;

    // 일반 모드는 이미지 변경 안 함
    if (settings.waifuMode === 'normal') return;

    // 특성 모드일 경우 호감도에 따라 새로운 랜덤 이미지 선택
    const tier = getAffectionTier(waifuState.affection);
    const randomIndex = getRandomImageNumber(tier.name);
    const path = await getWaifuImagePathWithFallback(waifuState.affection, randomIndex);
    setWaifuImagePath(path);
    setClickCount(0);
  };

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
    if (!input.trim() || loading || !settings?.geminiApiKey) return;

    setLoading(true);
    setError(null);
    setWaifuTurnState('listening'); // 사용자 입력 시 "듣고 있음" 상태

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
      // 현재 메시지는 제외하고 이전 메시지들만 히스토리로 전달
      const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);
      const history = recentMessages.map((msg) => ({
        role: msg.role,
        text: msg.text,
      }));

      // ✅ 통합 AI 호출 (PersonaContext 빌드 + 프롬프트 생성 + API 호출)
      const { text, tokenUsage } = await callAIWithContext({
        dailyData,
        gameState,
        waifuState,
        currentEnergy,
        apiKey: settings.geminiApiKey,
        type: 'chat',
        userPrompt: userMessage.text,
        history,
      });

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

      // Gemini 답변 후 와이푸 이미지 변경 및 "말하고 있음" 상태
      setWaifuTurnState('speaking');
      await changeWaifuImage();

      // 0.5초 후 idle 상태로 복귀
      setTimeout(() => {
        setWaifuTurnState('idle');
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      setWaifuTurnState('idle'); // 에러 시 idle로 복귀
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
    <div
      className="fixed inset-0 z-[1000] flex items-stretch bg-[var(--color-bg-base)]/90 backdrop-blur-lg"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="grid h-full w-full overflow-hidden lg:grid-cols-[1fr_1fr]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 좌측: 와이푸 이미지 */}
        <div className="relative flex h-full min-h-screen items-center justify-center bg-[var(--color-bg-surface)] px-6 py-8">
          <div className="absolute left-6 top-6 flex gap-3 rounded-2xl border border-[var(--color-border)] bg-[rgba(15,23,42,0.75)] px-4 py-3 text-[0.65rem] text-[var(--color-text-secondary)] shadow-2xl">
            <div className="flex flex-col">
              <span className="text-[0.55rem] uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">호감도</span>
              <span className="text-[var(--color-text)]">{waifuState?.affection ?? 0}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[0.55rem] uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">오늘 XP</span>
              <span className="text-[var(--color-text)]">{gameState?.dailyXP ?? 0}</span>
            </div>
          </div>
          <div
            className="group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-[32px] border border-white/5 bg-[var(--color-bg-surface)] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.55)] transition duration-300 hover:-translate-y-1 hover:scale-[1.002]"
            onClick={() => {
              const nextCount = clickCount + 1;
              if (nextCount >= 4) {
                changeWaifuImage();
                setClickCount(0);
              } else {
                setClickCount(nextCount);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`와이푸 이미지. 클릭 시 포즈 변경. 현재 호감도: ${waifuState?.affection}%, 기분: ${currentEnergy ? '현재 에너지' : ''}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const nextCount = clickCount + 1;
                if (nextCount >= 4) {
                  changeWaifuImage();
                  setClickCount(0);
                } else {
                  setClickCount(nextCount);
                }
              }
            }}
          >
            {waifuImagePath ? (
              <img
                src={waifuImagePath}
                alt={`와이푸 (호감도 ${waifuState?.affection}%)`}
                className={`max-h-[80vh] w-auto transform object-contain drop-shadow-[0_25px_60px_rgba(0,0,0,0.45)] transition duration-500 ${waifuTurnState === 'listening' ? 'opacity-70 blur-sm' : 'opacity-100'} animate-[fadeInScale_0.6s_ease-out]`}
              />
            ) : (
              <div className="flex h-[480px] flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-center leading-relaxed text-sm text-[var(--color-text-secondary)]">
                <span className="text-5xl opacity-70">🥰</span>
                <p>와이푸 이미지 로딩 중...</p>
                <p className="text-[0.65rem] text-[var(--color-text-tertiary)]">
                  /public/assets/waifu/poses/ 아래에<br />
                  호감도별 이미지를 넣어주세요
                </p>
              </div>
            )}
            <div className="pointer-events-none absolute bottom-4 flex -translate-x-1/2 transform rounded-full border border-white/10 bg-black/60 px-4 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-white opacity-0 transition duration-300 group-hover:opacity-100">
              클릭하여 포즈 변경 ({clickCount}/4)
            </div>

          </div>
        </div>

        {/* 우측: Gemini 채팅 */}
        <div className="flex h-full min-h-screen flex-col bg-[var(--color-bg-base)] shadow-[inset_0_0_64px_rgba(0,0,0,0.4)]">
          <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-5">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">💬 AI와의 대화</h2>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
                  onClick={clearChat}
                >
                  🗑️ 지우기
                </button>
              )}
              <button
                className="rounded-2xl bg-[var(--color-danger)] px-4 py-1 text-lg font-bold uppercase tracking-[0.3em] text-white transition hover:bg-[#dc2626]/90"
                onClick={onClose}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
          </header>

          <div
            className="flex flex-1 min-h-0 flex-col gap-5 overflow-y-auto px-6 py-8"
            ref={messagesEndRef}
          >
            {messages.length === 0 && (
              <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 text-center text-sm text-[var(--color-text-secondary)]">
                <div className="text-5xl">🤖</div>
                <h3 className="text-2xl font-semibold text-[var(--color-text)]">안녕하세요!</h3>
                <p>무엇을 도와드릴까요?</p>
                <div className="flex flex-col gap-2">
                  {[
                    '오늘 할 일 추천해줘',
                    '어제 완료한 작업 알려줘',
                    '이번 주 몇 개 작업 완료했어?',
                    '최근 5일 작업 패턴 분석해줘',
                    '에너지가 낮을 때 뭐 하면 좋을까?',
                  ].map((example) => (
                    <button
                      key={example}
                      className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-4 py-2 text-left text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
                      onClick={() => setInput(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.length > 0 && (
              <>
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  const bubbleClasses = [
                    'max-w-[70%] rounded-[18px] border px-4 py-3 text-sm leading-relaxed transition-transform duration-200',
                    isUser
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[0_10px_25px_rgba(99,102,241,0.2)]'
                      : 'border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text)]',
                  ].join(' ');

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-xl shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
                        {isUser ? '👤' : '🤖'}
                      </div>
                      <div className={`animate-[slideInUp_0.4s_ease-out] ${bubbleClasses}`}>
                        {isUser ? (
                          <div className="text-[var(--color-text)] whitespace-pre-wrap">{msg.text}</div>
                        ) : (
                          <div className="prose prose-sm prose-invert max-w-none
                            prose-headings:text-[var(--color-text)] prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2
                            prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                            prose-p:text-[var(--color-text)] prose-p:my-2 prose-p:leading-relaxed
                            prose-strong:text-[var(--color-primary)] prose-strong:font-bold
                            prose-em:text-[var(--color-text-secondary)] prose-em:italic
                            prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4
                            prose-li:text-[var(--color-text)] prose-li:my-1
                            prose-code:text-[var(--color-primary)] prose-code:bg-[var(--color-bg-tertiary)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                            prose-pre:bg-[var(--color-bg-tertiary)] prose-pre:border prose-pre:border-[var(--color-border)] prose-pre:rounded-xl prose-pre:p-3 prose-pre:my-2
                            prose-blockquote:border-l-2 prose-blockquote:border-[var(--color-primary)] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-[var(--color-text-secondary)]
                            prose-a:text-[var(--color-primary)] prose-a:underline
                            prose-hr:border-[var(--color-border)] prose-hr:my-3
                          ">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        )}
                        <div className="mt-2 text-[0.65rem] text-[var(--color-text-tertiary)]">
                          {new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {loading && (
              <div className="flex gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-xl">
                  🤖
                </div>
                <div className="flex animate-[slideInUp_0.4s_ease-out] items-center rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                  <div className="flex gap-2 text-[var(--color-primary)]">
                    <span className="animate-loadingDot rounded-full bg-[var(--color-primary)] p-2 text-transparent">·</span>
                    <span className="animate-loadingDot rounded-full bg-[var(--color-primary)] p-2 text-transparent animation-delay-[0.2s]">·</span>
                    <span className="animate-loadingDot rounded-full bg-[var(--color-primary)] p-2 text-transparent animation-delay-[0.4s]">·</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-[var(--color-danger)] bg-[rgba(239,68,68,0.15)] px-4 py-3 text-sm text-[var(--color-danger)] shadow-[0_12px_30px_rgba(239,68,68,0.35)]">
                ⚠️ {error}
              </div>
            )}
            <div ref={messagesEndRef} className="h-0" />
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-5 md:flex-row">
            <input
              ref={inputRef}
              type="text"
              className="flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
              placeholder="메시지를 입력하세요... (Enter로 전송, ESC로 닫기)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <button
              className="rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              {loading ? '⏳' : '📤 전송'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TaskModal
 *
 * @role 작업 추가/수정을 위한 모달 폼 컴포넌트. 제목, 메모, 예상 시간, 난이도 입력 제공
 * @input task (수정할 작업 또는 null), initialBlockId (초기 블록 ID), onSave (저장 핸들러), onClose (닫기 핸들러)
 * @output 작업 입력 폼 모달
 * @external_dependencies
 *   - utils: 조정된 시간 계산 함수
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Task, Resistance, TimeBlockId, DailyGoal } from '@/shared/types/domain';
import { calculateAdjustedDuration } from '@/shared/lib/utils';
import { suggestTaskEmoji } from '@/shared/services/ai/geminiApi';
import { scheduleEmojiSuggestion } from '@/shared/services/ai/emojiSuggester';
import { useWaifu } from '@/features/waifu/hooks/useWaifu';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { loadGlobalGoals } from '@/data/repositories';
import { MemoModal } from './MemoModal';
import { useTaskBreakdownStore } from '@/features/tasks/stores/breakdownStore';

interface TaskModalProps {
  task: Task | null;
  initialBlockId: TimeBlockId;
  onSave: (taskData: Partial<Task>) => void;
  onSaveMultiple?: (tasks: Partial<Task>[]) => void;
  onClose: () => void;
  source?: 'schedule' | 'inbox';
}

/**
 * 와이푸 코멘트 컴포넌트
 */
function WaifuCommentary({
  resistance,
  duration,
  affection
}: {
  resistance: Resistance;
  duration: number;
  affection: number
}) {
  const message = useMemo(() => {
    if (duration >= 90) return "90분 이상은 꽤 긴 시간이에요. 중간에 스트레칭 잊지 마세요! 🧘‍♀️";
    if (resistance === 'high') return "어려운 작업이군요! 하지만 해내면 성취감이 엄청날 거예요. 화이팅! 🔥";
    if (resistance === 'low' && duration <= 15) return "가볍게 처리할 수 있는 작업이네요. 후딱 해치워버리죠! ⚡";
    if (affection > 80) return "오늘도 열심히 하는 모습이 정말 멋져요! 제가 항상 응원하고 있어요. 🥰";
    return "준비물을 미리 챙기면 시작하기 훨씬 수월해요. 준비되셨나요? ✨";
  }, [resistance, duration, affection]);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 transition-all duration-300">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl shadow-sm">
        👩‍💼
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-indigo-400">AI Companion</span>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          "{message}"
        </p>
      </div>
    </div>
  );
}

/**
 * 작업 추가/수정 모달
 */
export default function TaskModal({ task, initialBlockId, onSave, onSaveMultiple, onClose, source = 'schedule' }: TaskModalProps) {
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [baseDuration, setBaseDuration] = useState(15);
  const [resistance, setResistance] = useState<Resistance>('low');
  const [preparation1, setPreparation1] = useState('');
  const [preparation2, setPreparation2] = useState('');
  const [preparation3, setPreparation3] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoRows, setMemoRows] = useState(2);
  const [showMemoModal, setShowMemoModal] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const { waifuState } = useWaifu();
  const { settings } = useSettingsStore();
  const { triggerBreakdown } = useTaskBreakdownStore();

  // 목표 목록 로드
  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const loadedGoals = await loadGlobalGoals();
        setGoals(loadedGoals.sort((a, b) => a.order - b.order));
      } catch (error) {
        console.error('[TaskModal] Failed to load goals:', error);
      }
    };
    fetchGoals();
  }, []);

  // 기존 작업 데이터로 초기화
  useEffect(() => {
    if (task) {
      setText(task.text);
      setMemo(task.memo);
      setBaseDuration(task.baseDuration);
      setResistance(task.resistance);
      setPreparation1(task.preparation1 || '');
      setPreparation2(task.preparation2 || '');
      setPreparation3(task.preparation3 || '');
      setGoalId(task.goalId || null);

      const lineCount = task.memo.split('\n').length;
      setMemoRows(Math.min(Math.max(lineCount, 2), 6));
    }
  }, [task]);

  // 자동 태그 파싱
  const parseAndApplyTags = (inputText: string) => {
    let updatedText = inputText;
    let hasChanges = false;

    const timeTagMatch = inputText.match(/\b(T5|T10|T15|T30|T60|T90)\b/i);
    if (timeTagMatch) {
      const timeTag = timeTagMatch[1].toUpperCase();
      const durationMap: { [key: string]: number } = {
        'T5': 5, 'T10': 10, 'T15': 15, 'T30': 30, 'T60': 60, 'T90': 90,
      };
      const duration = durationMap[timeTag];
      if (duration !== undefined) {
        setBaseDuration(duration);
        updatedText = updatedText.replace(/\b(T5|T10|T15|T30|T60|T90)\b/gi, '');
        hasChanges = true;
      }
    }

    const difficultyTagMatch = inputText.match(/\b(D1|D2|D3)\b/i);
    if (difficultyTagMatch) {
      const difficultyTag = difficultyTagMatch[1].toUpperCase();
      const difficultyMap: { [key: string]: Resistance } = {
        'D1': 'low', 'D2': 'medium', 'D3': 'high',
      };
      const difficulty = difficultyMap[difficultyTag];
      if (difficulty !== undefined) {
        setResistance(difficulty);
        updatedText = updatedText.replace(/\b(D1|D2|D3)\b/gi, '');
        hasChanges = true;
      }
    }

    if (hasChanges) {
      updatedText = updatedText.replace(/\s+/g, ' ').trim();
    }

    return updatedText;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputText = e.target.value;
    const isSpaceInput = inputText.length > text.length && inputText.endsWith(' ');

    if (isSpaceInput) {
      const parsedText = parseAndApplyTags(inputText);
      setText(parsedText);
    } else {
      setText(inputText);
    }
    if (error) setError(null);
  };

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMemo = e.target.value;
    setMemo(newMemo);
    const lineCount = newMemo.split('\n').length;
    setMemoRows(Math.min(Math.max(lineCount, 2), 6));
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (showMemoModal) return;

      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [onClose, showMemoModal]);

  // 수동 AI 세분화 버튼 핸들러 (이제 글로벌 스토어 사용)
  const handleAIBreakdown = async () => {
    if (!text.trim()) {
      setError('작업 제목을 먼저 입력해주세요.');
      return;
    }
    if (!settings?.geminiApiKey) {
      setError('Gemini API 키가 설정되지 않았습니다.');
      return;
    }

    // 현재 입력 상태로 임시 Task 객체 생성
    const tempTask: any = {
      text: text.trim(),
      memo: memo.trim(),
      baseDuration,
      resistance,
      preparation1: preparation1.trim(),
      preparation2: preparation2.trim(),
      preparation3: preparation3.trim(),
      timeBlock: initialBlockId,
    };

    triggerBreakdown(tempTask, source, settings.geminiApiKey, waifuState?.affection ?? 50);
  };

  const handleAutoEmoji = async () => {
    if (!text.trim()) return;
    if (!settings?.geminiApiKey) {
      setError('Gemini API 키가 필요합니다.');
      return;
    }

    try {
      const { emoji, tokenUsage } = await suggestTaskEmoji(text, settings.geminiApiKey, settings.geminiModel);
      if (tokenUsage) {
        const { addTokenUsage } = await import('@/data/repositories/chatHistoryRepository');
        addTokenUsage(tokenUsage.promptTokens, tokenUsage.candidatesTokens).catch(console.error);
      }
      if (emoji) {
        setText(`${emoji} ${text}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('작업 제목을 입력해주세요.');
      document.getElementById('task-text')?.focus();
      return;
    }

    const adjustedDuration = calculateAdjustedDuration(baseDuration, resistance);
    const taskData = {
      text: text.trim(),
      memo: memo.trim(),
      baseDuration,
      resistance,
      adjustedDuration,
      timeBlock: initialBlockId,
      preparation1: preparation1.trim(),
      preparation2: preparation2.trim(),
      preparation3: preparation3.trim(),
      goalId: goalId || null,
    };

    // 1. 먼저 저장 수행
    onSave(taskData);

    // 2. 모달 즉시 닫기 (비동기 저장 대기하지 않음)
    onClose();

    // 2-1. 자동 이모지: 기존 작업 편집 시 비동기 추천을 스케줄
    if (task?.id && settings?.autoEmojiEnabled && settings?.geminiApiKey) {
      scheduleEmojiSuggestion(task.id, taskData.text);
    }

    // 3. AI 작업 세분화 트리거 조건 체크
    const aiTrigger = settings?.aiBreakdownTrigger || 'high_difficulty';
    const shouldTrigger =
      settings?.geminiApiKey &&
      (aiTrigger === 'always' || (aiTrigger === 'high_difficulty' && resistance === 'high'));

    if (shouldTrigger) {
      const tempTask: any = {
        ...taskData,
        id: task?.id || 'temp-id', // 기존 ID 또는 임시 ID
      };

      triggerBreakdown(tempTask, source, settings.geminiApiKey, waifuState?.affection ?? 50);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const baseFieldClasses =
    'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all duration-200 focus:border-[var(--color-primary)] focus:bg-[var(--color-bg-surface)] focus:ring-2 focus:ring-[var(--color-primary)]/20 placeholder:text-[var(--color-text-tertiary)]';
  const selectFieldClasses = `${baseFieldClasses} cursor-pointer appearance-none`;
  const textareaClasses = `${baseFieldClasses} min-h-[80px] max-h-[300px] resize-y cursor-text leading-relaxed`;
  const preparationInputClasses =
    'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all duration-200 focus:border-[var(--color-primary)] focus:bg-[var(--color-bg-surface)] focus:ring-2 focus:ring-[var(--color-primary)]/20';

  return (
    <>
      <div
        className="modal-overlay fixed inset-0 z-[1000] flex items-start justify-center bg-[color:var(--modal-backdrop)] px-4 py-8 backdrop-blur-xl md:items-center"
        onClick={handleOverlayClick}
      >
        <div className="modal-content modal-content-wide relative flex w-full max-w-[900px] flex-col overflow-hidden rounded-3xl border border-[var(--modal-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-[var(--modal-shadow)] animate-in zoom-in-95 duration-200 max-h-[90vh]">

          {/* Header (Fixed) */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]/80 px-8 py-5 backdrop-blur-md">
            <div>
              <h3 className="text-xl font-bold text-[var(--color-text)]">{task ? '작업 수정' : '새 작업 추가'}</h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">작업을 세분화하고 구체적으로 계획해보세요.</p>
            </div>
            <button
              type="button"
              className="group inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]"
              onClick={onClose}
              aria-label="닫기"
            >
              <kbd className="hidden rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-sans text-[var(--color-text-tertiary)] shadow-sm group-hover:text-[var(--color-text-secondary)] sm:inline-block">ESC</kbd>
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto">
            <form
              ref={formRef}
              className="flex flex-col lg:flex-row"
              onSubmit={handleSubmit}
            >
              {/* Left Column: Basic Info */}
              <div className="flex-1 flex flex-col gap-6 p-8 lg:border-r lg:border-[var(--color-border)]">
                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200 animate-in slide-in-from-top-2">
                    <span>⚠️</span>
                    {error}
                  </div>
                )}

                {/* Title Input */}
                <div className="space-y-2">
                  <label htmlFor="task-text" className="text-sm font-semibold text-[var(--color-text)]">
                    작업 제목 <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="task-text"
                      type="text"
                      value={text}
                      onChange={handleTextChange}
                      placeholder="무엇을 할까요? (예: T30 D2 보고서 작성)"
                      autoFocus
                      className={baseFieldClasses}
                    />
                    <button
                      type="button"
                      onClick={handleAutoEmoji}
                      className="shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-xl hover:bg-[var(--color-bg-surface)] transition-colors"
                      title="AI 이모지 추천"
                    >
                      ✨
                    </button>
                  </div>
                </div>

                {/* Duration Selection (Redesigned) */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-[var(--color-text)]">
                    예상 소요 시간
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 30, 45, 60, 90, 120].map(duration => (
                      <button
                        key={duration}
                        type="button"
                        className={`
                          relative flex flex-col items-center justify-center rounded-xl border py-3 transition-all duration-200
                          ${baseDuration === duration
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-lg scale-[1.02] z-10'
                            : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-surface)]'
                          }
                        `}
                        onClick={() => setBaseDuration(duration)}
                      >
                        <span className={`text-sm font-bold ${baseDuration === duration ? 'text-white' : 'text-[var(--color-text)]'}`}>
                          {duration}분
                        </span>
                        {duration >= 60 && (
                          <span className={`text-[10px] ${baseDuration === duration ? 'text-white/80' : 'text-[var(--color-text-tertiary)]'}`}>
                            {duration / 60}시간
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-2 text-xs text-[var(--color-text-tertiary)]">
                    <span>조정된 시간:</span>
                    <span className="font-bold text-[var(--color-primary)]">
                      {calculateAdjustedDuration(baseDuration, resistance)}분
                    </span>
                  </div>
                </div>

                {/* Resistance & Goal */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="task-resistance" className="text-sm font-semibold text-[var(--color-text)]">
                      난이도
                    </label>
                    <select
                      id="task-resistance"
                      value={resistance}
                      onChange={e => setResistance(e.target.value as Resistance)}
                      className={selectFieldClasses}
                    >
                      <option value="low">💧 쉬움 (x1.0)</option>
                      <option value="medium">🌊 보통 (x1.3)</option>
                      <option value="high">🌪️ 어려움 (x1.6)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="task-goal" className="text-sm font-semibold text-[var(--color-text)]">
                      연결된 목표
                    </label>
                    <select
                      id="task-goal"
                      value={goalId || ''}
                      onChange={e => setGoalId(e.target.value || null)}
                      className={selectFieldClasses}
                    >
                      <option value="">목표 없음</option>
                      {goals.map(goal => (
                        <option key={goal.id} value={goal.id}>
                          {goal.icon} {goal.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Memo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="task-memo" className="text-sm font-semibold text-[var(--color-text)]">
                      메모
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowMemoModal(true)}
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      전체 화면 ↗
                    </button>
                  </div>
                  <textarea
                    id="task-memo"
                    value={memo}
                    onChange={handleMemoChange}
                    onDoubleClick={() => setShowMemoModal(true)}
                    placeholder="필요한 링크나 참고사항을 적어두세요."
                    rows={memoRows}
                    className={textareaClasses}
                  />
                  <button
                    type="button"
                    className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50"
                    onClick={handleAIBreakdown}
                    disabled={aiLoading || !text.trim()}
                  >
                    {aiLoading ? '⏳ AI가 분석 중...' : '🧠 AI로 작업 구체화하기'}
                  </button>
                </div>
              </div>

              {/* Right Column: Prep & Waifu */}
              <div className="flex-1 flex flex-col gap-6 p-8 bg-[var(--color-bg-surface)]/30">
                <WaifuCommentary resistance={resistance} duration={baseDuration} affection={waifuState?.affection ?? 50} />

                <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm">
                  <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]">
                    <span className="text-lg">🎒</span>
                    <h4 className="font-semibold text-[var(--color-text)]">작업 준비물 챙기기</h4>
                  </div>

                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <label htmlFor="preparation-1" className="text-xs font-medium text-[var(--color-text-secondary)]">
                        1. 물리적 준비물 (자료, 물 등)
                      </label>
                      <input
                        id="preparation-1"
                        type="text"
                        value={preparation1}
                        onChange={e => setPreparation1(e.target.value)}
                        placeholder="예) 참고 자료 펴두기"
                        className={preparationInputClasses}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="preparation-2" className="text-xs font-medium text-[var(--color-text-secondary)]">
                        2. 환경 세팅 (조명, 음악)
                      </label>
                      <input
                        id="preparation-2"
                        type="text"
                        value={preparation2}
                        onChange={e => setPreparation2(e.target.value)}
                        placeholder="예) 집중 플레이리스트 재생"
                        className={preparationInputClasses}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="preparation-3" className="text-xs font-medium text-[var(--color-text-secondary)]">
                        3. 시작 의식 (심호흡, 스트레칭)
                      </label>
                      <input
                        id="preparation-3"
                        type="text"
                        value={preparation3}
                        onChange={e => setPreparation3(e.target.value)}
                        placeholder="예) 가벼운 스트레칭"
                        className={preparationInputClasses}
                      />
                    </div>
                  </div>

                  {preparation1 && preparation2 && preparation3 && (
                    <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm font-semibold text-emerald-400 animate-bounce-slow">
                      ✨ 완벽해요! 준비가 다 되었네요.
                    </div>
                  )}
                </div>

                {/* Spacer for scrolling content to not be hidden by footer */}
                <div className="h-16 lg:hidden"></div>
              </div>
            </form>
          </div>

          {/* Footer (Fixed) */}
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]/90 px-8 py-4 backdrop-blur-md">
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="button"
              className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => formRef.current?.requestSubmit()}
            >
              <span>{task ? '저장하기' : '추가하기'}</span>
              <div className="flex items-center gap-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                <span>Ctrl</span>
                <span>↵</span>
              </div>
            </button>
          </div>
        </div>

        {showMemoModal && (
          <MemoModal
            memo={memo}
            onSave={(newMemo) => {
              setMemo(newMemo);
              const lineCount = newMemo.split('\n').length;
              setMemoRows(Math.min(Math.max(lineCount, 2), 6));
            }}
            onClose={() => setShowMemoModal(false)}
          />
        )}
      </div>
    </>
  );
}

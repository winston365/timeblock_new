/**
 * @file TaskModal.tsx
 * @role 작업 생성/수정 모달 폼 (AI 지원 태깅 및 이모지 추천 포함)
 * @responsibilities
 *   - 새 작업 생성 및 기존 작업 편집 UI 제공
 *   - AI 기반 이모지 추천 및 작업 세분화 트리거
 *   - 과거 유사 작업 패턴 기반 컨텍스트 추천
 *   - 키보드 단축키 지원 (Ctrl+Enter 저장, ESC 닫기)
 * @dependencies
 *   - useSettingsStore (설정), useTaskBreakdownStore (AI 세분화)
 *   - useTaskContextSuggestion (패턴 추천), suggestTaskEmoji (이모지 AI)
 *   - MemoModal (전체화면 메모 편집)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Task, Resistance, TimeBlockId } from '@/shared/types/domain';
import { calculateAdjustedDuration } from '@/shared/lib/utils';
import { suggestTaskEmoji } from '@/shared/services/ai/geminiApi';
import { scheduleEmojiSuggestion } from '@/shared/services/ai/emojiSuggester';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { MemoModal } from './MemoModal';
import { useTaskBreakdownStore } from '@/features/tasks/stores/breakdownStore';
import { useTaskContextSuggestion } from './hooks/useTaskContextSuggestion';
import { TASK_DEFAULTS } from '@/shared/constants/defaults';
import { useModalHotkeys } from '@/shared/hooks';
import { ModalEscHint } from '@/shared/components/ModalEscHint';

interface TaskModalProps {
  task: Task | null;
  initialBlockId: TimeBlockId;
  onSave: (taskData: Partial<Task>) => void;
  onSaveMultiple?: (tasks: Partial<Task>[]) => void;
  onClose: () => void;
  source?: 'schedule' | 'inbox';
  zIndex?: number; // allow stacking override when opened above other overlays
}

/**
 * Task creation/edit modal with schedule-aware defaults, AI helpers, and context pattern suggestions.
 * @param props.task - 기존 작업 데이터 또는 null
 * @param props.initialBlockId - 초기 타임블록 식별자
 * @param props.onSave - 단일 작업 저장 콜백
 * @param props.onSaveMultiple - 다중 작업 저장 콜백
 * @param props.onClose - 모달 닫기 핸들러
 * @param props.source - 모달 호출 출처 (schedule|inbox)
 * @param props.zIndex - 모달 z-index 오버라이드
 */
export default function TaskModal({
  task,
  initialBlockId,
  onSave,
  onClose,
  source = 'schedule',
  zIndex = 1000,
}: TaskModalProps) {
  const isOpen = !!task;
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [baseDuration, setBaseDuration] = useState<number>(TASK_DEFAULTS.baseDuration);
  const [resistance, setResistance] = useState<Resistance>(TASK_DEFAULTS.resistance);
  const [preparation1, setPreparation1] = useState('');
  const [preparation2, setPreparation2] = useState('');
  const [preparation3, setPreparation3] = useState('');
  const [deadline, setDeadline] = useState<string>(TASK_DEFAULTS.getDefaultDeadline());
  const [error, setError] = useState<string | null>(null);
  const [memoRows, setMemoRows] = useState(2);
  const [showMemoModal, setShowMemoModal] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const { settings } = useSettingsStore();
  const { triggerBreakdown } = useTaskBreakdownStore();

  // ESC + Ctrl/Cmd+Enter 통합 핫키 처리
  const handlePrimaryAction = useCallback(() => {
    formRef.current?.requestSubmit();
  }, []);

  useModalHotkeys({
    isOpen: isOpen && !showMemoModal,
    onEscapeClose: onClose,
    primaryAction: {
      onPrimary: handlePrimaryAction,
    },
  });

  // 맥락 추천 훅 사용
  const {
    contextSuggestion,
    contextLoading,
    appliedFields,
    applyContextDuration,
    applyContextResistance,
    applyContextPreparation,
    applyContextMemo,
    applyAll: applyAllContext,
  } = useTaskContextSuggestion(text);

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
      setDeadline(task.deadline || TASK_DEFAULTS.getDefaultDeadline());

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

  const handleTextChange = (textChangeEvent: React.ChangeEvent<HTMLInputElement>) => {
    const inputText = textChangeEvent.target.value;
    const isSpaceInput = inputText.length > text.length && inputText.endsWith(' ');

    if (isSpaceInput) {
      const parsedText = parseAndApplyTags(inputText);
      setText(parsedText);
    } else {
      setText(inputText);
    }
    if (error) setError(null);
  };

  const handleMemoChange = (memoChangeEvent: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMemo = memoChangeEvent.target.value;
    setMemo(newMemo);
    const lineCount = newMemo.split('\n').length;
    setMemoRows(Math.min(Math.max(lineCount, 2), 6));
  };

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

    // 현재 입력 상태로 임시 Task 객체 생성 (세분화에 필요한 최소 필드만)
    const draftTask = {
      id: task?.id ?? '',
      text: text.trim(),
      memo: memo.trim(),
      baseDuration,
      resistance,
      preparation1: preparation1.trim(),
      preparation2: preparation2.trim(),
      preparation3: preparation3.trim(),
      timeBlock: initialBlockId,
      completed: false,
      createdAt: task?.createdAt ?? new Date().toISOString(),
    } satisfies Partial<Task> & { timeBlock: TimeBlockId };

    triggerBreakdown(draftTask as Task, source, settings.geminiApiKey, 50);
  };

  const handleAutoEmoji = async () => {
    if (!text.trim()) return;
    if (!settings?.geminiApiKey) {
      setError('Gemini API 키가 필요합니다.');
      return;
    }

    try {
      const { emoji, tokenUsage } = await suggestTaskEmoji(text, settings.geminiApiKey, settings.geminiModel);
      const { trackTokenUsage } = await import('@/shared/utils/tokenUtils');
      trackTokenUsage(tokenUsage);
      if (emoji) {
        setText(`${emoji} ${text}`);
      }
    } catch (emojiSuggestionError) {
      console.error(emojiSuggestionError);
    }
  };

  // 훅으로 추출된 맥락 함수들에 현재 상태 바인딩
  const handleApplyDuration = () => applyContextDuration(setBaseDuration);
  const handleApplyResistance = () => applyContextResistance(setResistance);
  const handleApplyPreparation = (item: string) =>
    applyContextPreparation(item, preparation1, preparation2, preparation3, setPreparation1, setPreparation2, setPreparation3);
  const handleApplyMemo = (snippet: string) => applyContextMemo(snippet, memo, setMemo);
  const handleApplyAll = () =>
    applyAllContext(setBaseDuration, setResistance, preparation1, preparation2, preparation3, setPreparation1, setPreparation2, setPreparation3);

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    const trimmedText = text.trim();

    if (!trimmedText) {
      setError('작업 제목을 입력해주세요.');
      document.getElementById('task-text')?.focus();
      return;
    }

    const adjustedDuration = calculateAdjustedDuration(baseDuration, resistance);
    const taskData = {
      text: trimmedText,
      memo: memo.trim(),
      baseDuration,
      resistance,
      adjustedDuration,
      timeBlock: initialBlockId,
      preparation1: preparation1.trim(),
      preparation2: preparation2.trim(),
      preparation3: preparation3.trim(),
      goalId: null,
      deadline,
    };

    // 1. 먼저 저장 수행
    onSave(taskData);

    // 2. 모달 즉시 닫기 (비동기 저장 대기하지 않음)
    onClose();

    // 2-1. 자동 이모지: 기존 작업 편집 시 비동기 추천을 스케줄
    if (task?.id && settings?.autoEmojiEnabled && settings?.geminiApiKey) {
      scheduleEmojiSuggestion(task.id, taskData.text);
    }
  };

  const baseFieldClasses =
    'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all duration-200 focus:border-[var(--color-primary)] focus:bg-[var(--color-bg-surface)] focus:ring-2 focus:ring-[var(--color-primary)]/20 placeholder:text-[var(--color-text-tertiary)]';
  const selectFieldClasses = `${baseFieldClasses} cursor-pointer appearance-none`;
  const textareaClasses = `${baseFieldClasses} min-h-[80px] max-h-[300px] resize-y cursor-text leading-relaxed`;

  return (
    <>
      <div
        className="modal-overlay fixed inset-0 flex items-start justify-center bg-[color:var(--modal-backdrop)] px-4 py-8 backdrop-blur-xl md:items-center"
        style={{ zIndex }}
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
              <ModalEscHint variant="header" />
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

                {/* Resistance & Deadline & Goal */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="task-resistance" className="text-sm font-semibold text-[var(--color-text)]">
                      난이도
                    </label>
                    <select
                      id="task-resistance"
                      value={resistance}
                      onChange={resistanceChangeEvent => setResistance(resistanceChangeEvent.target.value as Resistance)}
                      className={selectFieldClasses}
                    >
                      <option value="low">💧 쉬움 (x1.0)</option>
                      <option value="medium">🌊 보통 (x1.3)</option>
                      <option value="high">🌪️ 어려움 (x1.6)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="task-deadline" className="text-sm font-semibold text-[var(--color-text)]">
                      데드라인
                    </label>
                    <input
                      id="task-deadline"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className={baseFieldClasses}
                    />
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

                  {/* AI 세분화 버튼 */}
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50"
                    onClick={handleAIBreakdown}
                    disabled={!text.trim()}
                  >
                    🧠 AI 세분화
                  </button>
                </div>
              </div>

              {/* Right Column: Context Pattern & Prep */}
              <div className="flex-1 flex flex-col gap-4 p-6 bg-[var(--color-bg-surface)]/30">
                
                {/* 과거 유사 작업 패턴 - 상시 표시 */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📊</span>
                      <span className="text-sm font-medium text-amber-300">과거 유사 작업 패턴</span>
                      {contextLoading && <span className="text-xs text-amber-400 animate-pulse">분석 중...</span>}
                    </div>
                    {contextSuggestion && contextSuggestion.matchCount > 0 && (
                      <button
                        type="button"
                        onClick={handleApplyAll}
                        className="text-xs px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors flex items-center gap-1"
                      >
                        🪄 모두 적용
                      </button>
                    )}
                  </div>
                  
                  {/* 반복 작업 감지 알림 */}
                  {contextSuggestion?.repeatInfo?.isRepeat && (
                    <div className="mb-3 p-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
                      <div className="text-xs text-purple-300 flex items-center gap-1.5">
                        🔁 <strong>반복 작업 감지!</strong> 
                        <span className="text-purple-200/80">
                          {contextSuggestion.repeatInfo.count}회 수행 (최근: {contextSuggestion.repeatInfo.lastDate})
                        </span>
                      </div>
                      <div className="text-[10px] text-purple-400/70 mt-1">
                        💡 이 작업을 템플릿으로 등록하면 더 빠르게 추가할 수 있어요!
                      </div>
                    </div>
                  )}
                  
                  {contextSuggestion && contextSuggestion.matchCount > 0 ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                        {contextSuggestion.preferredTimeBlock && (
                          <span className="text-[var(--color-text-secondary)]">
                            ⏰ {contextSuggestion.preferredTimeBlock.label} ({contextSuggestion.preferredTimeBlock.count}회)
                          </span>
                        )}
                        {contextSuggestion.avgDuration > 0 && (
                          <button
                            type="button"
                            onClick={handleApplyDuration}
                            className="text-[var(--color-text-secondary)] hover:text-amber-400 transition-colors flex items-center gap-1"
                          >
                            ⏱️ 평균 {contextSuggestion.avgDuration}분 
                            {appliedFields.has('duration') 
                              ? <span className="text-emerald-400">✓</span>
                              : <span className="text-amber-400">[적용]</span>
                            }
                          </button>
                        )}
                        {contextSuggestion.commonResistance && (
                          <button
                            type="button"
                            onClick={handleApplyResistance}
                            className="text-[var(--color-text-secondary)] hover:text-amber-400 transition-colors flex items-center gap-1"
                          >
                            💪 {contextSuggestion.commonResistance.label} 
                            {appliedFields.has('resistance') 
                              ? <span className="text-emerald-400">✓</span>
                              : <span className="text-amber-400">[적용]</span>
                            }
                          </button>
                        )}
                        {contextSuggestion.completionRate > 0 && (
                          <span className="text-[var(--color-text-secondary)]">
                            {contextSuggestion.completionRate >= 80 ? '✅' : '📊'} {contextSuggestion.completionRate}% 완료
                          </span>
                        )}
                      </div>
                      
                      {/* 과거 메모 스니펫 */}
                          {contextSuggestion.fullMemos && contextSuggestion.fullMemos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-amber-500/20">
                          <span className="text-xs text-[var(--color-text-tertiary)] mr-1">📝</span>
                          {contextSuggestion.fullMemos.slice(0, 3).map((memoItem, memoIndex) => (
                            <button
                              key={memoIndex}
                              type="button"
                              onClick={() => handleApplyMemo(memoItem.memo)}
                              title={`"${memoItem.memo}" 메모에 추가 (클릭)`}
                              className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:bg-amber-500/20 border border-[var(--color-border)] transition-colors truncate max-w-[120px]"
                            >
                              {memoItem.memo.length > 15 ? memoItem.memo.slice(0, 15) + '...' : memoItem.memo}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* 준비물 추천 */}
                      {contextSuggestion.commonPreparations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-amber-500/20">
                          <span className="text-xs text-[var(--color-text-tertiary)] mr-1">🎒</span>
                          {contextSuggestion.commonPreparations.map((preparationOption, preparationIndex) => (
                            <button
                              key={preparationIndex}
                              type="button"
                              onClick={() => handleApplyPreparation(preparationOption)}
                              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                appliedFields.has(`prep:${preparationOption}`)
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:bg-amber-500/20 border-[var(--color-border)]'
                              }`}
                            >
                              {appliedFields.has(`prep:${preparationOption}`) ? '✓ ' : ''}{preparationOption}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* 유사 작업 미리보기 */}
                      {contextSuggestion.sampleTasks.length > 0 && (
                        <div className="text-[10px] text-[var(--color-text-tertiary)] pt-1">
                          🔍 {contextSuggestion.matchCount}개 유사 작업: {contextSuggestion.sampleTasks.join(' / ')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--color-text-tertiary)]">
                      {text.trim().length < 5 
                        ? '작업 제목을 5자 이상 입력하면 과거 패턴을 분석합니다.'
                        : '유사한 과거 작업을 찾지 못했습니다.'
                      }
                    </div>
                  )}
                </div>

                {/* 준비물 - 간소화된 UI */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">🎒</span>
                    <span className="text-sm font-medium text-[var(--color-text)]">준비물</span>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={preparation1}
                      onChange={preparationOneChangeEvent => setPreparation1(preparationOneChangeEvent.target.value)}
                      placeholder="1. 물리적 준비물"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                    />
                    <input
                      type="text"
                      value={preparation2}
                      onChange={preparationTwoChangeEvent => setPreparation2(preparationTwoChangeEvent.target.value)}
                      placeholder="2. 환경 세팅"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                    />
                    <input
                      type="text"
                      value={preparation3}
                      onChange={preparationThreeChangeEvent => setPreparation3(preparationThreeChangeEvent.target.value)}
                      placeholder="3. 시작 의식"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                  {preparation1 && preparation2 && preparation3 && (
                    <div className="mt-2 text-xs text-center text-emerald-400">
                      ✨ 준비 완료!
                    </div>
                  )}
                </div>

                {/* Spacer */}
                <div className="h-8 lg:hidden"></div>
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

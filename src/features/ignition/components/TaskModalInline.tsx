/**
 * TaskModalInline
 *
 * @role IgnitionOverlay 내부에서 인라인으로 표시되는 작업 수정 컴포넌트
 * @note 기존 TaskModal의 기능을 유지하면서 오버레이 없이 인라인으로 표시됩니다.
 */

import { useState, useEffect, useRef } from 'react';
import type { Task, Resistance, TimeBlockId, DailyGoal } from '@/shared/types/domain';
import { calculateAdjustedDuration } from '@/shared/lib/utils';
import { suggestTaskEmoji } from '@/shared/services/ai/geminiApi';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { loadGlobalGoals } from '@/data/repositories';

interface TaskModalInlineProps {
  task: Task | null;
  initialBlockId: TimeBlockId;
  onSave: (taskData: Partial<Task>) => void;
  onClose: () => void;
}

export default function TaskModalInline({
  task,
  initialBlockId,
  onSave,
  onClose,
}: TaskModalInlineProps) {
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [baseDuration, setBaseDuration] = useState(15);
  const [resistance, setResistance] = useState<Resistance>('low');
  const [preparation1, setPreparation1] = useState('');
  const [preparation2, setPreparation2] = useState('');
  const [preparation3, setPreparation3] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [memoRows, setMemoRows] = useState(2);

  const formRef = useRef<HTMLFormElement>(null);
  const { settings } = useSettingsStore();

  // 목표 목록 로드
  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const loadedGoals = await loadGlobalGoals();
        setGoals(loadedGoals.sort((a, b) => a.order - b.order));
      } catch (error) {
        console.error('[TaskModalInline] Failed to load goals:', error);
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
    const trimmedText = text.trim();

    if (!trimmedText) {
      setError('작업 제목을 입력해주세요.');
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
      goalId: goalId || null,
    };

    onSave(taskData);
  };

  const baseFieldClasses =
    'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-all duration-200 focus:border-amber-500/50 focus:bg-white/10 focus:ring-1 focus:ring-amber-500/30 placeholder:text-white/30';
  const selectFieldClasses = `${baseFieldClasses} cursor-pointer appearance-none`;
  const textareaClasses = `${baseFieldClasses} min-h-[60px] max-h-[150px] resize-y cursor-text leading-relaxed`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          ✏️ 작업 수정
        </h3>
        <button
          type="button"
          className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {/* Form */}
      <form
        ref={formRef}
        className="flex-1 flex flex-col gap-4 py-4 overflow-y-auto custom-scrollbar"
        onSubmit={handleSubmit}
      >
        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
            <span>⚠️</span>
            {error}
          </div>
        )}

        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/70">
            작업 제목
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={handleTextChange}
              placeholder="무엇을 할까요?"
              className={baseFieldClasses}
            />
            <button
              type="button"
              onClick={handleAutoEmoji}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 text-lg hover:bg-white/10 transition-colors"
              title="AI 이모지 추천"
            >
              ✨
            </button>
          </div>
        </div>

        {/* Duration Selection (Compact) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/70">
            예상 소요 시간
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[5, 10, 15, 30, 45, 60, 90, 120].map(duration => (
              <button
                key={duration}
                type="button"
                className={`
                  flex items-center justify-center rounded-lg border py-2 text-xs transition-all duration-200
                  ${baseDuration === duration
                    ? 'border-amber-500 bg-amber-500 text-white shadow-lg'
                    : 'border-white/10 bg-white/5 text-white/60 hover:border-amber-500/50 hover:bg-white/10'
                  }
                `}
                onClick={() => setBaseDuration(duration)}
              >
                {duration}분
              </button>
            ))}
          </div>
          <div className="text-xs text-white/40 text-right">
            조정된 시간: <span className="text-amber-400 font-medium">{calculateAdjustedDuration(baseDuration, resistance)}분</span>
          </div>
        </div>

        {/* Resistance & Goal */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70">난이도</label>
            <select
              value={resistance}
              onChange={e => setResistance(e.target.value as Resistance)}
              className={selectFieldClasses}
            >
              <option value="low">💧 쉬움</option>
              <option value="medium">🌊 보통</option>
              <option value="high">🌪️ 어려움</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70">연결된 목표</label>
            <select
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

        {/* Memo (Compact) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/70">메모</label>
          <textarea
            value={memo}
            onChange={handleMemoChange}
            placeholder="필요한 링크나 참고사항"
            rows={memoRows}
            className={textareaClasses}
          />
        </div>

        {/* Preparations (Compact) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
            🎒 준비물
          </label>
          <div className="space-y-1.5">
            <input
              type="text"
              value={preparation1}
              onChange={e => setPreparation1(e.target.value)}
              placeholder="1. 물리적 준비물"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50"
            />
            <input
              type="text"
              value={preparation2}
              onChange={e => setPreparation2(e.target.value)}
              placeholder="2. 환경 세팅"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50"
            />
            <input
              type="text"
              value={preparation3}
              onChange={e => setPreparation3(e.target.value)}
              placeholder="3. 시작 의식"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </form>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
        <button
          type="button"
          className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 transition-colors"
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="button"
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-sm font-bold text-white shadow-lg hover:shadow-orange-500/25 transition-all"
          onClick={() => formRef.current?.requestSubmit()}
        >
          저장
        </button>
      </div>
    </div>
  );
}

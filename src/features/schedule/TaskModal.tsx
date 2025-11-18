/**
 * TaskModal
 *
 * @role 작업 추가/수정을 위한 모달 폼 컴포넌트. 제목, 메모, 예상 시간, 난이도 입력 제공
 * @input task (수정할 작업 또는 null), initialBlockId (초기 블록 ID), onSave (저장 핸들러), onClose (닫기 핸들러)
 * @output 작업 입력 폼 모달
 * @external_dependencies
 *   - utils: 조정된 시간 계산 함수
 */

import { useState, useEffect, useRef } from 'react';
import type { Task, Resistance, TimeBlockId, DailyGoal } from '@/shared/types/domain';
import { calculateAdjustedDuration } from '@/shared/lib/utils';
import { generateTaskBreakdown } from '@/shared/services/geminiApi';
import { useWaifuState } from '@/shared/hooks';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { loadDailyGoals } from '@/data/repositories/dailyGoalRepository';
import { MemoModal } from './MemoModal';

interface TaskModalProps {
  task: Task | null;
  initialBlockId: TimeBlockId;
  onSave: (taskData: Partial<Task>) => void;
  onClose: () => void;
}

/**
 * 작업 추가/수정 모달
 *
 * @param {TaskModalProps} props - 컴포넌트 props
 * @returns {JSX.Element} 모달 폼
 * @sideEffects
 *   - 작업 저장 시 onSave 콜백 호출
 *   - ESC 키로 모달 닫기
 */
export default function TaskModal({ task, initialBlockId, onSave, onClose }: TaskModalProps) {
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [baseDuration, setBaseDuration] = useState(15);  // 30분 -> 15분으로 변경
  const [resistance, setResistance] = useState<Resistance>('low');
  const [preparation1, setPreparation1] = useState('');
  const [preparation2, setPreparation2] = useState('');
  const [preparation3, setPreparation3] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [memoRows, setMemoRows] = useState(2); // 자동 높이 조절용
  const [showMemoModal, setShowMemoModal] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const { waifuState } = useWaifuState();
  const { settings } = useSettingsStore();
  const { currentDate } = useDailyDataStore();

  // 목표 목록 로드
  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const loadedGoals = await loadDailyGoals(currentDate);
        setGoals(loadedGoals.sort((a, b) => a.order - b.order));
      } catch (error) {
        console.error('[TaskModal] Failed to load goals:', error);
      }
    };
    fetchGoals();
  }, [currentDate]);

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

      // 메모 줄 수 계산
      const lineCount = task.memo.split('\n').length;
      setMemoRows(Math.min(Math.max(lineCount, 2), 6));
    }
  }, [task]);

  // 자동 태그 파싱 함수 (스페이스 입력 시에만 실행)
  const parseAndApplyTags = (inputText: string) => {
    let updatedText = inputText;
    let hasChanges = false;

    // 시간 태그 감지 및 적용 (T5, T10, T15, T30, T60, T90)
    const timeTagMatch = inputText.match(/\b(T5|T10|T15|T30|T60|T90)\b/i);
    if (timeTagMatch) {
      const timeTag = timeTagMatch[1].toUpperCase();
      const durationMap: { [key: string]: number } = {
        'T5': 5,
        'T10': 10,
        'T15': 15,
        'T30': 30,
        'T60': 60,
        'T90': 90,
      };
      const duration = durationMap[timeTag];
      if (duration !== undefined) {
        setBaseDuration(duration);
        // 태그 제거
        updatedText = updatedText.replace(/\b(T5|T10|T15|T30|T60|T90)\b/gi, '');
        hasChanges = true;
      }
    }

    // 난이도 태그 감지 및 적용 (D1, D2, D3)
    const difficultyTagMatch = inputText.match(/\b(D1|D2|D3)\b/i);
    if (difficultyTagMatch) {
      const difficultyTag = difficultyTagMatch[1].toUpperCase();
      const difficultyMap: { [key: string]: Resistance } = {
        'D1': 'low',
        'D2': 'medium',
        'D3': 'high',
      };
      const difficulty = difficultyMap[difficultyTag];
      if (difficulty !== undefined) {
        setResistance(difficulty);
        // 태그 제거
        updatedText = updatedText.replace(/\b(D1|D2|D3)\b/gi, '');
        hasChanges = true;
      }
    }

    // 태그가 제거된 경우에만 공백 정리
    if (hasChanges) {
      updatedText = updatedText.replace(/\s+/g, ' ').trim();
    }

    return updatedText;
  };

  // 텍스트 변경 핸들러 (스페이스 입력 시 태그 파싱)
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputText = e.target.value;

    // 스페이스를 입력했는지 확인 (마지막 문자가 스페이스)
    const isSpaceInput = inputText.length > text.length && inputText.endsWith(' ');

    if (isSpaceInput) {
      // 스페이스 입력 시 태그 파싱
      const parsedText = parseAndApplyTags(inputText);
      setText(parsedText);
    } else {
      // 일반 입력은 그대로 저장
      setText(inputText);
    }
  };

  // 메모 변경 핸들러 (자동 높이 조절)
  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMemo = e.target.value;
    setMemo(newMemo);

    // 줄 수 계산 (최소 2줄, 최대 6줄)
    const lineCount = newMemo.split('\n').length;
    setMemoRows(Math.min(Math.max(lineCount, 2), 6));
  };

  // ESC 키로 모달 닫기, Ctrl+Enter로 저장
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // 메모 모달이 열려 있으면 부모 모달의 키보드 이벤트 무시
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

  const handleAIBreakdown = async () => {
    if (!text.trim()) {
      alert('작업 제목을 먼저 입력해주세요.');
      return;
    }

    if (!settings?.geminiApiKey) {
      alert('Gemini API 키가 설정되지 않았습니다.\n우측 하단 ⚙️ 설정에서 API 키를 추가해주세요.');
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const breakdown = await generateTaskBreakdown(
        {
          taskText: text.trim(),
          memo: memo.trim(),
          baseDuration,
          resistance,
          preparation1: preparation1.trim(),
          preparation2: preparation2.trim(),
          preparation3: preparation3.trim(),
          affection: waifuState?.affection ?? 50,
        },
        settings.geminiApiKey
      );

      const newMemo = memo.trim()
        ? `${memo.trim()}\n\n--- AI 세분화 ---\n${breakdown}`
        : breakdown;

      setMemo(newMemo);

      const lineCount = newMemo.split('\n').length;
      setMemoRows(Math.min(Math.max(lineCount, 2), 6));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'AI 세분화에 실패했습니다.';
      setAiError(errorMessage);
      console.error('AI 세분화 오류:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      alert('작업 제목을 입력해주세요.');
      return;
    }

    const adjustedDuration = calculateAdjustedDuration(baseDuration, resistance);

    onSave({
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
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleMemoDoubleClick = () => {
    setShowMemoModal(true);
  };

  const handleMemoModalSave = (newMemo: string) => {
    setMemo(newMemo);
    const lineCount = newMemo.split('\n').length;
    setMemoRows(Math.min(Math.max(lineCount, 2), 6));
  };

  const handleMemoModalClose = () => {
    setShowMemoModal(false);
  };

  const memoLineCount = memo.split('\n').length;
  const baseFieldClasses =
    'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20';
  const selectFieldClasses = `${baseFieldClasses} cursor-pointer appearance-none`;
  const textareaClasses = `${baseFieldClasses} min-h-[48px] max-h-[300px] resize-y cursor-text leading-relaxed`;
  const preparationInputClasses =
    'w-full rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-[var(--color-bg-surface)] focus:ring-4 focus:ring-[var(--color-primary)]/20';

  return (
    <div
      className="modal-overlay fixed inset-0 z-[1000] flex items-start justify-center bg-[color:var(--modal-backdrop)] px-4 py-8 backdrop-blur-xl md:items-center"
      onClick={handleOverlayClick}
    >
      <div className="modal-content modal-content-wide relative w-full max-w-[800px] overflow-hidden rounded-2xl border border-[var(--modal-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-[var(--modal-shadow)]">
        <div className="modal-header flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-4">
          <h3 className="text-xl font-semibold text-[var(--color-text)]">{task ? '작업 수정' : '새 작업 추가'}</h3>
          <button
            type="button"
            className="modal-close-btn inline-flex h-10 w-10 items-center justify-center rounded-lg text-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/60"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <form
          ref={formRef}
          className="grid grid-cols-1 gap-8 overflow-y-auto px-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-6 border-b border-[var(--color-border)] pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">
            <div className="space-y-2">
              <label htmlFor="task-text" className="text-sm font-semibold text-[var(--color-text)]">
                작업 제목 *
              </label>
              <input
                id="task-text"
                type="text"
                value={text}
                onChange={handleTextChange}
                placeholder="무엇을 할까요? (예: T30 D2 보고서 작성)"
                autoFocus
                required
                className={baseFieldClasses}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="task-memo" className="text-sm font-semibold text-[var(--color-text)]">
                  메모
                </label>
                {memoLineCount > 6 && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">{memoLineCount}줄 (6줄 초과)</span>
                )}
              </div>
              <textarea
                id="task-memo"
                value={memo}
                onChange={handleMemoChange}
                onDoubleClick={handleMemoDoubleClick}
                placeholder="추가 메모 (선택 사항) - 더블클릭하면 전체창이 열립니다."
                rows={memoRows}
                className={textareaClasses}
                title="더블클릭하면 전체창에서 편집할 수 있어요"
              />
              <button
                type="button"
                className="btn-ai-breakdown inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 via-indigo-500/90 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleAIBreakdown}
                disabled={aiLoading || !text.trim()}
              >
                {aiLoading ? '🤖 AI 작업중...' : '🧠 AI로 작업 분해받기'}
              </button>
              {aiError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-[var(--color-danger)]">오류: {aiError}</div>
              )}
            </div>

            <div className="space-y-3">
              <label htmlFor="task-duration" className="text-sm font-semibold text-[var(--color-text)]">
                기본 시간
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[5, 10, 15, 30, 45, 60, 90, 120].map(duration => (
                  <button
                    key={duration}
                    type="button"
                    className={`inline-flex items-center justify-center rounded-md border border-[var(--color-border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 ${
                      baseDuration === duration
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[0_6px_16px_rgba(79,70,229,0.35)]'
                        : 'hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]'
                    }`}
                    onClick={() => setBaseDuration(duration)}
                  >
                    {duration < 60 ? `${duration}분` : duration === 60 ? '1시간' : duration === 90 ? '1시간 30분' : '2시간'}
                  </button>
                ))}
              </div>
            </div>

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
                <option value="low">낮음 (x1.0)</option>
                <option value="medium">보통 (x1.3)</option>
                <option value="high">매우 어려움 (x1.6)</option>
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
                    {goal.icon ? `${goal.icon} ` : ''}{goal.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-4 py-3 text-center text-sm text-[var(--color-text-secondary)]">
              조정된 예상 시간:{' '}
              <strong className="font-semibold text-[var(--color-primary)]">
                {calculateAdjustedDuration(baseDuration, resistance)}분
              </strong>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:pl-6">
            <div className="flex h-full flex-col gap-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 shadow-sm">
              <div className="rounded-lg border-l-4 border-[var(--color-primary)] bg-gradient-to-r from-[rgba(99,102,241,0.1)] to-[rgba(168,85,247,0.1)] p-4">
                <h4 className="text-lg font-semibold text-[var(--color-text)]">미리 작업 준비하기</h4>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  필요한 준비물을 체크하고 워밍업을 끝내면
                  <br />
                  작업 성공률이 크게 올라가요!
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="preparation-1" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                  현재 상태를 돕는 준비물 #1
                </label>
                <input
                  id="preparation-1"
                  type="text"
                  value={preparation1}
                  onChange={e => setPreparation1(e.target.value)}
                  placeholder="예) 책상 정리, 필요한 자료 꺼내기..."
                  className={preparationInputClasses}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="preparation-2" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                  현재 상태를 돕는 준비물 #2
                </label>
                <input
                  id="preparation-2"
                  type="text"
                  value={preparation2}
                  onChange={e => setPreparation2(e.target.value)}
                  placeholder="예) 물 마시기, 간단한 스트레칭..."
                  className={preparationInputClasses}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="preparation-3" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                  실행을 돕는 루틴 / 의식
                </label>
                <input
                  id="preparation-3"
                  type="text"
                  value={preparation3}
                  onChange={e => setPreparation3(e.target.value)}
                  placeholder="예) 타이머 켜기, 집중 음악 틀기..."
                  className={preparationInputClasses}
                />
              </div>

              {preparation1 && preparation2 && preparation3 && (
                <div className="mt-auto rounded-xl border-2 border-[var(--color-success)] bg-gradient-to-r from-[rgba(16,185,129,0.2)] to-[rgba(5,150,105,0.2)] p-4 text-center text-sm font-semibold text-[var(--color-success)] shadow-[0_2px_8px_rgba(16,185,129,0.2)]">
                  모든 준비가 완료된 작업이에요!
                </div>
              )}
            </div>
          </div>

          <div className="col-span-full mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border)] pt-6">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-transparent bg-[var(--color-bg-tertiary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/70"
            >
              {task ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>

      {showMemoModal && (
        <MemoModal
          memo={memo}
          onSave={handleMemoModalSave}
          onClose={handleMemoModalClose}
        />
      )}
    </div>
  );
}

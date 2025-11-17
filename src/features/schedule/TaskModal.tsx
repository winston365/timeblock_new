/**
 * TaskModal
 *
 * @role 작업 추가/수정을 위한 모달 폼 컴포넌트. 제목, 메모, 예상 시간, 난이도 입력 제공
 * @input task (수정할 작업 또는 null), initialBlockId (초기 블록 ID), onSave (저장 핸들러), onClose (닫기 핸들러)
 * @output 작업 입력 폼 모달
 * @external_dependencies
 *   - utils: 조정된 시간 계산 함수
 */

import { useState, useEffect } from 'react';
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
        // 폼 제출 트리거
        const form = document.querySelector('.modal-form') as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [onClose, showMemoModal]);

  /**
   * AI 작업 세분화 핸들러
   */
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

      // 기존 메모가 있으면 줄바꿈 추가
      const newMemo = memo.trim()
        ? `${memo.trim()}\n\n--- AI 세분화 ---\n${breakdown}`
        : breakdown;

      setMemo(newMemo);

      // 메모 줄 수 자동 조절
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

  // 메모 모달 핸들러
  const handleMemoDoubleClick = () => {
    setShowMemoModal(true);
  };

  const handleMemoModalSave = (newMemo: string) => {
    setMemo(newMemo);
    // 줄 수 자동 조절
    const lineCount = newMemo.split('\n').length;
    setMemoRows(Math.min(Math.max(lineCount, 2), 6));
  };

  const handleMemoModalClose = () => {
    setShowMemoModal(false);
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content modal-content-wide">
        <div className="modal-header">
          <h3>{task ? '작업 수정' : '새 작업 추가'}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="modal-form modal-form-two-column" onSubmit={handleSubmit}>
          {/* 왼쪽 컬럼: 기존 작업 정보 */}
          <div className="form-column form-column-left">
            <div className="form-group">
              <label htmlFor="task-text">작업 제목 *</label>
              <input
                id="task-text"
                type="text"
                value={text}
                onChange={handleTextChange}
                placeholder="무엇을 할까요? (예: T30 D2 보고서 작성)"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="task-memo">메모</label>
                {memo.split('\n').length > 6 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                    {memo.split('\n').length}줄 (6줄 초과)
                  </span>
                )}
              </div>
              <textarea
                id="task-memo"
                value={memo}
                onChange={handleMemoChange}
                onDoubleClick={handleMemoDoubleClick}
                placeholder="추가 메모 (선택사항) - 더블클릭하면 큰 창으로 편집"
                rows={memoRows}
                style={{
                  resize: 'vertical',
                  minHeight: '48px',
                  maxHeight: '300px',
                  cursor: 'text'
                }}
                title="더블클릭하면 큰 창에서 편집할 수 있습니다"
              />
              {/* AI 세분화 버튼 */}
              <button
                type="button"
                className="btn-ai-breakdown"
                onClick={handleAIBreakdown}
                disabled={aiLoading || !text.trim()}
                style={{
                  marginTop: 'var(--spacing-2)',
                  padding: '8px 12px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: aiLoading || !text.trim() ? 'not-allowed' : 'pointer',
                  opacity: aiLoading || !text.trim() ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {aiLoading ? '⏳ AI 세분화 중...' : '✨ AI로 세분화하기'}
              </button>
              {aiError && (
                <div
                  style={{
                    marginTop: 'var(--spacing-2)',
                    padding: 'var(--spacing-2)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    color: 'var(--color-danger)',
                  }}
                >
                  ⚠️ {aiError}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="task-duration">예상 시간</label>
              <div className="duration-buttons">
                {[5, 10, 15, 30, 45, 60, 90, 120].map(duration => (
                  <button
                    key={duration}
                    type="button"
                    className={`duration-btn ${baseDuration === duration ? 'active' : ''}`}
                    onClick={() => setBaseDuration(duration)}
                  >
                    {duration < 60 ? `${duration}분` : duration === 60 ? '1시간' : duration === 90 ? '1시간 30분' : '2시간'}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="task-resistance">난이도</label>
              <select
                id="task-resistance"
                value={resistance}
                onChange={e => setResistance(e.target.value as Resistance)}
              >
                <option value="low">🟢 쉬움 (x1.0)</option>
                <option value="medium">🟡 보통 (x1.3)</option>
                <option value="high">🔴 어려움 (x1.6)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="task-goal">연결된 목표</label>
              <select
                id="task-goal"
                value={goalId || ''}
                onChange={e => setGoalId(e.target.value || null)}
              >
                <option value="">목표 없음</option>
                {goals.map(goal => (
                  <option key={goal.id} value={goal.id}>
                    {goal.icon ? `${goal.icon} ` : ''}{goal.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="adjusted-duration-info">
              조정된 예상 시간: <strong>{calculateAdjustedDuration(baseDuration, resistance)}분</strong>
            </div>
          </div>

          {/* 오른쪽 컬럼: 준비 사항 입력 */}
          <div className="form-column form-column-right">
            <div className="preparation-section">
              <div className="preparation-header">
                <h4 className="preparation-title">💡 작업 준비하기</h4>
                <p className="preparation-description">
                  방해물을 예상하고 대처 환경을 준비하면<br />
                  작업 성공률이 높아집니다
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="preparation-1" className="preparation-label">
                  ⚠️ 예상되는 방해물 #1
                </label>
                <input
                  id="preparation-1"
                  type="text"
                  value={preparation1}
                  onChange={e => setPreparation1(e.target.value)}
                  placeholder="예: 스마트폰 알림, 배고픔, 피로..."
                  className="preparation-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="preparation-2" className="preparation-label">
                  ⚠️ 예상되는 방해물 #2
                </label>
                <input
                  id="preparation-2"
                  type="text"
                  value={preparation2}
                  onChange={e => setPreparation2(e.target.value)}
                  placeholder="예: 불편한 자세, 소음, 다른 업무..."
                  className="preparation-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="preparation-3" className="preparation-label">
                  ✅ 대처 환경/전략
                </label>
                <input
                  id="preparation-3"
                  type="text"
                  value={preparation3}
                  onChange={e => setPreparation3(e.target.value)}
                  placeholder="예: 집중 모드 켜기, 간식 준비, 휴식 계획..."
                  className="preparation-input"
                />
              </div>

              {preparation1 && preparation2 && preparation3 && (
                <div className="preparation-complete-badge">
                  ⭐ 완벽하게 준비된 작업입니다!
                </div>
              )}
            </div>
          </div>

          {/* 하단 액션 버튼 (전체 너비) */}
          <div className="modal-actions modal-actions-full">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn-primary">
              {task ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>

      {/* 메모 전용 모달 */}
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

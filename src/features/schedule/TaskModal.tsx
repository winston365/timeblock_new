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
import type { Task, Resistance, TimeBlockId } from '@/shared/types/domain';
import { calculateAdjustedDuration } from '@/shared/lib/utils';
import { generateTaskBreakdown } from '@/shared/services/geminiApi';
import { useWaifuState } from '@/shared/hooks';
import { useSettingsStore } from '@/shared/stores/settingsStore';

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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const { waifuState } = useWaifuState();
  const { settings } = useSettingsStore();

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

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]" onClick={handleOverlayClick}>
      <div className="bg-bg-surface rounded-lg shadow-xl max-w-[900px] w-[90vw] max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-lg border-b border-border">
          <h3 className="text-lg font-bold text-text">{task ? '작업 수정' : '새 작업 추가'}</h3>
          <button className="text-2xl text-text-tertiary hover:text-text transition-colors bg-transparent border-none cursor-pointer" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-lg p-lg" onSubmit={handleSubmit}>
          {/* 왼쪽 컬럼: 기존 작업 정보 */}
          <div className="flex flex-col gap-md">
            <div className="flex flex-col gap-xs">
              <label htmlFor="task-text" className="text-sm font-medium text-text-secondary">작업 제목 *</label>
              <input
                id="task-text"
                type="text"
                value={text}
                onChange={handleTextChange}
                placeholder="무엇을 할까요? (예: T30 D2 보고서 작성)"
                autoFocus
                required
                className="px-md py-sm border border-border rounded-md bg-bg-base text-text text-sm transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>

            <div className="flex flex-col gap-xs">
              <label htmlFor="task-memo" className="text-sm font-medium text-text-secondary">메모</label>
              <textarea
                id="task-memo"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="추가 메모 (선택사항)"
                rows={2}
                className="px-md py-sm border border-border rounded-md bg-bg-base text-text text-sm resize-y transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              {/* AI 세분화 버튼 */}
              <button
                type="button"
                onClick={handleAIBreakdown}
                disabled={aiLoading || !text.trim()}
                className={`
                  mt-sm px-md py-sm rounded-md text-sm font-semibold border-none transition-all
                  flex items-center justify-center gap-xs
                  ${aiLoading || !text.trim() ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'}
                `}
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
              >
                {aiLoading ? '⏳ AI 세분화 중...' : '✨ AI로 세분화하기'}
              </button>
              {aiError && (
                <div className="mt-sm p-sm bg-danger/10 border border-danger/30 rounded text-xs text-danger">
                  ⚠️ {aiError}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-xs">
              <label htmlFor="task-duration" className="text-sm font-medium text-text-secondary">예상 시간</label>
              <div className="grid grid-cols-4 gap-xs">
                {[5, 10, 15, 30, 45, 60, 90, 120].map(duration => (
                  <button
                    key={duration}
                    type="button"
                    className={`
                      px-sm py-sm border rounded-md text-xs font-medium transition-all
                      ${baseDuration === duration
                        ? 'bg-primary text-white border-primary'
                        : 'bg-bg-base text-text border-border hover:border-primary hover:bg-bg-elevated'}
                    `}
                    onClick={() => setBaseDuration(duration)}
                  >
                    {duration < 60 ? `${duration}분` : duration === 60 ? '1시간' : duration === 90 ? '1시간 30분' : '2시간'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-xs">
              <label htmlFor="task-resistance" className="text-sm font-medium text-text-secondary">난이도</label>
              <select
                id="task-resistance"
                value={resistance}
                onChange={e => setResistance(e.target.value as Resistance)}
                className="px-md py-sm border border-border rounded-md bg-bg-base text-text text-sm cursor-pointer transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                <option value="low">🟢 쉬움 (x1.0)</option>
                <option value="medium">🟡 보통 (x1.3)</option>
                <option value="high">🔴 어려움 (x1.6)</option>
              </select>
            </div>

            <div className="px-md py-sm bg-bg-elevated border border-border rounded-md text-sm text-text-secondary">
              조정된 예상 시간: <strong className="text-primary">{calculateAdjustedDuration(baseDuration, resistance)}분</strong>
            </div>
          </div>

          {/* 오른쪽 컬럼: 준비 사항 입력 */}
          <div className="flex flex-col gap-md">
            <div className="flex flex-col gap-sm p-md bg-bg-elevated/50 border border-border rounded-lg">
              <div className="flex flex-col gap-xs mb-sm">
                <h4 className="text-base font-semibold text-text">💡 작업 준비하기</h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  방해물을 예상하고 대처 환경을 준비하면<br />
                  작업 성공률이 높아집니다
                </p>
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="preparation-1" className="text-sm font-medium text-text-secondary">
                  ⚠️ 예상되는 방해물 #1
                </label>
                <input
                  id="preparation-1"
                  type="text"
                  value={preparation1}
                  onChange={e => setPreparation1(e.target.value)}
                  placeholder="예: 스마트폰 알림, 배고픔, 피로..."
                  className="px-md py-sm border border-border rounded-md bg-bg-base text-text text-sm transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="preparation-2" className="text-sm font-medium text-text-secondary">
                  ⚠️ 예상되는 방해물 #2
                </label>
                <input
                  id="preparation-2"
                  type="text"
                  value={preparation2}
                  onChange={e => setPreparation2(e.target.value)}
                  placeholder="예: 불편한 자세, 소음, 다른 업무..."
                  className="px-md py-sm border border-border rounded-md bg-bg-base text-text text-sm transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="preparation-3" className="text-sm font-medium text-text-secondary">
                  ✅ 대처 환경/전략
                </label>
                <input
                  id="preparation-3"
                  type="text"
                  value={preparation3}
                  onChange={e => setPreparation3(e.target.value)}
                  placeholder="예: 집중 모드 켜기, 간식 준비, 휴식 계획..."
                  className="px-md py-sm border border-border rounded-md bg-bg-base text-text text-sm transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              {preparation1 && preparation2 && preparation3 && (
                <div className="mt-sm px-md py-sm bg-reward/20 text-reward rounded-md text-sm font-semibold text-center">
                  ⭐ 완벽하게 준비된 작업입니다!
                </div>
              )}
            </div>
          </div>

          {/* 하단 액션 버튼 (전체 너비) */}
          <div className="col-span-full flex justify-end gap-sm pt-md border-t border-border">
            <button
              type="button"
              className="px-lg py-sm border border-border rounded-md text-sm font-medium bg-bg-base text-text transition-all hover:bg-bg-elevated"
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-lg py-sm bg-primary text-white rounded-md text-sm font-medium transition-all hover:bg-primary-dark hover:-translate-y-px hover:shadow-md"
            >
              {task ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

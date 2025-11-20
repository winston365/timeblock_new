/**
 * QuickAddTask
 *
 * @role 글로벌 단축키로 호출되는 빠른 작업 추가 컴포넌트
 * @input 없음 (독립 실행)
 * @output 작업 추가 폼 및 인박스 저장
 * @external_dependencies
 *   - inboxRepository: 인박스 작업 추가
 *   - electronAPI: 윈도우 닫기, 알림 표시
 */

import { useState, useEffect } from 'react';
import type { Task, Resistance } from '@/shared/types/domain';
import { calculateAdjustedDuration, generateId } from '@/shared/lib/utils';
import { useInboxStore } from '@/shared/stores/inboxStore';
import { initializeDatabase } from '@/data/db/dexieClient';

/**
 * 글로벌 단축키용 빠른 작업 추가 컴포넌트
 *
 * @returns {JSX.Element} 빠른 작업 추가 폼
 * @sideEffects
 *   - 작업 저장 시 인박스에 추가
 *   - 저장 완료 시 데스크탑 알림
 *   - 저장 완료 시 윈도우 닫기
 */
export default function QuickAddTask() {
  const { addTask } = useInboxStore();
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [baseDuration, setBaseDuration] = useState(15);
  const [resistance, setResistance] = useState<Resistance>('low');
  const [preparation1, setPreparation1] = useState('');
  const [preparation2, setPreparation2] = useState('');
  const [preparation3, setPreparation3] = useState('');
  const [saving, setSaving] = useState(false);
  const [memoRows, setMemoRows] = useState(3);
  const [dbInitialized, setDbInitialized] = useState(false);

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

    // 스페이스를 입력했는지 확인
    const isSpaceInput = inputText.length > text.length && inputText.endsWith(' ');

    if (isSpaceInput) {
      const parsedText = parseAndApplyTags(inputText);
      setText(parsedText);
    } else {
      setText(inputText);
    }
  };

  // 메모 변경 핸들러 (자동 높이 조절)
  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMemo = e.target.value;
    setMemo(newMemo);

    // 줄 수 계산 (최소 3줄, 최대 10줄)
    const lineCount = newMemo.split('\n').length;
    setMemoRows(Math.min(Math.max(lineCount, 3), 10));
  };

  // 데이터베이스 초기화
  useEffect(() => {
    let mounted = true;

    const initDB = async () => {
      try {
        console.log('[QuickAdd] Initializing database...');
        await initializeDatabase();
        if (mounted) {
          console.log('[QuickAdd] Database initialized successfully');
          setDbInitialized(true);
        }
      } catch (error) {
        console.error('[QuickAdd] Failed to initialize database:', error);
        if (mounted) {
          alert('데이터베이스 초기화에 실패했습니다.\n\n앱을 다시 시작해주세요.');
        }
      }
    };

    initDB();

    return () => {
      mounted = false;
    };
  }, []);

  // Ctrl+Enter로 저장, ESC로 닫기
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        const form = document.querySelector('.quickadd-form') as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      alert('작업 제목을 입력해주세요.');
      return;
    }

    if (!dbInitialized) {
      alert('데이터베이스가 아직 준비되지 않았습니다.\n\n잠시 후 다시 시도해주세요.');
      return;
    }

    setSaving(true);

    try {
      const adjustedDuration = calculateAdjustedDuration(baseDuration, resistance);

      const newTask: Task = {
        id: generateId('task'),
        text: text.trim(),
        memo: memo.trim(),
        baseDuration,
        resistance,
        adjustedDuration,
        timeBlock: null, // 인박스는 항상 null
        completed: false,
        actualDuration: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        preparation1: preparation1.trim() || undefined,
        preparation2: preparation2.trim() || undefined,
        preparation3: preparation3.trim() || undefined,
        timerUsed: false,
        goalId: null,
      };

      // 작업 저장
      await addTask(newTask);
      console.log('✅ Task added successfully:', newTask.text);

      // 데스크탑 알림 (Electron API 사용)
      if (window.electronAPI) {
        try {
          await window.electronAPI.showNotification(
            '✅ 작업 추가 완료',
            `"${text.trim()}" 작업이 인박스에 추가되었습니다.`
          );
        } catch (notifError) {
          console.warn('Notification failed:', notifError);
        }
      }

      // 저장 완료 상태로 변경
      setSaving(false);

      // 윈도우 닫기 (Electron API 사용)
      if (window.electronAPI) {
        setTimeout(async () => {
          if (window.electronAPI) {
            await window.electronAPI.closeQuickAddWindow();
          }
        }, 300); // 0.3초 후 닫기 (저장 완료 확인)
      }
    } catch (error) {
      console.error('❌ Failed to add task:', error);
      alert(`작업 추가에 실패했습니다.\n\n오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeQuickAddWindow();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur">
      <div className="flex h-[min(95vh,760px)] w-full max-w-[960px] flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-[0_35px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h3 className="text-xl font-semibold text-[var(--color-text)]">⚡ 빠른 작업 추가</h3>
          <button
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-lg font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-white)]"
            onClick={handleClose}
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <form
          className="grid flex-1 gap-6 overflow-hidden px-6 py-5 lg:grid-cols-[1fr_1fr]"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-5 overflow-y-auto pr-1 lg:pr-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--color-text-secondary)]" htmlFor="task-text">
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
                className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-[var(--color-text-secondary)]" htmlFor="task-memo">
                  메모
                </label>
                {memo.split('\n').length > 10 && (
                  <span className="text-[0.65rem] text-[var(--color-text-tertiary)]">
                    {memo.split('\n').length}줄 (10줄 초과)
                  </span>
                )}
              </div>
              <textarea
                id="task-memo"
                value={memo}
                onChange={handleMemoChange}
                placeholder="추가 메모 (선택사항)"
                rows={memoRows}
                className="min-h-[120px] max-h-[220px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30 resize-none"
              />
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-[var(--color-text-secondary)]">
                예상 시간
              </label>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 30, 45, 60, 90, 120].map(duration => (
                  <button
                    key={duration}
                    type="button"
                    className={`rounded-2xl border px-3 py-1 text-xs font-semibold transition ${baseDuration === duration
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-lg'
                      : 'border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]'
                      }`}
                    onClick={() => setBaseDuration(duration)}
                  >
                    {duration < 60
                      ? `${duration}분`
                      : duration === 60
                        ? '1시간'
                        : duration === 90
                          ? '1시간 30분'
                          : '2시간'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--color-text-secondary)]" htmlFor="task-resistance">
                난이도
              </label>
              <select
                id="task-resistance"
                value={resistance}
                onChange={e => setResistance(e.target.value as Resistance)}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
              >
                <option value="low">🟢 쉬움 (x1.0)</option>
                <option value="medium">🟡 보통 (x1.3)</option>
                <option value="high">🔴 어려움 (x1.6)</option>
              </select>
            </div>

            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-secondary)]">
              조정된 예상 시간: <strong className="text-[var(--color-text)]">{calculateAdjustedDuration(baseDuration, resistance)}분</strong>
            </div>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto pl-1 lg:pl-3">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold tracking-[0.3em] text-[var(--color-text-secondary)]">💡 작업 준비하기</h4>
                <p className="text-[0.65rem] text-[var(--color-text-tertiary)]">환경을 정리하고 방해 요소 대비</p>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {[
                  { id: 'preparation-1', label: '⚠️ 예상되는 방해물 #1', value: preparation1, setter: setPreparation1, placeholder: '예: 스마트폰 알림, 배고픔, 피로...' },
                  { id: 'preparation-2', label: '⚠️ 예상되는 방해물 #2', value: preparation2, setter: setPreparation2, placeholder: '예: 불편한 자세, 소음, 다른 업무...' },
                  { id: 'preparation-3', label: '✅ 대처 환경/전략', value: preparation3, setter: setPreparation3, placeholder: '예: 집중 모드 켜기, 간식 준비, 휴식 계획...' },
                ].map(field => (
                  <label key={field.id} className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                    <span>{field.label}</span>
                    <input
                      id={field.id}
                      type="text"
                      value={field.value}
                      onChange={e => field.setter(e.target.value)}
                      placeholder={field.placeholder}
                      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                    />
                  </label>
                ))}
              </div>

              {preparation1 && preparation2 && preparation3 && (
                <div className="mt-4 rounded-2xl border border-emerald-500 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">
                  ⭐ 완벽하게 준비된 작업입니다!
                </div>
              )}
            </div>
          </div>

          <div className="col-span-full flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <button
              type="button"
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
              onClick={handleClose}
              disabled={saving}
            >
              취소
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
            >
              {saving ? '저장 중...' : '추가'}
            </button>
          </div>
        </form>

        <div className="border-t border-[var(--color-border)] px-6 py-3 text-center text-xs text-[var(--color-text-tertiary)]">
          💡 <strong className="text-[var(--color-text)]">팁:</strong> T30, D2와 같은 태그로 빠르게 설정 | ESC: 취소, Ctrl+Enter: 저장
        </div>
      </div>
    </div>
  );
}

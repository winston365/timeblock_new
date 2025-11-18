/**
 * BulkAddModal
 *
 * @role 여러 작업을 한 번에 추가할 수 있는 대량 추가 모달 컴포넌트 (F1 단축키로 열기)
 * @input isOpen (boolean), onClose (function), onAddTasks (function)
 * @output 텍스트 입력 영역, 기본 설정 옵션, 파싱된 작업 미리보기, 추가 버튼을 포함한 모달 UI
 * @external_dependencies
 *   - TIME_BLOCKS, RESISTANCE_MULTIPLIERS: 도메인 타입 및 상수
 */

import { useState, useRef, useEffect } from 'react';
import type { Task, TimeBlockId, Resistance } from '@/shared/types/domain';
import { TIME_BLOCKS, RESISTANCE_MULTIPLIERS } from '@/shared/types/domain';
import { generateId } from '@/shared/lib/utils';

interface BulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTasks: (tasks: Task[]) => Promise<void>;
}

interface ParsedTask {
  text: string;
  memo?: string;
  baseDuration?: number;
  resistance?: Resistance;
  timeBlock?: TimeBlockId;
}

/**
 * 대량 할 일 추가 모달 컴포넌트
 * 한 줄에 하나씩 작업을 입력하면 자동으로 파싱하여 여러 작업을 한 번에 추가할 수 있습니다.
 *
 * @param {BulkAddModalProps} props - isOpen, onClose, onAddTasks를 포함하는 props
 * @returns {JSX.Element | null} 모달 UI (isOpen이 false면 null)
 * @sideEffects
 *   - ESC 키로 모달 닫기
 *   - Ctrl/Cmd + Enter로 작업 추가
 *   - 입력값 변경 시 실시간 미리보기 업데이트
 */
export default function BulkAddModal({ isOpen, onClose, onAddTasks }: BulkAddModalProps) {
  const [input, setInput] = useState('');
  const [defaultTimeBlock, setDefaultTimeBlock] = useState<TimeBlockId>(null);
  const [defaultResistance, setDefaultResistance] = useState<Resistance>('low');
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [previewTasks, setPreviewTasks] = useState<ParsedTask[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 모달 열릴 때 textarea에 포커스
  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
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

  // 입력값 변경 시 미리보기 업데이트
  useEffect(() => {
    if (input.trim()) {
      const parsed = parseInput(input);
      setPreviewTasks(parsed);
    } else {
      setPreviewTasks([]);
    }
  }, [input, defaultTimeBlock, defaultResistance, defaultDuration]);

  /**
   * 입력 텍스트 파싱
   * 각 줄을 하나의 작업으로 변환
   *
   * 포맷:
   * - 기본: "작업 제목"
   * - 메모 포함: "작업 제목 | 메모"
   * - 시간 포함: "작업 제목 [30m]" 또는 "작업 제목 [1h]"
   * - 저항도 포함: "작업 제목 🟢" 또는 "작업 제목 🟡" 또는 "작업 제목 🔴"
   * - 블록 지정: "작업 제목 @8-11" (블록 ID)
   * - 복합: "작업 제목 [45m] 🟡 @11-14 | 메모"
   */
  function parseInput(text: string): ParsedTask[] {
    const lines = text.split('\n').filter((line) => line.trim());
    const tasks: ParsedTask[] = [];

    for (const line of lines) {
      let remainingText = line.trim();
      const task: ParsedTask = {
        text: '',
        resistance: defaultResistance,
        baseDuration: defaultDuration,
        timeBlock: defaultTimeBlock,
      };

      // 메모 추출 (| 뒤의 내용)
      const memoMatch = remainingText.match(/\|(.+)$/);
      if (memoMatch) {
        task.memo = memoMatch[1].trim();
        remainingText = remainingText.replace(/\|.+$/, '').trim();
      }

      // 블록 ID 추출 (@블록ID)
      const blockMatch = remainingText.match(/@(\d+-\d+)/);
      if (blockMatch) {
        const blockId = blockMatch[1];
        if (TIME_BLOCKS.some((b) => b.id === blockId)) {
          task.timeBlock = blockId as TimeBlockId;
        }
        remainingText = remainingText.replace(/@\d+-\d+/, '').trim();
      }

      // 저항도 추출 (이모지)
      if (remainingText.includes('🟢')) {
        task.resistance = 'low';
        remainingText = remainingText.replace('🟢', '').trim();
      } else if (remainingText.includes('🟡')) {
        task.resistance = 'medium';
        remainingText = remainingText.replace('🟡', '').trim();
      } else if (remainingText.includes('🔴')) {
        task.resistance = 'high';
        remainingText = remainingText.replace('🔴', '').trim();
      }

      // 시간 추출 ([30m] 또는 [1h] 또는 [1h30m])
      const timeMatch = remainingText.match(/\[(\d+(?:\.\d+)?)(h|m)\]/);
      if (timeMatch) {
        const value = parseFloat(timeMatch[1]);
        const unit = timeMatch[2];
        task.baseDuration = unit === 'h' ? value * 60 : value;
        remainingText = remainingText.replace(/\[\d+(?:\.\d+)?(h|m)\]/, '').trim();
      }

      // 남은 텍스트가 작업 제목
      task.text = remainingText || '(제목 없음)';

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * 작업 추가
   */
  const handleSubmit = async () => {
    if (previewTasks.length === 0) {
      alert('추가할 작업이 없습니다.');
      return;
    }

    setLoading(true);

    try {
      // ParsedTask를 Task로 변환
      const tasks: Task[] = previewTasks.map((parsed) => {
        const resistance = parsed.resistance || defaultResistance;
        const baseDuration = parsed.baseDuration || defaultDuration;
        const multiplier = RESISTANCE_MULTIPLIERS[resistance];
        const adjustedDuration = Math.round(baseDuration * multiplier);

        return {
          id: generateId('task'),
          text: parsed.text,
          memo: parsed.memo || '',
          baseDuration,
          resistance,
          adjustedDuration,
          timeBlock: parsed.timeBlock || defaultTimeBlock,
          completed: false,
          actualDuration: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
        };
      });

      await onAddTasks(tasks);

      // 초기화
      setInput('');
      setPreviewTasks([]);
      onClose();

      alert(`${tasks.length}개의 작업이 추가되었습니다!`);
    } catch (error) {
      console.error('Failed to add tasks:', error);
      alert('작업 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter로 제출
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-[800px] max-w-[95vw] max-h-[90vh] flex-col rounded-xl border border-border bg-surface shadow-xl md:rounded-xl md:h-auto h-full w-full md:w-[800px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">📝 대량 할 일 추가</h2>
            <p className="mt-1 text-sm text-text-secondary">한 줄에 하나씩 작업을 입력하세요</p>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 설정 */}
        <div className="flex flex-wrap gap-4 border-b border-border bg-bg-secondary px-6 py-4 md:flex-row flex-col">
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-sm font-medium text-text-secondary">기본 블록:</label>
            <select
              className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary transition-all hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              value={defaultTimeBlock || ''}
              onChange={(e) => setDefaultTimeBlock((e.target.value || null) as TimeBlockId)}
            >
              <option value="">인박스</option>
              {TIME_BLOCKS.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-sm font-medium text-text-secondary">기본 저항도:</label>
            <select
              className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary transition-all hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              value={defaultResistance}
              onChange={(e) => setDefaultResistance(e.target.value as Resistance)}
            >
              <option value="low">🟢 쉬움</option>
              <option value="medium">🟡 보통</option>
              <option value="high">🔴 어려움</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-sm font-medium text-text-secondary">기본 시간:</label>
            <select
              className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary transition-all hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(Number(e.target.value))}
            >
              <option value="15">15분</option>
              <option value="30">30분</option>
              <option value="45">45분</option>
              <option value="60">1시간</option>
              <option value="90">1.5시간</option>
              <option value="120">2시간</option>
            </select>
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="flex flex-1 flex-col overflow-hidden p-6">
          <textarea
            ref={textareaRef}
            className="h-full min-h-[300px] w-full resize-y rounded-lg border border-border bg-surface p-4 font-mono text-sm leading-relaxed text-text-primary transition-all placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 md:min-h-[200px]"
            placeholder={`작업을 한 줄에 하나씩 입력하세요.

예시:
코딩 공부 [2h] 🔴 @8-11 | React 복습
이메일 확인 [15m] 🟢
회의 준비 [45m] 🟡 @14-17
장보기

특수 문법:
[30m] 또는 [1h] - 시간 지정
🟢 🟡 🔴 - 저항도 (쉬움/보통/어려움)
@8-11 - 블록 지정
| 메모 - 메모 추가`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={12}
          />
        </div>

        {/* 미리보기 */}
        {previewTasks.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto border-t border-border bg-bg-secondary p-6 md:max-h-[200px]">
            <h3 className="mb-4 text-base font-semibold text-text-primary">미리보기 ({previewTasks.length}개)</h3>
            <div className="flex flex-col gap-2">
              {previewTasks.map((task, index) => (
                <div
                  key={index}
                  className="flex gap-2 rounded-md border border-border bg-surface p-2 transition-all hover:shadow-sm"
                >
                  <span className="min-w-[24px] text-xs font-semibold text-text-tertiary">{index + 1}.</span>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="text-sm font-medium text-text-primary">{task.text}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${task.resistance === 'low'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : task.resistance === 'medium'
                              ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}
                      >
                        {task.resistance === 'low' ? '🟢' : task.resistance === 'medium' ? '🟡' : '🔴'}
                      </span>
                      <span>⏱️ {task.baseDuration}분</span>
                      {task.timeBlock && (
                        <span>📍 {TIME_BLOCKS.find((b) => b.id === task.timeBlock)?.label}</span>
                      )}
                      {task.memo && (
                        <span className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap italic text-text-tertiary">
                          📝 {task.memo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 안내 */}
        <div className="border-t border-border bg-bg-secondary px-6 py-2 text-center">
          <small className="text-xs text-text-tertiary">
            💡 Tip: Ctrl/Cmd + Enter로 빠르게 추가할 수 있습니다.
          </small>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2 border-t border-border p-6">
          <button
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            취소
          </button>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading || previewTasks.length === 0}
          >
            {loading ? '추가 중...' : `${previewTasks.length}개 추가`}
          </button>
        </div>
      </div>
    </div>
  );
}

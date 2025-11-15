/**
 * BulkAddModal
 *
 * @role 여러 작업을 한 번에 추가할 수 있는 대량 추가 모달 컴포넌트 (F1 단축키로 열기)
 * @input isOpen (boolean), onClose (function), onAddTasks (function)
 * @output 텍스트 입력 영역, 기본 설정 옵션, 파싱된 작업 미리보기, 추가 버튼을 포함한 모달 UI
 * @external_dependencies
 *   - TIME_BLOCKS, RESISTANCE_MULTIPLIERS: 도메인 타입 및 상수
 *   - bulkAdd.css: 스타일시트
 */

import { useState, useRef, useEffect } from 'react';
import type { Task, TimeBlockId, Resistance } from '@/shared/types/domain';
import { TIME_BLOCKS, RESISTANCE_MULTIPLIERS } from '@/shared/types/domain';
import './bulkAdd.css';

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
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bulk-add-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <div>
            <h2>📝 대량 할 일 추가</h2>
            <p className="modal-subtitle">한 줄에 하나씩 작업을 입력하세요</p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {/* 설정 */}
        <div className="bulk-add-settings">
          <div className="setting-item">
            <label>기본 블록:</label>
            <select
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

          <div className="setting-item">
            <label>기본 저항도:</label>
            <select
              value={defaultResistance}
              onChange={(e) => setDefaultResistance(e.target.value as Resistance)}
            >
              <option value="low">🟢 쉬움</option>
              <option value="medium">🟡 보통</option>
              <option value="high">🔴 어려움</option>
            </select>
          </div>

          <div className="setting-item">
            <label>기본 시간:</label>
            <select
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
        <div className="bulk-add-input-container">
          <textarea
            ref={textareaRef}
            className="bulk-add-textarea"
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
          <div className="bulk-add-preview">
            <h3>미리보기 ({previewTasks.length}개)</h3>
            <div className="preview-list">
              {previewTasks.map((task, index) => (
                <div key={index} className="preview-item">
                  <span className="preview-number">{index + 1}.</span>
                  <div className="preview-content">
                    <div className="preview-title">{task.text}</div>
                    <div className="preview-meta">
                      <span className={`resistance-badge ${task.resistance}`}>
                        {task.resistance === 'low' ? '🟢' : task.resistance === 'medium' ? '🟡' : '🔴'}
                      </span>
                      <span>⏱️ {task.baseDuration}분</span>
                      {task.timeBlock && (
                        <span>📍 {TIME_BLOCKS.find((b) => b.id === task.timeBlock)?.label}</span>
                      )}
                      {task.memo && <span className="preview-memo">📝 {task.memo}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 안내 */}
        <div className="bulk-add-footer">
          <small>
            💡 Tip: Ctrl/Cmd + Enter로 빠르게 추가할 수 있습니다.
          </small>
        </div>

        {/* 버튼 */}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            취소
          </button>
          <button
            className="btn-primary"
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
